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
});
