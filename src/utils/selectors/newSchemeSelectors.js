// SCSP™ — FULL FILE REPLACEMENT
// File: src/selectors/newSchemaSelectors.js
//
// Purpose: Centralized, permanent getters for the NEW Firestore schema.
// You pass in the already-fetched seasonDoc (e.g., 2025-26) and read fields directly.
// This avoids scattering dotted paths throughout the app and makes future tweaks trivial.
//
// Expected new schema shape examples (seasonDoc):
// {
//   bio: { displayName, age, position, height, weight, ... },
//   team: { code },                          // e.g., "LAL", "DEN"
//   stats: { pts, ast, reb, fgPct, tpPct, ftPct, ... },
//   contractView: { salary, yearsLeft, faYear, hasPlayerOption, hasTeamOption, ... },
//   evaluations?: {
//     meta: { evaluatorId, updatedAt },
//     grades: { Defense, Energy, Feel, IQ, Passing, Playmaking, Rebounding, Shooting },
//     roles: { offense, defense },
//     subroles: { offense:[], defense:[] },
//     shootingProfile: "Plus" | "Elite" | ...,
//     twoWayMeter: number,
//     blurbs: { traits, roles, shootingProfile, twoWayMeter }
//   }
// }

// ──────────────────────────────────────────────────────────────────────────────
// Basic identity / bio
export function getDisplayName(seasonDoc, fallback = '—') {
  return seasonDoc?.bio?.displayName ?? fallback;
}
export function getAge(seasonDoc, fallback = null) {
  return seasonDoc?.bio?.age ?? fallback;
}
export function getPosition(seasonDoc, fallback = null) {
  return seasonDoc?.bio?.position ?? fallback;
}
export function getHeight(seasonDoc, fallback = null) {
  return seasonDoc?.bio?.height ?? fallback;
}
export function getWeight(seasonDoc, fallback = null) {
  return seasonDoc?.bio?.weight ?? fallback;
}

// Team
export function getTeamCode(seasonDoc, fallback = null) {
  return seasonDoc?.team?.code ?? fallback;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stats (normalized to new keys)
export function getPTS(seasonDoc, fallback = null) {
  return seasonDoc?.stats?.pts ?? fallback;
}
export function getAST(seasonDoc, fallback = null) {
  return seasonDoc?.stats?.ast ?? fallback;
}
export function getREB(seasonDoc, fallback = null) {
  return seasonDoc?.stats?.reb ?? fallback;
}
export function getFGPct(seasonDoc, fallback = null) {
  return seasonDoc?.stats?.fgPct ?? fallback; // new normalized key
}
export function get3PPct(seasonDoc, fallback = null) {
  return seasonDoc?.stats?.tpPct ?? fallback; // three-point %
}
export function getFTPct(seasonDoc, fallback = null) {
  return seasonDoc?.stats?.ftPct ?? fallback;
}
// Generic stat accessor (if you need it)
export function getStat(seasonDoc, key, fallback = null) {
  return seasonDoc?.stats?.[key] ?? fallback;
}

// ──────────────────────────────────────────────────────────────────────────────
// Contract (seasonal view)
export function getContractView(seasonDoc, fallback = null) {
  return seasonDoc?.contractView ?? fallback;
}
export function getSalary(seasonDoc, fallback = null) {
  return seasonDoc?.contractView?.salary ?? fallback;
}
export function getYearsLeft(seasonDoc, fallback = null) {
  return seasonDoc?.contractView?.yearsLeft ?? fallback;
}
export function getFAYear(seasonDoc, fallback = null) {
  return seasonDoc?.contractView?.faYear ?? fallback;
}
export function hasPlayerOption(seasonDoc) {
  return !!seasonDoc?.contractView?.hasPlayerOption;
}
export function hasTeamOption(seasonDoc) {
  return !!seasonDoc?.contractView?.hasTeamOption;
}

// ──────────────────────────────────────────────────────────────────────────────
// Evaluations (safe reads; return empty/neutral shapes if absent)
export function hasEvaluations(seasonDoc) {
  return !!seasonDoc?.evaluations;
}
export function getEvalGrades(seasonDoc) {
  return seasonDoc?.evaluations?.grades ?? {};
}
export function getEvalRoles(seasonDoc) {
  return seasonDoc?.evaluations?.roles ?? { offense: null, defense: null };
}
export function getEvalSubroles(seasonDoc) {
  return seasonDoc?.evaluations?.subroles ?? { offense: [], defense: [] };
}
export function getEvalShootingProfile(seasonDoc, fallback = null) {
  return seasonDoc?.evaluations?.shootingProfile ?? fallback;
}
export function getEvalTwoWay(seasonDoc, fallback = null) {
  return seasonDoc?.evaluations?.twoWayMeter ?? fallback;
}
export function getEvalBlurbs(seasonDoc) {
  return seasonDoc?.evaluations?.blurbs ?? {};
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility: assert shape (optional, helps during transition)
export function assertSeasonDocShape(seasonDoc) {
  if (!seasonDoc) throw new Error('seasonDoc is null/undefined');
  // Soft checks (won't throw): you can log if critical sections are missing
  // console.warn can be added here if needed.
  return true;
}
