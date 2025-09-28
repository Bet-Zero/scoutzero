// SCSP™ — FULL FILE REPLACEMENT
// File: src/utils/selectorsNew.js
// Purpose: Direct, new-schema getters (no legacy). Import these across the app.
// New schema shape (per seasonDoc):
// {
//   bio: { displayName, age, position, height, weight, ... },
//   team: { code },               // e.g., "LAL"
//   stats: { fgPct, tpPct, ftPct, pts, ast, reb, ... },
//   contractView: { salary, yearsLeft, freeAgentYear, optionType? },
//   evaluations?: {
//     meta: { evaluatorId, updatedAt },
//     grades: { Defense, Energy, Feel, IQ, Passing, Playmaking, Rebounding, Shooting },
//     roles: { offense, defense },
//     subroles: { offense:[], defense:[] },
//     shootingProfile: string|null,
//     twoWayMeter: number|null,
//     blurbs: { traits, roles, shootingProfile, twoWayMeter }
//   }
// }

const get = (obj, path, fb = null) => {
  if (!obj) return fb;
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur == null) return fb;
    cur = cur[part];
  }
  return cur ?? fb;
};

// --- Bio ---
export const getDisplayName = (seasonDoc) =>
  get(seasonDoc, 'bio.displayName', null);
export const getAge = (seasonDoc) => get(seasonDoc, 'bio.age', null);
export const getPosition = (seasonDoc) => get(seasonDoc, 'bio.position', null);
export const getHeight = (seasonDoc) => get(seasonDoc, 'bio.height', null);
export const getWeight = (seasonDoc) => get(seasonDoc, 'bio.weight', null);

// --- Team ---
export const getTeamCode = (seasonDoc) => get(seasonDoc, 'team.code', null);

// --- Stats (new normalized keys) ---
export const getStat = (seasonDoc, key, fb = null) =>
  get(seasonDoc, `stats.${key}`, fb);
// Handy shorthands for common stats:
export const getFgPct = (s) => get(s, 'stats.fgPct', null); // replaces old "FG%"
export const getTpPct = (s) => get(s, 'stats.tpPct', null); // replaces old "3P%"
export const getFtPct = (s) => get(s, 'stats.ftPct', null); // replaces old "FT%"
export const getPts = (s) => get(s, 'stats.pts', null);
export const getAst = (s) => get(s, 'stats.ast', null);
export const getReb = (s) => get(s, 'stats.reb', null);

// --- Contract snapshot ---
export const getContractView = (seasonDoc) =>
  get(seasonDoc, 'contractView', null);
export const getSalary = (s) => get(s, 'contractView.salary', null);
export const getYearsLeft = (s) => get(s, 'contractView.yearsLeft', null);
export const getFreeAgentYear = (s) =>
  get(s, 'contractView.freeAgentYear', null);
export const getOptionType = (s) => get(s, 'contractView.optionType', null); // "PO"/"TO"/null

// --- Evaluations (safe reads; blank if not present) ---
export const hasEvaluations = (s) => !!s?.evaluations;

export const getEvalGrades = (s) => get(s, 'evaluations.grades', {});
export const getEvalRoles = (s) =>
  get(s, 'evaluations.roles', { offense: null, defense: null });
export const getEvalSubroles = (s) =>
  get(s, 'evaluations.subroles', { offense: [], defense: [] });
export const getEvalBlurbs = (s) => get(s, 'evaluations.blurbs', {});
export const getEvalShotProf = (s) =>
  get(s, 'evaluations.shootingProfile', null);
export const getEvalTwoWay = (s) => get(s, 'evaluations.twoWayMeter', null);
export const getEvalMeta = (s) => get(s, 'evaluations.meta', null);

// One-offs
export const getOffenseRole = (s) => get(s, 'evaluations.roles.offense', null);
export const getDefenseRole = (s) => get(s, 'evaluations.roles.defense', null);
