/**
 * FILE: src/tests/trade/hardCapSkip_strict_boolean.guardrail.test.js
 * PURPOSE: Guardrail tests to prevent false HARD_CAP_SKIP in worldless trades.
 * OWNERSHIP: Feature: architect (Trade Machine - Worldless Mode)
 *
 * HISTORY:
 *  - 2026-01-03: Created for HARD_CAP_SKIP strict boolean fix
 *
 * WHAT THIS TESTS:
 * - String "false" values for hardCapped or hardCapTriggered must NOT trigger skip
 * - Boolean true values MUST trigger skip with allowableIncoming = null
 * - Debug fields are present in HARD_CAP_SKIP output
 */

import { describe, test, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js';

describe('HARD_CAP_SKIP Strict Boolean Checks', () => {
  // ==========================================================================
  // Test: String values must NOT trigger skip
  // ==========================================================================
  
  describe('String values must NOT trigger skip', () => {
    test('hardCapped="false" (string) must NOT skip', () => {
      const team = {
        hardCapped: 'false', // String, not boolean!
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // Must NOT have HARD_CAP_SKIP
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
    });

    test('hardCapTriggered="false" (string) must NOT skip', () => {
      const team = {
        hardCapped: false, // Correct boolean false
        team: {
          hardCapTriggered: 'false', // String, not boolean!
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // Must NOT have HARD_CAP_SKIP
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
    });

    test('hardCapTriggered=undefined must NOT skip', () => {
      const team = {
        hardCapped: false,
        team: {
          hardCapTriggered: undefined,
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // Must NOT have HARD_CAP_SKIP
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
    });

    test('hardCapTriggered=0 (number) must NOT skip', () => {
      const team = {
        hardCapped: false,
        team: {
          hardCapTriggered: 0, // Number 0, not boolean false
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // Must NOT have HARD_CAP_SKIP
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
    });
  });

  // ==========================================================================
  // Test: Boolean true values MUST trigger skip
  // ==========================================================================
  
  describe('Boolean true values MUST trigger skip', () => {
    test('hardCapped=true (boolean) MUST skip with allowableIncoming=null and passed=null', () => {
      const team = {
        hardCapped: true, // Boolean true
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
      };

      const result = validateSalaryMatching(team, {});

      expect(result.skipReason).toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(false);
      expect(result.allowableIncoming).toBeNull();
      // P0 Fix: When skipped, passed should be null (validation didn't run), not true
      expect(result.passed).toBeNull();
    });

    test('hardCapTriggered=true (boolean) MUST skip with allowableIncoming=null and passed=null', () => {
      const team = {
        hardCapped: false,
        team: {
          hardCapTriggered: true, // Boolean true
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
      };

      const result = validateSalaryMatching(team, {});

      expect(result.skipReason).toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(false);
      expect(result.allowableIncoming).toBeNull();
      // P0 Fix: When skipped, passed should be null (validation didn't run), not true
      expect(result.passed).toBeNull();
    });
  });

  // ==========================================================================
  // Test: Debug fields are present in HARD_CAP_SKIP output (using hardCapStatus object)
  // ==========================================================================
  
  describe('Debug fields in HARD_CAP_SKIP output', () => {
    test('hardCapStatus shows status for hardCapped=true', () => {
      const team = {
        hardCapped: true,
        team: {
          hardCapTriggered: false,
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
      };

      const result = validateSalaryMatching(team, {});

      // P0 Fix: Now uses hardCapStatus object instead of raw debug fields
      expect(result.details.hardCapStatus).toBeDefined();
      expect(result.details.hardCapStatus.isHardCapped).toBe(true);
      expect(result.details.hardCapStatus.source).toBe('team.hardCapped === true');
    });

    test('hardCapStatus shows status for hardCapTriggered=true', () => {
      const team = {
        hardCapped: false,
        team: {
          hardCapTriggered: true,
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
      };

      const result = validateSalaryMatching(team, {});

      // P0 Fix: Now uses hardCapStatus object instead of raw debug fields
      expect(result.details.hardCapStatus).toBeDefined();
      expect(result.details.hardCapStatus.isHardCapped).toBe(true);
      expect(result.details.hardCapStatus.source).toBe('team.team.hardCapTriggered === true');
    });
  });

  // ==========================================================================
  // Test: Null semantics for allowableIncoming
  // ==========================================================================
  
  describe('Null semantics for allowableIncoming on skip', () => {
    test('allowableIncoming is null (not 0) when HARD_CAP_SKIP', () => {
      const team = {
        hardCapped: true,
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
      };

      const result = validateSalaryMatching(team, {});

      expect(result.allowableIncoming).toBeNull();
      expect(result.allowableIncoming).not.toBe(0);
    });

    test('allowableIncoming is null (not 0) when TPE_ABSORPTION', () => {
      const team = {
        hardCapped: false,
        appliedTPEs: [{ amount: 15_000_000 }],
        salaryIn: 10_000_000,
        salaryOut: 0,
        teamTotalSalary: 100_000_000,
      };

      const result = validateSalaryMatching(team, {});

      expect(result.skipReason).toBe('TPE_ABSORPTION');
      expect(result.allowableIncoming).toBeNull();
    });
  });
});
