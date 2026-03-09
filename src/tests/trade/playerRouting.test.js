/**
 * FILE: src/tests/trade/playerRouting.test.js
 * PURPOSE: Test player routing validation for multi-team trades
 * OWNERSHIP: Trade Machine (Phase A5-E1)
 *
 * HISTORY:
 *   - 2026-02-14: Created for A5-F3/A5-F1 fixes
 *
 * COVERAGE:
 *   - validatePlayerRouting: tradeTo required for 3+ teams
 *   - validatePlayerRouting: tradeTo must be valid destination
 *   - validatePlayerRouting: cannot route to self
 *   - validatePlayerRouting: duplicate player detection
 *   - removeTeam cleanup: clear orphaned routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import validatePlayerRoutingDefault, {
  enforcePlayerRouting,
  validatePlayerRouting,
} from '@/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js';

// Helper to create a mock team slot
const makeTeamSlot = (teamId, sends = [], entitlementsOut = []) => ({
  team: { id: teamId, teamCode: teamId, name: `Team ${teamId}` },
  sends,
  entitlementsOut,
});

// Helper to create a mock player
const makePlayer = (name, tradeTo = undefined, id = undefined) => ({
  id: id || `player-${name.toLowerCase().replace(/\s+/g, '-')}`,
  playerId: id || `player-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  displayName: name,
  tradeTo,
  contract: { salariesByYear: [{ season: '2024-25', salary: 10_000_000 }] },
});

describe('validatePlayerRouting', () => {
  it('preserves the default export as the canonical validator function', () => {
    expect(validatePlayerRoutingDefault).toBe(validatePlayerRouting);
  });

  describe('3-team trades: tradeTo required', () => {
    it('should pass when all players have tradeTo in 3-team trade', () => {
      const teams = [
        makeTeamSlot('LAL', [makePlayer('Player A', 'BOS')]),
        makeTeamSlot('BOS', [makePlayer('Player B', 'MIA')]),
        makeTeamSlot('MIA', [makePlayer('Player C', 'LAL')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when player has no tradeTo in 3-team trade', () => {
      const teams = [
        makeTeamSlot('LAL', [makePlayer('Player A')]), // No tradeTo!
        makeTeamSlot('BOS', [makePlayer('Player B', 'MIA')]),
        makeTeamSlot('MIA', [makePlayer('Player C', 'LAL')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Player A');
      expect(result.errors[0]).toContain('no destination');
      expect(result.errors[0]).toContain('tradeTo required');
    });

    it('should allow missing tradeTo in 2-team trade (backward compat)', () => {
      const teams = [
        makeTeamSlot('LAL', [makePlayer('Player A')]), // No tradeTo, but only 2 teams
        makeTeamSlot('BOS', [makePlayer('Player B')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('tradeTo destination validation', () => {
    it('should fail when tradeTo points to non-participant team', () => {
      const teams = [
        makeTeamSlot('LAL', [makePlayer('Player A', 'NYK')]), // NYK not in trade!
        makeTeamSlot('BOS', [makePlayer('Player B', 'LAL')]),
        makeTeamSlot('MIA', [makePlayer('Player C', 'LAL')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid destination'))).toBe(
        true
      );
      expect(result.errors.some((e) => e.includes('NYK'))).toBe(true);
    });

    it('should fail when tradeTo points to self', () => {
      const teams = [
        makeTeamSlot('LAL', [makePlayer('Player A', 'LAL')]), // Cannot route to self!
        makeTeamSlot('BOS', [makePlayer('Player B', 'MIA')]),
        makeTeamSlot('MIA', [makePlayer('Player C', 'BOS')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('cannot be routed to the same'))
      ).toBe(true);
    });
  });

  describe('duplicate player detection', () => {
    it('should fail when same player appears in multiple teams sends', () => {
      const duplicatePlayer = makePlayer('Duplicate Guy', 'MIA', 'dup-123');

      const teams = [
        makeTeamSlot('LAL', [duplicatePlayer]),
        makeTeamSlot('BOS', [{ ...duplicatePlayer, tradeTo: 'LAL' }]), // Same player!
        makeTeamSlot('MIA', [makePlayer('Player C', 'LAL')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('selected by both'))).toBe(
        true
      );
      expect(result.errors.some((e) => e.includes('Duplicate Guy'))).toBe(true);
    });

    it('should fail when same player appears twice in same team sends', () => {
      const player = makePlayer('Same Player', 'BOS', 'player-123');

      const teams = [
        makeTeamSlot('LAL', [player, player]), // Same player twice!
        makeTeamSlot('BOS', [makePlayer('Player B', 'LAL')]),
      ];

      const result = validatePlayerRouting({ teams });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('appears multiple times'))
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should pass with empty teams array', () => {
      const result = validatePlayerRouting({ teams: [] });
      expect(result.valid).toBe(true);
    });

    it('should pass with single team (not enough for trade)', () => {
      const teams = [makeTeamSlot('LAL', [makePlayer('Player A')])];
      const result = validatePlayerRouting({ teams });
      expect(result.valid).toBe(true);
    });

    it('should pass with empty sends arrays', () => {
      const teams = [
        makeTeamSlot('LAL', []),
        makeTeamSlot('BOS', []),
        makeTeamSlot('MIA', []),
      ];

      const result = validatePlayerRouting({ teams });
      expect(result.valid).toBe(true);
    });

    it('should handle teams with null team object', () => {
      const teams = [
        makeTeamSlot('LAL', [makePlayer('Player A', 'BOS')]),
        makeTeamSlot('BOS', [makePlayer('Player B', 'LAL')]),
        { team: null, sends: [], entitlementsOut: [] }, // Empty slot
      ];

      const result = validatePlayerRouting({ teams });
      // Only 2 active teams, so tradeTo not required
      expect(result.valid).toBe(true);
    });
  });
});

describe('enforcePlayerRouting', () => {
  it('mirrors validatePlayerRouting with pass/errors/warnings', () => {
    const teams = [
      makeTeamSlot('LAL', [makePlayer('Player A')]),
      makeTeamSlot('BOS', [makePlayer('Player B', 'MIA')]),
      makeTeamSlot('MIA', [makePlayer('Player C', 'LAL')]),
    ];

    const validationResult = validatePlayerRouting({ teams });
    const enforcementResult = enforcePlayerRouting({ teams });

    expect(enforcementResult).toEqual({
      pass: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    });
  });
});

describe('removeTeam cleanup behavior', () => {
  // This tests the expected behavior of the removeTeam function
  // We test the logic in isolation here

  /**
   * Simulates the removeTeam cleanup logic.
   * This mirrors the implementation in useTradeMachine.js
   */
  function simulateRemoveTeamCleanup(teams, indexToRemove) {
    const removedTeamId = teams[indexToRemove]?.team?.id || null;
    const filteredTeams = teams.filter((_, i) => i !== indexToRemove);

    if (!removedTeamId) return filteredTeams;

    return filteredTeams.map((teamSlot) => {
      const cleanedSends = (teamSlot.sends || []).map((player) => {
        if (player.tradeTo === removedTeamId) {
          return { ...player, tradeTo: undefined };
        }
        return player;
      });

      const cleanedEntitlements = (teamSlot.entitlementsOut || []).map(
        (entitlement) => {
          if (entitlement.toTeamId === removedTeamId) {
            return { ...entitlement, toTeamId: undefined };
          }
          return entitlement;
        }
      );

      return {
        ...teamSlot,
        sends: cleanedSends,
        entitlementsOut: cleanedEntitlements,
      };
    });
  }

  it('should clear tradeTo when it points to removed team', () => {
    const teams = [
      makeTeamSlot('LAL', [makePlayer('Player A', 'MIA')]), // tradeTo will be orphaned
      makeTeamSlot('BOS', [makePlayer('Player B', 'LAL')]),
      makeTeamSlot('MIA', [makePlayer('Player C', 'LAL')]),
    ];

    // Remove MIA (index 2)
    const result = simulateRemoveTeamCleanup(teams, 2);

    expect(result).toHaveLength(2);
    // LAL's player should have tradeTo cleared (was pointing to MIA)
    expect(result[0].sends[0].tradeTo).toBeUndefined();
    // BOS's player should still have tradeTo = LAL (not affected)
    expect(result[1].sends[0].tradeTo).toBe('LAL');
  });

  it('should clear toTeamId for entitlements when it points to removed team', () => {
    const teams = [
      {
        team: { id: 'LAL' },
        sends: [],
        entitlementsOut: [{ entitlementId: 'pick-1', toTeamId: 'MIA' }],
      },
      {
        team: { id: 'BOS' },
        sends: [],
        entitlementsOut: [{ entitlementId: 'pick-2', toTeamId: 'LAL' }],
      },
      {
        team: { id: 'MIA' },
        sends: [],
        entitlementsOut: [{ entitlementId: 'pick-3', toTeamId: 'BOS' }],
      },
    ];

    // Remove MIA (index 2)
    const result = simulateRemoveTeamCleanup(teams, 2);

    expect(result).toHaveLength(2);
    // LAL's entitlement should have toTeamId cleared (was pointing to MIA)
    expect(result[0].entitlementsOut[0].toTeamId).toBeUndefined();
    // BOS's entitlement should still have toTeamId = LAL (not affected)
    expect(result[1].entitlementsOut[0].toTeamId).toBe('LAL');
  });

  it('should not modify anything when removed team has no id', () => {
    const teams = [
      makeTeamSlot('LAL', [makePlayer('Player A', 'BOS')]),
      makeTeamSlot('BOS', [makePlayer('Player B', 'LAL')]),
      { team: null, sends: [], entitlementsOut: [] }, // Empty slot
    ];

    // Remove empty slot (index 2)
    const result = simulateRemoveTeamCleanup(teams, 2);

    expect(result).toHaveLength(2);
    // No changes to existing routes
    expect(result[0].sends[0].tradeTo).toBe('BOS');
    expect(result[1].sends[0].tradeTo).toBe('LAL');
  });
});
