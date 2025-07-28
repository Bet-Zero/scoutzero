import { describe, it, expect } from 'vitest';
import {
  getSalaryForYear,
  areSamePick,
  calculateAllowableIncoming,
  MIN_SALARY,
} from '../src/utils/architect/tradeHelpers.js';

describe('getSalaryForYear', () => {
  it('sums salary from contract_clean', () => {
    const player = {
      contract_clean: { salaries_by_year: { 2025: { salary: 5000000 } } },
    };
    expect(getSalaryForYear([player], 2025)).toBe(5000000);
  });

  it('sums salary from salaryByYear when contract_clean missing', () => {
    const player = {
      salaryByYear: { 2025: 4000000 },
    };
    expect(getSalaryForYear([player], 2025)).toBe(4000000);
  });

  it('prefers contract_clean value when both provided', () => {
    const player = {
      contract_clean: { salaries_by_year: { 2025: { salary: 6000000 } } },
      salaryByYear: { 2025: 4000000 },
    };
    expect(getSalaryForYear([player], 2025)).toBe(6000000);
  });

  it('includes likely bonuses in salary', () => {
    const player = {
      contract_clean: {
        salaries_by_year: {
          2025: { salary: 5000000, bonuses: { likely: 1000000, unlikely: 2000000 } },
        },
      },
    };
    expect(getSalaryForYear([player], 2025)).toBe(6000000);
  });
});

describe('areSamePick', () => {
  it('matches picks with numeric and string values', () => {
    const a = { year: 2026, round: 1, via: 'LAL' };
    const b = { year: '2026', round: '1', via: 'LAL' };
    expect(areSamePick(a, b)).toBe(true);
  });
});

describe('calculateAllowableIncoming', () => {
  const settings = { cap: 150000000, firstApron: 190000000, secondApron: 200000000, yearKey: 2025 };

  it('adds minimum salary exception when over cap', () => {
    const player = { salary: MIN_SALARY };
    const allowable = calculateAllowableIncoming(160000000, 0, [player], [], settings);
    expect(allowable).toBeCloseTo(MIN_SALARY + 100000, 0);
  });

  it('includes TPE amounts', () => {
    const tpe = { amount: 5000000 };
    const allowable = calculateAllowableIncoming(160000000, 0, [], [tpe], settings);
    expect(allowable).toBe(5100000); // 100k buffer + tpe
  });
});
