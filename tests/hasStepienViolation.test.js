import { describe, it, expect } from 'vitest';
import { hasStepienViolation } from '@/features/architect/utils/tradeMachine/rules/draftRules.js';

describe('hasStepienViolation', () => {
  it('fails on consecutive unprotected own picks', () => {
    const picks = [
      { year: 2026, round: '1st' },
      { year: 2027, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(true);
  });

  it('passes when picks are protected', () => {
    const picks = [
      { year: 2026, round: '1st', protection: 'Top 5' },
      { year: 2027, round: '1st', protection: 'Lottery' },
    ];
    expect(hasStepienViolation(picks)).toBe(false);
  });

  it('ignores swap years', () => {
    const picks = [
      { year: 2026, round: '1st', isSwap: true },
      { year: 2027, round: '1st', isSwap: true },
    ];
    expect(hasStepienViolation(picks)).toBe(false);
  });

  it('handles mixed protected and unprotected picks', () => {
    const picks = [
      { year: 2026, round: '1st' },
      { year: 2027, round: '1st', protection: 'Top 10' },
      { year: 2028, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(false);
  });
});
