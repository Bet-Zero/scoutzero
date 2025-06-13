const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../public/assets/headshots');
const files = fs.readdirSync(dir);

console.log('📁 Checking headshot filename encodings:\n');

files.forEach((file) => {
  const nfc = file.normalize('NFC');
  const nfd = file.normalize('NFD');
  const hex = Buffer.from(file).toString('hex');

  const isNFC = file === nfc;
  const isNFD = file === nfd;

  console.log(`🧾 ${file}`);
  console.log(`   - Matches NFC: ${isNFC}`);
  console.log(`   - Matches NFD: ${isNFD}`);
  console.log(`   - Hex: ${hex}\n`);
});
