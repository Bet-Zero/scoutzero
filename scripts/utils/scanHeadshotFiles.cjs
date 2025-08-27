// scripts/scanHeadshotFiles.cjs
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../public/assets/headshots');

const files = fs.readdirSync(dir);
const names = files
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.replace('.png', ''));

console.log('\n🖼️ Headshot Filenames:\n');
names.sort().forEach((n) => console.log(n));
