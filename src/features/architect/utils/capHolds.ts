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
