// scripts/groupNameAliases.cjs

const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '../../resources/data/name_variants_sorted.txt');
const outputPath = path.resolve(__dirname, '../../resources/data/name_alias_map.json');

const raw = fs.readFileSync(inputPath, 'utf-8');
const names = raw
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const normalize = (name) => {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/_/g, ' ')
    .replace(/\bjr\b/g, '')
    .replace(/[^\w\s]/g, '') // remove accents and symbols
    .replace(/\s+/g, ' ')
    .trim();
};

const aliasGroups = {};

for (const name of names) {
  const key = normalize(name);
  if (!aliasGroups[key]) aliasGroups[key] = new Set();
  aliasGroups[key].add(name);
}

// Only keep entries with more than one alias
const aliasMap = {};
for (const [norm, variants] of Object.entries(aliasGroups)) {
  if (variants.size > 1) {
    aliasMap[norm] = Array.from(variants).sort();
  }
}

fs.writeFileSync(outputPath, JSON.stringify(aliasMap, null, 2), 'utf-8');
console.log(`✅ Alias map saved to ${outputPath}`);
