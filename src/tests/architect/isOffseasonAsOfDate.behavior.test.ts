import { describe, expect, it } from 'vitest';
import { isOffseasonAsOfDate } from '@/features/architect/utils/buildRuleContext.helpers';

// BZE-190: sign-and-trade (and other offseason-only timing rules) read the
// offseason flag the Trade Machine derives from the world's as-of date.
describe('isOffseasonAsOfDate', () => {
  it('treats the July moratorium (July 1-6) as offseason', () => {
    expect(isOffseasonAsOfDate('2026-07-01')).toBe(true);
    expect(isOffseasonAsOfDate('2026-07-06')).toBe(true);
  });

  it('treats the post-moratorium summer (July 7 - mid-October) as offseason', () => {
    expect(isOffseasonAsOfDate('2026-07-07')).toBe(true);
    expect(isOffseasonAsOfDate('2026-08-01')).toBe(true);
    expect(isOffseasonAsOfDate('2026-09-30')).toBe(true);
    expect(isOffseasonAsOfDate('2026-10-15')).toBe(true);
  });

  it('does not treat the preseason or regular season as offseason', () => {
    expect(isOffseasonAsOfDate('2026-10-20')).toBe(false); // preseason
    expect(isOffseasonAsOfDate('2026-12-01')).toBe(false); // regular season
    expect(isOffseasonAsOfDate('2027-02-15')).toBe(false); // regular season
  });

  it('returns false for missing or malformed dates', () => {
    expect(isOffseasonAsOfDate(null)).toBe(false);
    expect(isOffseasonAsOfDate(undefined)).toBe(false);
    expect(isOffseasonAsOfDate('')).toBe(false);
    expect(isOffseasonAsOfDate('not-a-date')).toBe(false);
  });
});
