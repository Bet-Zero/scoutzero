// constants/cbaMechanics.js
export const CBA_MECHANICS = {
  // Trade Rules
  TRADE_BUFFER_BELOW_CAP: 100_000, // $100K buffer for below-cap teams
  MAX_CASH_IN_TRADE: 7_100_000, // Annual cash limit
  STEPIEN_RULE_YEARS: 7, // No picks 7+ years out

  // Roster Mechanics
  MIN_ROSTER_SIZE: 14, // Must carry 14 players
  MAX_STANDARD_CONTRACTS: 15, // 15 max (excluding two-ways)
  SIGN_AND_TRADE_HARD_CAP: 'FIRST_APRON', // Teams can't cross this (comma added here)

  // Timing Rules
  DEC_15_TRADE_ELIGIBILITY: true, // Most FAs can't be traded until Dec 15
  SIGNING_MORATORIUM_DAYS: 90, // Days until trade-eligible
};
