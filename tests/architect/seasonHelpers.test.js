/**
 * Season Helpers Tests
 * 
 * Unit tests for the canonical SeasonId helper API.
 * 
 * @file tests/architect/seasonHelpers.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSeasonId,
  parseSeasonId,
  makeSeasonIdFromStartYear,
  makeSeasonIdFromEndYear,
  prevSeason,
  nextSeason,
  addSeasons,
  compareSeasons,
  minSeason,
  maxSeason,
  getCurrentSeasonId,
  getCurrentSeasonEndYear,
  normalizeToSeasonId,
  getSeasonRange,
} from '@/features/architect/utils/seasonHelpers';

describe('SeasonId Helpers', () => {
  describe('isValidSeasonId', () => {
    it('validates correct season formats', () => {
      expect(isValidSeasonId('2024-25')).toBe(true);
      expect(isValidSeasonId('2025-26')).toBe(true);
      expect(isValidSeasonId('1999-00')).toBe(true);
      expect(isValidSeasonId('2030-31')).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(isValidSeasonId('2024-26')).toBe(false); // Non-consecutive years
      expect(isValidSeasonId('2024')).toBe(false); // Missing second part
      expect(isValidSeasonId('24-25')).toBe(false); // Short first year
      expect(isValidSeasonId('2024-2025')).toBe(false); // Full second year
      expect(isValidSeasonId('')).toBe(false);
      expect(isValidSeasonId(null)).toBe(false);
      expect(isValidSeasonId(undefined)).toBe(false);
    });
  });

  describe('parseSeasonId', () => {
    it('parses valid season IDs', () => {
      expect(parseSeasonId('2024-25')).toEqual({ startYear: 2024, endYear: 2025 });
      expect(parseSeasonId('2025-26')).toEqual({ startYear: 2025, endYear: 2026 });
      expect(parseSeasonId('1999-00')).toEqual({ startYear: 1999, endYear: 2000 });
    });

    it('returns null for invalid season IDs', () => {
      expect(parseSeasonId('invalid')).toBe(null);
      expect(parseSeasonId('')).toBe(null);
      expect(parseSeasonId(null)).toBe(null);
    });
  });

  describe('makeSeasonIdFromStartYear', () => {
    it('creates season ID from start year', () => {
      expect(makeSeasonIdFromStartYear(2024)).toBe('2024-25');
      expect(makeSeasonIdFromStartYear(2025)).toBe('2025-26');
      expect(makeSeasonIdFromStartYear(1999)).toBe('1999-00');
      expect(makeSeasonIdFromStartYear(2099)).toBe('2099-00');
    });

    it('throws for invalid years', () => {
      expect(() => makeSeasonIdFromStartYear(NaN)).toThrow();
      expect(() => makeSeasonIdFromStartYear(1800)).toThrow();
    });
  });

  describe('makeSeasonIdFromEndYear', () => {
    it('creates season ID from end year', () => {
      expect(makeSeasonIdFromEndYear(2025)).toBe('2024-25');
      expect(makeSeasonIdFromEndYear(2026)).toBe('2025-26');
      expect(makeSeasonIdFromEndYear(2000)).toBe('1999-00');
    });

    it('throws for invalid years', () => {
      expect(() => makeSeasonIdFromEndYear(NaN)).toThrow();
      expect(() => makeSeasonIdFromEndYear(1800)).toThrow();
    });
  });

  describe('prevSeason', () => {
    it('returns previous season', () => {
      expect(prevSeason('2025-26')).toBe('2024-25');
      expect(prevSeason('2024-25')).toBe('2023-24');
      expect(prevSeason('2000-01')).toBe('1999-00');
    });
  });

  describe('nextSeason', () => {
    it('returns next season', () => {
      expect(nextSeason('2024-25')).toBe('2025-26');
      expect(nextSeason('2025-26')).toBe('2026-27');
      expect(nextSeason('1999-00')).toBe('2000-01');
    });
  });

  describe('addSeasons', () => {
    it('adds positive delta', () => {
      expect(addSeasons('2024-25', 2)).toBe('2026-27');
      expect(addSeasons('2024-25', 5)).toBe('2029-30');
    });

    it('adds negative delta', () => {
      expect(addSeasons('2024-25', -2)).toBe('2022-23');
      expect(addSeasons('2024-25', -5)).toBe('2019-20');
    });

    it('handles zero delta', () => {
      expect(addSeasons('2024-25', 0)).toBe('2024-25');
    });
  });

  describe('compareSeasons', () => {
    it('compares seasons correctly', () => {
      expect(compareSeasons('2024-25', '2025-26')).toBe(-1);
      expect(compareSeasons('2025-26', '2024-25')).toBe(1);
      expect(compareSeasons('2024-25', '2024-25')).toBe(0);
    });
  });

  describe('minSeason', () => {
    it('returns earlier season', () => {
      expect(minSeason('2024-25', '2025-26')).toBe('2024-25');
      expect(minSeason('2025-26', '2024-25')).toBe('2024-25');
      expect(minSeason('2024-25', '2024-25')).toBe('2024-25');
    });
  });

  describe('maxSeason', () => {
    it('returns later season', () => {
      expect(maxSeason('2024-25', '2025-26')).toBe('2025-26');
      expect(maxSeason('2025-26', '2024-25')).toBe('2025-26');
      expect(maxSeason('2024-25', '2024-25')).toBe('2024-25');
    });
  });

  describe('getCurrentSeasonId', () => {
    it('returns correct season for dates after July 1', () => {
      // August 2024 -> 2024-25 season
      expect(getCurrentSeasonId(new Date('2024-08-15'))).toBe('2024-25');
      // October 2024 -> 2024-25 season
      expect(getCurrentSeasonId(new Date('2024-10-15'))).toBe('2024-25');
    });

    it('returns correct season for dates before July 1', () => {
      // March 2025 -> still 2024-25 season
      expect(getCurrentSeasonId(new Date('2025-03-15'))).toBe('2024-25');
      // June 2025 -> still 2024-25 season
      expect(getCurrentSeasonId(new Date('2025-06-15'))).toBe('2024-25');
    });

    it('returns correct season on July 1', () => {
      // July 1, 2025 -> 2025-26 season begins
      expect(getCurrentSeasonId(new Date('2025-07-01'))).toBe('2025-26');
    });
  });

  describe('getCurrentSeasonEndYear', () => {
    it('returns correct end year for dates after July 1', () => {
      expect(getCurrentSeasonEndYear(new Date('2024-08-15'))).toBe(2025);
      expect(getCurrentSeasonEndYear(new Date('2024-10-15'))).toBe(2025);
    });

    it('returns correct end year for dates before July 1', () => {
      expect(getCurrentSeasonEndYear(new Date('2025-03-15'))).toBe(2025);
      expect(getCurrentSeasonEndYear(new Date('2025-06-15'))).toBe(2025);
    });
  });

  describe('normalizeToSeasonId', () => {
    it('normalizes season string format', () => {
      expect(normalizeToSeasonId('2024-25')).toBe('2024-25');
    });

    it('normalizes numeric end year', () => {
      expect(normalizeToSeasonId(2025)).toBe('2024-25');
      expect(normalizeToSeasonId(2026)).toBe('2025-26');
    });

    it('normalizes string end year', () => {
      expect(normalizeToSeasonId('2025')).toBe('2024-25');
      expect(normalizeToSeasonId('2026')).toBe('2025-26');
    });

    it('normalizes full year format', () => {
      expect(normalizeToSeasonId('2024-2025')).toBe('2024-25');
      expect(normalizeToSeasonId('2025-2026')).toBe('2025-26');
    });

    it('returns null for invalid inputs', () => {
      expect(normalizeToSeasonId('')).toBe(null);
      expect(normalizeToSeasonId('invalid')).toBe(null);
      expect(normalizeToSeasonId('2024-2026')).toBe(null); // Non-consecutive
      expect(normalizeToSeasonId(null)).toBe(null);
      expect(normalizeToSeasonId(NaN)).toBe(null);
    });
  });

  describe('getSeasonRange', () => {
    it('returns range of seasons', () => {
      const range = getSeasonRange('2024-25', '2027-28');
      expect(range).toEqual(['2024-25', '2025-26', '2026-27', '2027-28']);
    });

    it('returns single season when start equals end', () => {
      const range = getSeasonRange('2024-25', '2024-25');
      expect(range).toEqual(['2024-25']);
    });

    it('returns empty array when start is after end', () => {
      const range = getSeasonRange('2027-28', '2024-25');
      expect(range).toEqual([]);
    });

    it('throws on invalid season IDs', () => {
      expect(() => getSeasonRange('invalid', '2024-25')).toThrow();
      expect(() => getSeasonRange('2024-25', 'bad')).toThrow();
      expect(() => getSeasonRange('2024', '2025')).toThrow();
    });
  });

  describe('navigation helpers with invalid input', () => {
    it('prevSeason throws on invalid input', () => {
      expect(() => prevSeason('invalid')).toThrow();
      expect(() => prevSeason('2024')).toThrow();
      expect(() => prevSeason('bad')).toThrow();
    });

    it('nextSeason throws on invalid input', () => {
      expect(() => nextSeason('invalid')).toThrow();
      expect(() => nextSeason('2024')).toThrow();
      expect(() => nextSeason('bad')).toThrow();
    });

    it('addSeasons throws on invalid input', () => {
      expect(() => addSeasons('invalid', 1)).toThrow();
      expect(() => addSeasons('2024', 1)).toThrow();
      expect(() => addSeasons('bad', 0)).toThrow();
    });

    it('compareSeasons throws on invalid input', () => {
      expect(() => compareSeasons('invalid', '2024-25')).toThrow();
      expect(() => compareSeasons('2024-25', 'bad')).toThrow();
      expect(() => compareSeasons('2024', '2025')).toThrow();
    });
  });
});
