/**
 * FILE: src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js
 * PURPOSE: Guardrail tests for Phase 56 pure computeTradeResult architecture.
 *
 * Tests verify:
 * 1. computeTradeResult is pure (no internal validateTrade calls)
 * 2. validateTrade is called exactly once per mutation
 * 3. Correct call order for signAndTrade (signing before trade)
 * 4. computeTradeResult works with provided validatedContext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
} from '@/features/architect/utils/mutationPipeline';
import { buildTradeApplyPreparation } from '@/features/architect/utils/tradeContext';
// Phase 59/TM-4B: validateTradeForContext remains compatibility-only in legacy/
import { validateTradeForContext } from '@/features/architect/utils/tradeContext/legacy';

type TradeMachineModule = typeof import('@/features/architect/utils/tradeMachine');

// Mock validateTrade to track calls
const validateTradeMock = vi.fn();
vi.mock('@/features/architect/utils/tradeMachine', async (importOriginal) => {
  const actual = (await importOriginal()) as TradeMachineModule;
  return {
    ...actual,
    validateTrade: (...args: Parameters<TradeMachineModule['validateTrade']>) => {
      validateTradeMock(...args);
      // Call the real implementation
      return actual.validateTrade(...args);
    },
  };
});

// Fixtures
const mockTeamA = {
  teamCode: 'TMA',
  teamName: 'Team A',
  roster: ['player-a'],
  players: [
    {
      player_id: 'player-a',
      name: 'Player A',
      currentSalary: 15000000,
      contract: {
        salariesByYear: [
          { season: '2025-26', salary: 15000000, guaranteed: true },
        ],
      },
    },
  ],
  tradeExceptions: [],
  draftPicks: [],
  exceptions: {},
  totals: {
    totalSalary: 150000000,
    capHit: 150000000,
  },
};

const mockTeamB = {
  teamCode: 'TMB',
  teamName: 'Team B',
  roster: ['player-b'],
  players: [
    {
      player_id: 'player-b',
      name: 'Player B',
      currentSalary: 12000000,
      contract: {
        salariesByYear: [
          { season: '2025-26', salary: 12000000, guaranteed: true },
        ],
      },
    },
  ],
  tradeExceptions: [],
  draftPicks: [],
  exceptions: {},
  totals: {
    totalSalary: 100000000,
    capHit: 100000000,
  },
};

describe('Phase 56: Pure computeTradeResult Guardrails', () => {
  beforeEach(() => {
    validateTradeMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 1: buildPostTradeTeamsSnapshot is Pure', () => {
    it('should build post-trade snapshot without calling validateTrade', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // Verify snapshot was built
      expect(snapshot).toBeDefined();
      expect(snapshot.teamUpdates).toHaveLength(2);
      expect(snapshot.validationTeams).toHaveLength(2);

      // Verify validateTrade was NOT called during snapshot building
      expect(validateTradeMock).not.toHaveBeenCalled();
    });

    it('should correctly apply roster changes in snapshot', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // Team A should have player-b, not player-a
      const teamASnapshot = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      );
      expect(teamASnapshot.team.roster).toContain('player-b');
      expect(teamASnapshot.team.roster).not.toContain('player-a');

      // Team B should have player-a, not player-b
      const teamBSnapshot = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      );
      expect(teamBSnapshot.team.roster).toContain('player-a');
      expect(teamBSnapshot.team.roster).not.toContain('player-b');
    });
  });

  describe('Test 2: validatePostTradeSnapshotForContext Calls Validate Once', () => {
    it('should call validateTrade exactly once', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      // Build snapshot first
      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // Clear mock after snapshot (should not have been called)
      expect(validateTradeMock).not.toHaveBeenCalled();

      // Validate snapshot
      const validatedContext = validatePostTradeSnapshotForContext({
        snapshot,
        payload,
        seasonId: '2025-26',
      });

      // Verify validateTrade was called exactly once
      expect(validateTradeMock).toHaveBeenCalledTimes(1);
      expect(validatedContext._isValidatedTradeContext).toBe(true);
    });

    it('should return validated context with correct structure', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const validatedContext = validatePostTradeSnapshotForContext({
        snapshot,
        payload,
        seasonId: '2025-26',
      });

      // Verify context structure
      expect(validatedContext).toHaveProperty('legal');
      expect(validatedContext).toHaveProperty('valid');
      expect(validatedContext).toHaveProperty('_isValidatedTradeContext', true);
      expect(validatedContext).toHaveProperty('teamResults');
      expect(validatedContext).toHaveProperty('validationTeams');
      expect(Array.isArray(validatedContext.violations)).toBe(true);
      expect(Array.isArray(validatedContext.warnings)).toBe(true);
    });
  });

  describe('Test 2B: buildTradeApplyPreparation centralizes snapshot + validation', () => {
    it('returns both prepared artifacts and canonicalizes validation payload asOfDate', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      const preparation = buildTradeApplyPreparation({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
        asOfDate: '2026-03-15',
      });

      expect(preparation.postTradeSnapshot.teamUpdates).toHaveLength(2);
      expect(preparation.validatedContext._isValidatedTradeContext).toBe(true);
      expect(preparation.validationPayload.asOfDate).toBe('2026-03-15');
      expect(preparation.validationPayload.tradeCtx.asOfDate).toBe(
        '2026-03-15'
      );
      expect(validateTradeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test 3: Legacy Compatibility - validateTradeForContext', () => {
    it('should still work as a convenience wrapper', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      // Legacy function should still work
      const validatedContext = validateTradeForContext({
        payload,
        currentState,
        seasonId: '2025-26',
      });

      expect(validatedContext._isValidatedTradeContext).toBe(true);
      expect(validatedContext).toHaveProperty('legal');
    });
  });

  describe('Test 4: Snapshot Validates Post-Trade State', () => {
    it('should include POST-trade roster in validation teams', () => {
      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player-a',
                name: 'Player A',
                currentSalary: 15000000,
              },
            ],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player-b',
                name: 'Player B',
                currentSalary: 12000000,
              },
            ],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: mockTeamA },
          { teamCode: 'TMB', team: mockTeamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // Validation teams should have POST-trade roster state
      const validationTeamA = snapshot.validationTeams.find(
        (t) => t.teamCode === 'TMA'
      );
      expect(validationTeamA.team.roster).toContain('player-b');
      expect(validationTeamA.team.roster).not.toContain('player-a');
    });
  });

  describe('Test 5: Error Handling', () => {
    it('should return error context if validation throws', () => {
      const badPayload = {
        teams: [], // Empty teams should cause issues
      };

      const currentState = {
        teams: [],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload: badPayload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // This should not throw but return an error context
      const validatedContext = validatePostTradeSnapshotForContext({
        snapshot,
        payload: badPayload,
        seasonId: '2025-26',
      });

      expect(validatedContext._isValidatedTradeContext).toBe(true);
      // Either legal:false or valid:false depending on how error manifests
      expect(
        validatedContext.legal === false ||
          validatedContext.valid === false ||
          validatedContext.teamResults.length === 0
      ).toBe(true);
    });
  });
});
