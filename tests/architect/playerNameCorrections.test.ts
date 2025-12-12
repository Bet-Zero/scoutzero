/**
 * Player Name Corrections Tests
 *
 * Unit tests for the playerNameCorrections module covering:
 * - HYPHENATED_NAMES constant
 * - normalizePlayerName function
 * - resolvePlayerDisplayName function
 *
 * @file tests/architect/playerNameCorrections.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  HYPHENATED_NAMES,
  normalizePlayerName,
  resolvePlayerDisplayName,
} from '@/features/architect/constants/playerNameCorrections';

describe('playerNameCorrections', () => {
  describe('HYPHENATED_NAMES constant', () => {
    it('contains known hyphenated player names', () => {
      expect(HYPHENATED_NAMES).toBeDefined();
      expect(typeof HYPHENATED_NAMES).toBe('object');
    });

    it('includes Shai Gilgeous-Alexander', () => {
      expect(HYPHENATED_NAMES['shai_gilgeous_alexander']).toBe(
        'Shai Gilgeous-Alexander'
      );
    });

    it('includes Karl-Anthony Towns (hyphen in first name)', () => {
      expect(HYPHENATED_NAMES['karl_anthony_towns']).toBe('Karl-Anthony Towns');
    });

    it('includes Dorian Finney-Smith', () => {
      expect(HYPHENATED_NAMES['dorian_finney_smith']).toBe(
        'Dorian Finney-Smith'
      );
    });
  });

  describe('normalizePlayerName', () => {
    describe('handles known hyphenated names', () => {
      it('correctly formats Shai Gilgeous-Alexander', () => {
        expect(normalizePlayerName('shai_gilgeous_alexander')).toBe(
          'Shai Gilgeous-Alexander'
        );
      });

      it('correctly formats Karl-Anthony Towns', () => {
        expect(normalizePlayerName('karl_anthony_towns')).toBe(
          'Karl-Anthony Towns'
        );
      });

      it('correctly formats Kentavious Caldwell-Pope', () => {
        expect(normalizePlayerName('kentavious_caldwell_pope')).toBe(
          'Kentavious Caldwell-Pope'
        );
      });

      it('correctly formats Talen Horton-Tucker', () => {
        expect(normalizePlayerName('talen_horton_tucker')).toBe(
          'Talen Horton-Tucker'
        );
      });
    });

    describe('falls back to Title Case for unknown names', () => {
      it('converts simple snake_case to Title Case', () => {
        expect(normalizePlayerName('lebron_james')).toBe('Lebron James');
      });

      it('converts three-part names to Title Case', () => {
        expect(normalizePlayerName('john_paul_jones')).toBe('John Paul Jones');
      });

      it('handles single-word IDs', () => {
        expect(normalizePlayerName('shaq')).toBe('Shaq');
      });

      it('lowercases the rest of each word (normalizes casing)', () => {
        expect(normalizePlayerName('LEBRON_JAMES')).toBe('Lebron James');
      });
    });

    describe('handles edge cases', () => {
      it('returns "Unknown" for undefined', () => {
        expect(normalizePlayerName(undefined)).toBe('Unknown');
      });

      it('returns "Unknown" for null', () => {
        expect(normalizePlayerName(null)).toBe('Unknown');
      });

      it('returns "Unknown" for empty string', () => {
        expect(normalizePlayerName('')).toBe('Unknown');
      });
    });
  });

  describe('resolvePlayerDisplayName', () => {
    it('returns existing valid name when present', () => {
      expect(resolvePlayerDisplayName('LeBron James', 'lebron_james')).toBe(
        'LeBron James'
      );
    });

    it('derives name from ID when name is "Player Not Found"', () => {
      expect(resolvePlayerDisplayName('Player Not Found', 'lebron_james')).toBe(
        'Lebron James'
      );
    });

    it('derives name from ID when name is "Unknown"', () => {
      expect(resolvePlayerDisplayName('Unknown', 'lebron_james')).toBe(
        'Lebron James'
      );
    });

    it('derives name from ID when name is undefined', () => {
      expect(resolvePlayerDisplayName(undefined, 'lebron_james')).toBe(
        'Lebron James'
      );
    });

    it('derives name from ID when name is null', () => {
      expect(resolvePlayerDisplayName(null, 'lebron_james')).toBe(
        'Lebron James'
      );
    });

    it('uses hyphenated name map when deriving from ID', () => {
      expect(
        resolvePlayerDisplayName('Player Not Found', 'shai_gilgeous_alexander')
      ).toBe('Shai Gilgeous-Alexander');
    });

    it('returns "Unknown" when both name and ID are missing', () => {
      expect(resolvePlayerDisplayName(undefined, undefined)).toBe('Unknown');
    });
  });
});
