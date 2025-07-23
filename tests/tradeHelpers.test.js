import { describe, it, expect } from 'vitest';
import { getSalaryForYear } from '../src/utils/architect/tradeHelpers.js';

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
});
