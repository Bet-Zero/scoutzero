import { describe, it, expect } from 'vitest';
import { hasStepienViolation } from '../src/utils/architect/tradeMachine/tradeValidator.js';

describe('hasStepienViolation', () => {
  it('detects consecutive unprotected first round picks', () => {
    const picks = [
      { year: 2026, round: '1st' },
      { year: 2027, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(true);
  });

  it('allows alternating unprotected firsts', () => {
    const picks = [
      { year: 2026, round: '1st' },
      { year: 2028, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(false);
  });

  it('ignores protected picks when checking', () => {
    const picks = [
      { year: 2026, round: '1st', protection: 'Top 10' },
      { year: 2027, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(false);
  });

  it('ignores swapped picks when checking', () => {
    const picks = [
      { year: 2026, round: '1st', isSwap: true },
      { year: 2027, round: '1st' },
    ];
    expect(hasStepienViolation(picks)).toBe(false);
  });
});
