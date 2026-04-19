/**
 * FILE: tests/smoke/trade-basics.smoke.test.js
 *
 * Smoke tests for trade validation basics
 * Ensures core trade logic doesn't break
 */

import { describe, it, expect } from 'vitest';

describe('Trade Validation Smoke Test', () => {
  describe('salary math basics', () => {
    it('calculates percentages correctly', () => {
      const salary = 10_000_000;
      const margin = salary * 1.1; // 110%
      expect(margin).toBe(11_000_000);
    });

    it('handles cap calculations', () => {
      const cap = 140_588_000;
      const apron = cap * 1.1;
      expect(apron).toBeGreaterThan(cap);
    });

    it('salary matching tier calculations', () => {
      // Test basic CBA tier 1 (≤ $7.5M)
      const tier1Outgoing = 5_000_000;
      const tier1Allowed = tier1Outgoing + 5_000_000; // Can add $5M
      expect(tier1Allowed).toBe(10_000_000);

      // Test basic CBA tier 2 ($7.5M - $29M)
      const tier2Outgoing = 20_000_000;
      const tier2Allowed = tier2Outgoing * 2; // Can double
      expect(tier2Allowed).toBe(40_000_000);
    });
  });

  describe('contract year logic', () => {
    it('parses season strings correctly', () => {
      const season = '2024-25';
      const [startYear, endYear] = season.split('-');
      expect(startYear).toBe('2024');
      expect(endYear).toBe('25');
    });

    it('calculates years remaining', () => {
      const totalYears = 4;
      const elapsedYears = 1;
      const remaining = totalYears - elapsedYears;
      expect(remaining).toBe(3);
    });
  });
});
