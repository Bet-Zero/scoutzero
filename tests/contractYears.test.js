import { describe, it, expect } from 'vitest';
import {
  getCurrentSeasonYear,
  getYearsRemaining,
} from '@/shared/utils/contracts/index.js';

describe('contract year helpers', () => {
  it('computes current season based on date', () => {
    expect(getCurrentSeasonYear(new Date('2024-06-30'))).toBe(2023);
    expect(getCurrentSeasonYear(new Date('2024-07-01'))).toBe(2024);
  });

  it('calculates years remaining', () => {
    expect(getYearsRemaining(2026, 2024)).toBe(2);
    expect(getYearsRemaining(2023, 2024)).toBe(0);
  });

  it('handles invalid free agency year', () => {
    expect(getYearsRemaining()).toBe(0);
  });
});
