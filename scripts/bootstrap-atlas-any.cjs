// scripts/bootstrap-atlas-any.js
// Bootstraps a full "atlas" for your repo WITHOUT knowing any entry path.
// - Detects source roots (src/app/lib or whole project with exclusions)
// - Installs tools (madge, dependency-cruiser, documentation, jsdoc-to-markdown, vitest, c8, glob)
// - Writes helper scripts & npm scripts
// - Generates global graphs, candidate entry graphs, and plain-English maps
// - ALSO adds: RULES_CATALOG.md + RULES_FLOW.md (Mermaid) generators
//
// Usage:
//   node scripts/bootstrap-atlas-any.js            # writes files & npm scripts
//   node scripts/bootstrap-atlas-any.js --install  # also installs dev deps
//
// After that:
//   npm run docs:all
//   npm run map:all

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// === Destination for all generated artifacts ===
const DOCS_DIR = 'atlas-docs';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, 'utf8');
  console.log('✓ wrote', p);
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log('✓ updated', p);
}

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error(
    'No package.json found. Run "npm init -y" first in your project root.'
  );
  process.exit(1);
}

// --- detect source roots ---
const candidateRoots = ['src', 'app', 'lib'];
let roots = candidateRoots.filter(
  (d) =>
    fs.existsSync(path.join(root, d)) &&
    fs.statSync(path.join(root, d)).isDirectory()
);
if (roots.length === 0) {
  // Fall back to project root but exclude common build folders
  roots = ['.'];
  console.warn(
    '! No src/app/lib folders found. Will analyze the whole project with exclusions.'
  );
}

const atlasConfig = {
  roots,
  exclude:
    '(node_modules|^\\.git$|^dist$|^build$|^coverage$|^' +
    DOCS_DIR.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') +
    '$|^public$|^scripts$|^\\.next$|^out$)',
};
writeJSON('scripts/atlas.config.json', atlasConfig);

// --- update package.json scripts ---
const pkg = readJSON(pkgPath);
pkg.scripts ||= {};
Object.assign(pkg.scripts, {
  'docs:deps': 'node scripts/generate-deps.js',
  'docs:candidates': 'node scripts/detect-validators.js',
  'docs:api':
    'documentation build "**/*.{js,ts,jsx,tsx}" -f md -o ' +
    DOCS_DIR +
    '/api.md --shallow --ignore "**/node_modules/**"',
  'docs:map': 'node scripts/generate-plain-map.js',
});
/** Extras we’re adding */
pkg.scripts['docs:rules'] = 'node scripts/generate-rules-catalog.js';
pkg.scripts['docs:mermaid'] = 'node scripts/generate-mermaid.js';

/** docs:all — extend if present; otherwise create a good default (including extras) */
const MUSTS = [
  'docs:deps',
  'docs:api',
  'docs:map',
  'docs:candidates',
  'docs:rules',
  'docs:mermaid',
];
if (pkg.scripts['docs:all']) {
  for (const s of MUSTS) {
    if (!pkg.scripts['docs:all'].includes(s)) {
      pkg.scripts['docs:all'] += ` && npm run ${s}`;
    }
  }
} else {
  pkg.scripts['docs:all'] = MUSTS.map((s) => `npm run ${s}`).join(' && ');
}

/** map scripts (unchanged) */
Object.assign(pkg.scripts, {
  'map:dups': 'node scripts/find-duplicates.js',
  'map:suggest': 'node scripts/suggest-buckets.js',
  'map:all': 'npm run map:dups && npm run map:suggest',
});

writeJSON(pkgPath, pkg);

// --- helper scripts ---

// 1) generate-deps.js: global graphs & dep reports for each root + merged
writeFile(
  'scripts/generate-deps.js',
  `
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = '${DOCS_DIR}';
const cfg = JSON.parse(fs.readFileSync('scripts/atlas.config.json','utf8'));
fs.mkdirSync(DOCS_DIR, { recursive: true });

function run(cmd) { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit' }); }

let merged = { modules: [] };

cfg.roots.forEach((rt, idx) => {
  const safe = rt.replace(/\\W+/g,'_') || 'project';
  // Global picture (SVG if possible, else DOT)
  try {
    run(\`npx madge \${rt} --extensions js,ts,jsx,tsx --exclude \${JSON.stringify(cfg.exclude)} --image \${DOCS_DIR}/all-graph-\${safe}.svg\`);
  } catch {
    run(\`npx madge \${rt} --extensions js,ts,jsx,tsx --exclude \${JSON.stringify(cfg.exclude)} --dot \${DOCS_DIR}/all-graph-\${safe}.dot\`);
  }
  // Dependency-cruiser text + json
  run(\`npx depcruise \${rt} --exclude \${JSON.stringify(cfg.exclude)} -T text > \${DOCS_DIR}/all-deps-\${safe}.txt\`);
  run(\`npx depcruise \${rt} --exclude \${JSON.stringify(cfg.exclude)} -T json > \${DOCS_DIR}/all-deps-\${safe}.json\`);

  const part = JSON.parse(fs.readFileSync(\`\${DOCS_DIR}/all-deps-\${safe}.json\`, 'utf8'));
  merged.modules.push(...(part.modules || []));
});

// De-duplicate merged modules by source
const bySrc = new Map();
for (const m of merged.modules) {
  bySrc.set(m.source, m);
}
merged.modules = [...bySrc.values()];
fs.writeFileSync(\`\${DOCS_DIR}/all-deps.json\`, JSON.stringify(merged, null, 2));
console.log('✓ wrote ' + DOCS_DIR + '/all-deps.json');

// Also write a combined text file
let allTxt = '';
cfg.roots.forEach(rt => {
  const safe = rt.replace(/\\W+/g,'_') || 'project';
  allTxt += fs.readFileSync(\`\${DOCS_DIR}/all-deps-\${safe}.txt\`, 'utf8') + "\\n";
});
fs.writeFileSync(\`\${DOCS_DIR}/all-deps.txt\`, allTxt);
console.log('✓ wrote ' + DOCS_DIR + '/all-deps.txt');

// Generate a single combined SVG (best effort)
try {
  run(\`npx madge \${cfg.roots.join(' ')} --extensions js,ts,jsx,tsx --exclude \${JSON.stringify(cfg.exclude)} --image \${DOCS_DIR}/all-graph.svg\`);
} catch {
  run(\`npx madge \${cfg.roots.join(' ')} --extensions js,ts,jsx,tsx --exclude \${JSON.stringify(cfg.exclude)} --dot \${DOCS_DIR}/all-graph.dot\`);
  console.warn('Graphviz might be missing; generated DOT instead of SVG.');
}
`
);

// 2) detect-validators.js: find likely validator entries & make focused graphs
writeFile(
  'scripts/detect-validators.js',
  `
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

const DOCS_DIR='${DOCS_DIR}';
const cfg = JSON.parse(fs.readFileSync('scripts/atlas.config.json','utf8'));
fs.mkdirSync(DOCS_DIR, { recursive: true });

function run(cmd) { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit' }); }

// Gather candidates by filename pattern or exported symbol
const patterns = /(trade.*validator|validator.*trade|TradeValidator)\\.(js|ts|jsx|tsx)$/i;
let files = [];
cfg.roots.forEach(rt => {
  files.push(...glob.sync(path.join(rt, '**/*.{js,ts,jsx,tsx}')));
});

const candidates = new Set();

// 1) Name-based hits
for (const f of files) {
  if (patterns.test(f)) candidates.add(f);
}

// 2) Content-based hits (export function validateTrade / default validateTrade)
for (const f of files) {
  try {
    const src = fs.readFileSync(f, 'utf8');
    if (/export\\s+function\\s+validateTrade\\s*\\(/.test(src)) candidates.add(f);
    if (/export\\s+default\\s+function\\s+validateTrade\\s*\\(/.test(src)) candidates.add(f);
    if (/export\\s+\\{\\s*validateTrade\\s*\\}/.test(src)) candidates.add(f);
    if (/module\\.exports\\s*=\\s*validateTrade/.test(src)) candidates.add(f);
  } catch {}
}

// Cap to top 5 by 'importance' (files with many dependents)
let depJson = {};
try { depJson = JSON.parse(fs.readFileSync(\`\${DOCS_DIR}/all-deps.json\`,'utf8')); } catch {}
const dependentCount = {};
(depJson.modules||[]).forEach(m => {
  (m.dependencies||[]).forEach(d => {
    dependentCount[d.resolved] = (dependentCount[d.resolved] || 0) + 1;
  });
});
const ranked = [...candidates].map(f => ({
  file: f,
  score: dependentCount[path.resolve(f)] || 0
})).sort((a,b)=> b.score - a.score).slice(0,5);

let md = '# Candidate Validators\\n\\n';
if (ranked.length === 0) {
  md += 'No obvious trade validator entry files found. You can still use the global maps in this folder.\\n';
  fs.writeFileSync(\`\${DOCS_DIR}/candidates.md\`, md);
  console.log('✓ wrote ' + DOCS_DIR + '/candidates.md');
  process.exit(0);
}

for (const { file, score } of ranked) {
  const base = path.basename(file).replace(/\\W+/g,'_');
  md += \`- \\\`\${file}\\\` (dependents: \${score})\\n\`;
  try {
    run(\`npx madge \${file} --extensions js,ts,jsx,tsx --image \${DOCS_DIR}/candidate-\${base}.svg\`);
  } catch {
    run(\`npx madge \${file} --extensions js,ts,jsx,tsx --dot \${DOCS_DIR}/candidate-\${base}.dot\`);
  }
  run(\`npx depcruise \${file} -T text > \${DOCS_DIR}/candidate-\${base}.txt\`);
}
fs.writeFileSync(\`\${DOCS_DIR}/candidates.md\`, md);
console.log('✓ wrote ' + DOCS_DIR + '/candidates.md');
`
);

// 3) generate-plain-map.js: plain-English catalog for ALL roots
writeFile(
  'scripts/generate-plain-map.js',
  `
const fs=require('fs'); const path=require('path'); const glob=require('glob');
const DOCS_DIR='${DOCS_DIR}';
const cfg = JSON.parse(fs.readFileSync('scripts/atlas.config.json','utf8'));
const roots = cfg.roots;

function listFiles(root) {
  return glob.sync(path.join(root,'**/*.{js,jsx,ts,tsx}'), {
    nodir:true,
    ignore:['**/node_modules/**','**/dist/**','**/build/**','**/coverage/**','**/' + DOCS_DIR + '/**','**/.next/**','**/out/**','**/public/**','**/scripts/**']
  });
}

function classify(p){
  const base=path.basename(p).toLowerCase();
  if(base.includes('.test.')||base.includes('.spec.'))return'test';
  if(/(stepien|pick|draft|swap|protection)/i.test(p))return'rule:picks';
  if(/(salary|apron|tax|exception|tpe|bird|cap)/i.test(p))return'rule:salary';
  if(/(roster|two[-_ ]?way|min|max.*roster|slot)/i.test(p))return'rule:roster';
  if(/(util|helper|calc|math|format|parse|group|sum)/i.test(p))return'utils';
  if(/(const|threshold|table|mapping|teams?|players?|config|data)/i.test(p))return'data';
  if(/validator/i.test(p))return'validator';
  return'other';
}
function topComment(src){
  const t=src.trimStart();
  const m=t.match(/^\\/\\*\\*([\\s\\S]*?)\\*\\//);
  if(m)return m[1].replace(/\\* ?/g,'').trim();
  const lines=t.match(/^(\\/\\/.*\\n)+/);
  if(lines)return lines[0].replace(/^\\/\\/ ?/gm,'').trim();
  return'';
}
function importsList(src){
  const imps=[]; const re=/import\\s+(?:.+?\\s+from\\s+)?['"]([^'"]+)['"];?/g; let m;
  while((m=re.exec(src))){ const s=m[1]; if(!s.startsWith('.'))continue; imps.push(s); if(imps.length>=5)break; }
  return imps;
}

const groups=new Map();
for (const rt of roots) {
  for (const file of listFiles(rt)) {
    const src=fs.readFileSync(file,'utf8');
    const kind=classify(file);
    const comment=topComment(src);
    const imps=importsList(src);
    const dir=path.dirname(file);
    if(!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push({file, kind, comment, imps});
  }
}

let md='# Plain-English Map (whole project)\\n\\n';
md+='> Auto-generated from file names + top-of-file comments.\\n\\n';
[...groups.keys()].sort().forEach(dir=>{
  md+=\`## \\\`\${dir}\\\`\\n\\n\`;
  const order={'validator':0,'rule:salary':1,'rule:picks':2,'rule:roster':3,'test':4,'utils':5,'data':6,'other':7};
  groups.get(dir).sort((a,b)=> (order[a.kind]-order[b.kind]) || a.file.localeCompare(b.file))
    .forEach(({file,kind,comment,imps})=>{
      const nice=kind.replace('rule:','rule / ');
      md+=\`- **\${path.basename(file)}** — _\${nice}_\\n\`;
      if(comment) md+=\`  - \${comment}\\n\`;
      if(imps.length) md+=\`  - imports: \${imps.join(', ')}\\n\`;
    });
  md+='\\n';
});
fs.mkdirSync(DOCS_DIR,{recursive:true});
fs.writeFileSync(\`\${DOCS_DIR}/PLAIN_MAP.md\`, md);
console.log('✓ wrote ' + DOCS_DIR + '/PLAIN_MAP.md');
`
);

// 4) find-duplicates.js: identical file groups
writeFile(
  'scripts/find-duplicates.js',
  `
const fs=require('fs'), crypto=require('crypto'); const glob=require('glob');
const DOCS_DIR='${DOCS_DIR}';
const files=glob.sync('**/*.{js,ts,jsx,tsx}',{nodir:true, ignore:['**/node_modules/**','**/dist/**','**/build/**','**/coverage/**','**/' + DOCS_DIR + '/**']});
const groups={};
for(const f of files){
  const src=fs.readFileSync(f,'utf8').replace(/\\s+/g,'');
  const hash=crypto.createHash('sha1').update(src).digest('hex');
  (groups[hash]=groups[hash]||[]).push(f);
}
let out=''; Object.values(groups).filter(g=>g.length>1).forEach(g=>{ out += '\\nDUPLICATE GROUP:\\n'+g.join('\\n')+'\\n'; });
if(!out) out='No exact duplicate files found.';
console.log(out);
fs.mkdirSync(DOCS_DIR,{recursive:true}); fs.writeFileSync(\`\${DOCS_DIR}/duplicates.txt\`, out);
console.log('✓ wrote ' + DOCS_DIR + '/duplicates.txt');
`
);

// 5) suggest-buckets.js: use dep-cruiser JSON to suggest buckets + priority
writeFile(
  'scripts/suggest-buckets.js',
  `
const fs=require('fs'), path=require('path');
const DOCS_DIR='${DOCS_DIR}';
if(!fs.existsSync(\`\${DOCS_DIR}/all-deps.json\`)) {
  console.error('Missing ' + DOCS_DIR + '/all-deps.json. Run: npm run docs:deps'); process.exit(1);
}
const data=JSON.parse(fs.readFileSync(\`\${DOCS_DIR}/all-deps.json\`,'utf8'));
const BUCKETS=[
  {name:'rules/salary', rx:/(salary|apron|tax|exception|tpe|bird|cap)/i},
  {name:'rules/picks',  rx:/(pick|stepien|draft|swap|protection)/i},
  {name:'rules/roster', rx:/(roster|two[-_ ]?way|min|max.*roster|slot)/i},
  {name:'data',         rx:/(const|threshold|table|mapping|teams?|players?|config|data)/i},
  {name:'utils',        rx:/(util|helper|calc|math|format|parse|group|sum)/i},
];
function bucketFor(f){
  const base=path.basename(f);
  const dir=path.dirname(f);
  for(const b of BUCKETS) if(b.rx.test(base)) return b.name;
  for(const b of BUCKETS) if(b.rx.test(dir)) return b.name;
  if(/validator/i.test(base)) return 'validator';
  return 'rules/misc';
}
// Build dependent counts (in-degree)
const dependents = {};
for (const m of (data.modules||[])) {
  for (const d of (m.dependencies||[])) {
    dependents[d.resolved] = (dependents[d.resolved] || 0) + 1;
  }
}
function priority(file) {
  const n = dependents[file] || 0;
  if (n >= 10) return 'CORE';
  if (n >= 3)  return 'WARM';
  return 'LEAF';
}
const rows = (data.modules||[])
  .filter(m => m.source && !/node_modules/.test(m.source))
  .map(m => {
    const file = path.relative(process.cwd(), m.source);
    return { priority: priority(m.source), suggested: bucketFor(file), file };
  })
  .sort((a,b)=> (a.priority>b.priority?-1:a.priority<b.priority?1:0) || a.suggested.localeCompare(b.suggested) || a.file.localeCompare(b.file));

fs.writeFileSync('bucket-plan.csv', 'priority,suggested,file\\n' + rows.map(r => \`\${r.priority},\${r.suggested},\${r.file}\`).join('\\n'));
console.log('✓ wrote bucket-plan.csv');
`
);

// 6) README inside atlas-docs (includes extras bullets)
const readmeContent = `# Project Atlas (auto-generated)

Artifacts you can browse _without changing any code_:

- **all-graph.svg** — global import graph (whole project)
- **all-deps.txt / all-deps.json** — human/JSON import reports
- **PLAIN_MAP.md** — plain-English folder/file catalog (from top-of-file comments + heuristics)
- **api.md** — docs extracted from JSDoc/TS comments (if present)
- **candidates.md** — likely validator entry files + focused graphs
- **duplicates.txt** — exact duplicate files
- **bucket-plan.csv** — suggested destinations (rules/utils/data) with CORE/WARM/LEAF priority
- **RULES_CATALOG.md** — grouped, plain-English list of rule files
- **RULES_FLOW.md** — Mermaid diagram of Validator → Rules → Utils/Data

## Generate / Refresh
\`\`\`bash
npm run docs:all
npm run map:all
\`\`\`
`;
writeFile(`${DOCS_DIR}/README.md`, readmeContent);

// --- EXTRAS: RULES_CATALOG + MERMAID FLOW ---

// helper: same ignore list used elsewhere
const IGNORE = `['**/node_modules/**','**/dist/**','**/build/**','**/coverage/**','**/${DOCS_DIR}/**','**/.next/**','**/out/**','**/public/**','**/scripts/**']`;

// generate-rules-catalog.js
writeFile(
  'scripts/generate-rules-catalog.js',
  `
const fs=require('fs'); const path=require('path'); const glob=require('glob');

const DOCS_DIR='${DOCS_DIR}';
const cfgPath='scripts/atlas.config.json';
const roots = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath,'utf8')).roots : ['src'];

function listFiles(root){
  return glob.sync(path.join(root,'**/*.{js,jsx,ts,tsx}'),{nodir:true, ignore:${IGNORE}});
}
function classify(p){
  if(/(stepien|pick|draft|swap|protection)/i.test(p))return{bucket:'picks',kind:'rule'};
  if(/(salary|apron|tax|exception|tpe|bird|cap)/i.test(p))return{bucket:'salary',kind:'rule'};
  if(/(roster|two[-_ ]?way|min|max.*roster|slot)/i.test(p))return{bucket:'roster',kind:'rule'};
  return null;
}
function topComment(src){
  const t=src.trimStart();
  const m=t.match(/^\\/\\*\\*([\\s\\S]*?)\\*\\//);
  if(m)return m[1].replace(/\\* ?/g,'').trim();
  const lines=t.match(/^(\\/\\/.*\\n)+/);
  if(lines)return lines[0].replace(/^\\/\\/ ?/gm,'').trim();
  return'';
}
function guessDesc(p){
  if(/stepien/i.test(p)) return 'Blocks trading away first-rounders in consecutive future years (Stepien).';
  if(/salary|matching/i.test(p)) return 'Checks CBA salary matching bands and related constraints.';
  if(/apron|tax/i.test(p)) return 'Enforces apron/tax thresholds and triggered restrictions.';
  if(/exception|tpe/i.test(p)) return 'Trade exceptions (creation/consumption) and aggregation rules.';
  if(/roster|two[-_ ]?way/i.test(p)) return 'Roster size and two-way slot limits before/after trade.';
  return 'Trade rule check.';
}

const groups={salary:[],picks:[],roster:[],misc:[]};

for(const rt of roots){
  for(const file of listFiles(rt)){
    const src=fs.readFileSync(file,'utf8');
    const cls=classify(file);
    if(!cls) continue;
    const comment=topComment(src) || guessDesc(file);
    const rel = file;
    (groups[cls.bucket]||groups.misc).push({file:rel, comment});
  }
}

let md = '# Rules Catalog\\n\\nPlain-English list of rule files grouped by category.\\n\\n';
function section(title,key){
  const arr=groups[key]; if(!arr||!arr.length) return;
  md += '## '+title+'\\n\\n';
  arr.sort((a,b)=>a.file.localeCompare(b.file)).forEach(({file,comment})=>{
    md += \`- **\${file}**\\n  - \${comment}\\n\`;
  });
  md += '\\n';
}
section('Salary / Cap / Exceptions','salary');
section('Draft Picks / Stepien / Protections','picks');
section('Roster Size / Two-Way','roster');
section('Misc','misc');

fs.mkdirSync(DOCS_DIR,{recursive:true});
fs.writeFileSync(\`\${DOCS_DIR}/RULES_CATALOG.md\`, md);
console.log('✓ wrote ' + DOCS_DIR + '/RULES_CATALOG.md');
`
);

// generate-mermaid.js
writeFile(
  'scripts/generate-mermaid.js',
  `
const fs=require('fs'); const path=require('path');

const DOCS_DIR='${DOCS_DIR}';
if(!fs.existsSync(\`\${DOCS_DIR}/all-deps.json\`)){
  console.error('Missing ' + DOCS_DIR + '/all-deps.json. Run: npm run docs:deps'); process.exit(1);
}
const data=JSON.parse(fs.readFileSync(\`\${DOCS_DIR}/all-deps.json\`,'utf8'));

function bucketFor(f){
  const p=f.toLowerCase();
  if(p.includes('validator')) return 'validator';
  if(/(salary|apron|tax|exception|tpe|bird|cap)/i.test(p)) return 'rule_salary';
  if(/(stepien|pick|draft|swap|protection)/i.test(p)) return 'rule_picks';
  if(/(roster|two[-_ ]?way|min|max.*roster|slot)/i.test(p)) return 'rule_roster';
  if(/(util|helper|calc|math|format|parse|group|sum)/i.test(p)) return 'utils';
  if(/(const|threshold|table|mapping|teams?|players?|config|data)/i.test(p)) return 'data';
  return 'other';
}

// Build dependent counts to find top "validators" if none named
const depCount={};
(data.modules||[]).forEach(m=>{
  (m.dependencies||[]).forEach(d=>{
    depCount[d.resolved]=(depCount[d.resolved]||0)+1;
  });
});
let validators = (data.modules||[])
  .map(m=>m.source)
  .filter(s=>bucketFor(s)==='validator');
if (validators.length===0){
  // fall back: top 3 by dependents (core entry-ish files)
  validators = Object.entries(depCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([f])=>f);
}

const nodesByBucket = {validator:new Set(), rule_salary:new Set(), rule_picks:new Set(), rule_roster:new Set(), utils:new Set(), data:new Set()};
const edges = new Set();

for (const m of (data.modules||[])) {
  const from = m.source;
  const fromB = bucketFor(from);
  if (!nodesByBucket[fromB]) continue;
  nodesByBucket[fromB].add(from);
  for (const d of (m.dependencies||[])) {
    const to = d.resolved;
    const toB = bucketFor(to);
    if (!nodesByBucket[toB]) continue;
    nodesByBucket[toB].add(to);

    // Keep edges only at high level: validator->rule_*, rule_*->utils/data
    const keep =
      (validators.includes(from) && toB.startsWith('rule_')) ||
      (fromB.startsWith('rule_') && (toB==='utils' || toB==='data'));
    if (keep) edges.add(from+'-->'+to);
  }
}

// Limit node count per bucket for readability
function limit(set, max=12){
  const arr=[...set]; if(arr.length<=max) return {kept:arr, more:0};
  return {kept:arr.slice(0,max), more:arr.length-max};
}

const outLines = [];
outLines.push('\\\`\\\`\\\`mermaid');
outLines.push('graph LR');

function label(f){
  const b=path.basename(f);
  return b.replace(/[^a-zA-Z0-9_]/g,'_').slice(0,60);
}
function title(f){
  const b=path.basename(f);
  return b.length>28 ? b.slice(0,25)+'…' : b;
}

function subgraph(name, bucket){
  const {kept, more} = limit(nodesByBucket[bucket]);
  outLines.push(\`subgraph \${name}\`);
  kept.forEach(f=>{
    outLines.push(\`\${label(f)}["\${title(f)}"]\`);
  });
  if(more>0){
    const phantom = bucket+'_more';
    outLines.push(\`\${phantom}["… \${more} more"]\`);
  }
  outLines.push('end');
}

subgraph('Validator(s)','validator');
subgraph('Rules — Salary/Cap','rule_salary');
subgraph('Rules — Picks/Stepien','rule_picks');
subgraph('Rules — Roster','rule_roster');
subgraph('Utils','utils');
subgraph('Data','data');

for (const e of edges) {
  const [from,to]=e.split('-->');
  outLines.push(\`\${label(from)} --> \${label(to)}\`);
}
outLines.push('\\\`\\\`\\\`');

const md = '# Rules Flow (Mermaid)\\n\\nHigh-level flow: Validator → Rules → Utils/Data\\n\\n' + outLines.join('\\n') + '\\n';
fs.mkdirSync(DOCS_DIR,{recursive:true});
fs.writeFileSync(\`\${DOCS_DIR}/RULES_FLOW.md\`, md);
console.log('✓ wrote ' + DOCS_DIR + '/RULES_FLOW.md');
`
);

// If there's an existing atlas-docs/README.md from older runs, make sure the two new bullets are present
try {
  const p = `${DOCS_DIR}/README.md`;
  if (fs.existsSync(p)) {
    let rd = fs.readFileSync(p, 'utf8');
    let changed = false;
    if (!rd.includes('RULES_CATALOG.md')) {
      rd +=
        '\n- **RULES_CATALOG.md** — grouped, plain-English list of rule files\n';
      changed = true;
    }
    if (!rd.includes('RULES_FLOW.md')) {
      rd +=
        '- **RULES_FLOW.md** — Mermaid diagram of Validator → Rules → Utils/Data\n';
      changed = true;
    }
    if (changed) fs.writeFileSync(p, rd, 'utf8');
  }
} catch {
  /* ignore */
}

// --- install dev deps if requested ---
if (process.argv.includes('--install') || process.argv.includes('-i')) {
  console.log('\nInstalling dev dependencies (this can take a minute)...');
  const deps = [
    'madge',
    'dependency-cruiser',
    'documentation',
    'jsdoc-to-markdown',
    'vitest',
    'c8',
    'glob',
  ];
  execSync(`npm i -D ${deps.join(' ')}`, { stdio: 'inherit' });
  console.log('✓ dev dependencies installed');
}

console.log(`
All set.

Detected roots: ${roots.join(', ')}

Next:
  1) Generate docs & maps:
       npm run docs:all
  2) Open:
       - ${DOCS_DIR}/all-graph.svg (global)
       - ${DOCS_DIR}/all-deps.txt / ${DOCS_DIR}/all-deps.json
       - ${DOCS_DIR}/PLAIN_MAP.md
       - ${DOCS_DIR}/api.md
       - ${DOCS_DIR}/candidates.md
       - ${DOCS_DIR}/RULES_CATALOG.md
       - ${DOCS_DIR}/RULES_FLOW.md
  3) Get suggested organization:
       npm run map:all
       # open bucket-plan.csv
`);
