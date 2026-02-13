/**
 * FILE: tests/smoke/utilities.smoke.test.js
 *
 * Smoke tests for core utility functions
 * These should be fast, stable, and catch obvious breakage
 */

import { describe, it, expect } from 'vitest';

// Import core utilities that should never break
import {
  toNum,
  toSeasonKey,
} from '@/features/architect/utils/tradeMachine/utils/capUtils.js';
import { formatHeight } from '@/shared/utils/formatting';

describe('Core Utilities Smoke Test', () => {
  describe('capUtils', () => {
    it('toNum converts values correctly', () => {
      expect(toNum(100)).toBe(100);
      expect(toNum('50')).toBe(50);
      expect(toNum(null)).toBe(0);
    });

    it('toSeasonKey formats correctly', () => {
      expect(toSeasonKey(2025)).toBe('2024-25');
      expect(toSeasonKey(2030)).toBe('2029-30');
    });
  });

  describe('formatting', () => {
    it('formatHeight works', () => {
      expect(formatHeight(76)).toBe('6\'4"');
      expect(formatHeight()).toBe('0\'0"');
    });
  });

  describe('basic math', () => {
    it('sanity check', () => {
      expect(1 + 1).toBe(2);
      expect([1, 2, 3].length).toBe(3);
      expect({ a: 1 }).toHaveProperty('a');
    });
  });
});
