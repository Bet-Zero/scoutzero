/** Exact Eastern-time rules used by governed RFA Offer Sheet decisions. */

import {
  GOVERNING_TIME_ZONE,
  isDateOnly,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';

function easternOffsetAt(value: string): string | null {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: GOVERNING_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(value))
    .find((part) => part.type === 'timeZoneName')?.value;
  const offset = timeZoneName?.replace('GMT', '');
  return offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null;
}

export function isEasternInstant(value: unknown): value is string {
  return isZonedDateTime(value) && easternOffsetAt(value) === value.slice(-6);
}

export function requireEasternInstant(
  value: unknown,
  label: string,
  reasons: string[]
): string | null {
  if (!isEasternInstant(value)) {
    reasons.push(`${label} must be an exact Eastern-time instant.`);
    return null;
  }
  return value;
}

export function compareInstant(left: string, right: string): number {
  const leftMilliseconds = parseZonedDateTime(left);
  const rightMilliseconds = parseZonedDateTime(right);
  if (leftMilliseconds == null || rightMilliseconds == null) {
    return Number.NaN;
  }
  return leftMilliseconds - rightMilliseconds;
}

function localParts(value: string) {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
    hour: Number(value.slice(11, 13)),
    offset: value.slice(-6),
  };
}

function dateAfterDays(value: string, days: number): string {
  const { year, month, day } = localParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function composeEasternInstant(localDateTime: string): string | null {
  for (const offset of ['-05:00', '-04:00']) {
    const candidate = `${localDateTime}${offset}`;
    if (easternOffsetAt(candidate) === offset) return candidate;
  }

  return null;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function exerciseNoticeDeadline(receivedAt: string): string {
  const { year, month, day, hour } = localParts(receivedAt);
  if (month === 7 && day >= 1 && day <= 6) {
    return `${year}-07-07T23:59:59-04:00`;
  }
  const days = hour < 12 ? 1 : 2;
  const deadline = composeEasternInstant(
    `${dateAfterDays(receivedAt, days)}T23:59:59`
  );
  if (!deadline) {
    throw new Error(
      'The Exercise Notice deadline is not a valid Eastern instant.'
    );
  }
  return deadline;
}

export function oneYearAfter(value: string): string | null {
  const { year, month, day } = localParts(value);
  const nextYear = year + 1;
  const normalizedDay =
    month === 2 && day === 29 && !isLeapYear(nextYear) ? 28 : day;
  const localDate = `${nextYear}-${String(month).padStart(2, '0')}-${String(
    normalizedDay
  ).padStart(2, '0')}`;
  const localTime = value.slice(11, -6);
  return composeEasternInstant(`${localDate}T${localTime}`);
}

export function worldDateContainsInstant(
  worldAsOfDate: unknown,
  instant: string
): boolean {
  if (isDateOnly(worldAsOfDate)) return worldAsOfDate === instant.slice(0, 10);
  return (
    isZonedDateTime(worldAsOfDate) &&
    compareInstant(instant, worldAsOfDate) <= 0
  );
}

export function worldDateHasReachedInstant(
  worldAsOfDate: unknown,
  instant: string
): boolean {
  if (isDateOnly(worldAsOfDate)) {
    return worldAsOfDate >= instant.slice(0, 10);
  }
  return (
    isZonedDateTime(worldAsOfDate) &&
    compareInstant(worldAsOfDate, instant) >= 0
  );
}

export function qualifyingOfferDeadlines(salaryCapYear: number) {
  const startYear = salaryCapYear - 1;
  return {
    delivery: `${startYear}-06-29T17:00:00-04:00`,
    unilateralWithdrawalEnds: `${startYear}-07-13T23:59:59-04:00`,
    consentWithdrawalStarts: `${startYear}-07-14T00:00:00-04:00`,
    ordinaryOpenThrough: `${startYear}-10-01T23:59:59-04:00`,
    absoluteOpenThrough: `${salaryCapYear}-03-01T23:59:59-05:00`,
    offerSheetLastSignedAt: `${salaryCapYear}-03-01T23:59:59-05:00`,
  };
}

export function businessDaysBetween(from: string, through: string): number {
  const start = new Date(`${from.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${through.slice(0, 10)}T12:00:00Z`);
  let count = 0;
  for (
    let cursor = new Date(start.getTime() + 86_400_000);
    cursor <= end;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}
