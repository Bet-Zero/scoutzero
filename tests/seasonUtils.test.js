import { describe, expect, it } from 'vitest';
import {
  getCapHitForSeason,
  getSalaryForSeason,
  getSeasonForYear,
  normalizeYearInput,
  seasonToYear,
  yearToSeason,
} from '@/features/architect/utils/tradeMachine/utils/seasonUtils';
import { getCapHitForSeason as getCapHitForSeasonFromSalaryUtils } from '@/features/architect/utils/tradeMachine/utils/salaryUtils';

describe('seasonUtils compatibility surface', () => {
  it('preserves season/year conversions', () => {
    expect(seasonToYear(2026)).toBe(2026);
    expect(seasonToYear('2025-26')).toBe(2025);
    expect(seasonToYear('invalid')).toBe(0);
    expect(yearToSeason(2026)).toBe('2025-26');
    expect(yearToSeason(0)).toBeNull();
    expect(yearToSeason('2026')).toBeNull();
  });

  it('prefers contract over primaryContract and finds the target season', () => {
    const player = {
      contract: {
        salariesByYear: [{ season: '2025-26', salary: 7_000_000 }],
      },
      primaryContract: {
        salariesByYear: [{ season: '2025-26', salary: 8_000_000 }],
      },
    };

    expect(getSeasonForYear(player, 2026)).toBe('2025-26');
  });

  it('falls back to primaryContract when contract is missing', () => {
    const player = {
      primaryContract: {
        salariesByYear: [{ season: '2025-26', salary: 8_000_000 }],
      },
    };

    expect(getSeasonForYear(player, 2026)).toBe('2025-26');
  });

  it('preserves salary, cap-hit, and missing-season lookup behavior', () => {
    const player = {
      contract: {
        salariesByYear: [
          { season: '2024-25', salary: 5_000_000, capHit: 5_500_000 },
          { season: '2025-26', capHit: 6_500_000 },
        ],
      },
    };

    expect(getSalaryForSeason(player, '2024-25')).toBe(5_000_000);
    expect(getSalaryForSeason(player, '2024-2025')).toBe(5_000_000);
    expect(getCapHitForSeason(player, '2024-25')).toBe(5_500_000);
    expect(getSalaryForSeason(player, '2025-26')).toBe(0);
    expect(getCapHitForSeason(player, '2025-26')).toBe(6_500_000);
    expect(getSalaryForSeason(player, '2030-31')).toBe(0);
  });

  it('keeps numeric cap-hit lookup semantics unchanged for seasonUtils and salaryUtils', () => {
    const player = {
      contract: {
        salariesByYear: [
          { season: '2024-25', salary: 5_000_000, capHit: 5_500_000 },
          { season: '2025-26', salary: 6_000_000, capHit: 6_500_000 },
        ],
      },
    };

    expect(getCapHitForSeason(player, 2025)).toBe(6_500_000);
    expect(getCapHitForSeasonFromSalaryUtils(player, 2025)).toBe(6_500_000);
  });

  it('preserves normalizeYearInput end-year semantics separately from salary lookup semantics', () => {
    expect(normalizeYearInput(2025)).toEqual({
      endYear: 2025,
      seasonString: '2024-25',
    });
  });
});
