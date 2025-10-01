// build_v2_scaffold.js
// Usage: node build_v2_scaffold.js
// Inputs:
//   - sample_player.json           (from pick_sample.js)
//   - mapping_template.json        (your editable mapping template)
// Optional:
//   - schema_targets.json (array of "to" paths). If absent, we derive from mapping + REQUIRED_TARGETS
// Output:
//   - player_scaffold_v2.json      (EXACT v2 Firestore doc, fully shaped)

import fs from 'node:fs';

// ---------- IO helpers ----------
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));
const exists = (p) => fs.existsSync(p);

// ---------- object path helpers ----------
function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function set(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = val;
}

// ---------- transforms ----------
function feetInchesToInches(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const m = s.match(/(\d{1,2})\s*[-'’]\s*(\d{1,2})/);
  if (m) {
    const f = Number(m[1]),
      i = Number(m[2]);
    return Number.isFinite(f) && Number.isFinite(i) ? f * 12 + i : null;
  }
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function pctToDecimal(v) {
  if (v == null) return null;
  const s = String(v).replace('%', '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}
function dateToIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

function coerce(val, type, transform) {
  let v = val;
  if (transform === 'feetInchesToInches') v = feetInchesToInches(v);
  if (transform === 'pctToDecimal') v = pctToDecimal(v);
  if (transform === 'dateToIso') v = dateToIso(v);

  if (v == null) return null;

  switch (type) {
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean':
      return typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true';
    case 'timestamp':
      // v should already be ISO string after dateToIso
      return typeof v === 'string' ? v : null;
    case 'enum':
      return String(v); // mapping may further normalize via enum map if you add it
    case 'string':
    default:
      return String(v);
  }
}

// ---------- main ----------
if (!exists('./sample_player.json')) {
  console.error('❌ Missing sample_player.json. Run pick_sample.js first.');
  process.exit(1);
}
if (!exists('./mapping_template.json')) {
  console.error(
    '❌ Missing mapping_template.json. Run make_mapping_template.js first.'
  );
  process.exit(1);
}

const sample = read('./sample_player.json');
const mapping = read('./mapping_template.json');

// Critical targets you said must exist in v2, even if not in the mapping yet
const REQUIRED_TARGETS = [
  // bio & metrics
  'bio.displayName',
  'bio.ageYears',
  'bio.team',
  'bio.position',
  'metrics.heightInches',
  'metrics.weightLb',

  // contract/FA
  'contractView.freeAgentType',
  'contractView.freeAgentYear',
  'contractView.currentSalary',

  // options & extensions scaffolding
  'contractView.optionType',
  'contractView.optionSeason',
  'contractView.extensionSigned',
  'contractView.extensionStartSeason',
  'contractView.extensionYears',
  'contractView.extensionTotalValue',

  // stats / shooting (add more as you need)
  'statsPerGame.points',
  'statsPerGame.rebounds',
  'statsPerGame.assists',
  'shooting.fgPct',
  'shooting.threePointPct',
  'shooting.ftPct',
];

// 1) Build the exact set of target paths
let targetPaths = [];
if (exists('./schema_targets.json')) {
  targetPaths = read('./schema_targets.json'); // explicit list wins
} else {
  const fromMapping = (mapping.mappings || [])
    .map((m) => m.to)
    .filter(Boolean)
    .filter((to) => to !== 'TODO.choose_path');
  targetPaths = Array.from(new Set([...fromMapping, ...REQUIRED_TARGETS]));
}

// 2) For quick lookup: map toPath -> mapping rows
const rowsByTo = new Map();
for (const row of mapping.mappings || []) {
  if (!row.to) continue;
  if (!rowsByTo.has(row.to)) rowsByTo.set(row.to, []);
  rowsByTo.get(row.to).push(row);
}

// 3) Build the scaffold output with ONLY target paths
const out = {};
for (const to of targetPaths) {
  const rows = rowsByTo.get(to) || [];

  if (rows.length === 0) {
    // no mapping row yet → placeholder, but path still created
    set(out, to, `<<MISSING: ${to}>>`);
    continue;
  }

  // If multiple rows map to the same target, prefer the first non-empty
  let setValue = null;
  let usedFrom = null;

  for (const row of rows) {
    const { from, type, transform, enum: enumMap } = row;
    if (!from || from === 'TODO.choose_source') {
      continue; // can't read from sample
    }
    const raw = get(sample, from);
    if (raw === undefined) continue;

    let val = coerce(raw, type, transform);
    // optional enum map if you added one to the row
    if (val != null && enumMap && enumMap[val] !== undefined) {
      val = enumMap[val];
    }

    if (val != null) {
      setValue = val;
      usedFrom = from;
      break;
    }
  }

  if (setValue == null) {
    // have mapping row(s) but couldn’t compute from sample → leave FROM placeholder
    const fallbackFrom = rows[0]?.from || 'UNKNOWN';
    set(out, to, `<<FROM: ${fallbackFrom}>>`);
  } else {
    set(out, to, setValue);
  }
}

// 4) Write exact v2 doc
write('./player_scaffold_v2.json', out);
console.log('✅ Wrote player_scaffold_v2.json');
console.log(
  '   This is the EXACT v2 Firestore shape. Placeholders show what’s missing.'
);
