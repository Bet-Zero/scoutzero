/**
 * FILE: src/tests/trade/tpe_perPlayer.guardrail.test.js
 * PURPOSE: Guardrail tests for TPE per-player matching (CBA fix)
 * OWNERSHIP: Feature: architect (Trade Machine - TPE Validation)
 *
 * HISTORY:
 *  - 2026-01-03: Created for TPE per-player matching fix
 *
 * KEY BEHAVIOR:
 * TPEs must cover 100% of specifically assigned player(s). Leftover TPE capacity
 * does NOT contribute to matching other players.
 */

import { describe, test, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js';

const defaultCapSettings = {
  salaryCap: 141_000_000,
  firstApron: 178_000_000,
  secondApron: 188_000_000,
};

describe('TPE Per-Player Matching', () => {
  
  describe('TPE must cover specific players', () => {
    test('TPE covering assigned player fully passes', () => {
      const team = {
        appliedTPEs: [{ id: 'tpe1', amount: 15_000_000 }],
        incomingPlayers: [
          { name: 'Player A', salary: 10_000_000, tpeId: 'tpe1' },
        ],
        salaryIn: 10_000_000,
        salaryOut: 0,
        teamTotalSalary: 100_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(true);
      expect(result.skipReason).toBe('TPE_ABSORPTION');
    });

    test('TPE covering multiple players fully passes', () => {
      const team = {
        appliedTPEs: [{ id: 'tpe1', amount: 15_000_000 }],
        incomingPlayers: [
          { name: 'Player A', salary: 10_000_000, tpeId: 'tpe1' },
          { name: 'Player B', salary: 4_000_000, tpeId: 'tpe1' },
        ],
        salaryIn: 14_000_000,
        salaryOut: 0,
        teamTotalSalary: 100_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(true);
      expect(result.skipReason).toBe('TPE_ABSORPTION');
    });

    test('absorptionMode=TPE fails if no TPE is large enough', () => {
      const team = {
        appliedTPEs: [{ id: 'small-tpe', amount: 3_000_000 }],
        incomingPlayers: [
          { name: 'Player A', salary: 5_000_000, absorptionMode: 'TPE' },
        ],
        salaryIn: 5_000_000,
        salaryOut: 0,
        teamTotalSalary: 100_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('sufficient capacity');
    });

    test('explicit tpeId assignment is respected (no auto-match override)', () => {
      const team = {
        appliedTPEs: [
          { id: 'small-tpe', amount: 3_000_000 },
          { id: 'large-tpe', amount: 10_000_000 },
        ],
        incomingPlayers: [
          // Explicitly assign to small TPE (too small) - should FAIL even though large TPE exists
          { name: 'Player A', salary: 5_000_000, absorptionMode: 'TPE', tpeId: 'small-tpe' },
        ],
        salaryIn: 5_000_000,
        salaryOut: 0,
        teamTotalSalary: 100_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('insufficient for assigned players');
    });

    test('TPE insufficient for assigned player FAILS', () => {
      const team = {
        appliedTPEs: [{ id: 'tpe1', amount: 10_000_000 }],
        incomingPlayers: [
          { name: 'Player A', salary: 15_000_000, tpeId: 'tpe1' }, // TPE too small
        ],
        salaryIn: 15_000_000,
        salaryOut: 0,
        teamTotalSalary: 100_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('insufficient');
    });
  });

  describe('Leftover TPE does NOT spill over', () => {
    test('Non-TPE player must be matched separately', () => {
      const team = {
        appliedTPEs: [{ id: 'tpe1', amount: 15_000_000 }],
        incomingPlayers: [
          { name: 'Player A', salary: 10_000_000, tpeId: 'tpe1' }, // TPE covers this
          { name: 'Player B', salary: 20_000_000 }, // NO tpeId - must match
        ],
        salaryIn: 30_000_000,
        salaryOut: 10_000_000, // Only $10M outgoing for $20M player
        teamTotalSalary: 150_000_000, // Over cap, below first apron
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // Extra $5M from TPE should NOT help match the $20M player
      // salaryNeedingMatch = 30M - 10M (TPE absorbed) = 20M
      // outgoing = 10M, so matching check should run on 20M vs 10M allowable
      expect(result.skipReason).not.toBe('TPE_ABSORPTION');
      // Note: This test verifies TPE doesn't skip; actual pass/fail depends on matching rules
    });
  });

  describe('No tpeId means no TPE coverage', () => {
    test('TPE with no assigned players does not skip matching', () => {
      const team = {
        appliedTPEs: [{ id: 'tpe1', amount: 50_000_000 }], // Big TPE
        incomingPlayers: [
          { name: 'Player A', salary: 10_000_000 }, // NO tpeId!
        ],
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 100_000_000,
        context: { capSettings: defaultCapSettings },
      };

      const result = validateSalaryMatching(team, {});

      // No player has tpeId, so TPE doesn't apply
      expect(result.skipReason).not.toBe('TPE_ABSORPTION');
      expect(result.applicable).toBe(true);
    });
  });
});
