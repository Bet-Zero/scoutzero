
const fs=require('fs'); const path=require('path');

const DOCS_DIR='atlas-docs';
if(!fs.existsSync(`${DOCS_DIR}/all-deps.json`)){
  console.error('Missing ' + DOCS_DIR + '/all-deps.json. Run: npm run docs:deps'); process.exit(1);
}
const data=JSON.parse(fs.readFileSync(`${DOCS_DIR}/all-deps.json`,'utf8'));

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
outLines.push('\`\`\`mermaid');
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
  outLines.push(`subgraph ${name}`);
  kept.forEach(f=>{
    outLines.push(`${label(f)}["${title(f)}"]`);
  });
  if(more>0){
    const phantom = bucket+'_more';
    outLines.push(`${phantom}["… ${more} more"]`);
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
  outLines.push(`${label(from)} --> ${label(to)}`);
}
outLines.push('\`\`\`');

const md = '# Rules Flow (Mermaid)\n\nHigh-level flow: Validator → Rules → Utils/Data\n\n' + outLines.join('\n') + '\n';
fs.mkdirSync(DOCS_DIR,{recursive:true});
fs.writeFileSync(`${DOCS_DIR}/RULES_FLOW.md`, md);
console.log('✓ wrote ' + DOCS_DIR + '/RULES_FLOW.md');
