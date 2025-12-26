/**
 * FILE: src/features/architect/utils/capHolds.ts
 * PURPOSE: Shared utility functions for cap hold filtering and calculations.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-14: Created - extracted common cap hold logic from CapSheet, CapSummaryTiles, CapImpactTiles
 */

/**
 * Cap hold structure as stored in teamCapSheet.capHolds
 */
export interface CapHold {
  playerId: string;
  playerName: string;
  amount: number;
  season: string; // Format: "YYYY-YY" e.g., "2024-25"
  type: string;
  active: boolean;
  isSigned: boolean;
  reason?: string;
}

/**
 * Parses the start year from a season string.
 * @param season - Season string in format "YYYY-YY" (e.g., "2024-25")
 * @returns The start year as a number, or null if invalid
 */
function parseSeasonStartYear(season: string | undefined | null): number | null {
  if (!season || typeof season !== 'string' || !season.includes('-')) {
    return null;
  }
  const seasonStart = parseInt(season.split('-')[0], 10);
  return Number.isFinite(seasonStart) ? seasonStart : null;
}

/**
 * Filters cap holds to return only active, unsigned holds for a given year.
 * 
 * @param capHolds - Array of cap holds from teamCapSheet.capHolds
 * @param yearKey - The START year of the season (e.g., 2024 for "2024-25" season)
 * @returns Filtered array of active, unsigned cap holds matching the year
 */
export function getActiveUnsignedCapHolds(
  capHolds: CapHold[] | undefined | null,
  yearKey: number
): CapHold[] {
  if (!Array.isArray(capHolds)) {
    return [];
  }

  return capHolds.filter((h) => {
    // Must be active and not signed
    if (!h.active || h.isSigned) return false;

    // Parse season and match to yearKey (start year)
    const seasonStart = parseSeasonStartYear(h.season);
    if (seasonStart === null) return false;

    // Match season start year directly with yearKey
    return seasonStart === yearKey;
  });
}

/**
 * Calculates the total amount of active, unsigned cap holds for a given year.
 * 
 * @param capHolds - Array of cap holds from teamCapSheet.capHolds
 * @param yearKey - The START year of the season (e.g., 2024 for "2024-25" season)
 * @returns Total amount of active, unsigned cap holds
 */
export function getActiveUnsignedCapHoldsTotal(
  capHolds: CapHold[] | undefined | null,
  yearKey: number
): number {
  const activeHolds = getActiveUnsignedCapHolds(capHolds, yearKey);
  return activeHolds.reduce((sum, h) => sum + (h.amount ?? 0), 0);
}

/**
 * Converts an end year to a start year for season matching.
 * Used when components receive selectedYear as the END year (e.g., 2025 for "2024-25").
 * 
 * @param endYear - The end year of the season (e.g., 2025 for "2024-25")
 * @returns The start year (e.g., 2024)
 */
export function endYearToStartYear(endYear: number): number {
  return endYear - 1;
}

/**
 * Gets active, unsigned cap holds using an end year parameter.
 * This is a convenience wrapper for components that track selectedYear as end year.
 * 
 * @param capHolds - Array of cap holds from teamCapSheet.capHolds
 * @param selectedYear - The END year of the season (e.g., 2025 for "2024-25")
 * @returns Filtered array of active, unsigned cap holds
 */
export function getActiveUnsignedCapHoldsByEndYear(
  capHolds: CapHold[] | undefined | null,
  selectedYear: number
): CapHold[] {
  return getActiveUnsignedCapHolds(capHolds, endYearToStartYear(selectedYear));
}

/**
 * Calculates total active, unsigned cap holds using an end year parameter.
 * This is a convenience wrapper for components that track selectedYear as end year.
 * 
 * @param capHolds - Array of cap holds from teamCapSheet.capHolds
 * @param selectedYear - The END year of the season (e.g., 2025 for "2024-25")
 * @returns Total amount of active, unsigned cap holds
 */
export function getActiveUnsignedCapHoldsTotalByEndYear(
  capHolds: CapHold[] | undefined | null,
  selectedYear: number
): number {
  return getActiveUnsignedCapHoldsTotal(capHolds, endYearToStartYear(selectedYear));
}

// ============================================================================
// Cap Hold Calculation - Canonical Implementation
// CBA Reference: Bird Rights Cap Hold Multipliers (2023 CBA)
// ============================================================================

/**
 * Bird rights cap hold multipliers per CBA rules
 * These determine the cap hold amount for free agents based on their Bird rights status
 */
export const CAP_HOLD_MULTIPLIERS = {
  FULL_BIRD: 1.9,      // 190% of prior salary for Full Bird rights
  EARLY_BIRD: 1.75,    // 175% of prior salary for Early Bird rights  
  NON_BIRD: 1.2,       // 120% of prior salary for Non-Bird rights
  MINIMUM: 1.2,        // 120% of minimum salary for players without Bird rights
  ROOKIE_SCALE: 1.2,   // 120% of rookie scale salary for unsigned first-round picks
} as const;

/**
 * Default rookie salary fallback for picks beyond the standard 30.
 * Derived from picks 29-30 average (~$2.45M), rounded to $2.5M.
 * CBA Reference: 2024-25 Rookie Scale (Exhibit B).
 */
export const DEFAULT_ROOKIE_FALLBACK = 2_500_000;

/**
 * Rookie scale salaries by draft pick number (2024-25 values)
 */
export const ROOKIE_SCALE: Record<number, number> = {
  1: 12720000,
  2: 11400000,
  3: 10300000,
  4: 9500000,
  5: 8600000,
  6: 7700000,
  7: 6900000,
  8: 6200000,
  9: 5600000,
  10: 5100000,
  11: 4800000,
  12: 4500000,
  13: 4200000,
  14: 4000000,
  15: 3900000,
  16: 3800000,
  17: 3700000,
  18: 3600000,
  19: 3500000,
  20: 3400000,
  21: 3300000,
  22: 3200000,
  23: 3100000,
  24: 3000000,
  25: 2900000,
  26: 2800000,
  27: 2700000,
  28: 2600000,
  29: 2500000,
  30: 2400000,
};

/**
 * Minimum salary by years of service (2024-25 values)
 */
const MINIMUM_SALARY_BY_YOS: Record<number, number> = {
  0: 1120000,
  1: 1820000,
  2: 2092400,
  3: 2390000,
  4: 2600000,
  5: 2800000,
  6: 3000000,
  7: 3200000,
  8: 3400000,
  9: 3600000,
  10: 3800000,
};

/**
 * Get minimum salary for a player by years of service
 */
export function getMinimumSalaryByYOS(yearsOfService: number): number {
  return MINIMUM_SALARY_BY_YOS[yearsOfService] ?? 3800000;
}

/**
 * Player data structure for cap hold calculation
 */
export interface CapHoldPlayerInput {
  renounced?: boolean;
  bio?: {
    yearsExperience?: number;
  };
  contract?: {
    birdRights?: {
      status?: string;
    };
    salariesByYear?: Array<{
      season?: string;
      salary?: number;
      capHit?: number;
    }>;
  };
  draft?: {
    pick?: number;
    round?: number;
  };
}

/**
 * Cap hold calculation result
 */
export interface CapHoldResult {
  amount: number;
  reason: string;
  active: boolean;
}

/**
 * Calculate cap hold for a player based on their Bird rights status and contract history.
 * 
 * CBA Cap Hold Rules:
 * - Full Bird rights: 190% of prior salary
 * - Early Bird rights: 175% of prior salary
 * - Non-Bird rights: 120% of prior salary
 * - No Bird rights: 120% of minimum salary
 * - Unsigned first-round picks: 120% of rookie scale salary
 * 
 * @param player - Player data including contract and Bird rights info
 * @returns Cap hold result with amount and reason, or null if renounced
 */
export function calculateCapHold(player: CapHoldPlayerInput): CapHoldResult | null {
  if (player.renounced) return null;

  const experience = player.bio?.yearsExperience ?? 0;
  const rights = player.contract?.birdRights?.status ?? 'None';

  // Calculate last salary from contract history
  let lastSalary = 0;
  if (player.contract?.salariesByYear?.length) {
    const sorted = [...player.contract.salariesByYear].sort((a, b) => {
      const ya = parseSeasonStartYear(a.season) ?? 0;
      const yb = parseSeasonStartYear(b.season) ?? 0;
      return ya - yb;
    });
    const last = sorted[sorted.length - 1];
    lastSalary = last?.salary ?? last?.capHit ?? 0;
  }

  const pickNumber = player.draft?.pick ?? null;
  const draftRound = player.draft?.round ?? null;

  // Unsigned first-round picks: 120% of rookie scale
  if (draftRound === 1 && pickNumber) {
    const rookieAmount = ROOKIE_SCALE[pickNumber] ?? DEFAULT_ROOKIE_FALLBACK;
    return {
      amount: Math.round(rookieAmount * CAP_HOLD_MULTIPLIERS.ROOKIE_SCALE),
      reason: 'Rookie Scale',
      active: true,
    };
  }

  // No Bird rights: 120% of minimum salary
  if (!rights || rights === 'None') {
    const minSalary = getMinimumSalaryByYOS(experience);
    return {
      amount: Math.round(minSalary * CAP_HOLD_MULTIPLIERS.MINIMUM),
      reason: 'Minimum Hold',
      active: true,
    };
  }

  // Bird rights: apply appropriate multiplier
  const multiplierMap: Record<string, number> = {
    'Non-Bird': CAP_HOLD_MULTIPLIERS.NON_BIRD,
    'Early Bird': CAP_HOLD_MULTIPLIERS.EARLY_BIRD,
    'Full Bird': CAP_HOLD_MULTIPLIERS.FULL_BIRD,
  };
  const multiplier = multiplierMap[rights] ?? CAP_HOLD_MULTIPLIERS.NON_BIRD;

  // For Bird rights with no prior salary, use minimum salary as fallback
  // This ensures meaningful cap holds for players with missing salary data
  if (!lastSalary && (rights === 'Early Bird' || rights === 'Full Bird')) {
    const fallbackSalary = getMinimumSalaryByYOS(experience);
    return {
      amount: Math.round(fallbackSalary * multiplier),
      reason: `${rights} Rights (min fallback)`,
      active: true,
    };
  }

  return {
    amount: Math.round(lastSalary * multiplier),
    reason: `${rights} Rights`,
    active: true,
  };
}
