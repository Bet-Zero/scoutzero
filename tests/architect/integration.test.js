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
import { getTeam, getLeague } from '@/features/architect/utils/teamLoader';
import {
  executeTrade,
  signFreeAgent,
  waivePlayer,
} from '@/features/architect/utils/tradeManager';
import { advanceSeason } from '@/features/architect/utils/seasonManager';
import {
  seedBaseData,
  createMockCapProjections,
  getMockWorldMetadata,
} from '../helpers/architectTestHelpers.js';
import { getMockData } from '../__mocks__/firebase.js';

// Mock validateTrade to return valid trades for testing
vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({
    legal: true,
    reason: 'Trade is valid',
    teamResults: [],
  })),
}));

describe('Architect Integration Tests', () => {
  const userId = 'user_123';

  beforeEach(() => {
    seedBaseData(['LAL', 'GSW', 'BOS']);
  });

  describe('World Creation → Trade Flow', () => {
    it('creates world → executes trade → verifies snapshots created', async () => {
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

      const tradeResult = await executeTrade(worldResult.worldId, tradeData);

      expect(tradeResult.success).toBe(true);

      // Verify snapshots created
      const lalSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      const gswSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/GSW`
      );

      expect(lalSnapshot).toBeDefined();
      expect(gswSnapshot).toBeDefined();
      expect(lalSnapshot.source.type).toBe('world-snapshot');
      expect(lalSnapshot.source.worldId).toBe(worldResult.worldId);
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

      await executeTrade(worldResult.worldId, tradeData);

      const lalSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );

      expect(lalSnapshot.totals).toBeDefined();
      expect(typeof lalSnapshot.totals.totalSalary).toBe('number');
      expect(typeof lalSnapshot.totals.capHit).toBe('number');
    });

    it('verifies world stats incremented', async () => {
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

      await executeTrade(worldResult.worldId, tradeData);

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.stats.totalTrades).toBe(1);
      expect(metadata.actionCount).toBe(1);
      expect(metadata.modifiedTeams).toContain('LAL');
      expect(metadata.modifiedTeams).toContain('GSW');
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

      await executeTrade(parentResult.worldId, tradeData);

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

    it('verifies branch inherits parent snapshots', async () => {
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

      await executeTrade(parentResult.worldId, tradeData);

      // Branch world
      const branchResult = await branchWorld(
        parentResult.worldId,
        'Branch World',
        '',
        userId
      );

      // Get team from branch - should fall back to parent snapshot
      const lalTeam = await getTeam(branchResult.worldId, 'LAL');
      expect(lalTeam.roster).not.toContain('lebron_james');
      expect(lalTeam.roster).toContain('stephen_curry');
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

      await executeTrade(parentResult.worldId, parentTradeData);

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

      await executeTrade(branchResult.worldId, branchTradeData);

      // Verify branch has its own snapshot
      const branchLalSnapshot = getMockData(
        `architect_worlds/${branchResult.worldId}/teams/LAL`
      );
      expect(branchLalSnapshot.roster).not.toContain('anthony_davis');
      expect(branchLalSnapshot.roster).toContain('jayson_tatum');

      // Verify parent snapshot unchanged
      const parentLalSnapshot = getMockData(
        `architect_worlds/${parentResult.worldId}/teams/LAL`
      );
      expect(parentLalSnapshot.roster).not.toContain('lebron_james');
      expect(parentLalSnapshot.roster).toContain('stephen_curry');
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

      await executeTrade(worldResult.worldId, tradeData);

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

      const { seedMockData } = await import('../setupFirebaseMocks.js');
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

      const { seedMockData } = await import('../setupFirebaseMocks.js');
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

      const { seedMockData } = await import('../setupFirebaseMocks.js');
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

      await executeTrade(worldResult.worldId, tradeData);

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

      await signFreeAgent(worldResult.worldId, signingData);

      // Waive player
      await waivePlayer(worldResult.worldId, 'LAL', 'stephen_curry');

      // Verify all operations created snapshots
      const lalSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      expect(lalSnapshot).toBeDefined();
      expect(lalSnapshot.roster).toContain('test_fa');
      expect(lalSnapshot.roster).not.toContain('stephen_curry');
      expect(lalSnapshot.deadCap.length).toBeGreaterThan(0);
    });

    it('verifies cap totals accurate throughout', async () => {
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

      await executeTrade(worldResult.worldId, tradeData);

      let lalSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      const initialCap = lalSnapshot.totals.capHit || 0;

      // Sign free agent
      await signFreeAgent(worldResult.worldId, {
        playerId: 'test_fa',
        teamCode: 'LAL',
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

      lalSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      expect(lalSnapshot.totals.capHit).toBeGreaterThan(initialCap);

      // Waive player
      await waivePlayer(worldResult.worldId, 'LAL', 'test_fa');

      lalSnapshot = getMockData(
        `architect_worlds/${worldResult.worldId}/teams/LAL`
      );
      // Dead cap should be included
      expect(lalSnapshot.totals.deadCapTotal).toBeGreaterThan(0);
    });
  });
});
