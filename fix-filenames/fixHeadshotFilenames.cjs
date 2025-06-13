const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../public/assets/headshots');

fs.readdirSync(dir).forEach((file) => {
  const normalized = file.normalize('NFC');

  if (file !== normalized) {
    const oldPath = path.join(dir, file);
    const newPath = path.join(dir, normalized);

    if (!fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`✅ Renamed: "${file}" → "${normalized}"`);
    } else {
      console.log(`⚠️ Skipped: "${file}" already exists as normalized`);
    }
  }
});

console.log('\n✨ Filename normalization complete.\n');
