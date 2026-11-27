import {
  CANON_GOVERNED_SEASON_REGISTRY,
  governingCalendarDate,
  isDateOnlyWithinSalaryCapYear,
} from '@/features/architect/utils/governedSeason';

const DAY_MS = 86_400_000;

/** Inclusive date-only day counts under CBA2-C13.23. */
export function minimumSigningSeasonDays(
  worldDate: unknown,
  salaryCapYear: number
) {
  const date = governingCalendarDate(worldDate);
  if (!date || !isDateOnlyWithinSalaryCapYear(date, salaryCapYear)) return null;
  const calendar = CANON_GOVERNED_SEASON_REGISTRY.calendars.find(
    (entry) =>
      entry.salaryCapYear === salaryCapYear && entry.authority === 'official'
  );
  const opening = calendar?.regularSeasonOpening.value;
  const closing = calendar?.regularSeasonClosing.value;
  if (!opening || !closing || date > closing) return null;
  const total = (Date.parse(closing) - Date.parse(opening)) / DAY_MS + 1;
  const remaining =
    (Date.parse(closing) - Date.parse(date < opening ? opening : date)) /
      DAY_MS +
    1;
  return { date, total, remaining, inRegularSeason: date >= opening };
}

/** Express CBA2-C13.23 in the existing whole-dollar Contract representation. */
export function prorateSigningMinimum(
  annualMinimum: number,
  days: ReturnType<typeof minimumSigningSeasonDays>
): number {
  return days
    ? Math.round((annualMinimum * days.remaining) / days.total)
    : annualMinimum;
}
