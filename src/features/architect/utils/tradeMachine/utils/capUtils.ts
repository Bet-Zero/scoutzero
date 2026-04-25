/**
 * Cap utilities for trade validation
 * Handles cap calculations, payroll resolution, and team object normalization
 * Consolidated from: capHelpers.js
 */

// Phase 3.1: Re-export toSeasonKey from canonical module for backwards compatibility
// All new code should import directly from '@/features/architect/utils/seasonFormat'
export { toSeasonKey } from '@/features/architect/utils/seasonFormat';

type NumericLike = number | string | null | undefined;

interface CapUtilsPayrollStatus {
  projectedSalary?: NumericLike;
}

interface CapUtilsTeamData {
  totalSalary?: NumericLike;
  teamTotalSalary?: NumericLike;
  projectedSalary?: NumericLike;
  payroll?: NumericLike;
  postTradeStatus?: CapUtilsPayrollStatus | null;
  preTradeStatus?: CapUtilsPayrollStatus | null;
}

interface CapUtilsTeamWrapper {
  team?: CapUtilsTeamData | null;
  sourceTeam?: CapUtilsTeamData | null;
  ctx?: CapUtilsTeamData | null;
}

type CapUtilsTeamContainer =
  | CapUtilsTeamData
  | CapUtilsTeamWrapper
  | null
  | undefined;
type CapUtilsTeamLike = CapUtilsTeamContainer | NumericLike;

interface CapUtilsCapSettingsLike {
  salaryCap?: NumericLike;
  cap?: NumericLike;
  softCap?: NumericLike;
  salary_cap?: NumericLike;
  soft_cap?: NumericLike;
  firstApron?: NumericLike;
  apron?: NumericLike;
  apron1?: NumericLike;
  first_apron?: NumericLike;
  taxApron1?: NumericLike;
  firstTaxApron?: NumericLike;
  secondApron?: NumericLike;
  apron2?: NumericLike;
  second_apron?: NumericLike;
  taxApron2?: NumericLike;
  secondTaxApron?: NumericLike;
  taxLine?: NumericLike;
  tax?: NumericLike;
  luxuryTaxLine?: NumericLike;
  luxuryTax?: NumericLike;
  fullMLE?: NumericLike;
  mle?: NumericLike;
  roomMLE?: NumericLike;
  rmle?: NumericLike;
  bae?: NumericLike;
}

interface NormalizedCapSettings {
  salaryCap: number;
  firstApron: number;
  secondApron: number;
  taxLine: number;
  fullMLE: number;
  roomMLE: number;
  bae: number;
}

function asTeamData(team: CapUtilsTeamData | null | undefined): CapUtilsTeamData {
  return (team || {}) as CapUtilsTeamData;
}

function isTeamWrapper(
  teamLike: CapUtilsTeamContainer
): teamLike is CapUtilsTeamWrapper {
  if (!teamLike) {
    return false;
  }
  return (
    typeof teamLike === 'object' &&
    ('team' in teamLike || 'sourceTeam' in teamLike || 'ctx' in teamLike)
  );
}

function resolveComparableTeamData(
  teamLike: CapUtilsTeamLike
): CapUtilsTeamData | null {
  if (teamLike === null || teamLike === undefined) {
    return null;
  }

  if (typeof teamLike === 'number' || typeof teamLike === 'string') {
    const totalSalary: NumericLike = teamLike;
    return { totalSalary };
  }

  const teamContainer: CapUtilsTeamContainer = teamLike;
  const extractedTeam = getTeamObject(teamContainer);
  if (extractedTeam) {
    return asTeamData(extractedTeam);
  }

  if (isTeamWrapper(teamContainer)) {
    return null;
  }

  return asTeamData(teamContainer);
}

/**
 * Determines if a team is at or above the first apron threshold
 * (From capHelpers.js)
 */
export function isFirstApronTeam(
  team: CapUtilsTeamLike,
  capSettings: CapUtilsCapSettingsLike | null | undefined
): boolean {
  const teamData = resolveComparableTeamData(team);
  if (!teamData || !capSettings) return false;

  const teamSalary = (teamData.totalSalary || teamData.teamTotalSalary || 0) as
    | number
    | string;
  const firstApron = (capSettings.firstApron || capSettings.apron || 0) as
    | number
    | string;

  return teamSalary >= firstApron;
}

/**
 * Determines if a team is ABOVE the second apron threshold
 * Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
 * (From capHelpers.js)
 */
export function isSecondApronTeam(
  teamLike: CapUtilsTeamLike,
  capSettings: CapUtilsCapSettingsLike | null | undefined
): boolean {
  if (!teamLike || !capSettings) return false;

  // Utilize robust extraction
  const team = resolveComparableTeamData(teamLike);
  if (!team) return false;
  const teamSalary = (team.totalSalary || team.teamTotalSalary || 0) as
    | number
    | string;
  const secondApron = (capSettings.secondApron || 0) as number | string;

  return teamSalary > secondApron;
}

/**
 * Gets the apron status of a team
 * (From capHelpers.js)
 */
export function getTeamApronStatus(
  team: CapUtilsTeamLike,
  capSettings: CapUtilsCapSettingsLike | null | undefined
): 'SECOND_APRON' | 'FIRST_APRON' | 'OVER_CAP' | 'UNDER_CAP' {
  const teamData = resolveComparableTeamData(team);
  if (!teamData || !capSettings) return 'UNDER_CAP';

  const teamSalary = (teamData.totalSalary || teamData.teamTotalSalary || 0) as
    | number
    | string;
  const salaryCap = (capSettings.salaryCap || 0) as number | string;
  const firstApron = (capSettings.firstApron || 0) as number | string;
  const secondApron = (capSettings.secondApron || 0) as number | string;

  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  if (teamSalary > secondApron) return 'SECOND_APRON';
  if (teamSalary >= firstApron) return 'FIRST_APRON';
  if (teamSalary >= salaryCap) return 'OVER_CAP';
  return 'UNDER_CAP';
}

/**
 * Converts a value to a number, handling various input types
 * @param {unknown} v - The value to convert
 * @returns {number} The numeric value or 0
 */
export const toNum = (v: unknown): number =>
  (Number.isFinite(v) ? (v as number) : Number(v)) || 0;

// NOTE: toSeasonKey is now re-exported from seasonFormat.js at the top of this file
// The local definition below is REMOVED to prevent duplication

/**
 * Normalizes cap settings from various input formats
 * @param {Object} raw - Raw cap settings with potentially varying property names
 * @returns {Object} Normalized cap settings
 */
export function normalizeCaps(
  raw: CapUtilsCapSettingsLike = {}
): NormalizedCapSettings {
  return {
    salaryCap: toNum(
      raw.salaryCap ?? raw.cap ?? raw.softCap ?? raw.salary_cap ?? raw.soft_cap
    ),
    firstApron: toNum(
      raw.firstApron ??
        raw.apron1 ??
        raw.first_apron ??
        raw.taxApron1 ??
        raw.firstTaxApron
    ),
    secondApron: toNum(
      raw.secondApron ??
        raw.apron2 ??
        raw.second_apron ??
        raw.taxApron2 ??
        raw.secondTaxApron
    ),
    taxLine: toNum(
      raw.taxLine ?? raw.tax ?? raw.luxuryTaxLine ?? raw.luxuryTax
    ),
    fullMLE: toNum(raw.fullMLE ?? raw.mle),
    roomMLE: toNum(raw.roomMLE ?? raw.rmle),
    bae: toNum(raw.bae),
  };
}

/**
 * Extract the team object from various wrapper formats
 * @param {Object} teamLike - An object that might contain a team
 * @returns {Object|null} The team object or null
 */
export function getTeamObject(teamLike: CapUtilsTeamContainer): CapUtilsTeamData | null {
  if (!teamLike) return null;
  const wrapper = teamLike as CapUtilsTeamWrapper;
  return wrapper.team || wrapper.sourceTeam || wrapper.ctx || (teamLike as CapUtilsTeamData);
}

/**
 * Resolves a team's payroll from various potential fields
 * @param {Object} team - The team object
 * @returns {number} The payroll amount
 */
export function resolvePayroll(team: CapUtilsTeamData | null | undefined): number {
  if (!team) return 0;
  const candidates = [
    team.postTradeStatus?.projectedSalary,
    team.preTradeStatus?.projectedSalary,
    team.projectedSalary,
    team.teamTotalSalary,
    team.totalSalary,
    team.payroll,
  ];
  for (const v of candidates) {
    const n = toNum(v);
    if (n > 0) return n;
  }
  return 0;
}
