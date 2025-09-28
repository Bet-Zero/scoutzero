// SCSP™ — FULL FILE REPLACEMENT
// File: src/utils/compat/legacyFieldAdapter.js

// Purpose:
// Bridge old field selectors to the new Firestore schema during the transition.
// It reads your new season/player docs but exposes functions that satisfy
// existing UI expectations. Remove pieces gradually as screens are refactored.

// ── 1) Load the schema map emitted by scripts/emit_schema_map.cjs ──────────────
// The map should look like an object keyed by oldPath.
// Example: { "bio.AGE": "seasons.2025-26.bio.age", "FG%": "seasons.2025-26.stats.fgPct" }

import schemaMap from '../../_exports/schema_map_2025-26.json'; // Updated path

// Normalize the map to: { [oldPath: string]: newPath: string }
const MAP = Array.isArray(schemaMap)
  ? schemaMap.reduce((acc, row) => {
      if (row && row.old && row.new) acc[row.old] = row.new;
      return acc;
    }, {})
  : { ...schemaMap };

// ── 2) Small path helpers ─────────────────────────────────────────────────────
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function getByPath(root, dotted, fallback = undefined) {
  if (!root || !dotted) return fallback;
  const parts = dotted.split('.');
  let cur = root;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur ?? fallback;
}

// Resolve "old path" → "new path" using the MAP; allow direct new path too.
function resolvePath(oldOrNewPath) {
  return MAP[oldOrNewPath] || oldOrNewPath;
}

// ── 3) Core adapter: read using old selector names safely ──────────────────────
// playerDoc: the top-level player document (slug-keyed)
// seasonDoc: the specific season document (already fetched), e.g., 2025-26
// If you only pass seasonDoc, we’ll still work for most fields.

export function getLegacy(playerDoc, seasonDoc, oldSelector, fallback = null) {
  const path = resolvePath(oldSelector);

  // Heuristic: if the new path starts with "seasons.", strip the season key if you already passed seasonDoc
  // Example: seasons.2025-26.stats.fgPct → stats.fgPct
  const seasonPrefix = 'seasons.';
  let source = seasonDoc;
  let p = path;

  if (path.startsWith(seasonPrefix)) {
    const rest = path.slice(seasonPrefix.length); // "2025-26.stats.fgPct"
    const ix = rest.indexOf('.');
    if (ix > -1) {
      // drop "2025-26."
      p = rest.slice(ix + 1);
      source = seasonDoc ?? playerDoc; // prefer seasonDoc if provided
    } else {
      // seasons.<year> only; no subpath
      p = '';
      source = seasonDoc;
    }
  } else {
    // Non-seasoned path: try playerDoc first
    source = playerDoc ?? seasonDoc;
  }

  if (!p) return source ?? fallback;
  return getByPath(source, p, fallback);
}

// ── 4) Convenience getters your UI can use immediately ────────────────────────

export function getBioField(seasonDoc, key, fallback = null) {
  return seasonDoc?.bio?.[key] ?? fallback;
}

export function getTeamCode(seasonDoc, fallback = null) {
  // Try new path directly first
  const direct = seasonDoc?.team?.code ?? null;
  if (direct) return direct;
  // Or via legacy selector map (old e.g., "teamId" → new "team.code")
  return getLegacy(null, seasonDoc, 'teamId', fallback);
}

export function getStat(seasonDoc, statKey, fallback = null) {
  // Accept both old keys (e.g., "FG%") and new normalized keys (e.g., "fgPct")
  const direct = seasonDoc?.stats?.[statKey];
  if (direct != null) return direct;

  // Look up old selector like "system.stats.FG%" → "seasons.2025-26.stats.fgPct"
  const oldSelector = `system.stats.${statKey}`;
  const value = getLegacy(null, seasonDoc, oldSelector, undefined);
  if (value != null) return value;

  // Last resort: normalized statKey guesses
  const aliases = aliasStatKey(statKey);
  for (const a of aliases) {
    const v = seasonDoc?.stats?.[a];
    if (v != null) return v;
  }
  return fallback;
}

function aliasStatKey(k) {
  // Minimal aliasing; extend as needed
  const map = {
    'FG%': ['fgPct', 'FG_PCT'],
    '3P%': ['tpPct', 'threePct', 'FG3_PCT'],
    'FT%': ['ftPct', 'FT_PCT'],
    PTS: ['pts'],
    AST: ['ast'],
    REB: ['reb'],
    STL: ['stl'],
    BLK: ['blk'],
    TOV: ['tov'],
    ORB: ['orb'],
    DRB: ['drb'],
  };
  return map[k] || [];
}

export function getContractView(seasonDoc, fallback = null) {
  return seasonDoc?.contractView ?? fallback;
}

export function getEval(seasonDoc, path, fallback = null) {
  // path examples: "grades.Shooting", "roles.offense", "blurbs.roles"
  if (!seasonDoc?.evaluations) return fallback;
  return getByPath(seasonDoc.evaluations, path, fallback);
}

// Common safe reads for empty evals:
export function getEvalGrades(seasonDoc) {
  return seasonDoc?.evaluations?.grades ?? {};
}
export function getEvalRoles(seasonDoc) {
  return seasonDoc?.evaluations?.roles ?? { offense: null, defense: null };
}
export function getEvalSubroles(seasonDoc) {
  return seasonDoc?.evaluations?.subroles ?? { offense: [], defense: [] };
}
export function getEvalBlurbs(seasonDoc) {
  return seasonDoc?.evaluations?.blurbs ?? {};
}
export function getEvalShootingProfile(seasonDoc) {
  return seasonDoc?.evaluations?.shootingProfile ?? null;
}
export function getEvalTwoWay(seasonDoc) {
  return seasonDoc?.evaluations?.twoWayMeter ?? null;
}

// ── 5) Example: legacy one-liners your older UI might call ────────────────────

export function getLegacyAge(playerDoc, seasonDoc) {
  // Old: "bio.AGE" → New: "seasons.2025-26.bio.age"
  return getLegacy(playerDoc, seasonDoc, 'bio.AGE', null);
}

export function getLegacyPosition(playerDoc, seasonDoc) {
  // Old: "player.position" → New: "seasons.2025-26.bio.position" (example)
  return getLegacy(playerDoc, seasonDoc, 'player.position', null);
}

export function getLegacyTeam(playerDoc, seasonDoc) {
  // Old: "teamId" → New: "seasons.2025-26.team.code"
  return getLegacy(playerDoc, seasonDoc, 'teamId', null);
}
