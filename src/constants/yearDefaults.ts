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
