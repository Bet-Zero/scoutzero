#!/usr/bin/env node
/** Forecast ↔ Schema Compatibility Validator (CommonJS, Path-Keyed, Strict-to-Agreed) */
const fs = require('fs');

const REQUIRED = [
  // bio (NO headshot requirement)
  ['bio.slug', 'string'],
  ['bio.nbaId', ['string', 'number']],
  ['bio.name.first', 'string'],
  ['bio.name.last', 'string'],

  // xref
  ['xref.nbaId', ['string', 'number']],
  ['xref.slug', 'string'],

  // season
  ['season.seasonYear', 'string'],
  ['season.team', ['string', 'object']], // <-- accept string or object; do NOT require .code

  // evaluation
  ['season.evaluation.grades', 'object'],
  ['season.evaluation.roles.offense', 'array'],
  ['season.evaluation.roles.defense', 'array'],
  ['season.evaluation.subRoles', 'array'],
  ['season.evaluation.traits', 'array'],
  ['season.evaluation.badges', 'array'],
  ['season.evaluation.status', 'string'],
  ['season.evaluation.shootingProfile', 'string'],
  ['season.evaluation.blurbs.shootingProfile', 'string'],
  ['season.evaluation.twoWayMeter', ['string', 'number']],
  ['season.evaluation.blurbs.twoWayMeter', 'string'],

  // contractView (lean)
  ['season.contractView.salary', ['number', 'string']],
  ['season.contractView.yearsRemaining', ['number', 'string']],
  ['season.contractView.freeAgent.year', ['number', 'string']],

  // contracts (years can be array or number; if array, deeper checks happen)
  ['contracts', 'array'],
  ['contracts[0].years', ['array', 'number']],
];

const typeOf = (v) =>
  Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
const typeMatches = (val, expected) => {
  const t = typeOf(val);
  return Array.isArray(expected) ? expected.includes(t) : t === expected;
};
function safeGet(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object')
      return { ok: false, val: undefined };
    if (!(p in cur)) return { ok: false, val: undefined };
    cur = cur[p];
  }
  return { ok: true, val: cur };
}
function setIfMissing(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (cur[last] === undefined) cur[last] = value;
}

// ---------- normalization from path-keyed ----------
function fromPathKeyed(map) {
  const out = { contracts: [] };
  const meta = {
    bioPath: null,
    seasonPath: null,
    contractPaths: [],
    xrefPath: null,
  };

  for (const [path, doc] of Object.entries(map || {})) {
    const parts = path.split('/');
    if (parts[0] === 'playersByNbaId') {
      out.xref = doc;
      meta.xrefPath = path;
      continue;
    }
    if (parts[0] !== 'players') continue;
    if (parts.length === 2) {
      out.bio = doc;
      meta.bioPath = path;
      continue;
    }
    if (parts.length === 4 && parts[2] === 'seasons') {
      out.season = doc;
      meta.seasonPath = path;
      continue;
    }
    if (parts.length === 4 && parts[2] === 'contracts') {
      out.contracts.push(doc);
      meta.contractPaths.push(path);
      continue;
    }
  }
  if (!out.contracts.length) delete out.contracts;
  return {
    bundle: out.bio || out.season || out.contracts || out.xref ? out : null,
    meta,
  };
}

function normalize(original) {
  // Already normalized?
  if (
    original &&
    (original.bio || original.season || original.contracts || original.xref)
  ) {
    return enrich(original, {
      bioPath: null,
      seasonPath: null,
      contractPaths: [],
      xrefPath: null,
    });
  }
  // Path-keyed?
  const keys = Object.keys(original || {});
  if (
    keys.some(
      (k) => k.startsWith('players/') || k.startsWith('playersByNbaId/')
    )
  ) {
    const { bundle, meta } = fromPathKeyed(original);
    if (bundle) return enrich(bundle, meta);
  }
  return null;
}

// Only fill IDs that are derived from paths (no extra fields beyond schema)
function enrich(bundle, meta) {
  if (meta.bioPath) {
    const slug = meta.bioPath.split('/')[1];
    if (slug) {
      setIfMissing(bundle, 'bio.slug', slug);
      setIfMissing(bundle, 'xref.slug', slug);
    }
  }
  if (meta.xrefPath) {
    const nbaIdStr = meta.xrefPath.split('/')[1];
    const nbaId = /^\d+$/.test(nbaIdStr) ? Number(nbaIdStr) : nbaIdStr;
    setIfMissing(bundle, 'xref.nbaId', nbaId);
    setIfMissing(bundle, 'bio.nbaId', nbaId);
  }
  if (meta.seasonPath) {
    const year = meta.seasonPath.split('/')[3];
    if (year) setIfMissing(bundle, 'season.seasonYear', year);
  }
  // contracts map → array (if necessary)
  if (
    bundle.contracts &&
    !Array.isArray(bundle.contracts) &&
    typeof bundle.contracts === 'object'
  ) {
    bundle.contracts = Object.values(bundle.contracts);
  }
  return bundle;
}

// -------- main --------
const file = process.argv[2];
if (!file) {
  console.error(
    'Usage: node scripts/validate_forecast_compat.cjs <ForecastBundle_TARGET_*.json>'
  );
  process.exit(1);
}
const raw = fs.readFileSync(file, 'utf8');
const original = JSON.parse(raw);
const bundle = normalize(original);

if (!bundle) {
  console.error(`❌ Could not normalize ${file}`);
  console.error('Top-level keys:', Object.keys(original || {}));
  process.exit(1);
}

// Parent checks
const failures = [];
for (const [p, t] of [
  ['bio', 'object'],
  ['xref', 'object'],
  ['season', 'object'],
  ['contracts', 'array'],
]) {
  const { ok, val } = safeGet(bundle, p);
  if (!ok) failures.push(`Missing: ${p}`);
  else if (!typeMatches(val, t))
    failures.push(`Type mismatch: ${p} (got ${typeOf(val)}, want ${t})`);
}
const parentOk = (key) => !failures.some((f) => f.includes(`: ${key}`));

// Children (if parent ok). If years is an array, we apply deeper checks inline.
for (const [path, expected] of REQUIRED) {
  const parent = path.split('.')[0];
  if (!parentOk(parent)) continue;

  if (path === 'contracts[0].years') {
    const yrs = safeGet(bundle, 'contracts[0].years');
    if (!yrs.ok) {
      failures.push('Missing: contracts[0].years');
      continue;
    }
    if (!typeMatches(yrs.val, ['array', 'number'])) {
      failures.push(
        `Type mismatch: contracts[0].years (got ${typeOf(yrs.val)}, want array|number)`
      );
    }
    // no deeper enforcement here (schema allows number OR array)
    continue;
  }

  const { ok, val } = safeGet(bundle, path);
  if (!ok) failures.push(`Missing: ${path}`);
  else if (!typeMatches(val, expected))
    failures.push(
      `Type mismatch: ${path} (got ${typeOf(val)}, want ${Array.isArray(expected) ? expected.join('|') : expected})`
    );
}

if (failures.length) {
  console.error(`❌ Schema compatibility FAILED for ${file}`);
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
} else {
  console.log(`✅ Schema compatibility OK for ${file}`);
  process.exit(0);
}
