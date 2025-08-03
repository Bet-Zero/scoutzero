/* ========================================================================
   CBA CONSTANTS – structural numbers that rarely change
   ------------------------------------------------------------------------
   WARNING:  Do not put season-specific dollar figures here.  Those belong
   in capProjections.js.  Everything below is “how the rules work”, not
   “what the cap is this year”.
   ===================================================================== */

export const MATCHING_TIERS_2025 = [
  // Cap-room teams (below salary cap before trade)
  {
    maxOutgoing: 0,
    incoming: () => 7_500_000, // flat $7.5 M ceiling
  },

  // Outgoing ≤ $7,499,999   → incoming = 200 %
  {
    maxOutgoing: 7_499_999,
    incoming: (out) => out * 2.0,
  },

  // $7,500,000 – $14,619,999 → 175 % + $100k
  {
    maxOutgoing: 14_619_999,
    incoming: (out) => out * 1.75 + 100_000,
  },

  // ≥ $14,620,000            → outgoing + $5 M
  {
    maxOutgoing: Infinity,
    incoming: (out) => out + 5_000_000,
  },
];

/** “50 % of outgoing” figure for Base-Year Compensation players */
export const BYC_PERCENT = 0.5;

/** Poison-Pill / PPP default multiplier (rookie max extensions before July 1) */
export const PPP_MULTIPLIER = 1.2;

/** Maximum cash a team may send in a league year (2024 CBA) */
export const CASH_LIMIT_2025 = 7_000_000;

/** Roster limits */
export const MAX_STANDARD_PLAYERS = 15;
export const MAX_TWO_WAY_PLAYERS = 3;

/* ======================================================================
     Any future fundamentally new rule (e.g., hard-third-apron in 2027 CBA)
     gets added down here and imported by mechanics – not sprinkled inline.
     ==================================================================== */
