import { describe, it, expect } from 'vitest';
import { hasStepienViolation } from '@/features/architect/utils/tradeMachine/rules/draftRules';

describe('hasStepienViolation', () => {
  it('fails on consecutive unprotected own picks', () => {
    const picks = [
      { year: 2026, round: '1st' },
      { year: 2027, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(true);
  });

  it('fails closed when protection text lacks complete governed history', () => {
    const picks = [
      { year: 2026, round: '1st', protection: 'Top 5' },
      { year: 2027, round: '1st', protection: 'Lottery' },
    ];
    expect(hasStepienViolation(picks)).toBe(true);
  });

  it('treats swap years the same as outright picks for Stepien', () => {
    // Swap picks are NOT excluded from Stepien checks (Phase 1 fix - T3)
    // Proper swap modeling is Phase 2, but swaps should not bypass Stepien validation
    const picks = [
      { year: 2026, round: '1st', isSwap: true },
      { year: 2027, round: '1st', isSwap: true },
    ];
    expect(hasStepienViolation(picks)).toBe(true);
  });

  it('fails closed for mixed partial protection records', () => {
    const picks = [
      { year: 2026, round: '1st' },
      { year: 2027, round: '1st', protection: 'Top 10' },
      { year: 2028, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(true);
  });
});
