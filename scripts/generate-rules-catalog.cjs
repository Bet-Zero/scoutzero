
const fs=require('fs'); const path=require('path'); const glob=require('glob');

const DOCS_DIR='atlas-docs';
const cfgPath='scripts/atlas.config.json';
const roots = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath,'utf8')).roots : ['src'];

function listFiles(root){
  return glob.sync(path.join(root,'**/*.{js,jsx,ts,tsx}'),{nodir:true, ignore:['**/node_modules/**','**/dist/**','**/build/**','**/coverage/**','**/atlas-docs/**','**/.next/**','**/out/**','**/public/**','**/scripts/**']});
}
function classify(p){
  if(/(stepien|pick|draft|swap|protection)/i.test(p))return{bucket:'picks',kind:'rule'};
  if(/(salary|apron|tax|exception|tpe|bird|cap)/i.test(p))return{bucket:'salary',kind:'rule'};
  if(/(roster|two[-_ ]?way|min|max.*roster|slot)/i.test(p))return{bucket:'roster',kind:'rule'};
  return null;
}
function topComment(src){
  const t=src.trimStart();
  const m=t.match(/^\/\*\*([\s\S]*?)\*\//);
  if(m)return m[1].replace(/\* ?/g,'').trim();
  const lines=t.match(/^(\/\/.*\n)+/);
  if(lines)return lines[0].replace(/^\/\/ ?/gm,'').trim();
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

let md = '# Rules Catalog\n\nPlain-English list of rule files grouped by category.\n\n';
function section(title,key){
  const arr=groups[key]; if(!arr||!arr.length) return;
  md += '## '+title+'\n\n';
  arr.sort((a,b)=>a.file.localeCompare(b.file)).forEach(({file,comment})=>{
    md += `- **${file}**\n  - ${comment}\n`;
  });
  md += '\n';
}
section('Salary / Cap / Exceptions','salary');
section('Draft Picks / Stepien / Protections','picks');
section('Roster Size / Two-Way','roster');
section('Misc','misc');

fs.mkdirSync(DOCS_DIR,{recursive:true});
fs.writeFileSync(`${DOCS_DIR}/RULES_CATALOG.md`, md);
console.log('✓ wrote ' + DOCS_DIR + '/RULES_CATALOG.md');
