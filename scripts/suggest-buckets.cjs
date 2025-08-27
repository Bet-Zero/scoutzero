
const fs=require('fs'), path=require('path');
const DOCS_DIR='atlas-docs';
if(!fs.existsSync(`${DOCS_DIR}/all-deps.json`)) {
  console.error('Missing ' + DOCS_DIR + '/all-deps.json. Run: npm run docs:deps'); process.exit(1);
}
const data=JSON.parse(fs.readFileSync(`${DOCS_DIR}/all-deps.json`,'utf8'));
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

fs.writeFileSync('bucket-plan.csv', 'priority,suggested,file\n' + rows.map(r => `${r.priority},${r.suggested},${r.file}`).join('\n'));
console.log('✓ wrote bucket-plan.csv');
