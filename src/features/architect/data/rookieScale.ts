/**
 * FILE: src/features/architect/data/rookieScale.ts
 * PURPOSE: Canonical source for Rookie Scale Slot amounts.
 *          Provides 100% scale values for validation enforcement.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-18: Created for Phase 11 (Rookie Scale Enforcement)
 *  - 2026-01-18: Fixed syntax error in number literals and removed duplicate definition.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const ROOKIE_SCALE_MIN_PCT = 0.80; // 80%
export const ROOKIE_SCALE_MAX_PCT = 1.20; // 120%
export const ROOKIE_SCALE_TOLERANCE = 1;  // $1 tolerance for rounding differences

// ============================================================================
// DATA TABLES (100% amounts)
// ============================================================================

/**
 * 2024-25 Rookie Scale (100% Values)
 * Derived from HoopsRumors/RealGM 120% reported figures / 1.2
 */
const ROOKIE_SCALE_2024_25: Record<number, number> = {
  1: 10_474_200,
  2: 9_371_400,
  3: 8_677_000, 
  4: 8_067_200,
  5: 7_399_800,
  6: 6_790_000,
  7: 6_181_100,
  8: 5_656_000,
  9: 5_198_900,
  10: 4_952_200,
  11: 4_706_300,
  12: 4_461_000,
  13: 4_215_100,
  14: 4_043_100,
  15: 3_871_900,
  16: 3_700_000,
  17: 3_527_900,
  18: 3_355_800,
  19: 3_183_700,
  20: 3_011_600,
  21: 2_839_500,
  22: 2_667_400,
  23: 2_495_300,
  24: 2_323_200,
  25: 2_237_100,
  26: 2_151_000,
  27: 2_064_900,
  28: 1_978_800,
  29: 1_892_700,
  30: 1_806_700,
};

export const ROOKIE_SCALE_BY_SEASON: Record<string, Record<number, number>> = {
  '2024-25': ROOKIE_SCALE_2024_25,
};

/**
 * Get 100% Rookie Scale amount for a specific slot and season.
 */
export function getRookieScaleAmount({ seasonKey, pick }: { seasonKey: string; pick: number }): number | null {
  const table = ROOKIE_SCALE_BY_SEASON[seasonKey];
  if (!table) return null;
  return table[pick] || null;
}
