import { describe, it, expect } from 'vitest';
import {
  normalizeSeason,
  seasonStartYear,
  compareSeason,
  isSeasonActive,
  isSeasonFuture,
  isSeasonExpired,
} from '@/utils/contracts/seasonNormalizer.js';

describe('Season Normalizer', () => {
  describe('normalizeSeason', () => {
    it('handles already normalized seasons', () => {
      expect(normalizeSeason('2025-26')).toBe('2025-26');
      expect(normalizeSeason('2023-24')).toBe('2023-24');
    });

    it('converts YYYY format to YYYY-YY', () => {
      expect(normalizeSeason('2025')).toBe('2025-26');
      expect(normalizeSeason(2025)).toBe('2025-26');
      expect(normalizeSeason('2023')).toBe('2023-24');
    });

    it('converts YYYY-YYYY format to YYYY-YY', () => {
      expect(normalizeSeason('2025-2026')).toBe('2025-26');
      expect(normalizeSeason('2023-2024')).toBe('2023-24');
    });

    it('returns null for invalid input', () => {
      expect(normalizeSeason(null)).toBe(null);
      expect(normalizeSeason('')).toBe(null);
      expect(normalizeSeason('invalid')).toBe(null);
    });
  });

  describe('seasonStartYear', () => {
    it('extracts start year from normalized season', () => {
      expect(seasonStartYear('2025-26')).toBe(2025);
      expect(seasonStartYear('2023-24')).toBe(2023);
      expect(seasonStartYear('2030-31')).toBe(2030);
    });

    it('returns 0 for invalid input', () => {
      expect(seasonStartYear(null)).toBe(0);
      expect(seasonStartYear('')).toBe(0);
      expect(seasonStartYear('invalid')).toBe(0);
    });
  });

  describe('compareSeason', () => {
    it('compares seasons correctly', () => {
      expect(compareSeason('2025-26', '2026-27')).toBe(-1);
      expect(compareSeason('2026-27', '2025-26')).toBe(1);
      expect(compareSeason('2025-26', '2025-26')).toBe(0);
    });
  });

  describe('isSeasonActive', () => {
    it('detects active seasons', () => {
      expect(isSeasonActive('2023-24', '2027-28', '2025-26')).toBe(true);
      expect(isSeasonActive('2025-26', '2027-28', '2025-26')).toBe(true);
      expect(isSeasonActive('2023-24', '2025-26', '2025-26')).toBe(true);
    });

    it('detects inactive seasons', () => {
      expect(isSeasonActive('2026-27', '2027-28', '2025-26')).toBe(false);
      expect(isSeasonActive('2023-24', '2024-25', '2025-26')).toBe(false);
    });
  });

  describe('isSeasonFuture', () => {
    it('detects future seasons', () => {
      expect(isSeasonFuture('2026-27', '2025-26')).toBe(true);
      expect(isSeasonFuture('2027-28', '2025-26')).toBe(true);
    });

    it('detects non-future seasons', () => {
      expect(isSeasonFuture('2025-26', '2025-26')).toBe(false);
      expect(isSeasonFuture('2024-25', '2025-26')).toBe(false);
    });
  });

  describe('isSeasonExpired', () => {
    it('detects expired seasons', () => {
      expect(isSeasonExpired('2024-25', '2025-26')).toBe(true);
      expect(isSeasonExpired('2023-24', '2025-26')).toBe(true);
    });

    it('detects non-expired seasons', () => {
      expect(isSeasonExpired('2025-26', '2025-26')).toBe(false);
      expect(isSeasonExpired('2026-27', '2025-26')).toBe(false);
    });
  });
});
