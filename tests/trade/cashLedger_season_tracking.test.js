import { describe, it, expect } from 'vitest';
import { validateCash } from '@/features/architect/utils/tradeMachine/rules/validateCash.js';
import { validationFlags } from '@/config/validationFlags.js';

describe('seasonal cash ledger tracking', () => {
  it('flags when cash out exceeds seasonal cap', () => {
    validationFlags.seasonalCash = 'error';
    const team = {
      teamId: 1,
      cashSent: 500_000,
      cashReceived: 0,
      postTradeStatus: {},
    };
    const history = [{ season: 2025, fromTeamId: 1, cashSent: 7_000_000 }];
    const res = validateCash(team, { season: 2025, tradesHistory: history });
    expect(res.violations[0]).toMatch(/Cash sent exceeds seasonal cap/);
  });
});
