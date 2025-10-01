// pick_sample.js
import fs from 'node:fs';

const RAW_PATH = './data_pipeline/resources/data/players_merged.json';
const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

// turn object → array, preserve slug
const entries = Object.entries(raw).map(([slug, data]) => ({
  _slug: slug,
  ...data,
}));

const query = (process.argv[2] || '').toLowerCase();
if (!query) {
  console.error(
    'Usage: node pick_sample.js <slug | name substring | player_id>'
  );
  process.exit(1);
}

let sample =
  // exact slug match
  entries.find((p) => p._slug.toLowerCase() === query) ||
  // player_id match
  entries.find(
    (p) => String(p.player_id || p.id || '').toLowerCase() === query
  ) ||
  // substring search in JSON text
  entries.find((p) => JSON.stringify(p).toLowerCase().includes(query));

if (!sample) {
  console.error('No player matched:', query);
  process.exit(1);
}

fs.writeFileSync('./sample_player.json', JSON.stringify(sample, null, 2));
console.log(`Wrote sample_player.json for ${sample._slug}`);
