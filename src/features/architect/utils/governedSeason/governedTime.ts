/**
 * FILE: src/features/architect/utils/governedSeason/governedTime.ts
 * PURPOSE: Shared dated primitives for the governed season-input envelope.
 * OWNERSHIP: Feature: architect/governed season inputs
 *
 * BZE-270. These primitives are deliberately the only place the governed path
 * interprets a date. Nothing here reads the runtime clock: there is no
 * `Date.now()`, no `new Date()` without an argument, and no current-year
 * derivation. A caller that has no date gets `null` and must fail closed
 * (Canon `CBA2-L01.1`).
 *
 * `CBA2-L01.8` forbids normalizing a date-only rule to an assumed local
 * midnight, so date-only source values keep their own type and are never
 * silently widened into an instant.
 */

/** Zoned ISO-8601 instant: requires an explicit `Z` or numeric UTC offset. */
const ZONED_ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Calendar date with no time component and no implied zone. */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Eastern-time offset used for Salary Cap Year boundaries. July 1 and June 30
 * both fall inside US daylight time every year, so the boundary offset is
 * constant at -04:00 and needs no zone database.
 */
const SALARY_CAP_YEAR_BOUNDARY_OFFSET = '-04:00';

/** Governing time zone the Canon attaches to CBA and league calendar dates. */
export const GOVERNING_TIME_ZONE = 'America/New_York';

type GoverningDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const GOVERNING_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: GOVERNING_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

/** True only for an ISO-8601 instant that names its own offset. */
export function isZonedDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    ZONED_ISO_DATE_TIME.test(value) &&
    hasValidCalendarDate(value) &&
    Number.isFinite(Date.parse(value))
  );
}

/** True only for a bare `YYYY-MM-DD` calendar date. */
export function isDateOnly(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    ISO_DATE_ONLY.test(value) &&
    hasValidCalendarDate(value)
  );
}

/** Epoch milliseconds for a zoned instant, or `null` when it is not one. */
export function parseZonedDateTime(value: unknown): number | null {
  return isZonedDateTime(value) ? Date.parse(value) : null;
}

function governingParts(
  epochMilliseconds: number
): GoverningDateTimeParts | null {
  if (!Number.isFinite(epochMilliseconds)) return null;
  const values = Object.fromEntries(
    GOVERNING_PARTS_FORMATTER.formatToParts(epochMilliseconds).map((part) => [
      part.type,
      part.value,
    ])
  );
  const parts = {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
  return Object.values(parts).every(Number.isFinite) ? parts : null;
}

/**
 * Governing Eastern calendar day for a saved-world date or offset-bearing
 * instant. A date-only value already names that day; an instant is converted
 * before its calendar fields are compared.
 */
export function governingCalendarDate(value: unknown): string | null {
  if (isDateOnly(value)) return value;
  const epochMilliseconds = parseZonedDateTime(value);
  if (epochMilliseconds === null) return null;
  const parts = governingParts(epochMilliseconds);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(
    2,
    '0'
  )}-${String(parts.day).padStart(2, '0')}`;
}

function governingOffsetMinutes(epochMilliseconds: number): number | null {
  const parts = governingParts(epochMilliseconds);
  if (!parts) return null;
  const localFieldsAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return Math.round((localFieldsAsUtc - epochMilliseconds) / 60_000);
}

/**
 * Resolve a saved-world calendar date to midnight in the governing Eastern
 * zone. Offset-bearing instants keep their exact instant. This is deliberately
 * contextual: generic Canon date-only values remain date-only elsewhere.
 */
export function governingDayStartInstant(value: unknown): string | null {
  if (isZonedDateTime(value)) return value;
  if (!isDateOnly(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const intendedFieldsAsUtc = Date.UTC(year, month - 1, day);
  const firstOffset = governingOffsetMinutes(intendedFieldsAsUtc);
  if (firstOffset === null) return null;
  let epochMilliseconds = intendedFieldsAsUtc - firstOffset * 60_000;
  const resolvedOffset = governingOffsetMinutes(epochMilliseconds);
  if (resolvedOffset === null) return null;
  epochMilliseconds = intendedFieldsAsUtc - resolvedOffset * 60_000;
  const parts = governingParts(epochMilliseconds);
  if (
    !parts ||
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day ||
    parts.hour !== 0 ||
    parts.minute !== 0 ||
    parts.second !== 0
  ) {
    return null;
  }

  const sign = resolvedOffset >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(resolvedOffset);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
  const offsetMinutes = String(absoluteOffset % 60).padStart(2, '0');
  return `${value}T00:00:00${sign}${offsetHours}:${offsetMinutes}`;
}

export interface SalaryCapYearWindow {
  /** Inclusive start: July 1 of the prior calendar year, Eastern time. */
  readonly from: string;
  /** Exclusive end: July 1 of the Salary Cap Year, Eastern time. */
  readonly until: string;
}

/**
 * A Salary Cap Year is representable only when both it and the prior calendar
 * year are four-digit ISO years, because every date primitive here parses
 * `\d{4}` calendar strings. Outside this range the boundary strings become
 * unparseable and `Date.parse` yields `NaN`, which silently answers `false` to
 * every comparison — a validator reading that as "no violation" would accept a
 * record it never actually checked. Rejecting the year at the single place both
 * the resolver and the record validator derive from keeps that fail-closed.
 */
const MIN_SALARY_CAP_YEAR = 1001;
const MAX_SALARY_CAP_YEAR = 9999;

/** True only for a Salary Cap Year that yields valid ISO year boundaries. */
export function isSupportedSalaryCapYear(salaryCapYear: unknown): boolean {
  return (
    typeof salaryCapYear === 'number' &&
    Number.isInteger(salaryCapYear) &&
    salaryCapYear >= MIN_SALARY_CAP_YEAR &&
    salaryCapYear <= MAX_SALARY_CAP_YEAR
  );
}

/**
 * Boundaries of a Salary Cap Year identified by its end year, e.g. 2026 for
 * the 2025-26 Salary Cap Year. The Canon fixes the year on a July 1 to June 30
 * period (Moratorium opens July 1 of the Salary Cap Year per `CBA2-L03.15`;
 * stretch and post-season windows close June 30 per `CBA2-R04.2`).
 *
 * Returns `null` for any year that cannot produce valid ISO boundaries; every
 * caller must branch on that rather than assume a window exists.
 */
export function salaryCapYearWindow(
  salaryCapYear: number
): SalaryCapYearWindow | null {
  if (!isSupportedSalaryCapYear(salaryCapYear)) return null;

  return {
    from: `${salaryCapYear - 1}-07-01T00:00:00${SALARY_CAP_YEAR_BOUNDARY_OFFSET}`,
    until: `${salaryCapYear}-07-01T00:00:00${SALARY_CAP_YEAR_BOUNDARY_OFFSET}`,
  };
}

/** True when a zoned instant falls inside `[from, until)` of its cap year. */
export function isWithinSalaryCapYear(
  asOfDate: string,
  salaryCapYear: number
): boolean {
  const window = salaryCapYearWindow(salaryCapYear);
  const asOfTime = parseZonedDateTime(asOfDate);
  if (!window || asOfTime === null) return false;

  return (
    asOfTime >= Date.parse(window.from) && asOfTime < Date.parse(window.until)
  );
}

/**
 * True when a date-only calendar value falls inside the Salary Cap Year. The
 * comparison stays on the calendar-date field so a date-only source value is
 * never promoted to an instant (`CBA2-L01.8`).
 */
export function isDateOnlyWithinSalaryCapYear(
  value: string,
  salaryCapYear: number
): boolean {
  if (!isDateOnly(value) || !isSupportedSalaryCapYear(salaryCapYear)) {
    return false;
  }

  return (
    value >= `${salaryCapYear - 1}-07-01` && value <= `${salaryCapYear}-06-30`
  );
}

/** Season key for a Salary Cap Year end year, e.g. 2026 becomes `2025-26`. */
export function seasonKeyForSalaryCapYear(
  salaryCapYear: number
): string | null {
  if (!isSupportedSalaryCapYear(salaryCapYear)) return null;

  return `${salaryCapYear - 1}-${String(salaryCapYear % 100).padStart(2, '0')}`;
}
