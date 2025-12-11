/**
 * FILE: src/features/architect/utils/seasonHelpers.ts
 * PURPOSE: Canonical season utilities for Architect timing model.
 *          Provides standardized SeasonId type and helper functions.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-11: Initial implementation per Architect Timing Plan.
 *
 * LINKS:
 *  - Plan: plans/architect-timing/plan.md
 */

/**
 * Canonical season identifier in "YYYY-YY" format.
 * Examples: "2024-25", "2025-26", "2026-27"
 *
 * Convention:
 * - The first four digits are the START year of the NBA season
 * - The last two digits are the END year
 * - E.g., "2024-25" is the season that starts October 2024 and ends June 2025
 */
export type SeasonId = `${number}-${number}`;

/** Regex pattern for validating SeasonId format */
const SEASON_ID_REGEX = /^(\d{4})-(\d{2})$/;

/**
 * Validate that a string is a valid SeasonId
 * @param value - String to validate
 * @returns True if value is a valid SeasonId
 */
export function isValidSeasonId(value: string | null | undefined): value is SeasonId {
  if (!value || typeof value !== 'string') return false;
  const match = value.match(SEASON_ID_REGEX);
  if (!match) return false;
  
  const startYear = parseInt(match[1], 10);
  const endYearShort = parseInt(match[2], 10);
  
  // Validate years are reasonable
  if (startYear < 1900 || startYear > 2100) return false;
  
  // Validate end year matches start year + 1
  const expectedEndShort = (startYear + 1) % 100;
  return endYearShort === expectedEndShort;
}

/**
 * Parse a SeasonId into its component years
 * @param seasonId - Season ID in "YYYY-YY" format (e.g., "2024-25")
 * @returns Object with startYear and endYear, or null if invalid
 */
export function parseSeasonId(seasonId: SeasonId | string | null | undefined): { startYear: number; endYear: number } | null {
  if (!seasonId || typeof seasonId !== 'string') return null;
  
  const match = seasonId.match(SEASON_ID_REGEX);
  if (!match) return null;
  
  const startYear = parseInt(match[1], 10);
  
  // For NBA seasons, the end year is always start year + 1
  // The two-digit suffix is just formatting: "2024-25" means 2024 to 2025
  // This handles century boundaries correctly: "1999-00" means 1999 to 2000
  const endYear = startYear + 1;
  
  return { startYear, endYear };
}

/**
 * Create a SeasonId from the season's start year
 * @param startYear - Start year of the season (e.g., 2024)
 * @returns SeasonId in "YYYY-YY" format (e.g., "2024-25")
 */
export function makeSeasonIdFromStartYear(startYear: number): SeasonId {
  if (!Number.isFinite(startYear) || startYear < 1900 || startYear > 2100) {
    throw new Error(`Invalid start year: ${startYear}`);
  }
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}` as SeasonId;
}

/**
 * Create a SeasonId from the season's end year
 * @param endYear - End year of the season (e.g., 2025 for 2024-25)
 * @returns SeasonId in "YYYY-YY" format (e.g., "2024-25")
 */
export function makeSeasonIdFromEndYear(endYear: number): SeasonId {
  if (!Number.isFinite(endYear) || endYear < 1901 || endYear > 2101) {
    throw new Error(`Invalid end year: ${endYear}`);
  }
  const startYear = endYear - 1;
  const endYearShort = String(endYear % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}` as SeasonId;
}

/**
 * Get the previous season
 * @param seasonId - Current season (e.g., "2025-26")
 * @returns Previous season (e.g., "2024-25")
 */
export function prevSeason(seasonId: SeasonId): SeasonId {
  const parsed = parseSeasonId(seasonId);
  if (!parsed) {
    throw new Error(`Invalid SeasonId: ${seasonId}`);
  }
  return makeSeasonIdFromStartYear(parsed.startYear - 1);
}

/**
 * Get the next season
 * @param seasonId - Current season (e.g., "2024-25")
 * @returns Next season (e.g., "2025-26")
 */
export function nextSeason(seasonId: SeasonId): SeasonId {
  const parsed = parseSeasonId(seasonId);
  if (!parsed) {
    throw new Error(`Invalid SeasonId: ${seasonId}`);
  }
  return makeSeasonIdFromStartYear(parsed.startYear + 1);
}

/**
 * Add or subtract seasons (delta can be negative)
 * @param seasonId - Starting season (e.g., "2024-25")
 * @param delta - Number of seasons to add (e.g., 2)
 * @returns Resulting season (e.g., "2026-27")
 */
export function addSeasons(seasonId: SeasonId, delta: number): SeasonId {
  const parsed = parseSeasonId(seasonId);
  if (!parsed) {
    throw new Error(`Invalid SeasonId: ${seasonId}`);
  }
  return makeSeasonIdFromStartYear(parsed.startYear + delta);
}

/**
 * Compare two seasons
 * @param a - First season
 * @param b - Second season
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareSeasons(a: SeasonId, b: SeasonId): -1 | 0 | 1 {
  const parsedA = parseSeasonId(a);
  const parsedB = parseSeasonId(b);
  
  if (!parsedA || !parsedB) {
    throw new Error(`Invalid SeasonId(s): ${a}, ${b}`);
  }
  
  if (parsedA.startYear < parsedB.startYear) return -1;
  if (parsedA.startYear > parsedB.startYear) return 1;
  return 0;
}

/**
 * Get the minimum of two seasons
 * @param a - First season
 * @param b - Second season
 * @returns The earlier season
 */
export function minSeason(a: SeasonId, b: SeasonId): SeasonId {
  return compareSeasons(a, b) <= 0 ? a : b;
}

/**
 * Get the maximum of two seasons
 * @param a - First season
 * @param b - Second season
 * @returns The later season
 */
export function maxSeason(a: SeasonId, b: SeasonId): SeasonId {
  return compareSeasons(a, b) >= 0 ? a : b;
}

/**
 * Get current NBA season based on a date (July 1 rule)
 *
 * The NBA league year begins on July 1. This function determines which season
 * a given date falls into:
 *
 * - If date is between July 1 and December 31 of year Y:
 *   Returns season "Y-(Y+1 last 2 digits)" (e.g., Aug 15, 2024 → "2024-25")
 *
 * - If date is between January 1 and June 30 of year Y:
 *   Returns season "(Y-1)-(Y last 2 digits)" (e.g., Mar 10, 2025 → "2024-25")
 *
 * @param date - Date to evaluate (defaults to now)
 * @returns Current SeasonId (e.g., if date is Aug 2024, returns "2024-25")
 */
export function getCurrentSeasonId(date: Date = new Date()): SeasonId {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 6 = Jul
  
  // July 1 is the start of the new league year
  // If we're in July or later, we're in the season that starts this year
  // If we're before July, we're in the season that started last year
  const startYear = month >= 6 ? year : year - 1;
  
  return makeSeasonIdFromStartYear(startYear);
}

/**
 * Get current NBA season year (end year) based on a date
 * 
 * @param date - Date to evaluate (defaults to now)
 * @returns End year of current season (e.g., 2025 for "2024-25")
 */
export function getCurrentSeasonEndYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 6 = Jul
  
  // July 1 is the start of the new league year
  return month >= 6 ? year + 1 : year;
}

/**
 * Normalize various season formats to canonical SeasonId
 * Handles: "2024-25", "2025", 2025, "2024-2025"
 *
 * @param input - Season in various formats
 * @returns SeasonId if valid, null if input cannot be parsed
 *
 * Valid Inputs:
 * - "2024-25" → "2024-25" (already canonical)
 * - "2025" → "2024-25" (interpreted as end year)
 * - 2025 → "2024-25" (numeric end year)
 * - "2024-2025" → "2024-25" (full year format)
 *
 * Invalid Inputs (returns null):
 * - "" (empty string)
 * - "invalid"
 * - "20-25" (malformed)
 * - "2024-2026" (non-consecutive years)
 * - NaN, Infinity, negative numbers
 */
export function normalizeToSeasonId(input: string | number | null | undefined): SeasonId | null {
  if (input === null || input === undefined) return null;
  
  // Handle numeric input (interpreted as end year)
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 1901 || input > 2101) return null;
    try {
      return makeSeasonIdFromEndYear(input);
    } catch {
      return null;
    }
  }
  
  // Handle string input
  if (typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Already in "YYYY-YY" format
  if (SEASON_ID_REGEX.test(trimmed)) {
    return isValidSeasonId(trimmed) ? trimmed as SeasonId : null;
  }
  
  // Handle "YYYY-YYYY" format (e.g., "2024-2025")
  const fullYearMatch = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (fullYearMatch) {
    const startYear = parseInt(fullYearMatch[1], 10);
    const endYear = parseInt(fullYearMatch[2], 10);
    if (endYear !== startYear + 1) return null; // Non-consecutive years
    try {
      return makeSeasonIdFromStartYear(startYear);
    } catch {
      return null;
    }
  }
  
  // Handle "YYYY" format (interpreted as end year)
  const yearOnlyMatch = trimmed.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1], 10);
    if (year < 1901 || year > 2101) return null;
    try {
      return makeSeasonIdFromEndYear(year);
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Get the range of seasons between two seasons (inclusive)
 * @param start - Starting season
 * @param end - Ending season
 * @returns Array of SeasonIds from start to end
 */
export function getSeasonRange(start: SeasonId, end: SeasonId): SeasonId[] {
  const parsedStart = parseSeasonId(start);
  const parsedEnd = parseSeasonId(end);
  
  if (!parsedStart || !parsedEnd) {
    throw new Error(`Invalid SeasonId(s): ${start}, ${end}`);
  }
  
  const result: SeasonId[] = [];
  for (let year = parsedStart.startYear; year <= parsedEnd.startYear; year++) {
    result.push(makeSeasonIdFromStartYear(year));
  }
  return result;
}
