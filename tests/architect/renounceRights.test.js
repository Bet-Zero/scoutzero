/**
 * Renounce Rights Tests
 *
 * Tests for the renounceRights mutation in the Architect mutation pipeline.
 * Verifies:
 * - Cap hold removal
 * - Bird rights clearing
 * - Proper persistence to world snapshots
 *
 * @file tests/architect/renounceRights.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeWorldMutation, applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { createWorld, updateWorldStats } from '@/features/architect/utils/worldManager';
import {
  seedBaseData,
  seedTeamSnapshot,
  getMockTeamSnapshot,
  getMockWorldMetadata,
} from '../helpers/architectTestHelpers.js';

describe('Renounce Rights Mutation', () => {
  const userId = 'test_user_123';
  const seasonId = '2025-26';
  const timestamp = Date.now();

  describe('computeWorldMutation - renounceRights', () => {
    it('removes cap hold for the renounced player', () => {
      // Setup: Team with a cap hold for the player
      const teamCode = 'LAL';
      const playerId = 'player_123';
      const playerName = 'Test Player';

      const currentState = {
        team: {
          teamCode,
          teamName: 'Los Angeles Lakers',
          players: [
            {
              player_id: playerId,
              name: playerName,
              displayName: playerName,
              contract: {
                birdRights: {
                  status: 'Full',
                  yearsOfService: 5,
                },
              },
            },
          ],
          capHolds: [
            {
              playerId,
              playerName,
              amount: 15_000_000,
              type: 'FA Cap Hold',
              season: '2025-26',
              active: true,
              isSigned: false,
            },
          ],
          totals: {
            totalSalary: 100_000_000,
            capHit: 115_000_000, // includes cap hold
          },
        },
        player: {
          player_id: playerId,
          name: playerName,
          displayName: playerName,
          contract: {
            birdRights: {
              status: 'Full',
              yearsOfService: 5,
            },
          },
        },
        teamCode,
      };

      const payload = {
        teamCode,
        playerId,
      };

      const result = computeWorldMutation({
        mutationType: 'renounceRights',
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      expect(result.success).toBe(true);
      expect(result.teamUpdates).toHaveLength(1);

      const updatedTeam = result.teamUpdates[0].team;

      // Cap hold should be removed
      expect(updatedTeam.capHolds).toHaveLength(0);

      // Metadata should reflect the action
      expect(result.metadata.type).toBe('renounce');
      expect(result.metadata.playerId).toBe(playerId);
      expect(result.metadata.teamCode).toBe(teamCode);
    });

    it('clears bird rights for the renounced player', () => {
      const teamCode = 'BOS';
      const playerId = 'player_456';
      const playerName = 'Bird Rights Player';

      const currentState = {
        team: {
          teamCode,
          teamName: 'Boston Celtics',
          players: [
            {
              player_id: playerId,
              name: playerName,
              displayName: playerName,
              contract: {
                birdRights: {
                  status: 'Full',
                  yearsOfService: 8,
                  yearsWithTeam: 4,
                },
              },
            },
          ],
          capHolds: [],
          totals: {},
        },
        player: {
          player_id: playerId,
          name: playerName,
          displayName: playerName,
          contract: {
            birdRights: {
              status: 'Full',
              yearsOfService: 8,
              yearsWithTeam: 4,
            },
          },
        },
        teamCode,
      };

      const payload = {
        teamCode,
        playerId,
      };

      const result = computeWorldMutation({
        mutationType: 'renounceRights',
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      expect(result.success).toBe(true);

      const updatedTeam = result.teamUpdates[0].team;
      const updatedPlayer = updatedTeam.players.find(
        (p) => p.player_id === playerId
      );

      // Player should be marked as renounced
      expect(updatedPlayer.rightsRenounced).toBe(true);
      expect(updatedPlayer.renouncedAt).toBeDefined();

      // Bird rights should be cleared
      expect(updatedPlayer.contract.birdRights.status).toBe('None');
      expect(updatedPlayer.contract.birdRights.renouncedBy).toBe(teamCode);
    });

    it('recalculates team totals after removing cap hold', () => {
      const teamCode = 'GSW';
      const playerId = 'player_789';
      const playerName = 'Cap Hold Player';
      const capHoldAmount = 20_000_000;

      const currentState = {
        team: {
          teamCode,
          teamName: 'Golden State Warriors',
          players: [
            {
              player_id: playerId,
              name: playerName,
              displayName: playerName,
              contract: {
                salariesByYear: [],
                birdRights: { status: 'Early Bird' },
              },
            },
            {
              player_id: 'other_player',
              name: 'Other Player',
              displayName: 'Other Player',
              contract: {
                salariesByYear: [
                  { season: '2025-26', salary: 30_000_000, guaranteed: true },
                ],
                birdRights: { status: 'None' },
              },
            },
          ],
          capHolds: [
            {
              playerId,
              playerName,
              amount: capHoldAmount,
              type: 'FA Cap Hold',
              season: '2025-26',
              active: true,
              isSigned: false,
            },
          ],
          deadCap: [],
          totals: {
            totalSalary: 30_000_000,
            capHit: 50_000_000, // 30M salary + 20M cap hold
            capHoldsTotal: capHoldAmount,
          },
        },
        player: {
          player_id: playerId,
          name: playerName,
          displayName: playerName,
          contract: {
            birdRights: { status: 'Early Bird' },
          },
        },
        teamCode,
      };

      const payload = {
        teamCode,
        playerId,
      };

      const result = computeWorldMutation({
        mutationType: 'renounceRights',
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      expect(result.success).toBe(true);

      const updatedTeam = result.teamUpdates[0].team;

      // Totals should be recalculated without the cap hold
      expect(updatedTeam.totals.capHoldsTotal).toBe(0);
      expect(updatedTeam.capHolds).toHaveLength(0);
    });

    it('handles player with multiple cap holds (only removes target)', () => {
      const teamCode = 'MIA';
      const playerId1 = 'player_to_renounce';
      const playerId2 = 'player_to_keep';

      const currentState = {
        team: {
          teamCode,
          teamName: 'Miami Heat',
          players: [
            {
              player_id: playerId1,
              name: 'Renounce Me',
              displayName: 'Renounce Me',
              contract: { birdRights: { status: 'Full' } },
            },
            {
              player_id: playerId2,
              name: 'Keep Me',
              displayName: 'Keep Me',
              contract: { birdRights: { status: 'Full' } },
            },
          ],
          capHolds: [
            {
              playerId: playerId1,
              playerName: 'Renounce Me',
              amount: 10_000_000,
              type: 'FA Cap Hold',
              season: '2025-26',
              active: true,
              isSigned: false,
            },
            {
              playerId: playerId2,
              playerName: 'Keep Me',
              amount: 8_000_000,
              type: 'FA Cap Hold',
              season: '2025-26',
              active: true,
              isSigned: false,
            },
          ],
          totals: {},
        },
        player: {
          player_id: playerId1,
          name: 'Renounce Me',
          displayName: 'Renounce Me',
          contract: { birdRights: { status: 'Full' } },
        },
        teamCode,
      };

      const payload = {
        teamCode,
        playerId: playerId1,
      };

      const result = computeWorldMutation({
        mutationType: 'renounceRights',
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      expect(result.success).toBe(true);

      const updatedTeam = result.teamUpdates[0].team;

      // Only one cap hold should remain (for player 2)
      expect(updatedTeam.capHolds).toHaveLength(1);
      expect(updatedTeam.capHolds[0].playerId).toBe(playerId2);
      expect(updatedTeam.capHolds[0].amount).toBe(8_000_000);
    });

    it('updates source metadata with last modified timestamp', () => {
      const teamCode = 'DEN';
      const playerId = 'player_source';

      const currentState = {
        team: {
          teamCode,
          teamName: 'Denver Nuggets',
          players: [],
          capHolds: [],
          source: { type: 'base', provider: 'spotrac' },
          totals: {},
        },
        player: {
          player_id: playerId,
          name: 'Test',
          displayName: 'Test',
          contract: { birdRights: { status: 'Non-Bird' } },
        },
        teamCode,
      };

      const payload = {
        teamCode,
        playerId,
      };

      const result = computeWorldMutation({
        mutationType: 'renounceRights',
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      expect(result.success).toBe(true);

      const updatedTeam = result.teamUpdates[0].team;
      expect(updatedTeam.source.type).toBe('world-snapshot');
      expect(updatedTeam.source.lastModifiedAt).toBeDefined();
    });
  });

  describe('applyWorldMutation - persistence', () => {
    const userId = 'persistence_test_user';

    beforeEach(() => {
      // Seed base data for the teams we'll use
      seedBaseData(['LAL', 'BOS']);
    });

    it('persists renounce action to world and updates world stats', async () => {
      // Create a test world
      const worldResult = await createWorld({
        name: 'Renounce Test World',
        userId,
        currentSeason: '2025-26',
      });

      const worldId = worldResult.worldId;
      const teamCode = 'LAL';
      const playerId = 'fa_to_renounce';
      const playerName = 'Free Agent Player';

      // Seed team snapshot with a cap hold
      const teamSnapshot = {
        teamCode,
        teamName: 'Los Angeles Lakers',
        season: '2025-26',
        roster: [],
        players: [
          {
            player_id: playerId,
            name: playerName,
            displayName: playerName,
            contract: {
              salariesByYear: [],
              birdRights: { status: 'Full', yearsOfService: 6 },
            },
          },
        ],
        capHolds: [
          {
            playerId,
            playerName,
            amount: 25_000_000,
            type: 'FA Cap Hold',
            season: '2025-26',
            active: true,
            isSigned: false,
          },
        ],
        totals: {
          totalSalary: 80_000_000,
          capHit: 105_000_000,
          capHoldsTotal: 25_000_000,
        },
        source: { type: 'base', provider: 'spotrac' },
      };

      seedTeamSnapshot(worldId, teamCode, teamSnapshot);

      // Apply the renounce mutation
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId: '2025-26',
        mutationType: 'renounceRights',
        payload: {
          teamCode,
          playerId,
        },
      });

      expect(result.success).toBe(true);
      expect(result.changedTeams).toHaveLength(1);
      expect(result.event).toBeDefined();
      expect(result.event.type).toBe('renounceRights');

      // Verify persisted data shows cap hold removed
      const persistedTeam = getMockTeamSnapshot(worldId, teamCode);
      expect(persistedTeam.capHolds).toHaveLength(0);

      // Verify the player is marked as renounced
      const renouncedPlayer = persistedTeam.players.find(
        (p) => p.player_id === playerId
      );
      expect(renouncedPlayer.rightsRenounced).toBe(true);
      expect(renouncedPlayer.contract.birdRights.status).toBe('None');

      // Verify world stats were updated
      const worldMetadata = getMockWorldMetadata(worldId);
      expect(worldMetadata.stats.totalRenounces).toBe(1);
      expect(worldMetadata.actionCount).toBe(1);
      expect(worldMetadata.modifiedTeams).toContain(teamCode);
    });

    it('persisted state can be reloaded correctly', async () => {
      // Create a test world
      const worldResult = await createWorld({
        name: 'Reload Test World',
        userId,
        currentSeason: '2025-26',
      });

      const worldId = worldResult.worldId;
      const teamCode = 'BOS';
      const playerId = 'reload_test_player';
      const playerName = 'Reload Test Player';
      const capHoldAmount = 18_500_000;

      // Seed initial state
      const initialSnapshot = {
        teamCode,
        teamName: 'Boston Celtics',
        season: '2025-26',
        roster: [],
        players: [
          {
            player_id: playerId,
            name: playerName,
            displayName: playerName,
            contract: {
              salariesByYear: [],
              birdRights: { status: 'Early Bird', yearsOfService: 2 },
            },
          },
        ],
        capHolds: [
          {
            playerId,
            playerName,
            amount: capHoldAmount,
            type: 'FA Cap Hold',
            season: '2025-26',
            active: true,
            isSigned: false,
          },
        ],
        totals: {
          totalSalary: 120_000_000,
          capHit: 138_500_000,
          capHoldsTotal: capHoldAmount,
        },
        source: { type: 'base' },
      };

      seedTeamSnapshot(worldId, teamCode, initialSnapshot);

      // Apply renounce mutation
      await applyWorldMutation({
        userId,
        worldId,
        seasonId: '2025-26',
        mutationType: 'renounceRights',
        payload: { teamCode, playerId },
      });

      // Simulate "reload" by reading from persisted data
      const reloadedTeam = getMockTeamSnapshot(worldId, teamCode);

      // Verify state is correct after reload
      expect(reloadedTeam.capHolds).toHaveLength(0);
      
      const reloadedPlayer = reloadedTeam.players.find(
        (p) => p.player_id === playerId
      );
      expect(reloadedPlayer.rightsRenounced).toBe(true);
      expect(reloadedPlayer.renouncedAt).toBeDefined();
      expect(reloadedPlayer.contract.birdRights.status).toBe('None');
      expect(reloadedPlayer.contract.birdRights.renouncedBy).toBe(teamCode);

      // Source metadata should show world-snapshot type
      expect(reloadedTeam.source.type).toBe('world-snapshot');
    });

    it('returns error when worldId is missing', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId: null,
        seasonId: '2025-26',
        mutationType: 'renounceRights',
        payload: { teamCode: 'LAL', playerId: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('worldId is required');
    });

    it('returns error when payload is missing', async () => {
      const worldResult = await createWorld({
        name: 'Error Test World',
        userId,
      });

      const result = await applyWorldMutation({
        userId,
        worldId: worldResult.worldId,
        seasonId: '2025-26',
        mutationType: 'renounceRights',
        payload: null,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('payload is required');
    });
  });
});
