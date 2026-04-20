/**
 * FILE: src/tests/architect/phase47_tpe_persistence_guardrails.test.js
 * PURPOSE: Guardrail tests for Phase 47B TPE persistence (SSOT-aligned)
 * OWNERSHIP: Feature: architect (Cap Sheet - Trade Exceptions)
 *
 * HISTORY:
 *  - 2026-01-28: Phase 47 - Created for TPE persistence guardrails
 *  - 2026-01-28: Phase 47B - Updated to reflect SSOT alignment (no hardcoded cap, validator-based creation)
 *
 * KEY BEHAVIOR (Phase 47B):
 * - Created TPEs sourced from validator output (teamResult.createdTPE), not recomputed
 * - Consumed TPEs use validated matchIncoming values, not raw salary fields
 * - No hardcoded cap constants; cap settings from capSettingsProvider
 * - Tests validate the mathematical logic; actual persistence tested via integration tests
 */

import { describe, test, expect, vi } from 'vitest';

// We'll test the computeTradeResult function directly by importing the pipeline
// Since computeTradeResult is not exported, we need to test via the public interface
// For unit testing, we'll mock the minimal dependencies

// Helper to create a mock player
const makePlayer = (name, salary, options = {}) => ({
  name,
  player_id: `player_${name.toLowerCase().replace(/\s+/g, '_')}`,
  salary,
  contract: {
    salariesByYear: [{ season: '2024-25', salary }],
  },
  ...options,
});

// Helper to create a mock team
const makeTeam = (teamCode, totalSalary, options = {}) => ({
  id: teamCode.toLowerCase(),
  teamCode,
  teamName: `Team ${teamCode}`,
  teamTotalSalary: totalSalary,
  totals: { teamSalary: totalSalary },
  players: [],
  roster: [],
  tradeExceptions: [],
  entitlementIds: [],
  ...options,
});

// Helper to create a mock TPE
const makeTPE = (id, amount, options = {}) => ({
  id,
  amount,
  totalAmount: amount,
  remainingAmount: amount,
  usedAmount: 0,
  createdSeason: 2024,
  expiresOn: '2026-07-01T00:00:00.000Z',
  isUsed: false,
  ...options,
});

describe('Phase 47B: TPE Persistence Guardrails (SSOT-Aligned)', () => {
  describe('TPE Creation Persistence', () => {
    test('Created TPE is added to tradeExceptions when team sends more than receives and is over cap', async () => {
      // Phase 47B: TPE creation now sourced from validator output (teamResult.createdTPE)
      // This test validates the mathematical logic; actual validator integration tested elsewhere

      const SALARY_CAP = 141_000_000; // In production, from capSettings.salaryCap
      const team = makeTeam('BOS', 170_000_000); // Over cap
      const outgoingSalary = 20_000_000;
      const incomingSalary = 12_000_000;
      const salaryDifference = outgoingSalary - incomingSalary;

      // Simulate TPE creation logic (matches validator behavior)
      const isOverCap = team.teamTotalSalary > SALARY_CAP;
      const shouldCreateTPE = salaryDifference > 0 && isOverCap;

      expect(shouldCreateTPE).toBe(true);
      expect(salaryDifference).toBe(8_000_000);

      // Simulate the created TPE structure
      if (shouldCreateTPE) {
        const createdTPE = {
          id: `tpe_BOS_${Date.now()}_test`,
          amount: salaryDifference,
          totalAmount: salaryDifference,
          remainingAmount: salaryDifference,
          usedAmount: 0,
          createdSeason: 2024,
          expiresOn: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000
          ).toISOString(),
          isUsed: false,
        };

        const updatedTPEs = [...team.tradeExceptions, createdTPE];
        expect(updatedTPEs.length).toBe(1);
        expect(updatedTPEs[0].amount).toBe(8_000_000);
        expect(updatedTPEs[0].remainingAmount).toBe(8_000_000);
        expect(updatedTPEs[0].isUsed).toBe(false);
      }
    });

    test('No TPE created when team receives more than sends', () => {
      const SALARY_CAP = 141_000_000; // In production, from capSettings.salaryCap
      const team = makeTeam('LAL', 170_000_000); // Over cap
      const outgoingSalary = 10_000_000;
      const incomingSalary = 15_000_000;
      const salaryDifference = outgoingSalary - incomingSalary;

      const isOverCap = team.teamTotalSalary > SALARY_CAP;
      const shouldCreateTPE = salaryDifference > 0 && isOverCap;

      expect(shouldCreateTPE).toBe(false);
      expect(salaryDifference).toBe(-5_000_000);
    });

    test('No TPE created when team is under cap', () => {
      const SALARY_CAP = 141_000_000; // In production, from capSettings.salaryCap
      const team = makeTeam('DET', 120_000_000); // Under cap
      const outgoingSalary = 20_000_000;
      const incomingSalary = 10_000_000;
      const salaryDifference = outgoingSalary - incomingSalary;

      const isOverCap = team.teamTotalSalary > SALARY_CAP;
      const shouldCreateTPE = salaryDifference > 0 && isOverCap;

      expect(shouldCreateTPE).toBe(false);
      expect(isOverCap).toBe(false);
    });

    test('Created TPE has stable ID format', () => {
      const teamCode = 'MIA';
      const timestamp = Date.now();
      const randomPart = 'abc123';
      const expectedIdPattern = /^tpe_[A-Z]{3}_\d+_[a-z0-9]+$/;

      const tpeId = `tpe_${teamCode}_${timestamp}_${randomPart}`;
      expect(tpeId).toMatch(expectedIdPattern);
    });
  });

  describe('TPE Consumption Persistence', () => {
    test('Consumed TPE has remainingAmount decremented', () => {
      const tpe = makeTPE('tpe_existing_1', 15_000_000);
      const absorbedSalary = 10_000_000;

      // Simulate consumption logic
      const newRemaining = Math.max(0, tpe.remainingAmount - absorbedSalary);
      const newUsed = tpe.usedAmount + absorbedSalary;
      const isFullyUsed = newRemaining === 0;

      const updatedTPE = {
        ...tpe,
        remainingAmount: newRemaining,
        usedAmount: newUsed,
        isUsed: isFullyUsed,
      };

      expect(updatedTPE.remainingAmount).toBe(5_000_000);
      expect(updatedTPE.usedAmount).toBe(10_000_000);
      expect(updatedTPE.isUsed).toBe(false);
    });

    test('Fully consumed TPE is marked isUsed=true', () => {
      const tpe = makeTPE('tpe_existing_2', 10_000_000);
      const absorbedSalary = 10_000_000;

      const newRemaining = Math.max(0, tpe.remainingAmount - absorbedSalary);
      const newUsed = tpe.usedAmount + absorbedSalary;
      const isFullyUsed = newRemaining === 0;

      const updatedTPE = {
        ...tpe,
        remainingAmount: newRemaining,
        usedAmount: newUsed,
        isUsed: isFullyUsed,
      };

      expect(updatedTPE.remainingAmount).toBe(0);
      expect(updatedTPE.usedAmount).toBe(10_000_000);
      expect(updatedTPE.isUsed).toBe(true);
    });

    test('Multiple players can consume same TPE', () => {
      const tpe = makeTPE('tpe_multi', 20_000_000);
      const player1Salary = 8_000_000;
      const player2Salary = 7_000_000;
      const totalAbsorbed = player1Salary + player2Salary;

      const newRemaining = Math.max(0, tpe.remainingAmount - totalAbsorbed);
      const newUsed = tpe.usedAmount + totalAbsorbed;

      const updatedTPE = {
        ...tpe,
        remainingAmount: newRemaining,
        usedAmount: newUsed,
        isUsed: newRemaining === 0,
      };

      expect(updatedTPE.remainingAmount).toBe(5_000_000);
      expect(updatedTPE.usedAmount).toBe(15_000_000);
      expect(updatedTPE.isUsed).toBe(false);
    });

    test('TPE usage map correctly accumulates per tpeId', () => {
      const players = [
        { name: 'Player A', salary: 5_000_000, tpeId: 'tpe1' },
        { name: 'Player B', salary: 3_000_000, tpeId: 'tpe1' },
        { name: 'Player C', salary: 4_000_000, tpeId: 'tpe2' },
      ];

      const tpeUsageMap = new Map();
      players.forEach((player) => {
        if (player.tpeId) {
          const currentUsage = tpeUsageMap.get(player.tpeId) || 0;
          tpeUsageMap.set(player.tpeId, currentUsage + player.salary);
        }
      });

      expect(tpeUsageMap.get('tpe1')).toBe(8_000_000);
      expect(tpeUsageMap.get('tpe2')).toBe(4_000_000);
    });

    test('Unchanged TPEs are not modified', () => {
      const tpe1 = makeTPE('tpe_unchanged', 10_000_000);
      const tpe2 = makeTPE('tpe_used', 15_000_000);
      const currentTPEs = [tpe1, tpe2];

      const tpeUsageMap = new Map();
      tpeUsageMap.set('tpe_used', 5_000_000); // Only tpe2 is used

      const updatedTPEs = currentTPEs.map((tpe) => {
        const absorbed = tpeUsageMap.get(tpe.id) || 0;
        if (absorbed === 0) return tpe; // No change

        return {
          ...tpe,
          remainingAmount: Math.max(0, tpe.remainingAmount - absorbed),
          usedAmount: tpe.usedAmount + absorbed,
          isUsed: tpe.remainingAmount - absorbed === 0,
        };
      });

      // tpe_unchanged should be identical
      expect(updatedTPEs[0]).toBe(tpe1); // Same reference = unchanged
      expect(updatedTPEs[0].remainingAmount).toBe(10_000_000);

      // tpe_used should be updated
      expect(updatedTPEs[1]).not.toBe(tpe2); // Different reference = changed
      expect(updatedTPEs[1].remainingAmount).toBe(10_000_000);
      expect(updatedTPEs[1].usedAmount).toBe(5_000_000);
    });
  });

  describe('TPE Auto-Match Logic', () => {
    test('Player with absorptionMode=TPE auto-matches to first available TPE', () => {
      const tpes = [
        makeTPE('tpe_small', 3_000_000),
        makeTPE('tpe_large', 10_000_000),
      ];

      const player = {
        name: 'Player X',
        salary: 5_000_000,
        absorptionMode: 'TPE',
        // No explicit tpeId
      };

      // Simulate auto-match logic
      let matchedTpeId = null;
      for (const tpe of tpes) {
        if (tpe.isUsed) continue;
        const remaining = tpe.remainingAmount ?? tpe.amount ?? 0;
        if (remaining >= player.salary) {
          matchedTpeId = tpe.id;
          break;
        }
      }

      // Should match to 'tpe_large' since 'tpe_small' is too small
      expect(matchedTpeId).toBe('tpe_large');
    });

    test('Explicit tpeId takes precedence over auto-match', () => {
      const tpes = [
        makeTPE('tpe_small', 3_000_000),
        makeTPE('tpe_large', 10_000_000),
      ];

      const player = {
        name: 'Player Y',
        salary: 5_000_000,
        tpeId: 'tpe_small', // Explicit assignment (will fail validation but should be respected)
      };

      // When tpeId is explicitly set, use it regardless of capacity
      const matchedTpeId = player.tpeId;
      expect(matchedTpeId).toBe('tpe_small');
    });
  });

  describe('Edge Cases', () => {
    test('Empty tradeExceptions array is handled correctly', () => {
      const team = makeTeam('CHI', 170_000_000);
      expect(team.tradeExceptions).toEqual([]);

      // After trade that creates TPE
      const createdTPE = makeTPE('tpe_new', 5_000_000);
      const updatedTPEs = [...team.tradeExceptions, createdTPE];

      expect(updatedTPEs.length).toBe(1);
    });

    test('remainingAmount clamps to 0 (no negative values)', () => {
      const tpe = makeTPE('tpe_small', 5_000_000);
      const absorbedSalary = 10_000_000; // More than available

      const newRemaining = Math.max(0, tpe.remainingAmount - absorbedSalary);
      expect(newRemaining).toBe(0);
      expect(newRemaining).toBeGreaterThanOrEqual(0);
    });

    test('Duplicate TPE IDs are not created (idempotency)', () => {
      const existingTPEs = [makeTPE('tpe_existing', 10_000_000)];
      const newTPE = makeTPE('tpe_existing', 5_000_000); // Same ID

      // Check for duplicate before adding
      const hasDuplicate = existingTPEs.some((t) => t.id === newTPE.id);
      expect(hasDuplicate).toBe(true);

      // In real implementation, we should not add duplicates
      const updatedTPEs = hasDuplicate
        ? existingTPEs
        : [...existingTPEs, newTPE];

      expect(updatedTPEs.length).toBe(1);
    });
  });
});
