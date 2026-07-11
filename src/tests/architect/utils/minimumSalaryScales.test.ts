/**
 * FILE: src/tests/architect/utils/minimumSalaryScales.test.ts
 * PURPOSE: Narrow selection guardrails for the centralized minimum salary
 *          scales — specifically that the official 2026-27 scale (BZE-220) is
 *          present, complete, and selectable by season id and numeric year.
 * OWNERSHIP: Feature: architect/timing
 */
import { describe, it, expect } from 'vitest';
import {
  MINIMUM_SALARY_SCALES,
  getAvailableScaleSeasons,
  getScaleForSeason,
  hasScaleForSeason,
  getLatestScale,
} from '@/features/architect/data/minimumSalaryScales';

// Official 2026-27 scale, sourced per BZE-220 (Hoops Rumors / RealGM, cap set
// 2026-06-30, +6.7%). Kept here as the test's own transcription so a silent
// edit to the data file is caught.
const OFFICIAL_2026_27: Record<number, number> = {
  0: 1_357_763,
  1: 2_185_116,
  2: 2_449_421,
  3: 2_537_526,
  4: 2_625_627,
  5: 2_845_883,
  6: 3_066_143,
  7: 3_286_399,
  8: 3_506_659,
  9: 3_524_115,
  10: 3_876_529,
};

describe('minimumSalaryScales — 2026-27 selection (BZE-220)', () => {
  it('exposes 2026-27 as an available scale season', () => {
    expect(getAvailableScaleSeasons()).toContain('2026-27');
    expect(hasScaleForSeason('2026-27')).toBe(true);
  });

  it('carries the complete, exact official 2026-27 years-of-service scale', () => {
    expect(MINIMUM_SALARY_SCALES['2026-27']).toEqual(OFFICIAL_2026_27);
    // Every YOS bucket 0..10 is present (no missing rungs that would fall back).
    for (let yos = 0; yos <= 10; yos += 1) {
      expect(MINIMUM_SALARY_SCALES['2026-27'][yos]).toBe(OFFICIAL_2026_27[yos]);
    }
  });

  it('selects 2026-27 by both season id and numeric end-year', () => {
    expect(getScaleForSeason('2026-27')).toEqual(OFFICIAL_2026_27);
    expect(getScaleForSeason(2027)).toEqual(OFFICIAL_2026_27);
  });

  it('treats 2026-27 as the latest scale (used when a later season lacks its own)', () => {
    expect(getLatestScale()).toEqual(OFFICIAL_2026_27);
  });
});
