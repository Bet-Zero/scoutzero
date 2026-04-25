/**
 * FILE: src/tests/trade/hardCapSkip_strict_boolean.guardrail.test.js
 * PURPOSE: Guardrail tests for hard cap detection and salary matching behavior.
 * OWNERSHIP: Feature: architect (Trade Machine - Worldless Mode)
 *
 * HISTORY:
 *  - 2026-01-03: Created for HARD_CAP_SKIP strict boolean fix
 *  - 2026-01-03: Updated for hard cap salary matching fix - hard-capped teams now RUN matching
 *
 * WHAT THIS TESTS:
 * - String "false" values for hardCapped or hardCapTriggered must NOT affect matching
 * - Boolean true values are detected but salary matching still runs based on salary position
 * - Debug fields are present in output when team is hard-capped
 */

import { describe, test, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';

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
  // Test: Boolean true values are detected but matching still runs
  // ==========================================================================
  
  describe('Boolean true values detected, but matching runs', () => {
    test('hardCapped=true (boolean) runs matching with hardCapStatus in details', () => {
      const team = {
        hardCapped: true, // Boolean true
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000, // Under cap
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // FIXED: Matching runs based on salary position (not skipped)
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
      expect(result.allowableIncoming).not.toBeNull();
      expect(typeof result.passed).toBe('boolean');
      // But hardCapStatus is still tracked for informational purposes
      expect(result.details.hardCapStatus!.isHardCapped).toBe(true);
    });

    test('hardCapTriggered=true (boolean) runs matching with hardCapStatus in details', () => {
      const team = {
        hardCapped: false,
        team: {
          hardCapTriggered: true, // Boolean true
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000, // Under cap
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // FIXED: Matching runs based on salary position
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
      expect(result.allowableIncoming).not.toBeNull();
      expect(typeof result.passed).toBe('boolean');
      // But hardCapStatus is still tracked
      expect(result.details.hardCapStatus!.isHardCapped).toBe(true);
    });
  });

  // ==========================================================================
  // Test: Debug fields are present when hard-capped
  // ==========================================================================
  
  describe('Debug fields in output for hard-capped teams', () => {
    test('hardCapStatus shows status for hardCapped=true', () => {
      const team = {
        hardCapped: true,
        team: {
          hardCapTriggered: false,
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000, // Under cap
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // Hard cap status is tracked even though matching runs
      expect(result.details.hardCapStatus).toBeDefined();
      expect(result.details.hardCapStatus!.isHardCapped).toBe(true);
      expect(result.details.hardCapStatus!.source).toBe('team.hardCapped === true');
    });

    test('hardCapStatus shows status for hardCapTriggered=true', () => {
      const team = {
        hardCapped: false,
        team: {
          hardCapTriggered: true,
        },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000, // Under cap
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // Hard cap status is tracked even though matching runs
      expect(result.details.hardCapStatus).toBeDefined();
      expect(result.details.hardCapStatus!.isHardCapped).toBe(true);
      expect(result.details.hardCapStatus!.source).toBe('team.team.hardCapTriggered === true');
    });
  });

  // ==========================================================================
  // Test: allowableIncoming semantics
  // ==========================================================================
  
  describe('allowableIncoming semantics', () => {
    test('allowableIncoming is computed (not null) for hard-capped teams', () => {
      const team = {
        hardCapped: true,
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000, // Under cap
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, {});

      // FIXED: Hard-capped teams get proper allowableIncoming
      expect(result.allowableIncoming).not.toBeNull();
      expect(result.allowableIncoming).toBeGreaterThan(0);
    });

    test('allowableIncoming is null (not 0) when TPE_ABSORPTION', () => {
      const team = {
        hardCapped: false,
        appliedTPEs: [{ id: 'tpe1', amount: 15_000_000 }],
        // CBA FIX: Must have incoming players with tpeId assignments
        incomingPlayers: [
          { name: 'Player A', salary: 10_000_000, tpeId: 'tpe1' },
        ],
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
