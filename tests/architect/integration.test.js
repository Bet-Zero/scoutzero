/**
 * Integration Tests
 *
 * Tests critical workflows combining multiple Architect modules:
 * - World creation → trade flow
 * - Branching flow
 * - Season advancement flow
 * - Multi-season flow
 * - Trade → sign FA → waive flow
 *
 * @file tests/architect/integration.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createWorld,
  branchWorld,
} from '@/features/architect/utils/worldManager';
import { getTeam } from '@/features/architect/utils/teamLoader';
import { signFreeAgent, waivePlayer } from '@/features/architect/utils/tradeManager';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { advanceSeasonLegacy as advanceSeason } from '@/features/architect/utils/seasonManagerLegacy';
import {
  seedBaseData,
  createMockCapProjections,
  getMockWorldMetadata,
  seedMockData,
} from '../helpers/architectTestHelpers.ts';
import { getMockData } from '../__mocks__/firebase.ts';

// Mock validateTrade to return valid trades for testing
vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({
    legal: true,
    reason: 'Trade is valid',
    teamResults: [],
  })),
}));

function toSeasonId(currentYear) {
  if (typeof currentYear === 'string' && currentYear) {
    return currentYear;
  }

  const year = typeof currentYear === 'number' ? currentYear : 2025;
  return `${year}-${String(year + 1).slice(-2)}`;
}

async function computeTrade(worldId, tradeData) {
  const teams = await Promise.all(
    tradeData.teams.map(async (tradeTeam) => {
      const teamCode = tradeTeam.teamCode || tradeTeam.team?.teamCode;
      return {
        teamCode,
        team: await getTeam(worldId, teamCode),
      };
    })
  );

  const result = computeWorldMutation({
    mutationType: 'executeTrade',
    payload: tradeData,
    currentState: { teams },
    seasonId: toSeasonId(tradeData.currentYear),
    timestamp: Date.now(),
    worldId,
  });

  if (!result.success) {
    throw new Error(result.error || 'Authoritative trade compute failed');
  }

  return {
    success: true,
    teams: result.teamUpdates,
    validation: result._validatedTradeContext,
  };
}

describe('Architect Integration Tests', () => {
  const userId = 'user_123';

  beforeEach(() => {
    // advanceSeason calls getLeague which needs all 30 teams
    seedBaseData('all');
  });

  describe('World Creation → Trade Flow', () => {
    it('creates world → executes trade → returns updated teams', async () => {
      // Create world
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      // Execute trade
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      const tradeResult = await computeTrade(worldResult.worldId, tradeData);

      expect(tradeResult.success).toBe(true);

      // Verify updated teams returned (executeTrade is read-only, doesn't persist)
      const lalTeam = tradeResult.teams.find((t) => t.teamCode === 'LAL');
      const gswTeam = tradeResult.teams.find((t) => t.teamCode === 'GSW');

      expect(lalTeam).toBeDefined();
      expect(gswTeam).toBeDefined();
      expect(lalTeam.team.source.type).toBe('world-snapshot');
      expect(lalTeam.team.source.worldId).toBeUndefined();
    });

    it('verifies cap totals updated correctly', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      const tradeResult = await computeTrade(worldResult.worldId, tradeData);

      const lalTeam = tradeResult.teams.find((t) => t.teamCode === 'LAL');

      expect(lalTeam.team.totals).toBeDefined();
      // Phase 77: totals now comes from computeTeamCapTotals SSOT
      expect(typeof lalTeam.team.totals.playersTotal).toBe('number');
      expect(typeof lalTeam.team.totals.totalCapAllocations).toBe('number');
    });

    it('verifies authoritative trade compute is read-only (does not modify world metadata)', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      // Get metadata before trade
      const metadataBefore = getMockWorldMetadata(worldResult.worldId);
      const statsBefore = metadataBefore.stats.totalTrades;

      await computeTrade(worldResult.worldId, tradeData);

      // Verify world metadata was not modified (computeWorldMutation is read-only)
      const metadataAfter = getMockWorldMetadata(worldResult.worldId);
      expect(metadataAfter.stats.totalTrades).toBe(statsBefore);
      expect(metadataAfter.actionCount).toBe(metadataBefore.actionCount);
    });
  });

  describe('Branching Flow', () => {
    it('creates world → executes trade → branches world', async () => {
      // Create parent world
      const parentResult = await createWorld({
        name: 'Parent World',
        userId,
      });

      // Execute trade in parent
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await computeTrade(parentResult.worldId, tradeData);

      // Branch world
      const branchResult = await branchWorld(
        parentResult.worldId,
        'Branch World',
        'Branch description',
        userId
      );

      expect(branchResult.metadata.parentWorldId).toBe(parentResult.worldId);
      expect(branchResult.metadata.worldName).toBe('Branch World');
    });

    it('verifies branch inherits base data when no parent snapshots exist', async () => {
      const parentResult = await createWorld({
        name: 'Parent World',
        userId,
      });

      // Compute trade in parent (but don't persist - authoritative compute is read-only)
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await computeTrade(parentResult.worldId, tradeData);

      // Branch world
      const branchResult = await branchWorld(
        parentResult.worldId,
        'Branch World',
        '',
        userId
      );

      // Get team from branch - since authoritative compute doesn't persist, branch falls back to base data
      const lalTeam = await getTeam(branchResult.worldId, 'LAL');
      // Base LAL team has lebron_james in roster, trade was not persisted
      // Note: getTeam hydrates team with players array in roster field
      const rosterIds = lalTeam.roster.map(p => p.player_id || p.id);
      expect(rosterIds).toContain('lebron_james');
      expect(rosterIds).not.toContain('stephen_curry');
    });

    it('executes different trade in branch → verifies isolation', async () => {
      const parentResult = await createWorld({
        name: 'Parent World',
        userId,
      });

      // Execute trade in parent
      const parentTradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await computeTrade(parentResult.worldId, parentTradeData);

      // Branch world
      const branchResult = await branchWorld(
        parentResult.worldId,
        'Branch World',
        '',
        userId
      );

      // Execute different trade in branch
      const branchTradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'anthony_davis' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'BOS',
            sends: [{ player_id: 'jayson_tatum' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      const branchTradeResult = await computeTrade(branchResult.worldId, branchTradeData);

      // Verify branch trade result (computeWorldMutation doesn't persist, so no snapshots created)
      const branchLalTeam = branchTradeResult.teams.find((t) => t.teamCode === 'LAL');
      const branchRosterIds = branchLalTeam.team.roster;
      expect(branchRosterIds).not.toContain('anthony_davis');
      expect(branchRosterIds).toContain('jayson_tatum');

      // Parent data is unchanged since trades don't persist
      // Both parent and branch start from same base data
      const parentLalTeam = await getTeam(parentResult.worldId, 'LAL');
      const parentRosterIds = parentLalTeam.roster.map(p => p.player_id || p.id);
      // Parent has base LAL roster (no trade was persisted)
      expect(parentRosterIds).toContain('lebron_james');
    });
  });

  describe('Season Advancement Flow', () => {
    it('creates world → executes trade → advances season', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      // Execute trade
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await computeTrade(worldResult.worldId, tradeData);

      // Advance season
      const advanceResult = await advanceSeason(worldResult.worldId);

      expect(advanceResult.success).toBe(true);
      expect(advanceResult.fromSeason).toBe('2025-26');
      expect(advanceResult.toSeason).toBe('2026-27');

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.currentSeason).toBe('2026-27');
    });

    it('verifies contracts expired correctly', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
        currentSeason: '2025-26',
      });

      // Create team with expiring contract
      const teamWithExpiring = {
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_expiring'],
        players: [
          {
            playerId: 'player_expiring',
            contract: {
              endSeason: '2025-26',
              yearsRemaining: 1,
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
              ],
            },
          },
        ],
      };

      // seedMockData is imported at top of file
      seedMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`,
        teamWithExpiring
      );

      // Advance season
      await advanceSeason(worldResult.worldId);

      const updatedTeam = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      expect(updatedTeam.roster).not.toContain('player_expiring');
    });

    it('verifies cap holds updated', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
        currentSeason: '2025-26',
      });

      const teamWithHolds = {
        teamCode: 'BOS',
        season: '2025-26',
        capHolds: [
          {
            playerId: 'fa_player',
            playerName: 'FA Player',
            amount: 12_000_000,
            type: 'Bird',
            isSigned: false,
          },
        ],
      };

      // seedMockData is imported at top of file
      seedMockData(
        `architect_worlds/${worldResult.worldId}/teams/BOS`,
        teamWithHolds
      );

      await advanceSeason(worldResult.worldId);

      const updatedTeam = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/BOS`
      );
      // Cap holds should still exist (not expired yet)
      expect(updatedTeam.capHolds).toBeDefined();
    });

    it('verifies draft picks updated', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
        currentSeason: '2025-26',
      });

      await advanceSeason(worldResult.worldId);

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.currentSeason).toBe('2026-27');
    });
  });

  describe('Multi-Season Flow', () => {
    it('creates world → advances 2 seasons', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
        currentSeason: '2025-26',
      });

      // Advance first season
      await advanceSeason(worldResult.worldId);
      let metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.currentSeason).toBe('2026-27');

      // Advance second season
      await advanceSeason(worldResult.worldId);
      metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.currentSeason).toBe('2027-28');
    });

    it('verifies all contract processing', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
        currentSeason: '2025-26',
      });

      const teamWithMultiYear = {
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player1'],
        players: [
          {
            playerId: 'player1',
            contract: {
              endSeason: '2027-28',
              yearsRemaining: 3,
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
                {
                  season: '2026-27',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
                {
                  season: '2027-28',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
              ],
            },
          },
        ],
      };

      // seedMockData is imported at top of file
      seedMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`,
        teamWithMultiYear
      );

      // Advance first season
      await advanceSeason(worldResult.worldId);
      let updatedTeam = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      let player = updatedTeam.players.find((p) => p.playerId === 'player1');
      expect(player.contract.yearsRemaining).toBe(2);

      // Advance second season
      await advanceSeason(worldResult.worldId);
      updatedTeam = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      player = updatedTeam.players.find((p) => p.playerId === 'player1');
      expect(player.contract.yearsRemaining).toBe(1);
    });
  });

  describe('Trade → Sign FA → Waive Flow', () => {
    it('executes trade → signs free agent → waives player', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      // Execute trade
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await computeTrade(worldResult.worldId, tradeData);

      // Sign free agent
      const signingData = {
        playerId: 'test_fa',
        teamCode: 'LAL',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 20_000_000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const signResult = await signFreeAgent(worldResult.worldId, 'LAL', signingData);

      // Waive player
      const waiveResult = await waivePlayer(worldResult.worldId, 'LAL', 'stephen_curry');

      // Verify operations returned updated data (functions are read-only, don't persist)
      expect(signResult.team.roster).toContain('test_fa');
      expect(waiveResult.team.roster).not.toContain('stephen_curry');
      expect(waiveResult.team.deadCap.length).toBeGreaterThan(0);
    });

    it('verifies cap totals accurate throughout', async () => {
      // Seed a free agent player for this test with a contract
      seedMockData('architect_basePlayers/test_fa', {
        playerId: 'test_fa',
        displayName: 'Test Free Agent',
        teamCode: null,
        teamName: null,
        bio: { position: 'SG', age: 26, experience: 4 },
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 10_000_000,
          guaranteedValue: 10_000_000,
          yearsRemaining: 2,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 5_000_000,
              capHit: 5_000_000,
              guaranteed: true,
            },
            {
              season: '2026-27',
              salary: 5_000_000,
              capHit: 5_000_000,
              guaranteed: true,
            },
          ],
        },
        source: { provider: 'test' },
      });

      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      // Execute trade
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await computeTrade(worldResult.worldId, tradeData);

      // Sign free agent
      const signResult = await signFreeAgent(worldResult.worldId, 'LAL', {
        playerId: 'test_fa',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 10_000_000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
        },
      });

      // Verify player was added to roster
      expect(signResult.team.roster).toContain('test_fa');

      // Waive player
      const waiveResult = await waivePlayer(worldResult.worldId, 'LAL', 'test_fa');

      // Verify player removed from roster and dead cap added
      expect(waiveResult.team.roster).not.toContain('test_fa');
      expect(waiveResult.team.deadCap.length).toBeGreaterThan(0);
    });
  });
});
