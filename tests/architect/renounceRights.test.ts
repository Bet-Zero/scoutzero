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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeWorldMutation,
  applyWorldMutation,
} from '@/features/architect/utils/mutationPipeline';

// Mock validators to isolate persistence tests from validation logic
vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/capHoldTransitionHelpers', () => ({
  isCapHoldAmountValid: vi.fn(() => ({ valid: true })),
  getValidatedCapHold: vi.fn((hold) => hold),
  isCapHoldAllowed: vi.fn(() => ({ allowed: true })),
}));
import {
  createWorld,
  updateWorldStats,
} from '@/features/architect/utils/worldManager';
import {
  seedBaseData,
  seedTeamSnapshot,
  getMockTeamSnapshot,
  getMockWorldMetadata,
  createMockPlayer,
  createMockTeam,
  type MockPlayer,
  type MockTeamSnapshot,
  type MockWorldMetadata,
} from '../helpers/architectTestHelpers.js';

type ComputeMutationResult = ReturnType<typeof computeWorldMutation>;
type ApplyMutationResult = Awaited<ReturnType<typeof applyWorldMutation>>;
type UpdatedTeam = NonNullable<
  NonNullable<ComputeMutationResult['teamUpdates']>[number]['team']
>;
type UpdatedPlayer = NonNullable<
  NonNullable<UpdatedTeam['players']>[number]
> & {
  player_id?: string;
  rightsRenounced?: boolean;
  renouncedAt?: string;
};
type PersistedPlayer = MockPlayer & {
  player_id?: string;
  rightsRenounced?: boolean;
  renouncedAt?: string;
};

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function requireArray<T>(value: T[] | null | undefined, message: string): T[] {
  const arrayValue = requireValue(value, message);
  expect(Array.isArray(arrayValue), message).toBe(true);
  return arrayValue;
}

function getUpdatedTeam(
  result: ComputeMutationResult,
  message: string
): UpdatedTeam {
  return requireValue(result.teamUpdates?.[0]?.team, message);
}

function getUpdatedPlayer(
  team: UpdatedTeam,
  playerId: string,
  message: string
): UpdatedPlayer {
  return requireValue(
    requireArray(
      team.players as UpdatedPlayer[] | null | undefined,
      `${message}: expected updated players`
    ).find(
      (player) => player.playerId === playerId || player.player_id === playerId
    ),
    message
  );
}

function getResultMetadata(result: ComputeMutationResult, message: string) {
  return requireValue(result.metadata, message);
}

function getPersistedTeam(worldId: string, teamCode: string): MockTeamSnapshot {
  return requireValue(
    getMockTeamSnapshot(worldId, teamCode),
    `Expected persisted team snapshot for ${worldId}/${teamCode}`
  );
}

function getPersistedPlayer(
  team: MockTeamSnapshot,
  playerId: string,
  message: string
): PersistedPlayer {
  return requireValue(
    requireArray(team.players, `${message}: expected persisted players`).find(
      (player) => player.playerId === playerId
    ) as PersistedPlayer | undefined,
    message
  );
}

function makeBirdRights(status: string, yearsOfService: number) {
  return {
    status,
    yearsOfService,
    yearsWithTeam: 0,
    eligibleFor: [] as string[],
  };
}

function getWorldMetadata(worldId: string): MockWorldMetadata {
  return requireValue(
    getMockWorldMetadata(worldId),
    `Expected world metadata for ${worldId}`
  );
}

function getMutationEvent(result: ApplyMutationResult, message: string) {
  return requireValue(result.event, message) as { type?: string } & Record<
    string,
    unknown
  >;
}

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

      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated renounce team'
      );
      const metadata = getResultMetadata(result, 'Expected renounce metadata');

      // Cap hold should be removed
      expect(
        requireArray(updatedTeam.capHolds, 'Expected updated cap holds')
      ).toHaveLength(0);

      // Metadata should reflect the action
      expect(metadata.type).toBe('renounce');
      expect(metadata.playerId).toBe(playerId);
      expect(metadata.teamCode).toBe(teamCode);
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

      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated renounce team'
      );
      const updatedPlayer = getUpdatedPlayer(
        updatedTeam,
        playerId,
        'Expected updated renounced player'
      );

      // Player should be marked as renounced
      expect(updatedPlayer.rightsRenounced).toBe(true);
      expect(updatedPlayer.renouncedAt).toBeDefined();

      // Bird rights should be cleared
      expect(updatedPlayer.contract?.birdRights?.status).toBe('None');
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

      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated totals team'
      );

      // Totals should be recalculated without the cap hold
      expect(updatedTeam.totals?.capHoldsTotal).toBe(0);
      expect(
        requireArray(updatedTeam.capHolds, 'Expected updated cap holds')
      ).toHaveLength(0);
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

      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated multi-hold team'
      );
      const capHolds = requireArray(
        updatedTeam.capHolds,
        'Expected remaining cap holds'
      );

      // Only one cap hold should remain (for player 2)
      expect(capHolds).toHaveLength(1);
      expect(capHolds[0]?.playerId).toBe(playerId2);
      expect(capHolds[0]?.amount).toBe(8_000_000);
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

      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated source metadata team'
      );
      const source = requireValue(
        updatedTeam.source,
        'Expected updated source metadata'
      );
      expect(source.type).toBe('world-snapshot');
      expect(source.lastModifiedAt).toBeDefined();
    });
  });

  describe('applyWorldMutation - persistence', () => {
    const persistenceUserId = 'persistence_test_user';

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
        ...createMockTeam({
          teamCode,
          season: '2025-26',
          roster: [playerId],
          players: [
            createMockPlayer({
              playerId,
              displayName: playerName,
              teamCode,
              contract: {
                salariesByYear: [],
                birdRights: makeBirdRights('Full', 6),
              },
            }),
          ],
          capHolds: [
            {
              playerId,
              playerName,
              amount: 25_000_000,
              type: 'FA Cap Hold',
              season: '2025-26',
              isSigned: false,
            },
          ],
          totals: {
            totalSalary: 80_000_000,
            capHit: 105_000_000,
            capHoldsTotal: 25_000_000,
          },
        }),
      };

      // Keep the snapshot post-state legal so the shared roster validator
      // exercises the renounce mutation instead of failing on fixture shape.
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
      const event = getMutationEvent(
        result,
        'Expected renounce persistence event'
      );
      expect(event.type).toBe('renounceRights');

      // Verify persisted data shows cap hold removed
      const persistedTeam = getPersistedTeam(worldId, teamCode);
      expect(
        requireArray(persistedTeam.capHolds, 'Expected persisted cap holds')
      ).toHaveLength(0);

      // Verify the player is marked as renounced
      const renouncedPlayer = getPersistedPlayer(
        persistedTeam,
        playerId,
        'Expected persisted renounced player'
      );
      expect(renouncedPlayer.rightsRenounced).toBe(true);
      expect(renouncedPlayer.contract?.birdRights?.status).toBe('None');

      // Verify world stats were updated
      const worldMetadata = getWorldMetadata(worldId);
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
        ...createMockTeam({
          teamCode,
          season: '2025-26',
          roster: [playerId],
          players: [
            createMockPlayer({
              playerId,
              displayName: playerName,
              teamCode,
              contract: {
                salariesByYear: [],
                birdRights: makeBirdRights('Early Bird', 2),
              },
            }),
          ],
          capHolds: [
            {
              playerId,
              playerName,
              amount: capHoldAmount,
              type: 'FA Cap Hold',
              season: '2025-26',
              isSigned: false,
            },
          ],
          totals: {
            totalSalary: 120_000_000,
            capHit: 138_500_000,
            capHoldsTotal: capHoldAmount,
          },
        }),
      };

      // Keep the snapshot post-state legal so the shared roster validator
      // exercises the renounce mutation instead of failing on fixture shape.
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
      const reloadedTeam = getPersistedTeam(worldId, teamCode);

      // Verify state is correct after reload
      expect(
        requireArray(reloadedTeam.capHolds, 'Expected reloaded cap holds')
      ).toHaveLength(0);
      const reloadedPlayer = getPersistedPlayer(
        reloadedTeam,
        playerId,
        'Expected reloaded renounced player'
      );
      expect(reloadedPlayer.rightsRenounced).toBe(true);
      expect(reloadedPlayer.renouncedAt).toBeDefined();
      expect(reloadedPlayer.contract?.birdRights?.status).toBe('None');

      // Source metadata should show world-snapshot type
      expect(reloadedTeam.source?.type).toBe('world-snapshot');
    });

    it('returns error when worldId is missing', async () => {
      const missingWorldId = null as unknown as string;

      const result = await applyWorldMutation({
        userId,
        worldId: missingWorldId,
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
        payload: null as unknown as Parameters<
          typeof applyWorldMutation
        >[0]['payload'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('payload is required');
    });
  });
});
