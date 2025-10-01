// make_mapping_template.js
// Usage: node make_mapping_template.js
// Input: sample_player.json (made by pick_sample.js)
// Output: mapping_template.json (edit by hand)
// This version FORCE-INCLUDES option/extension targets even if missing in sample.

import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));

function flattenValues(obj, base = '', out = []) {
  if (obj == null) return out;
  if (Array.isArray(obj)) {
    if (obj.length > 0) flattenValues(obj[0], base + '[]', out);
    else out.push({ path: base + '[]', type: 'array', example: [] });
    return out;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj))
      flattenValues(obj[k], base ? `${base}.${k}` : k, out);
    return out;
  }
  out.push({ path: base, type: typeof obj, example: obj });
  return out;
}

function isNumberLike(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean' || typeof v === 'object') return false;
  const s = String(v).trim().replace(/,/g, '');
  const n = Number(s);
  return s !== '' && Number.isFinite(n);
}
function looksFeetInches(v) {
  if (v == null) return false;
  const s = String(v);
  return /\b\d{1,2}\s*[-'’]\s*\d{1,2}\b/.test(s); // 6-10, 6'10
}
function looksPercent(v, fromPath) {
  if (v == null) return false;
  const s = String(v).trim();
  if (/%$/.test(s)) return true;
  if (fromPath && /pct|percent/i.test(fromPath)) return true;
  return false;
}
function looksDate(v) {
  if (v == null) return false;
  const d = new Date(v);
  return !isNaN(d);
}

// conservative auto buckets
function suggestToPath(fromPath) {
  const p = fromPath.toLowerCase();

  // identifiers / name
  if (p === 'name' || p.endsWith('.name') || p.includes('display_name'))
    return 'bio.displayName';
  if (p === '_slug') return 'identifiers.slug';
  if (p.includes('player_id') || p === 'id') return 'identifiers.playerId';

  // metrics
  if (p === 'ht' || p.includes('height')) return 'metrics.heightInches';
  if (p === 'wt' || p.includes('weight')) return 'metrics.weightLb';
  if (p.includes('wingspan')) return 'metrics.wingspanInches';

  // bio
  if (p.includes('age')) return 'bio.ageYears';
  if (p.includes('team')) return 'bio.team';
  if (p.includes('position') || p === 'pos') return 'bio.position';
  if (p.includes('birth') || p.includes('dob')) return 'bio.birthdate';

  // contract / FA
  if (p.includes('free_agent_type')) return 'contractView.freeAgentType';
  if (p.includes('free_agent_year')) return 'contractView.freeAgentYear';
  if (p.includes('salary')) return 'contractView.currentSalary';

  // shooting / stats
  if (p.includes('3p') || p.includes('three')) return 'shooting.threePointPct';
  if (p.includes('fg') && p.includes('pct')) return 'shooting.fgPct';
  if (p.includes('ft') && p.includes('pct')) return 'shooting.ftPct';
  if (p.endsWith('.pts') || p === 'pts' || p.includes('ppg'))
    return 'statsPerGame.points';
  if (p.endsWith('.reb') || p === 'reb' || p.includes('rpg'))
    return 'statsPerGame.rebounds';
  if (p.endsWith('.ast') || p === 'ast' || p.includes('apg'))
    return 'statsPerGame.assists';

  return 'TODO.choose_path';
}

function inferTypeAndTransform(fromPath, example) {
  if (looksDate(example)) return { type: 'timestamp', transform: 'dateToIso' };
  if (looksFeetInches(example))
    return { type: 'number', transform: 'feetInchesToInches' };
  if (looksPercent(example, fromPath))
    return { type: 'number', transform: 'pctToDecimal' };
  if (typeof example === 'boolean') return { type: 'boolean', transform: null };
  if (isNumberLike(example)) return { type: 'number', transform: null };
  return { type: 'string', transform: null };
}

// ---------- main ----------
if (!fs.existsSync('./sample_player.json')) {
  console.error('Missing sample_player.json. Run pick_sample.js first.');
  process.exit(1);
}
const sample = read('./sample_player.json');
const rows = flattenValues(sample).filter((r) => !r.path.endsWith('[]'));

const idField = sample._slug ? '_slug' : sample.player_id ? 'player_id' : 'id';

const mappings = [];
for (const r of rows) {
  if (r.path === '_slug') continue;

  const to = suggestToPath(r.path);
  const { type, transform } = inferTypeAndTransform(r.path, r.example);

  const entry = { from: r.path, to, type, example: r.example };
  if (transform) entry.transform = transform;

  mappings.push(entry);
}

// ---------- force-include critical contract targets even if missing ----------
const REQUIRED_TARGETS = [
  // options
  {
    to: 'contractView.optionType',
    type: 'enum',
    enum: { TEAM: 'TEAM', PLAYER: 'PLAYER', ETO: 'ETO', NONE: 'NONE' },
  },
  { to: 'contractView.optionSeason', type: 'number' },

  // extension flags/fields (edit as needed)
  { to: 'contractView.extensionSigned', type: 'boolean' },
  { to: 'contractView.extensionStartSeason', type: 'number' },
  { to: 'contractView.extensionYears', type: 'number' },
  { to: 'contractView.extensionTotalValue', type: 'number' },
];

// add rows as TODOs only if not already present
const existingTargets = new Set(mappings.map((m) => m.to));
for (const hint of REQUIRED_TARGETS) {
  if (!existingTargets.has(hint.to)) {
    const row = { from: 'TODO.choose_source', to: hint.to, type: hint.type };
    if (hint.enum) row.enum = hint.enum;
    mappings.push(row);
  }
}

const out = { idField, mappings };
write('./mapping_template.json', out);

console.log(
  '✅ mapping_template.json created (with option/extension targets added).'
);
console.log(
  'Open it and fill the `from` path for those TODO rows when you’re ready.'
);
