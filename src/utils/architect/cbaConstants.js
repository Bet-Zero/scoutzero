/**************************  SCSP™ BLOCK: cbaConstants.js  **************************
 * FUTURE-PROOF CBA CONSTANTS
 * - Exports CBA_BY_YEAR → { 2025: { matchingTiers, cashLimit, … }, … }
 * - Adds getMatchingTiers(year) helper for tradeHelpers.js (defaults to 2025)
 * - Keeps BYC_PERCENT / PPP_MULTIPLIER / roster limits untouched
 * -------------------------------------------------------------------------------*/
export const CBA_BY_YEAR = {
  2025: {
    salaryCap: 141_000_000,
    salaryTiers: [6_500_000, 19_600_000], // legacy thresholds
    /* 2023 CBA §6(f)(2) — salary-matching tiers */
    matchingTiers: [
      // Cap-room teams (payroll below cap before trade) → flat $7.5 M ceiling
      { maxOutgoing: 0, incoming: () => 7_500_000 },

      // Outgoing ≤ $7,499,999  → 200 %
      { maxOutgoing: 7_499_999, incoming: (out) => out * 2.0 },

      // $7,500,000 – $14,619,999 → 175 % + $100 k
      { maxOutgoing: 14_619_999, incoming: (out) => out * 1.75 + 100_000 },

      // ≥ $14,620,000 → outgoing + $5 M
      { maxOutgoing: Infinity, incoming: (out) => out + 5_000_000 },
    ],
    cashLimit: 7_000_000, // max cash a team may send in 2024-25
  },

  // 🔮 Future seasons drop in here with their own tier arrays if the CBA changes
};

/** Helper – returns correct tier table for the given league year */
export const getMatchingTiers = (year = 2025) =>
  CBA_BY_YEAR[year]?.matchingTiers || CBA_BY_YEAR[2025].matchingTiers;

/* --------------------------------------------------------------------------
     Misc “structural” constants (unchanged)
  -------------------------------------------------------------------------- */
export const BYC_PERCENT = 0.5; // 50 % of outgoing for BYC players
export const PPP_MULTIPLIER = 1.2; // poison-pill default (rookie max ext.)
export const MAX_STANDARD_PLAYERS = 15; // roster size (two-ways excluded)
export const MAX_TWO_WAY_PLAYERS = 3;
/***********************  END SCSP™ BLOCK: cbaConstants.js  ***********************/
