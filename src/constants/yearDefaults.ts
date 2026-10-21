import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';

export const DEFAULT_SALARY_YEAR: number = getCurrentSeasonYear();

export function getSalaryYearOptions(): number[] {
  const defaultYear = DEFAULT_SALARY_YEAR;
  const years: number[] = [];
  for (let y = defaultYear - 1; y <= defaultYear + 5; y++) {
    years.push(y);
  }
  return years;
}

export const SALARY_YEAR_OPTIONS: number[] = getSalaryYearOptions();

// Upcoming season start years (free-agent classes, option years), beginning
// with the current season so dropdowns never offer a season that has passed.
// Computed per call so a page left open across July 1 still rolls over.
export function getUpcomingSeasonYears(count = 8): number[] {
  const startYear = getCurrentSeasonYear();
  return Array.from({ length: count }, (_, i) => startYear + i);
}
