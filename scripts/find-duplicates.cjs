
const fs=require('fs'), crypto=require('crypto'); const glob=require('glob');
const DOCS_DIR='atlas-docs';
const files=glob.sync('**/*.{js,ts,jsx,tsx}',{nodir:true, ignore:['**/node_modules/**','**/dist/**','**/build/**','**/coverage/**','**/' + DOCS_DIR + '/**']});
const groups={};
for(const f of files){
  const src=fs.readFileSync(f,'utf8').replace(/\s+/g,'');
  const hash=crypto.createHash('sha1').update(src).digest('hex');
  (groups[hash]=groups[hash]||[]).push(f);
}
let out=''; Object.values(groups).filter(g=>g.length>1).forEach(g=>{ out += '\nDUPLICATE GROUP:\n'+g.join('\n')+'\n'; });
if(!out) out='No exact duplicate files found.';
console.log(out);
fs.mkdirSync(DOCS_DIR,{recursive:true}); fs.writeFileSync(`${DOCS_DIR}/duplicates.txt`, out);
console.log('✓ wrote ' + DOCS_DIR + '/duplicates.txt');
