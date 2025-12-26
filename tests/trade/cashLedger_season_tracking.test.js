import { describe, it, expect } from 'vitest';
import { validateCash } from '@/features/architect/utils/tradeMachine/rules/eligibilityRules.js';
import { validationFlags } from '@/config/validationFlags.js';

describe('seasonal cash ledger tracking', () => {
  it('flags when cash out exceeds seasonal cap', () => {
    validationFlags.seasonalCash = 'error';
    // The validateCash function expects team.team.cashLedger.totalOut for prior cash
    // and team.cashOut for current trade cash
    const team = {
      teamId: 1,
      cashOut: 500_000,  // Current trade cash
      cashReceived: 0,
      team: {
        cashLedger: {
          totalOut: 7_000_000,  // Prior cash sent this season
        },
      },
      postTradeStatus: {},
    };
    const res = validateCash(team, { season: 2025 });
    // Total = 7,000,000 (prior) + 500,000 (current) = 7,500,000 > 5,800,000 limit
    expect(res.violations[0]).toMatch(/Cash sent.*would exceed.*seasonal limit/);
  });
});
