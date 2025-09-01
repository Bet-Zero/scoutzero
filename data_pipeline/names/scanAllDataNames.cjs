// scripts/scanAllDataNames.cjs

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const dataDir = path.resolve(__dirname, '../data');
const outputPath = path.resolve(__dirname, '../data/alias_map.json');

const targetFiles = [
  'all_player_ids.json',
  'contracts_parsed.json',
  'players.json',
  'players_bios_2025.json',
  'nba_per_game_2025.csv',
];

// Normalize a name into ID format
const normalizeName = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Store raw name sets
const rawNameSets = [];

const addToRawSets = (name) => {
  const normalized = normalizeName(name);
  let foundSet = null;

  for (const nameSet of rawNameSets) {
    for (const existing of nameSet) {
      if (normalizeName(existing) === normalized) {
        foundSet = nameSet;
        break;
      }
    }
    if (foundSet) break;
  }

  if (foundSet) {
    foundSet.add(name);
  } else {
    rawNameSets.push(new Set([name]));
  }
};

const extractFromObject = (obj) => {
  const fields = ['player_id', 'id', 'name', 'full_name', 'display_name'];
  for (const key of fields) {
    if (obj[key]) addToRawSets(obj[key]);
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
      if (row.Player) addToRawSets(row.Player);
    })
    .on('end', done);
};

// STEP 1: SCAN FILES AND GATHER INITIAL SETS
(async () => {
  console.log('🔍 Scanning name data across files...\n');

  for (const filename of targetFiles) {
    const fullPath = path.join(dataDir, filename);
    if (!fs.existsSync(fullPath)) continue;

    if (filename.endsWith('.json')) {
      parseJsonFile(fullPath);
    } else if (filename.endsWith('.csv')) {
      await new Promise((resolve) => parseCsvFile(fullPath, resolve));
    }
  }

  console.log(`✅ Scanned ${rawNameSets.length} raw name sets\n`);

  // STEP 2: INITIAL MAP CONSTRUCTION (no merging yet)
  let aliasMap = {};
  for (const nameSet of rawNameSets) {
    const allNames = Array.from(nameSet);
    const allNormalized = allNames.map(normalizeName);
    const allKeys = [...new Set([...allNames, ...allNormalized])];
    const key = allNormalized.sort((a, b) => b.length - a.length)[0]; // pick longest

    if (!aliasMap[key]) aliasMap[key] = new Set();
    for (const name of allKeys) {
      aliasMap[key].add(name);
    }
  }

  // STEP 3: MERGE OVERLAPPING SETS
  const finalMap = {};
  const nameToKey = {};

  for (const [key, names] of Object.entries(aliasMap)) {
    const mergedSet = new Set(names);
    let mergedInto = key;

    for (const name of names) {
      const existingKey = nameToKey[name];
      if (existingKey && existingKey !== key) {
        // Merge sets
        const existingSet = finalMap[existingKey];
        for (const n of mergedSet) {
          existingSet.add(n);
          nameToKey[n] = existingKey;
        }
        mergedInto = existingKey;
        mergedSet.clear(); // skip adding new entry later
        break;
      }
    }

    if (mergedSet.size > 0) {
      finalMap[mergedInto] = mergedSet;
      for (const n of mergedSet) nameToKey[n] = mergedInto;
    }
  }

  // STEP 4: SAVE CLEANED ALIAS MAP
  const output = {};
  for (const [key, set] of Object.entries(finalMap)) {
    output[key] = Array.from(set).sort();
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`🧠 Final merged alias map written to: ${outputPath}`);
})();
