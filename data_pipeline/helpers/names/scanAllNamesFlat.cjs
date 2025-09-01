// scripts/scanAllNamesFlat.cjs

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const dataDir = path.resolve(__dirname, '../../resources/data');
const outputPath = path.resolve(__dirname, '../../resources/data/name_variants_sorted.txt');

const targetFiles = [
  'all_player_ids.json',
  'contracts_parsed.json',
  'players.json',
  'players_bios_2025.json',
  'nba_per_game_2025.csv',
];

const allNames = new Set();

const extractFromObject = (obj) => {
  const fields = ['player_id', 'id', 'name', 'full_name', 'display_name'];
  for (const key of fields) {
    if (obj[key]) allNames.add(obj[key]);
  }
};

const parseJsonFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : Object.values(data);
  items.forEach(extractFromObject);
};

const parseCsvFile = (filePath, done) => {
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.Player) allNames.add(row.Player);
    })
    .on('end', done);
};

(async () => {
  console.log('🔍 Scanning for all raw player names...\n');

  for (const filename of targetFiles) {
    const fullPath = path.join(dataDir, filename);
    if (!fs.existsSync(fullPath)) continue;

    if (filename.endsWith('.json')) {
      parseJsonFile(fullPath);
    } else if (filename.endsWith('.csv')) {
      await new Promise((resolve) => parseCsvFile(fullPath, resolve));
    }
  }

  const sortedNames = Array.from(allNames)
    .filter(Boolean)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  fs.writeFileSync(outputPath, sortedNames.join('\n'));
  console.log(
    `✅ Saved ${sortedNames.length} names (sorted by first name) to: ${outputPath}`
  );
})();
