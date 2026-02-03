/**
 * FILE: src/tests/architect/dare/protectionLadderFactory.test.js
 * PURPOSE: Tests for protection ladder factory (B4)
 */

import { describe, it, expect } from 'vitest';
import {
  buildProtectionLadder,
  parseProtectionCondition,
  parseProtectionThreshold,
  protectionTriggers,
  getCurrentProtectionTier,
  getNextProtectionTier,
  isFinalProtectionYear,
} from '@/features/architect/utils/entitlements/dare/protectionLadderFactory';

describe('Protection Ladder Factory (B4)', () => {
  describe('buildProtectionLadder', () => {
    it('transforms protections array to ladder', () => {
      const pickRule = {
        pickId: 'LAL_2026_1st',
        seasonYear: 2026,
        round: 1,
        protections: [
          { type: 'top_n', protectedRange: '1-3', appliesToYears: [2026] },
          { type: 'top_n', protectedRange: '1-5', appliesToYears: [2027] },
          { type: 'lottery', appliesToYears: [2028] },
        ],
        conditions: [],
        updatedAtISO: '2026-01-01',
        source: 'test',
      };
      const entitlement = { seasonYear: 2026 };

      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder).toHaveLength(3);
      expect(ladder[0]).toMatchObject({
        year: 2026,
        condition: 'Top 3',
        ifTriggered: 'roll',
        rollToYear: 2027,
      });
      expect(ladder[1]).toMatchObject({
        year: 2027,
        condition: 'Top 5',
        ifTriggered: 'roll',
        rollToYear: 2028,
      });
      expect(ladder[2]).toMatchObject({
        year: 2028,
        condition: 'Lottery',
        ifTriggered: 'cancel', // Final tier
      });
    });

    it('handles single-year protection', () => {
      const pickRule = {
        pickId: 'BOS_2026_1st',
        seasonYear: 2026,
        round: 1,
        protections: [{ type: 'top_n', protectedRange: '1-3', appliesToYears: [2026] }],
        conditions: [],
        updatedAtISO: '2026-01-01',
        source: 'test',
      };
      const entitlement = { seasonYear: 2026 };

      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder).toHaveLength(1);
      expect(ladder[0]).toMatchObject({
        year: 2026,
        condition: 'Top 3',
        ifTriggered: 'cancel', // Only tier = final
      });
    });

    it('handles conversion conditions', () => {
      const pickRule = {
        pickId: 'PHI_2026_1st',
        seasonYear: 2026,
        round: 1,
        protections: [{ type: 'lottery', appliesToYears: [2026] }],
        conditions: [
          {
            kind: 'conveys',
            description: 'Converts to 2nd if not conveyed',
            appliesToYears: [2026],
            relatedPickIds: ['PHI_2026_2nd'],
          },
        ],
        updatedAtISO: '2026-01-01',
        source: 'test',
      };
      const entitlement = { seasonYear: 2026 };

      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder).toHaveLength(1);
      expect(ladder[0].ifTriggered).toBe('convert');
      expect(ladder[0].convertToRound).toBe(2);
    });

    it('returns null when no protections', () => {
      const pickRule = {
        pickId: 'MIA_2026_1st',
        seasonYear: 2026,
        round: 1,
        protections: [],
        conditions: [],
        updatedAtISO: '2026-01-01',
        source: 'test',
      };
      const entitlement = { seasonYear: 2026 };

      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder).toBeNull();
    });

    it('returns null when pickRule is null', () => {
      const ladder = buildProtectionLadder(null, { seasonYear: 2026 });
      expect(ladder).toBeNull();
    });
  });

  describe('parseProtectionCondition', () => {
    it('parses top_n type', () => {
      expect(parseProtectionCondition({ type: 'top_n', protectedRange: '1-3' })).toBe('Top 3');
      expect(parseProtectionCondition({ type: 'top_n', protectedRange: '1-5' })).toBe('Top 5');
      expect(parseProtectionCondition({ type: 'top_n', protectedRange: '1-10' })).toBe('Top 10');
    });

    it('parses lottery type', () => {
      expect(parseProtectionCondition({ type: 'lottery' })).toBe('Lottery');
    });

    it('parses range type', () => {
      expect(parseProtectionCondition({ type: 'range', protectedRange: '1-14' })).toBe('Top 14');
      expect(parseProtectionCondition({ type: 'range', protectedRange: '5-10' })).toBe('Protected 5-10');
    });

    it('returns Unprotected for null/undefined', () => {
      expect(parseProtectionCondition(null)).toBe('Unprotected');
      expect(parseProtectionCondition(undefined)).toBe('Unprotected');
    });
  });

  describe('parseProtectionThreshold', () => {
    it('parses Top N patterns', () => {
      expect(parseProtectionThreshold('Top 3')).toBe(3);
      expect(parseProtectionThreshold('Top 5')).toBe(5);
      expect(parseProtectionThreshold('top 10')).toBe(10);
      expect(parseProtectionThreshold('TOP3')).toBe(3);
    });

    it('parses Lottery as 14', () => {
      expect(parseProtectionThreshold('Lottery')).toBe(14);
      expect(parseProtectionThreshold('LOTTERY')).toBe(14);
      expect(parseProtectionThreshold('lottery protected')).toBe(14);
    });

    it('parses 1-14 as 14', () => {
      expect(parseProtectionThreshold('1-14')).toBe(14);
    });

    it('returns null for Unprotected', () => {
      expect(parseProtectionThreshold('Unprotected')).toBeNull();
      expect(parseProtectionThreshold('unprotected')).toBeNull();
    });

    it('returns null for empty/null', () => {
      expect(parseProtectionThreshold('')).toBeNull();
      expect(parseProtectionThreshold(null)).toBeNull();
      expect(parseProtectionThreshold(undefined)).toBeNull();
    });
  });

  describe('protectionTriggers', () => {
    it('triggers when position within threshold', () => {
      expect(protectionTriggers('Top 3', 1)).toBe(true);
      expect(protectionTriggers('Top 3', 2)).toBe(true);
      expect(protectionTriggers('Top 3', 3)).toBe(true);
    });

    it('does not trigger when position outside threshold', () => {
      expect(protectionTriggers('Top 3', 4)).toBe(false);
      expect(protectionTriggers('Top 3', 10)).toBe(false);
      expect(protectionTriggers('Top 3', 30)).toBe(false);
    });

    it('handles Lottery protection (1-14)', () => {
      expect(protectionTriggers('Lottery', 1)).toBe(true);
      expect(protectionTriggers('Lottery', 14)).toBe(true);
      expect(protectionTriggers('Lottery', 15)).toBe(false);
    });

    it('returns false for Unprotected', () => {
      expect(protectionTriggers('Unprotected', 1)).toBe(false);
      expect(protectionTriggers('Unprotected', 30)).toBe(false);
    });

    it('returns false for invalid position', () => {
      expect(protectionTriggers('Top 3', 0)).toBe(false);
      expect(protectionTriggers('Top 3', -1)).toBe(false);
    });
  });

  describe('ladder lookup functions', () => {
    const testLadder = [
      { year: 2026, condition: 'Top 3', ifTriggered: 'roll', rollToYear: 2027 },
      { year: 2027, condition: 'Top 5', ifTriggered: 'roll', rollToYear: 2028 },
      { year: 2028, condition: 'Lottery', ifTriggered: 'cancel' },
    ];

    describe('getCurrentProtectionTier', () => {
      it('returns tier for matching year', () => {
        expect(getCurrentProtectionTier(testLadder, 2026)).toMatchObject({ year: 2026, condition: 'Top 3' });
        expect(getCurrentProtectionTier(testLadder, 2027)).toMatchObject({ year: 2027, condition: 'Top 5' });
        expect(getCurrentProtectionTier(testLadder, 2028)).toMatchObject({ year: 2028, condition: 'Lottery' });
      });

      it('returns null for non-matching year', () => {
        expect(getCurrentProtectionTier(testLadder, 2025)).toBeNull();
        expect(getCurrentProtectionTier(testLadder, 2029)).toBeNull();
      });

      it('returns null for null ladder', () => {
        expect(getCurrentProtectionTier(null, 2026)).toBeNull();
      });
    });

    describe('getNextProtectionTier', () => {
      it('returns next tier after given year', () => {
        expect(getNextProtectionTier(testLadder, 2026)).toMatchObject({ year: 2027 });
        expect(getNextProtectionTier(testLadder, 2027)).toMatchObject({ year: 2028 });
      });

      it('returns null when no next tier', () => {
        expect(getNextProtectionTier(testLadder, 2028)).toBeNull();
        expect(getNextProtectionTier(testLadder, 2029)).toBeNull();
      });
    });

    describe('isFinalProtectionYear', () => {
      it('returns true for final year', () => {
        expect(isFinalProtectionYear(testLadder, 2028)).toBe(true);
        expect(isFinalProtectionYear(testLadder, 2029)).toBe(true); // Beyond final
      });

      it('returns false for non-final years', () => {
        expect(isFinalProtectionYear(testLadder, 2026)).toBe(false);
        expect(isFinalProtectionYear(testLadder, 2027)).toBe(false);
      });

      it('returns true for null ladder', () => {
        expect(isFinalProtectionYear(null, 2026)).toBe(true);
      });
    });
  });
});
