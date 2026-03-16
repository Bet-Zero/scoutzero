// Consolidated architect utilities
// Merged from: getCapPercentage.js, hardCapTriggers.js, cbaMechanics.js, defaultPicks.js

type LooseRecord = Record<string, unknown>;

// Calculate salary as percentage of salary cap
const getCapPercentage = (
  salary: number | null | undefined,
  salaryCap: number | null | undefined
): number | null => {
  if (!salary || !salaryCap) return null;

  const percent = (salary / salaryCap) * 100;
  return parseFloat(percent.toFixed(1)); // e.g. 27.8
};

export default getCapPercentage;

// Hard cap trigger tracking
export function markHardCapTriggered(
  teamSeasonState: LooseRecord = {},
  { reason, season }: { reason: any; season: any }
): LooseRecord {
  const current = teamSeasonState.hardCapFirstApron as { active?: boolean } | undefined;
  if (current?.active) return teamSeasonState;
  teamSeasonState.hardCapFirstApron = { active: true, reason, season };
  return teamSeasonState;
}

// CBA mechanics constants
export const CBA_MECHANICS = {
  // Trade Rules
  TRADE_BUFFER_BELOW_CAP: 100_000, // $100K buffer for below-cap teams
  MAX_CASH_IN_TRADE: 7_100_000, // Annual cash limit
  STEPIEN_RULE_YEARS: 7, // No picks 7+ years out

  // Roster Mechanics
  MIN_ROSTER_SIZE: 13, // Teams may drop to 13 for up to 14 days
  MAX_STANDARD_CONTRACTS: 15, // 15 max (excluding two-ways)
  SIGN_AND_TRADE_HARD_CAP: 'FIRST_APRON',

  // Timing Rules
  DEC_15_TRADE_ELIGIBILITY: true, // Most FAs can't be traded until Dec 15
  SIGNING_MORATORIUM_DAYS: 90, // Days until trade-eligible
};

// Default draft picks generation
export const generateDefaultPicks = (): Array<{ year: number; round: string }> => {
  const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
  const picks: Array<{ year: number; round: string }> = [];
  years.forEach((year) => {
    picks.push({ year, round: '1st' });
    picks.push({ year, round: '2nd' });
  });
  return picks;
};

export const attachDefaultPicks = (capSheet: LooseRecord = {}): LooseRecord => {
  if (!Array.isArray(capSheet.picks)) {
    capSheet.picks = generateDefaultPicks();
  }
  return capSheet;
};
