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
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import {
  createMockWorld,
  createMockPlayer,
  createMockTeam,
  seedWorldMetadata,
  seedTeamSnapshot,
  getMockTeamSnapshot,
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
});
