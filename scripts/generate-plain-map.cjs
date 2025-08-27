
const fs=require('fs'); const path=require('path'); const glob=require('glob');
const DOCS_DIR='atlas-docs';
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
  const m=t.match(/^\/\*\*([\s\S]*?)\*\//);
  if(m)return m[1].replace(/\* ?/g,'').trim();
  const lines=t.match(/^(\/\/.*\n)+/);
  if(lines)return lines[0].replace(/^\/\/ ?/gm,'').trim();
  return'';
}
function importsList(src){
  const imps=[]; const re=/import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"];?/g; let m;
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

let md='# Plain-English Map (whole project)\n\n';
md+='> Auto-generated from file names + top-of-file comments.\n\n';
[...groups.keys()].sort().forEach(dir=>{
  md+=`## \`${dir}\`\n\n`;
  const order={'validator':0,'rule:salary':1,'rule:picks':2,'rule:roster':3,'test':4,'utils':5,'data':6,'other':7};
  groups.get(dir).sort((a,b)=> (order[a.kind]-order[b.kind]) || a.file.localeCompare(b.file))
    .forEach(({file,kind,comment,imps})=>{
      const nice=kind.replace('rule:','rule / ');
      md+=`- **${path.basename(file)}** — _${nice}_\n`;
      if(comment) md+=`  - ${comment}\n`;
      if(imps.length) md+=`  - imports: ${imps.join(', ')}\n`;
    });
  md+='\n';
});
fs.mkdirSync(DOCS_DIR,{recursive:true});
fs.writeFileSync(`${DOCS_DIR}/PLAIN_MAP.md`, md);
console.log('✓ wrote ' + DOCS_DIR + '/PLAIN_MAP.md');
