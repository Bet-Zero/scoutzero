import { describe, it, expect } from 'vitest';
import { DEFAULT_SALARY_YEAR, getUpcomingSeasonYears } from '@/constants/yearDefaults';
import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';

describe('yearDefaults', () => {
  it('starts upcoming season years at the current season', () => {
    expect(DEFAULT_SALARY_YEAR).toBe(getCurrentSeasonYear());
    expect(getUpcomingSeasonYears(3)).toEqual([
      DEFAULT_SALARY_YEAR,
      DEFAULT_SALARY_YEAR + 1,
      DEFAULT_SALARY_YEAR + 2,
    ]);
  });

  it('rolls the season over on July 1', () => {
    expect(getCurrentSeasonYear(new Date(Date.UTC(2026, 5, 30)))).toBe(2025);
    expect(getCurrentSeasonYear(new Date(Date.UTC(2026, 6, 1)))).toBe(2026);
  });
});
