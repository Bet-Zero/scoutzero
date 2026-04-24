/**
 * FILE: src/tests/architect/phase86_league_invariants.test.js
 * PURPOSE: Tests for league-wide invariant validation (cross-team duplicate player prevention)
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-03: Created per LEAGUE_INTEGRITY_COMPLETION_AUDIT blocking gap resolution
 *
 * LINKS:
 *  - Module: src/features/architect/utils/leagueInvariants.ts
 *  - Audit: docs/architect/LEAGUE_INTEGRITY_COMPLETION_AUDIT.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateNoDuplicatePlayers,
  extractIncomingPlayers,
  assertPlayerNotOnOtherTeam,
  validateMutationLeagueInvariants,
} from '@/features/architect/utils/leagueInvariants';

// Mock getLeague for isolated testing
vi.mock('@/features/architect/utils/teamLoader', () => ({
  getLeague: vi.fn(),
}));

import { getLeague } from '@/features/architect/utils/teamLoader';

type LoadedLeague = Awaited<ReturnType<typeof getLeague>>;
type DuplicatePlayersResult = ReturnType<typeof validateNoDuplicatePlayers>;
const mockedGetLeague = vi.mocked(getLeague);

function expectDuplicatePlayers(
  result: DuplicatePlayersResult
): NonNullable<DuplicatePlayersResult['duplicates']> {
  expect(result.duplicates).toBeDefined();
  return result.duplicates ?? [];
}

describe('League Invariants - Phase 86', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateNoDuplicatePlayers', () => {
    it('returns valid when no duplicates exist', () => {
      const teams = [
        {
          teamCode: 'LAL',
          players: [
            { player_id: 'lebron_james', displayName: 'LeBron James' },
            { player_id: 'anthony_davis', displayName: 'Anthony Davis' },
          ],
        },
        {
          teamCode: 'BOS',
          players: [
            { player_id: 'jayson_tatum', displayName: 'Jayson Tatum' },
            { player_id: 'jaylen_brown', displayName: 'Jaylen Brown' },
          ],
        },
      ];

      const result = validateNoDuplicatePlayers(teams);
      expect(result.valid).toBe(true);
      expect(result.duplicates).toBeUndefined();
    });

    it('detects player on multiple teams', () => {
      const teams = [
        {
          teamCode: 'LAL',
          players: [{ player_id: 'lebron_james', displayName: 'LeBron James' }],
        },
        {
          teamCode: 'BOS',
          players: [{ player_id: 'lebron_james', displayName: 'LeBron James' }],
        },
      ];

      const result = validateNoDuplicatePlayers(teams);
      expect(result.valid).toBe(false);
      const duplicates = expectDuplicatePlayers(result);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].playerId).toBe('lebron_james');
      expect(duplicates[0].teams).toEqual(['LAL', 'BOS']);
      expect(result.error).toContain('LeBron James');
      expect(result.error).toContain('LAL, BOS');
    });

    it('handles different player ID formats', () => {
      const teams = [
        {
          teamCode: 'LAL',
          players: [{ id: 'player_1' }], // Uses 'id' field
        },
        {
          teamCode: 'BOS',
          players: [{ playerId: 'player_1' }], // Uses 'playerId' field
        },
      ];

      const result = validateNoDuplicatePlayers(teams);
      expect(result.valid).toBe(false);
      const duplicates = expectDuplicatePlayers(result);
      expect(duplicates[0].playerId).toBe('player_1');
    });

    it('handles bio.playerId format', () => {
      const teams = [
        {
          teamCode: 'LAL',
          players: [{ bio: { playerId: 'player_1' } }],
        },
        {
          teamCode: 'BOS',
          players: [{ player_id: 'player_1' }],
        },
      ];

      const result = validateNoDuplicatePlayers(teams);
      expect(result.valid).toBe(false);
    });

    it('handles empty teams gracefully', () => {
      const teams = [
        { teamCode: 'LAL', players: [] },
        { teamCode: 'BOS', players: null },
        { teamCode: 'CHI' }, // No players field
      ];

      const result = validateNoDuplicatePlayers(teams);
      expect(result.valid).toBe(true);
    });

    it('handles roster field instead of players field', () => {
      const teams = [
        {
          teamCode: 'LAL',
          roster: [{ player_id: 'player_1' }],
        },
        {
          teamCode: 'BOS',
          roster: [{ player_id: 'player_1' }],
        },
      ];

      const result = validateNoDuplicatePlayers(teams);
      expect(result.valid).toBe(false);
    });
  });

  describe('extractIncomingPlayers', () => {
    it('extracts players from executeTrade payload', () => {
      const payload = {
        teams: [
          {
            teamCode: 'LAL',
            receiving: [
              { player_id: 'jayson_tatum', displayName: 'Jayson Tatum' },
            ],
          },
          {
            teamCode: 'BOS',
            receiving: [
              { player_id: 'anthony_davis', displayName: 'Anthony Davis' },
            ],
          },
        ],
      };

      const result = extractIncomingPlayers('executeTrade', payload);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        playerId: 'jayson_tatum',
        targetTeamCode: 'LAL',
        playerName: 'Jayson Tatum',
      });
      expect(result[1]).toEqual({
        playerId: 'anthony_davis',
        targetTeamCode: 'BOS',
        playerName: 'Anthony Davis',
      });
    });

    it('extracts player from signFreeAgent payload', () => {
      const payload = {
        teamCode: 'LAL',
        playerId: 'free_agent_1',
        playerName: 'John Doe',
      };

      const result = extractIncomingPlayers('signFreeAgent', payload);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        playerId: 'free_agent_1',
        targetTeamCode: 'LAL',
        playerName: 'John Doe',
      });
    });

    it('returns empty array for mutations that dont add players', () => {
      const payload = {
        teamCode: 'LAL',
        playerId: 'player_1',
      };

      expect(extractIncomingPlayers('waivePlayer', payload)).toHaveLength(0);
      expect(extractIncomingPlayers('extendPlayer', payload)).toHaveLength(0);
      expect(extractIncomingPlayers('optionDecision', payload)).toHaveLength(0);
      expect(extractIncomingPlayers('renounceRights', payload)).toHaveLength(0);
    });
  });

  describe('assertPlayerNotOnOtherTeam', () => {
    it('returns valid when player is not on any other team', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [{ player_id: 'existing_player' }],
        },
        {
          teamCode: 'BOS',
          players: [],
        },
      ] as LoadedLeague);

      const result = await assertPlayerNotOnOtherTeam(
        'world123',
        'new_player',
        'BOS',
        'New Player'
      );

      expect(result.valid).toBe(true);
    });

    it('returns invalid when player exists on another team', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [
            { player_id: 'target_player', displayName: 'Target Player' },
          ],
        },
        {
          teamCode: 'BOS',
          players: [],
        },
      ] as LoadedLeague);

      const result = await assertPlayerNotOnOtherTeam(
        'world123',
        'target_player',
        'BOS', // Trying to add to BOS
        'Target Player'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Target Player');
      expect(result.error).toContain('LAL');
      expect(result.error).toContain('BOS');
    });

    it('skips the target team when checking', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [{ player_id: 'existing_player' }],
        },
      ] as LoadedLeague);

      // Player already on LAL, adding to LAL (e.g., extension)
      const result = await assertPlayerNotOnOtherTeam(
        'world123',
        'existing_player',
        'LAL'
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('validateMutationLeagueInvariants', () => {
    it('validates trade post-trade state for duplicates', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [{ player_id: 'player_a' }],
        },
        {
          teamCode: 'BOS',
          players: [{ player_id: 'player_b' }],
        },
        {
          teamCode: 'CHI',
          players: [{ player_id: 'player_c' }],
        },
      ] as LoadedLeague);

      // Compute result shows post-trade state where player_a is now on BOS
      const computeResult = {
        success: true,
        teamUpdates: [
          {
            teamCode: 'LAL',
            team: { teamCode: 'LAL', players: [] }, // player_a removed
          },
          {
            teamCode: 'BOS',
            team: {
              teamCode: 'BOS',
              players: [
                { player_id: 'player_b' },
                { player_id: 'player_a' }, // player_a added
              ],
            },
          },
        ],
      };

      const result = await validateMutationLeagueInvariants(
        'world123',
        'executeTrade',
        {},
        computeResult
      );

      expect(result.valid).toBe(true);
    });

    it('detects duplicate in post-trade state', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [{ player_id: 'player_a' }],
        },
        {
          teamCode: 'BOS',
          players: [{ player_id: 'player_b' }],
        },
        {
          teamCode: 'CHI',
          players: [{ player_id: 'player_a' }], // BUG: player_a already here!
        },
      ] as LoadedLeague);

      // Trade tries to move player_a to BOS, but CHI also has player_a
      const computeResult = {
        success: true,
        teamUpdates: [
          {
            teamCode: 'LAL',
            team: { teamCode: 'LAL', players: [] },
          },
          {
            teamCode: 'BOS',
            team: {
              teamCode: 'BOS',
              players: [{ player_id: 'player_b' }, { player_id: 'player_a' }],
            },
          },
        ],
      };

      const result = await validateMutationLeagueInvariants(
        'world123',
        'executeTrade',
        {},
        computeResult
      );

      expect(result.valid).toBe(false);
      const duplicates = expectDuplicatePlayers(result);
      expect(duplicates[0].playerId).toBe('player_a');
      expect(duplicates[0].teams).toContain('BOS');
      expect(duplicates[0].teams).toContain('CHI');
    });

    it('validates signing does not create duplicate', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [{ player_id: 'existing_player' }],
        },
        {
          teamCode: 'BOS',
          players: [],
        },
      ] as LoadedLeague);

      const payload = {
        teamCode: 'BOS',
        playerId: 'new_player',
        playerName: 'New Player',
      };

      const result = await validateMutationLeagueInvariants(
        'world123',
        'signFreeAgent',
        payload
      );

      expect(result.valid).toBe(true);
    });

    it('blocks signing if player already on another team', async () => {
      mockedGetLeague.mockResolvedValue([
        {
          teamCode: 'LAL',
          players: [{ player_id: 'player_x', displayName: 'Player X' }],
        },
        {
          teamCode: 'BOS',
          players: [],
        },
      ] as LoadedLeague);

      const payload = {
        teamCode: 'BOS',
        playerId: 'player_x', // Already on LAL!
        playerName: 'Player X',
      };

      const result = await validateMutationLeagueInvariants(
        'world123',
        'signFreeAgent',
        payload
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Player X');
      expect(result.error).toContain('LAL');
    });

    it('skips validation for mutations that dont add players', async () => {
      const payload = {
        teamCode: 'LAL',
        playerId: 'player_1',
      };

      // Should not even call getLeague for these mutations
      const result = await validateMutationLeagueInvariants(
        'world123',
        'waivePlayer',
        payload
      );

      expect(result.valid).toBe(true);
      expect(mockedGetLeague).not.toHaveBeenCalled();
    });
  });
});
