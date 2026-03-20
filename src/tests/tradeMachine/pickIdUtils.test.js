import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeRound,
  generatePickId,
  ensurePickId,
  areSamePickById,
} from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';

describe('Pick ID Utilities', () => {
  describe('normalizeRound', () => {
    it('normalizes numeric round 1', () => {
      expect(normalizeRound(1)).toBe(1);
    });

    it('normalizes numeric round 2', () => {
      expect(normalizeRound(2)).toBe(2);
    });

    it('normalizes string "1st" to 1', () => {
      expect(normalizeRound('1st')).toBe(1);
    });

    it('normalizes string "2nd" to 2', () => {
      expect(normalizeRound('2nd')).toBe(2);
    });

    it('normalizes string "first" to 1 (case-insensitive)', () => {
      expect(normalizeRound('first')).toBe(1);
      expect(normalizeRound('First')).toBe(1);
      expect(normalizeRound('FIRST')).toBe(1);
    });

    it('normalizes string "second" to 2 (case-insensitive)', () => {
      expect(normalizeRound('second')).toBe(2);
      expect(normalizeRound('Second')).toBe(2);
      expect(normalizeRound('SECOND')).toBe(2);
    });

    it('normalizes string "1" to 1', () => {
      expect(normalizeRound('1')).toBe(1);
    });

    it('normalizes string "2" to 2', () => {
      expect(normalizeRound('2')).toBe(2);
    });

    it('returns null for invalid inputs', () => {
      expect(normalizeRound(null)).toBe(null);
      expect(normalizeRound(undefined)).toBe(null);
      expect(normalizeRound(3)).toBe(null);
      expect(normalizeRound('3rd')).toBe(null);
      expect(normalizeRound('invalid')).toBe(null);
      expect(normalizeRound('')).toBe(null);
    });

    it('handles whitespace in string input', () => {
      expect(normalizeRound('  1st  ')).toBe(1);
      expect(normalizeRound(' 2nd ')).toBe(2);
    });
  });

  describe('generatePickId', () => {
    it('generates canonical ID from pick properties', () => {
      expect(generatePickId({ originalTeam: 'PHI', year: 2026, round: 1 })).toBe(
        'PHI_2026_1'
      );
    });

    it('handles string round formats', () => {
      expect(
        generatePickId({ originalTeam: 'LAL', year: 2027, round: '1st' })
      ).toBe('LAL_2027_1');
      expect(
        generatePickId({ originalTeam: 'BOS', year: 2028, round: '2nd' })
      ).toBe('BOS_2028_2');
      expect(
        generatePickId({ originalTeam: 'GSW', year: 2029, round: 'first' })
      ).toBe('GSW_2029_1');
    });

    it('uses UNK for missing originalTeam', () => {
      expect(generatePickId({ year: 2026, round: 1 })).toBe('UNK_2026_1');
    });

    it('uses ???? for missing year', () => {
      expect(generatePickId({ originalTeam: 'PHI', round: 1 })).toBe(
        'PHI_????_1'
      );
    });

    it('uses ? for missing or invalid round', () => {
      expect(generatePickId({ originalTeam: 'PHI', year: 2026 })).toBe(
        'PHI_2026_?'
      );
      expect(
        generatePickId({ originalTeam: 'PHI', year: 2026, round: 'invalid' })
      ).toBe('PHI_2026_?');
    });

    it('handles completely missing pick', () => {
      expect(generatePickId(null)).toBe('UNK_????_?');
      expect(generatePickId(undefined)).toBe('UNK_????_?');
    });

    it('generates same ID regardless of round format', () => {
      const pick1 = { originalTeam: 'MIA', year: 2026, round: 1 };
      const pick2 = { originalTeam: 'MIA', year: 2026, round: '1st' };
      const pick3 = { originalTeam: 'MIA', year: 2026, round: 'first' };

      expect(generatePickId(pick1)).toBe(generatePickId(pick2));
      expect(generatePickId(pick2)).toBe(generatePickId(pick3));
    });
  });

  describe('ensurePickId', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      // Mock console.warn to suppress output during tests
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('preserves valid existing ID', () => {
      const pick = { id: 'PHI_2026_1', year: 2026, round: 1 };
      const result = ensurePickId(pick);

      expect(result).toBe(pick); // Same object reference
      expect(result.id).toBe('PHI_2026_1');
    });

    it('generates ID when missing', () => {
      const pick = { originalTeam: 'LAL', year: 2027, round: '2nd' };
      const result = ensurePickId(pick);

      expect(result).not.toBe(pick); // New object
      expect(result.id).toBe('LAL_2027_2');
      expect(result.originalTeam).toBe('LAL');
      expect(result.year).toBe(2027);
    });

    it('replaces invalid ID format', () => {
      const pick = {
        id: 'bad-format',
        originalTeam: 'BOS',
        year: 2028,
        round: 1,
      };
      const result = ensurePickId(pick);

      expect(result.id).toBe('BOS_2028_1');
    });

    it('adds warning for missing originalTeam', () => {
      const pick = { year: 2026, round: 1 };
      const result = ensurePickId(pick);

      expect(result.id).toBe('UNK_2026_1');
      expect(result.pickIdWarning).toContain('originalTeam');
    });

    it('adds warning for missing year', () => {
      const pick = { originalTeam: 'PHI', round: 1 };
      const result = ensurePickId(pick);

      expect(result.id).toBe('PHI_????_1');
      expect(result.pickIdWarning).toContain('year');
    });

    it('adds warning for missing round', () => {
      const pick = { originalTeam: 'PHI', year: 2026 };
      const result = ensurePickId(pick);

      expect(result.id).toBe('PHI_2026_?');
      expect(result.pickIdWarning).toContain('round');
    });

    it('adds warning for multiple missing fields', () => {
      const pick = { year: 2026 };
      const result = ensurePickId(pick);

      expect(result.pickIdWarning).toContain('originalTeam');
      expect(result.pickIdWarning).toContain('round');
    });

    it('handles null pick', () => {
      const result = ensurePickId(null);

      expect(result.id).toBe('UNK_????_?');
      expect(result.pickIdWarning).toBeTruthy();
    });

    it('handles undefined pick', () => {
      const result = ensurePickId(undefined);

      expect(result.id).toBe('UNK_????_?');
      expect(result.pickIdWarning).toBeTruthy();
    });

    it('validates ID pattern correctly', () => {
      // Valid IDs should be preserved
      expect(ensurePickId({ id: 'PHI_2026_1' }).id).toBe('PHI_2026_1');
      expect(ensurePickId({ id: 'LAL_2030_2' }).id).toBe('LAL_2030_2');
      expect(ensurePickId({ id: 'GSW_2025_1' }).id).toBe('GSW_2025_1');
      expect(ensurePickId({ id: 'UTAH_2027_2' }).id).toBe('UTAH_2027_2'); // 4-char team code

      // Invalid IDs should be regenerated
      const pickWithData = { originalTeam: 'BOS', year: 2026, round: 1 };
      expect(ensurePickId({ ...pickWithData, id: 'phi_2026_1' }).id).toBe(
        'BOS_2026_1'
      ); // lowercase
      expect(ensurePickId({ ...pickWithData, id: 'PHI_26_1' }).id).toBe(
        'BOS_2026_1'
      ); // short year
      expect(ensurePickId({ ...pickWithData, id: 'PHI_2026_3' }).id).toBe(
        'BOS_2026_1'
      ); // invalid round
    });
  });

  describe('areSamePickById', () => {
    it('returns true for picks with same ID', () => {
      const pickA = { originalTeam: 'PHI', year: 2026, round: 1 };
      const pickB = { originalTeam: 'PHI', year: 2026, round: '1st' };

      expect(areSamePickById(pickA, pickB)).toBe(true);
    });

    it('returns false for picks with different originalTeam', () => {
      const pickA = { originalTeam: 'PHI', year: 2026, round: 1 };
      const pickB = { originalTeam: 'LAL', year: 2026, round: 1 };

      expect(areSamePickById(pickA, pickB)).toBe(false);
    });

    it('returns false for picks with different year', () => {
      const pickA = { originalTeam: 'PHI', year: 2026, round: 1 };
      const pickB = { originalTeam: 'PHI', year: 2027, round: 1 };

      expect(areSamePickById(pickA, pickB)).toBe(false);
    });

    it('returns false for picks with different round', () => {
      const pickA = { originalTeam: 'PHI', year: 2026, round: 1 };
      const pickB = { originalTeam: 'PHI', year: 2026, round: 2 };

      expect(areSamePickById(pickA, pickB)).toBe(false);
    });

    it('handles picks with existing IDs', () => {
      const pickA = { id: 'PHI_2026_1', year: 2026, round: 1 };
      const pickB = {
        id: 'PHI_2026_1',
        originalTeam: 'DIFFERENT',
        year: 9999,
        round: 2,
      };

      // Should match because IDs are the same (and valid)
      expect(areSamePickById(pickA, pickB)).toBe(true);
    });

    it('returns false for null/undefined picks', () => {
      const pick = { originalTeam: 'PHI', year: 2026, round: 1 };

      expect(areSamePickById(null, pick)).toBe(false);
      expect(areSamePickById(pick, null)).toBe(false);
      expect(areSamePickById(undefined, pick)).toBe(false);
      expect(areSamePickById(pick, undefined)).toBe(false);
      expect(areSamePickById(null, null)).toBe(false);
    });
  });

  describe('Integration: Same year/round, different originalTeam', () => {
    it('correctly distinguishes picks that only differ by originalTeam', () => {
      // This is the critical case that the old areSamePick() failed on
      const phiPick = { originalTeam: 'PHI', year: 2026, round: '1st' };
      const lalPick = { originalTeam: 'LAL', year: 2026, round: '1st' };

      // Should NOT be the same pick
      expect(areSamePickById(phiPick, lalPick)).toBe(false);

      // Their IDs should be different
      expect(generatePickId(phiPick)).toBe('PHI_2026_1');
      expect(generatePickId(lalPick)).toBe('LAL_2026_1');
      expect(generatePickId(phiPick)).not.toBe(generatePickId(lalPick));
    });
  });
});
