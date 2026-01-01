/**
 * tradeMultiSurfaceOfficialValues.test.js
 *
 * PURPOSE: Regression tests proving multi-surface identity of official salary matching values.
 * Per MASTER_TRADE_MACHINE_ALIGNMENT.md (Invariant 1):
 * "If the same concept is displayed in multiple UI locations, it MUST use the SAME SOURCE/PIPELINE"
 *
 * These tests ensure that all UI surfaces using getOfficialSalaryMatchingSnapshot receive
 * identical values, preventing divergence.
 *
 * TEST STRATEGY:
 * 1. Create teamResult with distinctive, recognizable values
 * 2. Call the selector multiple times (simulating multiple UI surfaces)
 * 3. Assert every call produces identical results
 * 4. Assert values come from canonical paths, not fallbacks
 */

import { describe, it, expect } from 'vitest';
import {
  getOfficialSalaryMatchingSnapshot,
  computeRemainingRoom,
  getOfficialSnapshotByTeamId,
  getOfficialSnapshotByIndex,
} from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';

// Distinctive test values that are recognizable and unlikely to be computed accidentally
const DISTINCTIVE_OUT = 111_111_111;
const DISTINCTIVE_IN = 222_222_222;
const DISTINCTIVE_LIMIT = 333_333_333;

/**
 * Create a mock teamResult with distinctive values for testing
 */
function createDistinctiveTeamResult(overrides = {}) {
  return {
    teamId: 'TEST_TEAM',
    teamName: 'Test Team',
    salaryOut: DISTINCTIVE_OUT,
    salaryIn: DISTINCTIVE_IN,
    rules: {
      salaryMatching: {
        passed: true,
        allowableIncoming: DISTINCTIVE_LIMIT,
        skipReason: null,
        details: {
          ruleApplied: 'DISTINCTIVE_RULE_123',
          formulaUsed: 'TEST_FORMULA_456',
        },
      },
    },
    // Include calculations with DIFFERENT values to ensure we're not using them
    calculations: {
      salaryOut: 999_999_999,
      salaryIn: 888_888_888,
      salaryMatching: {
        allowedIncoming: 777_777_777,
      },
    },
    ...overrides,
  };
}

/**
 * Create a full validation result with distinctive team values
 */
function createDistinctiveValidationResult() {
  return {
    legal: true,
    yearKey: 2025,
    teamResults: [
      createDistinctiveTeamResult({ teamId: 'TEAM_A' }),
      createDistinctiveTeamResult({
        teamId: 'TEAM_B',
        salaryOut: 444_444_444,
        salaryIn: 555_555_555,
        rules: {
          salaryMatching: {
            passed: true,
            allowableIncoming: 666_666_666,
            details: {
              ruleApplied: 'TEAM_B_RULE',
              formulaUsed: 'TEAM_B_FORMULA',
            },
          },
        },
      }),
    ],
  };
}

describe('Official Salary Matching Snapshot - Canonical Selector', () => {
  describe('TASK 1: API shape and null handling', () => {
    it('returns all required fields when teamResult is null', () => {
      const snapshot = getOfficialSalaryMatchingSnapshot(null);

      expect(snapshot).toEqual({
        hasValidator: false,
        allowableIncoming: null,
        salaryIn: null,
        salaryOut: null,
        passed: null,
        ruleApplied: null,
        formulaUsed: null,
        skipReason: null,
      });
    });

    it('returns hasValidator=true with populated fields when teamResult exists', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot.hasValidator).toBe(true);
      expect(snapshot.allowableIncoming).toBe(DISTINCTIVE_LIMIT);
      expect(snapshot.salaryIn).toBe(DISTINCTIVE_IN);
      expect(snapshot.salaryOut).toBe(DISTINCTIVE_OUT);
      expect(snapshot.passed).toBe(true);
      expect(snapshot.ruleApplied).toBe('DISTINCTIVE_RULE_123');
      expect(snapshot.formulaUsed).toBe('TEST_FORMULA_456');
      expect(snapshot.skipReason).toBeNull();
    });

    it('preserves null for missing fields (does NOT infer/compute)', () => {
      const sparseTeamResult = {
        teamId: 'SPARSE',
        salaryOut: 100,
        // salaryIn is missing
        rules: {
          salaryMatching: {
            // allowableIncoming is missing
            passed: true,
          },
        },
      };

      const snapshot = getOfficialSalaryMatchingSnapshot(sparseTeamResult);

      expect(snapshot.hasValidator).toBe(true);
      expect(snapshot.salaryOut).toBe(100);
      expect(snapshot.salaryIn).toBeNull(); // NOT 0, but null
      expect(snapshot.allowableIncoming).toBeNull(); // NOT 0, but null
    });

    it('returns raw numbers (no formatting)', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(typeof snapshot.allowableIncoming).toBe('number');
      expect(typeof snapshot.salaryIn).toBe('number');
      expect(typeof snapshot.salaryOut).toBe('number');
    });
  });

  describe('TASK 2: Canonical source enforcement', () => {
    it('reads salaryOut from teamResult.salaryOut, NOT calculations.salaryOut', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      // Must be DISTINCTIVE_OUT, not calculations value
      expect(snapshot.salaryOut).toBe(DISTINCTIVE_OUT);
      expect(snapshot.salaryOut).not.toBe(999_999_999);
    });

    it('reads salaryIn from teamResult.salaryIn, NOT calculations.salaryIn', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      // Must be DISTINCTIVE_IN, not calculations value
      expect(snapshot.salaryIn).toBe(DISTINCTIVE_IN);
      expect(snapshot.salaryIn).not.toBe(888_888_888);
    });

    it('reads allowableIncoming from rules.salaryMatching.allowableIncoming, NOT calculations', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      // Must be DISTINCTIVE_LIMIT, not calculations value
      expect(snapshot.allowableIncoming).toBe(DISTINCTIVE_LIMIT);
      expect(snapshot.allowableIncoming).not.toBe(777_777_777);
    });

    it('reads ruleApplied from rules.salaryMatching.details.ruleApplied', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot.ruleApplied).toBe('DISTINCTIVE_RULE_123');
    });

    it('reads formulaUsed from rules.salaryMatching.details.formulaUsed', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot.formulaUsed).toBe('TEST_FORMULA_456');
    });

    it('reads skipReason from rules.salaryMatching.skipReason', () => {
      const teamResult = createDistinctiveTeamResult({
        rules: {
          salaryMatching: {
            passed: true,
            skipReason: 'HARD_CAP_SKIP',
            allowableIncoming: null,
          },
        },
      });
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot.skipReason).toBe('HARD_CAP_SKIP');
    });
  });

  describe('TASK 3: Remaining Room computation', () => {
    it('computes remaining room as allowableIncoming - salaryIn', () => {
      const teamResult = createDistinctiveTeamResult();
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);
      const remaining = computeRemainingRoom(snapshot);

      // DISTINCTIVE_LIMIT - DISTINCTIVE_IN = 333_333_333 - 222_222_222 = 111_111_111
      expect(remaining).toBe(111_111_111);
    });

    it('returns null if hasValidator is false', () => {
      const snapshot = getOfficialSalaryMatchingSnapshot(null);
      const remaining = computeRemainingRoom(snapshot);

      expect(remaining).toBeNull();
    });

    it('returns null if allowableIncoming is null', () => {
      const snapshot = {
        hasValidator: true,
        allowableIncoming: null,
        salaryIn: 100,
      };
      const remaining = computeRemainingRoom(snapshot);

      expect(remaining).toBeNull();
    });

    it('returns null if salaryIn is null', () => {
      const snapshot = {
        hasValidator: true,
        allowableIncoming: 100,
        salaryIn: null,
      };
      const remaining = computeRemainingRoom(snapshot);

      expect(remaining).toBeNull();
    });

    it('handles negative remaining room (exceeds allowable)', () => {
      const teamResult = createDistinctiveTeamResult({
        salaryIn: 500_000_000, // Exceeds DISTINCTIVE_LIMIT
      });
      const snapshot = getOfficialSalaryMatchingSnapshot(teamResult);
      const remaining = computeRemainingRoom(snapshot);

      expect(remaining).toBe(333_333_333 - 500_000_000);
      expect(remaining).toBeLessThan(0);
    });
  });

  describe('TASK 4: Multi-surface identity (regression)', () => {
    it('multiple calls return identical OUT values', () => {
      const teamResult = createDistinctiveTeamResult();

      // Simulate 3 UI surfaces all calling the selector
      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot3 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1.salaryOut).toBe(DISTINCTIVE_OUT);
      expect(snapshot2.salaryOut).toBe(snapshot1.salaryOut);
      expect(snapshot3.salaryOut).toBe(snapshot1.salaryOut);
    });

    it('multiple calls return identical IN values', () => {
      const teamResult = createDistinctiveTeamResult();

      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot3 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1.salaryIn).toBe(DISTINCTIVE_IN);
      expect(snapshot2.salaryIn).toBe(snapshot1.salaryIn);
      expect(snapshot3.salaryIn).toBe(snapshot1.salaryIn);
    });

    it('multiple calls return identical LIMIT values', () => {
      const teamResult = createDistinctiveTeamResult();

      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot3 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1.allowableIncoming).toBe(DISTINCTIVE_LIMIT);
      expect(snapshot2.allowableIncoming).toBe(snapshot1.allowableIncoming);
      expect(snapshot3.allowableIncoming).toBe(snapshot1.allowableIncoming);
    });

    it('multiple calls return identical RULE values', () => {
      const teamResult = createDistinctiveTeamResult();

      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1.ruleApplied).toBe('DISTINCTIVE_RULE_123');
      expect(snapshot2.ruleApplied).toBe(snapshot1.ruleApplied);
    });

    it('multiple calls return identical PASSED values', () => {
      const teamResult = createDistinctiveTeamResult();

      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1.passed).toBe(true);
      expect(snapshot2.passed).toBe(snapshot1.passed);
    });

    it('multiple calls return identical SKIP values', () => {
      const teamResult = createDistinctiveTeamResult({
        rules: {
          salaryMatching: {
            skipReason: 'TPE_ABSORPTION',
          },
        },
      });

      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1.skipReason).toBe('TPE_ABSORPTION');
      expect(snapshot2.skipReason).toBe(snapshot1.skipReason);
    });

    it('full snapshot object is identical across calls', () => {
      const teamResult = createDistinctiveTeamResult();

      const snapshot1 = getOfficialSalaryMatchingSnapshot(teamResult);
      const snapshot2 = getOfficialSalaryMatchingSnapshot(teamResult);

      expect(snapshot1).toEqual(snapshot2);
    });
  });

  describe('Convenience wrappers', () => {
    it('getOfficialSnapshotByTeamId finds team by ID', () => {
      const result = createDistinctiveValidationResult();
      const snapshot = getOfficialSnapshotByTeamId('TEAM_A', result);

      expect(snapshot.hasValidator).toBe(true);
      expect(snapshot.salaryOut).toBe(DISTINCTIVE_OUT);
    });

    it('getOfficialSnapshotByTeamId returns null snapshot for missing team', () => {
      const result = createDistinctiveValidationResult();
      const snapshot = getOfficialSnapshotByTeamId('NONEXISTENT', result);

      expect(snapshot.hasValidator).toBe(false);
    });

    it('getOfficialSnapshotByIndex finds team by index', () => {
      const result = createDistinctiveValidationResult();
      const snapshot = getOfficialSnapshotByIndex(1, result);

      expect(snapshot.hasValidator).toBe(true);
      expect(snapshot.salaryOut).toBe(444_444_444);
      expect(snapshot.ruleApplied).toBe('TEAM_B_RULE');
    });

    it('getOfficialSnapshotByIndex returns null snapshot for invalid index', () => {
      const result = createDistinctiveValidationResult();
      const snapshot = getOfficialSnapshotByIndex(99, result);

      expect(snapshot.hasValidator).toBe(false);
    });
  });

  describe('No local recalculation', () => {
    it('preserves arbitrary validator values without recalculating', () => {
      // Create a teamResult where values don't "make sense" mathematically
      // If the selector were recalculating, it would produce different values
      const arbitraryTeamResult = {
        teamId: 'ARBITRARY',
        salaryOut: 12_345_678, // Arbitrary
        salaryIn: 87_654_321, // Arbitrary
        rules: {
          salaryMatching: {
            passed: true,
            allowableIncoming: 11_111_111, // Arbitrary, doesn't match any formula
            details: {
              ruleApplied: 'CUSTOM_RULE',
              formulaUsed: 'N/A',
            },
          },
        },
      };

      const snapshot = getOfficialSalaryMatchingSnapshot(arbitraryTeamResult);

      // Must return exact values, not recalculate
      expect(snapshot.salaryOut).toBe(12_345_678);
      expect(snapshot.salaryIn).toBe(87_654_321);
      expect(snapshot.allowableIncoming).toBe(11_111_111);
    });

    it('does not compute from components even when relationships seem off', () => {
      // allowableIncoming is less than salaryIn (an illegal trade)
      // but selector should not "fix" this
      const illegalTeamResult = {
        teamId: 'ILLEGAL',
        salaryOut: 10_000_000,
        salaryIn: 50_000_000,
        rules: {
          salaryMatching: {
            passed: false, // Validator says it's illegal
            allowableIncoming: 15_000_000, // Less than salaryIn
            details: {
              ruleApplied: 'OVER_CAP',
            },
          },
        },
      };

      const snapshot = getOfficialSalaryMatchingSnapshot(illegalTeamResult);

      // Must preserve exact values, including the "impossible" relationship
      expect(snapshot.salaryIn).toBe(50_000_000);
      expect(snapshot.allowableIncoming).toBe(15_000_000);
      expect(snapshot.passed).toBe(false);
    });
  });
});
