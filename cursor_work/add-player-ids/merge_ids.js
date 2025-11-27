import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = '/Users/brenthibbitts/Desktop/ScoutZero';
const IDS_PATH = path.join(PROJECT_ROOT, 'player-scrape/shared/outputs/all_player_ids.json');
const ADDITIONS_PATH = path.join(PROJECT_ROOT, 'cursor_work/add-player-ids/additions.json');

function normalizeSlug(raw) {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const additions = JSON.parse(readFileSync(ADDITIONS_PATH, 'utf8'));
const data = JSON.parse(readFileSync(IDS_PATH, 'utf8'));

let added = 0;
let skipped = 0;

for (const entry of additions) {
  const slug = normalizeSlug(entry.slug);
  if (!slug || data.hasOwnProperty(slug)) {
    skipped++;
    continue;
  }
  data[slug] = entry.nbaId;
  added++;
}

const sorted = Object.keys(data)
  .sort()
  .reduce((acc, key) => {
    acc[key] = data[key];
    return acc;
  }, {});

writeFileSync(IDS_PATH, JSON.stringify(sorted, null, 2) + '\n');
console.log(`Added ${added} entries, skipped ${skipped}`);
