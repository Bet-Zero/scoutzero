
import { parseSwap, parseVia, INTERNAL_TEAM_CODE_MAP } from './realgm_draft_picks.js';

console.log('--- TEST START ---');

const tests = [
  "Own or OKC",
  "(via OKC swap for DAL)",
  "Own or BKN",
  "Own or SAC (via SAC swap for ATL)"
];

for (const t of tests) {
  const res = parseSwap(t, INTERNAL_TEAM_CODE_MAP);
  console.log(`Parsing "${t}":`, JSON.stringify(res, null, 0));
}

const viaTests = [
  "(via DAL)",
  "via DAL",
  "from DAL"
];

for (const t of viaTests) {
  const res = parseVia(t);
  console.log(`Via "${t}":`, res);
}
