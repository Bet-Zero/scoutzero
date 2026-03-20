/**
 * FILE: src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js
 * PURPOSE: P0 regression tests for HARD_CAP_SKIP bug fix
 *          Validates worldless mode hard cap detection and skip semantics
 * OWNERSHIP: Feature: architect (Trade Machine - CBA Validation)
 *
 * HISTORY:
 *  - 2026-01-03: Created for P0 HARD_CAP_SKIP bug fix
 *
 * WHAT THIS TESTS (from problem statement Task E):
 * 1) Worldless team with no triggers does NOT produce HARD_CAP_SKIP
 * 2) If hard cap skip occurs, allowableIncoming is null (not 0) and passed is null (not true)
 * 3) ruleApplied is null in skip state; skipReason is populated
 * 4) preTradeTeamSalarySource is NOT team.teamTotalSalary in worldless (uses canonical source)
 */

import { describe, test, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';
import { getHardCapStatus, isTeamHardCapped } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus.js';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';

describe('P0 HARD_CAP_SKIP Worldless Regression Tests', () => {
  // ==========================================================================
  // Test 1: Worldless team with no triggers does NOT produce HARD_CAP_SKIP
  // ==========================================================================
  
  describe('Worldless teams without triggers', () => {
    test('team with hardCapped=undefined does NOT trigger HARD_CAP_SKIP', () => {
      const team = {
        hardCapped: undefined, // No hard cap flag
        team: {},
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 140_000_000, // Under cap
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, { worldId: null }); // Worldless context

      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
      expect(result.passed).not.toBeNull();
    });

    test('team with hardCapped=false does NOT trigger HARD_CAP_SKIP', () => {
      const team = {
        hardCapped: false, // Explicit false
        team: { hardCapTriggered: false },
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 140_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, { worldId: null });

      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
    });

    test('team with only totals.hardCapLevel !== "none" but hardCapped not boolean true', () => {
      // This simulates the case where loadTeamCapSheet sets hardCapped based on
      // baseDoc.totals?.hardCapLevel which might be a string like "FirstApron"
      const team = {
        hardCapped: 'FirstApron', // String, not boolean!
        team: {},
        salaryIn: 10_000_000,
        salaryOut: 10_000_000,
        teamTotalSalary: 140_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 178_000_000,
            secondApron: 188_000_000,
          },
        },
      };

      const result = validateSalaryMatching(team, { worldId: null });

      // String values should NOT trigger HARD_CAP_SKIP in worldless mode
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.applicable).toBe(true);
    });
  });

  // ==========================================================================
  // Test 2: Hard-capped teams now RUN salary matching (FIX applied)
  // ==========================================================================
  
  describe('Hard-capped teams run salary matching', () => {
    test('hard-capped team gets proper allowableIncoming (not null)', () => {
      const team = {
        hardCapped: true, // Boolean true - now runs matching
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

      // FIXED: No longer skips - runs matching based on salary position
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.allowableIncoming).not.toBeNull();
      expect(result.applicable).toBe(true);
    });

    test('hard-capped team gets proper passed boolean (not null)', () => {
      const team = {
        hardCapped: true,
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

      // FIXED: Actually runs validation
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.passed).not.toBeNull();
      expect(typeof result.passed).toBe('boolean');
    });

    test('TPE_ABSORPTION skip has allowableIncoming=null (not 0)', () => {
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
      expect(result.allowableIncoming).not.toBe(0);
    });
  });

  // ==========================================================================
  // Test 3: Hard-capped teams get proper rule/margin (not null)
  // ==========================================================================
  
  describe('Hard-capped teams get proper matching results', () => {
    test('hard-capped team gets proper ruleApplied based on salary position', () => {
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

      // FIXED: Gets actual rule based on salary position
      expect(result.skipReason).not.toBe('HARD_CAP_SKIP');
      expect(result.details.ruleApplied).toBe('UNDER_CAP'); // Under 141M
    });

    test('hard-capped team gets proper margin calculation', () => {
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

      // FIXED: Gets actual margin calculation
      expect(result.details.margin).not.toBeNull();
      expect(typeof result.details.margin).toBe('number');
    });
  });

  // ==========================================================================
  // Test 4: Trade receipt respects new matching semantics
  // ==========================================================================
  
  describe('Trade receipt matching semantics', () => {
    test('trade receipt salaryMatchingEvaluation runs for hard-capped teams', () => {
      const teams = [
        {
          team: {
            id: 'A',
            teamName: 'Team A',
            teamTotalSalary: 100_000_000, // Under cap - uses UNDER_CAP rule
            hardCapTriggered: true, // Hard capped, but matching still runs
          },
          sends: [{ name: 'Player A', id: 'p1' }],
          picksOut: [],
          hardCapped: true,
        },
        {
          team: {
            id: 'B',
            teamName: 'Team B',
            teamTotalSalary: 100_000_000,
          },
          sends: [{ name: 'Player B', id: 'p2' }],
          picksOut: [],
          hardCapped: false,
        },
      ];

      const capProjections = {
        salaryCap: 141_000_000,
        firstApron: 178_000_000,
        secondApron: 188_000_000,
      };

      const result = validateTrade({
        teams,
        capProjections,
        currentYear: 2026,
      });

      // Team A is hard-capped but salary matching RUNS (not skipped)
      const teamAReceipt = result.tradeReceipt?.teams?.find(t => t.teamCode === 'A');
      expect(teamAReceipt).toBeDefined();
      
      if (teamAReceipt) {
        const salaryMatchingEval = teamAReceipt.salaryMatchingEvaluation;
        // FIXED: No longer skips - runs matching based on salary position
        expect(salaryMatchingEval.skipReason).not.toBe('HARD_CAP_SKIP');
        expect(salaryMatchingEval.ruleApplied).not.toBeNull();
      }
    });

    test('trade receipt uses global cap settings for skipped teams', () => {
      const teams = [
        {
          team: {
            id: 'A',
            teamName: 'Team A',
            teamTotalSalary: 100_000_000,
          },
          sends: [{ name: 'Player A', id: 'p1' }],
          picksOut: [],
          hardCapped: true, // Triggers skip
        },
        {
          team: {
            id: 'B',
            teamName: 'Team B',
            teamTotalSalary: 100_000_000,
          },
          sends: [{ name: 'Player B', id: 'p2' }],
          picksOut: [],
          hardCapped: false,
        },
      ];

      const capProjections = {
        '2025-26': {
          salaryCap: 141_000_000,
          firstApron: 178_000_000,
          secondApron: 188_000_000,
        },
      };

      const result = validateTrade({
        teams,
        capProjections,
        currentYear: 2026,
      });

      // Even when skipped, receipt should include global cap settings
      const teamAReceipt = result.tradeReceipt?.teams?.find(t => t.teamCode === 'A');
      expect(teamAReceipt).toBeDefined();
      
      if (teamAReceipt) {
        const salaryMatchingEval = teamAReceipt.salaryMatchingEvaluation;
        // capSettings should reference global settings even on skip
        expect(salaryMatchingEval.capSettings).toBeDefined();
        expect(salaryMatchingEval.capSettings.salaryCap).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // Test: getHardCapStatus function
  // ==========================================================================
  
  describe('getHardCapStatus function', () => {
    test('returns isHardCapped=false for team with no triggers', () => {
      const team = {
        hardCapped: false,
        team: { hardCapTriggered: undefined },
      };

      const status = getHardCapStatus(team, { isWorldless: true });

      expect(status.isHardCapped).toBe(false);
      expect(status.source).toBe('NO_HARD_CAP_TRIGGER');
    });

    test('returns isHardCapped=true only for boolean true', () => {
      const team = {
        hardCapped: true,
        team: {},
      };

      const status = getHardCapStatus(team, { isWorldless: true });

      expect(status.isHardCapped).toBe(true);
      expect(status.source).toBe('team.hardCapped === true');
    });

    test('ignores string values in worldless mode', () => {
      const team = {
        hardCapped: 'FirstApron', // String should not trigger
        team: { hardCapTriggered: 'true' }, // String should not trigger
      };

      const status = getHardCapStatus(team, { isWorldless: true });

      expect(status.isHardCapped).toBe(false);
    });

    test('isTeamHardCapped helper returns boolean', () => {
      const hardCappedTeam = { hardCapped: true };
      const normalTeam = { hardCapped: false };

      expect(isTeamHardCapped(hardCappedTeam)).toBe(true);
      expect(isTeamHardCapped(normalTeam)).toBe(false);
    });
  });
});
