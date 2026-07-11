import { describe, it, expect } from 'vitest';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';

describe('CapRulesProfile Facade', () => {
  it('returns valid rules for 2024-25 (Year 2025) with REAL provenance', () => {
    const rules = getCapRulesForYear(2025);

    expect(rules).toBeDefined();
    expect(rules.yearKey).toBe(2025);
    expect(rules.seasonKey).toBe('2024-25');

    expect(rules._meta).toBeDefined();
    expect(rules._meta?.sourcesSummary).toBe('real');
    expect(rules._meta?.sourcesMixed).toBe(false);
    expect(rules._meta?.sourceTags).toEqual(['real']);
    expect(rules._meta?.sources.cap.salaryCap).toBe('real');
    expect(rules._meta?.provenance.capSettingsTag).toBe('real');
    expect(rules._meta?.provenance.rookieMinResolver).toBe('capSettings');
    expect(rules.salaries.rookieMinSource).toBe('real');

    expect(rules.cap.salaryCap).toBeGreaterThan(140_000_000);
    expect(rules.salaries.rookieMin).toBeGreaterThan(1_000_000);
  });

  it('keeps confirmed 2025-26 rules uniformly real', () => {
    const rules = getCapRulesForYear(2026);

    expect(rules).toBeDefined();
    expect(rules.salaries.rookieMinSource).toBe('real');
    expect(rules._meta).toBeDefined();
    expect(rules._meta?.sourcesSummary).toBe('real');
    expect(rules._meta?.sourcesMixed).toBe(false);
    expect(rules._meta?.sourceTags).toEqual(['real']);
    expect(rules._meta?.provenance.rookieMinResolver).toBe('capSettings');
  });

  it('reports mixed-source years honestly when rookieMin falls back separately', () => {
    const rules = getCapRulesForYear(2026, {
      '2025-26': {
        cap: 154_647_000,
        tax: 187_895_000,
        firstApron: 195_945_000,
        secondApron: 207_824_000,
        bae: 5_135_000,
        roomMLE: 8_781_000,
        fullMLE: 14_104_000,
        taxpayerMLE: 5_685_000,
        confirmed: true,
      },
    });

    expect(rules._meta?.sourcesSummary).toBe('projected');
    expect(rules._meta?.sourcesMixed).toBe(true);
    expect(rules._meta?.sourceTags).toEqual(['projected', 'real']);
    expect(rules._meta?.sources.cap.salaryCap).toBe('real');
    expect(rules._meta?.sources.salaries.rookieMin).toBe('projected');
    expect(rules._meta?.fieldsBySource.real).toContain('cap.salaryCap');
    expect(rules._meta?.fieldsBySource.projected).toContain('salaries.rookieMin');
    expect(rules._meta?.provenance.capSettingsTag).toBe('real');
    expect(rules._meta?.provenance.rookieMinResolver).toBe(
      'previousYearCapGrowth'
    );
    expect(rules._meta?.provenance.rookieMinBaseSeasonKey).toBe('2024-25');
    expect(rules.salaries.rookieMinSource).toBe('projected');
  });

  it('projects provenance for future years (2027-28)', () => {
    const rules = getCapRulesForYear(2028);
    expect(rules).toBeDefined();

    expect(rules._meta?.sourcesSummary).toBe('projected');
    expect(rules._meta?.sourcesMixed).toBe(false);
    expect(rules.salaries.rookieMinSource).toBe('projected');
    expect(rules._meta?.provenance.rookieMinResolver).toBe(
      'previousYearCapGrowth'
    );
    expect(rules.cap.salaryCap).toBeGreaterThan(150_000_000);
  });

  it('handles deep projection (2029-30)', () => {
    const rules = getCapRulesForYear(2030);
    expect(rules).toBeDefined();
    expect(rules._meta?.sourcesSummary).toBe('projected');
    expect(rules._meta?.sourcesMixed).toBe(false);
    expect(rules.salaries.rookieMinSource).toBe('projected');
  });

  it('throws error for invalid year', () => {
    expect(() => getCapRulesForYear(1990)).toThrow();
  });

  // BZE-220: before the official 2026-27 minimum scale was added, getScaleForSeason
  // returned null for 2026-27, so getMinimumForYOS collapsed EVERY years-of-service
  // bucket to the (projected) rookie minimum. With the scale present it must return
  // the correct per-YOS values from CBA Exhibit C (as reported for 2026-27).
  it('resolves the official 2026-27 minimum salary by years of service (no rookie-min collapse)', () => {
    const { getMinimumForYOS, rookieMin } = getCapRulesForYear(2027).salaries;

    // Exact per-YOS values from the sourced 2026-27 scale.
    expect(getMinimumForYOS(0)).toBe(1_357_763);
    expect(getMinimumForYOS(2)).toBe(2_449_421);
    expect(getMinimumForYOS(7)).toBe(3_286_399);
    expect(getMinimumForYOS(10)).toBe(3_876_529);
    // 10+ years all use the final row.
    expect(getMinimumForYOS(15)).toBe(3_876_529);

    // Regression guard: the buckets are genuinely distinct — not every YOS
    // collapsed to the same rookie value.
    const buckets = [0, 1, 2, 5, 10].map((yos) => getMinimumForYOS(yos));
    expect(new Set(buckets).size).toBe(buckets.length);
    expect(getMinimumForYOS(10)).toBeGreaterThan(getMinimumForYOS(0));
    // The veteran minimum is no longer pinned to the rookie minimum.
    expect(getMinimumForYOS(10)).not.toBe(rookieMin);
  });

  // Follow-up to BZE-220: capProjections has no explicit 2026-27 rookieMin, so
  // the resolver used to PROJECT it (~$1,241,999) — disagreeing with the
  // official scale's $1,357,763 that getMinimumForYOS(0) returns. The official
  // scale is now the single source of truth for the rookie minimum.
  it('resolves the 2026-27 rookie minimum from the official scale (single source, no projection)', () => {
    const rules = getCapRulesForYear(2027);

    expect(rules.salaries.rookieMin).toBe(1_357_763);
    // No subsystem can disagree: the rookieMin field equals the scale's rung 0.
    expect(rules.salaries.rookieMin).toBe(rules.salaries.getMinimumForYOS(0));

    // Provenance is honest: sourced from the official scale, tagged real.
    expect(rules.salaries.rookieMinSource).toBe('real');
    expect(rules._meta?.provenance.rookieMinResolver).toBe('minimumSalaryScale');
    expect(rules._meta?.sourcesSummary).toBe('real');
    expect(rules._meta?.sourcesMixed).toBe(false);
  });
});
