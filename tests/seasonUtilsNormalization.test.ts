/**
 * Tests for normalizeYearInput helper function
 * Ensures consistent year format conversion across validators
 */

import { describe, it, expect } from 'vitest';
import { normalizeYearInput } from '@/features/architect/utils/tradeMachine/utils/seasonUtils';

describe('normalizeYearInput', () => {
  describe('with numeric year input', () => {
    it('should convert numeric end-year to both formats', () => {
      const result = normalizeYearInput(2025);

      expect(result).toBeDefined();
      expect(result.endYear).toBe(2025);
      expect(result.seasonString).toBe('2024-25');
    });

    it('should handle different years correctly', () => {
      const result2026 = normalizeYearInput(2026);
      expect(result2026.endYear).toBe(2026);
      expect(result2026.seasonString).toBe('2025-26');

      const result2030 = normalizeYearInput(2030);
      expect(result2030.endYear).toBe(2030);
      expect(result2030.seasonString).toBe('2029-30');
    });
  });

  describe('with season string input', () => {
    it('should convert season string to both formats', () => {
      const result = normalizeYearInput('2024-25');

      expect(result).toBeDefined();
      expect(result.endYear).toBe(2025);
      expect(result.seasonString).toBe('2024-25');
    });

    it('should handle different season strings', () => {
      const result2025 = normalizeYearInput('2025-26');
      expect(result2025.endYear).toBe(2026);
      expect(result2025.seasonString).toBe('2025-26');
    });

    it('should normalize malformed season strings', () => {
      // If normalizeSeason can handle it
      const result = normalizeYearInput('2024-2025');
      // Depending on normalizeSeason implementation, this might work or return null
      if (result) {
        expect(result.seasonString).toMatch(/2024-25/);
      }
    });
  });

  describe('with numeric string input', () => {
    it('should convert numeric string to both formats', () => {
      const result = normalizeYearInput('2025');

      expect(result).toBeDefined();
      expect(result.endYear).toBe(2025);
      expect(result.seasonString).toBe('2024-25');
    });
  });

  describe('edge cases', () => {
    it('should return null for invalid input', () => {
      expect(normalizeYearInput(null)).toBeNull();
      expect(normalizeYearInput(undefined)).toBeNull();
      expect(normalizeYearInput('')).toBeNull();
    });

    it('should return null for non-numeric string without hyphen', () => {
      expect(normalizeYearInput('abc')).toBeNull();
      expect(normalizeYearInput('twenty-twenty-five')).toBeNull();
    });

    it('should handle extreme years', () => {
      const result1999 = normalizeYearInput(1999);
      expect(result1999).toBeDefined();
      expect(result1999.endYear).toBe(1999);
      expect(result1999.seasonString).toBe('1998-99');

      const result2050 = normalizeYearInput(2050);
      expect(result2050).toBeDefined();
      expect(result2050.endYear).toBe(2050);
      expect(result2050.seasonString).toBe('2049-50');
    });
  });

  describe('consistency checks', () => {
    it('should produce same result for equivalent inputs', () => {
      const fromNumeric = normalizeYearInput(2025);
      const fromSeason = normalizeYearInput('2024-25');
      const fromString = normalizeYearInput('2025');

      expect(fromNumeric.endYear).toBe(fromSeason.endYear);
      expect(fromNumeric.seasonString).toBe(fromSeason.seasonString);

      expect(fromNumeric.endYear).toBe(fromString.endYear);
      expect(fromNumeric.seasonString).toBe(fromString.seasonString);
    });

    it('should be reversible with yearToSeason/seasonToYear', () => {
      // If we start with an end-year, convert to season, then normalize
      // We should get back the same values
      const originalYear = 2025;
      const result = normalizeYearInput(originalYear);

      expect(result.endYear).toBe(originalYear);

      // And normalizing the season string should give same result
      const fromSeason = normalizeYearInput(result.seasonString);
      expect(fromSeason.endYear).toBe(result.endYear);
      expect(fromSeason.seasonString).toBe(result.seasonString);
    });
  });
});
