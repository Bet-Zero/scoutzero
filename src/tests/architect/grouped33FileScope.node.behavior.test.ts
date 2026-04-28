import { describe, expect, it } from 'vitest';
import getCapPercentage, {
  attachDefaultPicks,
  generateDefaultPicks,
  markHardCapTriggered,
} from '@/features/architect/utils/basicArchitectUtils';
import { ValidationCache } from '@/features/architect/utils/tradeMachine/cache/validationCache';
import { computeTradeKicker } from '@/features/architect/utils/tradeMachine/engine/engineUtils';

describe('Grouped 33-file scope node behavior', () => {
  it('preserves the basicArchitectUtils mixed helper behavior', () => {
    expect(getCapPercentage(35_000_000, 140_000_000)).toBe(25);
    expect(getCapPercentage(null, 140_000_000)).toBeNull();

    const seasonState: Record<string, unknown> = {};
    expect(
      markHardCapTriggered(seasonState, {
        reason: 'Sign-and-trade',
        season: '2025-26',
      })
    ).toBe(seasonState);
    expect(seasonState.hardCapFirstApron).toEqual({
      active: true,
      reason: 'Sign-and-trade',
      season: '2025-26',
    });

    const defaultPicks = generateDefaultPicks();
    expect(defaultPicks).toHaveLength(14);
    expect(defaultPicks[0]).toEqual({ year: 2026, round: '1st' });
    expect(defaultPicks[13]).toEqual({ year: 2032, round: '2nd' });

    const capSheet: Record<string, unknown> = {};
    expect(attachDefaultPicks(capSheet)).toBe(capSheet);
    expect(capSheet.picks).toHaveLength(14);
  });

  it('preserves validationCache loose payload cloning, apron caching, and invalidation semantics', () => {
    const cache = new ValidationCache();
    const team = {
      teamId: 'LAL',
      salaryOut: 9_000_000,
      salaryIn: 11_000_000,
      teamTotalSalary: 189_000_000,
      absorptionMode: 'standard',
      bucketType: 'band-2',
    };
    const result = {
      passed: true,
      reasons: ['cached'],
      nested: { amount: 11_000_000 },
    };

    cache.cacheSalaryMatch(team, 2026, result);
    const cachedSalaryMatch = cache.getCachedSalaryMatch(team, 2026);

    expect(cachedSalaryMatch).toEqual(result);
    expect(cachedSalaryMatch).not.toBe(result);

    const apronSettings = {
      firstApron: 178_132_000,
      secondApron: 188_931_000,
    };
    const apronStatus = { status: 'SECOND_APRON' };
    cache.cacheApronStatus(189_000_000, apronSettings, apronStatus);
    expect(cache.getCachedApronStatus(189_000_000, apronSettings)).toEqual(
      apronStatus
    );

    expect(cache.invalidate('salary_match_')).toBe(1);
    expect(cache.getCachedSalaryMatch(team, 2026)).toBeUndefined();
  });

  it('preserves computeTradeKicker waiver and proration behavior', () => {
    expect(
      computeTradeKicker(
        {
          newSalary: 20_000_000,
          tradeKicker: {
            percentage: 0.15,
            waived: 0.25,
          },
        },
        {
          daysRemainingInSeason: 50,
          daysInSeason: 100,
        }
      )
    ).toBe(1_125_000);

    expect(
      computeTradeKicker({
        newSalary: 20_000_000,
        tradeKicker: null,
      })
    ).toBe(0);
  });

});
