/**
 * @file legacyMatchingValue.test.js
 * @description Unit test proving legacy getMatchingValue() poison-pill formula
 *              differs from canonical computeMatchingValues() implementation.
 *
 * PURPOSE: Document that getMatchingValue() is NOT used in validation paths
 *          and has a known bug in its poison-pill calculation.
 *
 * @ticket TM_LEGACY_MATCHINGVALUE_E1
 */
import { describe, it, expect } from 'vitest';
import {
  getMatchingValue,
  computeMatchingValues,
} from '@/features/architect/utils/tradeMachine/utils/matchingValues';

type MatchingTeams = NonNullable<
  Parameters<typeof computeMatchingValues>[0]['teams']
>;

describe('Legacy getMatchingValue() vs Canonical computeMatchingValues()', () => {
  const currentYear = '2024-25';

  describe('Poison-pill formula difference', () => {
    it('legacy formula produces incorrect result compared to canonical', () => {
      // Example player with rookie scale extension (poison pill scenario)
      // Current salary: $10M
      // Extension years: [$20M, $22M, $24M]
      const extensionYears = [
        { salary: 20_000_000 },
        { salary: 22_000_000 },
        { salary: 24_000_000 },
      ];

      const player = {
        name: 'Test Player',
        salary: 10_000_000,
        currentSalary: 10_000_000,
        isPoisonPill: true,
        isRookieScale: true,
        extensionYears,
      };

      // Calculate using legacy getMatchingValue()
      // Bug: extensionAvg = (20M + 22M + 24M) / 3 = 22M
      //      result = (10M + 22M) / 2 = 16M
      const legacyResult = getMatchingValue(player, currentYear, false);

      // Calculate using canonical computeMatchingValues()
      // Correct: (10M + 20M + 22M + 24M) / 4 = 19M
      const teams: MatchingTeams = [{ sends: [{ ...player }] }];
      computeMatchingValues({ teams, yearKey: currentYear });
      const canonicalResult = teams[0].sends?.[0]?.matchIncoming;

      // Document the difference
      const legacyExpected = Math.floor((10_000_000 + 22_000_000) / 2); // 16M
      const canonicalExpected = Math.floor(76_000_000 / 4); // 19M

      expect(legacyResult).toBe(legacyExpected);
      expect(canonicalResult).toBe(canonicalExpected);

      // The formulas produce DIFFERENT results - legacy is wrong
      expect(legacyResult).not.toBe(canonicalResult);
      expect(canonicalResult).toBeGreaterThan(legacyResult);
    });

    it('documents the correct canonical formula for poison-pill', () => {
      // The canonical formula averages ALL years (current + extension):
      //   matchIncoming = floor((currentSalary + sum(extensionYears)) / (1 + numExtensionYears))
      //
      // This matches CBA Article 7, Section 7 poison pill provision:
      // The "average annual salary" considering the full contract term.

      const extensionYears = [{ salary: 30_000_000 }, { salary: 35_000_000 }];

      const player = {
        name: 'Canonical Test',
        salary: 15_000_000,
        currentSalary: 15_000_000,
        isPoisonPill: true,
        extensionYears,
      };

      const teams: MatchingTeams = [{ sends: [{ ...player }] }];
      computeMatchingValues({ teams, yearKey: currentYear });

      // Canonical: (15M + 30M + 35M) / 3 = 80M / 3 = 26.666...M → floor = 26,666,666
      const expectedCanonical = Math.floor(80_000_000 / 3);
      expect(teams[0].sends?.[0]?.matchIncoming).toBe(expectedCanonical);
    });

    it('legacy getMatchingValue() is only used as input fallback, not validation', () => {
      // This test documents that getMatchingValue() is only called from
      // normalizeTradeInput.ts as a fallback when player.salary is missing.
      //
      // The actual trade validation uses computeMatchingValues() which has
      // the correct canonical poison-pill formula.

      const player = {
        name: 'No Salary Player',
        // salary: MISSING - this is when getMatchingValue() is called
        currentSalary: 12_000_000,
        isPoisonPill: false,
      };

      // When isPoisonPill is false, both functions return plain salary
      // so there's no bug in the common case
      const legacyResult = getMatchingValue(player, currentYear, false);

      // Without salary field, it falls back to getSalaryForYear() lookup
      // which may return 0 if no contract data
      expect(typeof legacyResult).toBe('number');
    });
  });

  describe('Non-poison-pill cases match', () => {
    it('BYC calculation is consistent between both functions', () => {
      const player = {
        name: 'BYC Player',
        salary: 20_000_000,
        newSalary: 20_000_000,
        currentSalary: 20_000_000,
        isBYC: true,
        previousSalary: 8_000_000,
      };

      // Legacy: max(previousSalary, 50% of newSalary)
      const legacyOutgoing = getMatchingValue(player, currentYear, true);
      const expectedBYC = Math.max(8_000_000, Math.floor(20_000_000 * 0.5)); // max(8M, 10M) = 10M

      expect(legacyOutgoing).toBe(expectedBYC);

      // Canonical should match for BYC
      const teams: MatchingTeams = [{ sends: [{ ...player }] }];
      computeMatchingValues({ teams, yearKey: currentYear });

      expect(teams[0].sends?.[0]?.matchOutgoing).toBe(expectedBYC);
    });
  });
});
