/**
 * Trade Manager Tests
 * 
 * Comprehensive unit tests for tradeManager.js covering executeTrade,
 * signFreeAgent, waivePlayer, extendPlayer, and updateTeamCapTotals.
 * 
 * @file tests/architect/tradeManager.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeTrade,
  signFreeAgent,
  waivePlayer,
  extendPlayer,
  updateTeamCapTotals,
} from '@/utils/architect/tradeManager';
import {
  seedBaseData,
  seedWorldMetadata,
  createMockWorld,
  createMockTeam,
  createMockPlayer,
  createMockCapProjections,
} from '../helpers/architectTestHelpers.js';
import { getMockData } from '../__mocks__/firebase.js';

// Mock validateTrade to return valid trades for testing
vi.mock('@/utils/architect/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({
    legal: true,
    reason: 'Trade is valid',
    teamResults: [],
  })),
}));

describe('Trade Manager', () => {
  const worldId = 'world_123';
  const userId = 'user_123';

  beforeEach(() => {
    seedBaseData(['LAL', 'GSW', 'BOS']);
    const world = createMockWorld({ worldId, userId });
    seedWorldMetadata(worldId, world);
  });

  describe('executeTrade', () => {
    it('executes valid 2-team trade', async () => {
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

      const result = await executeTrade(worldId, tradeData);

      expect(result.success).toBe(true);
      expect(result.teams.length).toBe(2);
      expect(result.validation.legal).toBe(true);
    });

    it('updates rosters correctly (remove outgoing, add incoming)', async () => {
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

      await executeTrade(worldId, tradeData);

      // Check LAL snapshot
      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      expect(lalSnapshot).toBeDefined();
      expect(lalSnapshot.roster).not.toContain('lebron_james');
      expect(lalSnapshot.roster).toContain('stephen_curry');
    });

    it('updates draft picks correctly', async () => {
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [],
            picksOut: [
              {
                id: 'lal_2026_1',
                year: 2026,
                round: 1,
                owner: 'LAL',
              },
            ],
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

      await executeTrade(worldId, tradeData);

      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      const gswSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/GSW`);

      // LAL should not have the pick anymore
      const lalPick = lalSnapshot.draftPicks?.find((p) => p.id === 'lal_2026_1');
      expect(lalPick).toBeUndefined();

      // GSW should have the pick
      const gswPick = gswSnapshot.draftPicks?.find((p) => p.id === 'lal_2026_1');
      expect(gswPick).toBeDefined();
    });

    it('creates snapshots for modified teams only', async () => {
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
            sends: [],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await executeTrade(worldId, tradeData);

      // Both teams should have snapshots (both were in the trade)
      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      const gswSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/GSW`);

      expect(lalSnapshot).toBeDefined();
      expect(gswSnapshot).toBeDefined();
    });

    it('recalculates cap totals after trade', async () => {
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

      await executeTrade(worldId, tradeData);

      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      expect(lalSnapshot.totals).toBeDefined();
      expect(typeof lalSnapshot.totals.totalSalary).toBe('number');
    });

    it('throws error for invalid trade', async () => {
      const { validateTrade } = await import('@/utils/architect/tradeMachine');
      vi.mocked(validateTrade).mockReturnValueOnce({
        legal: false,
        reason: 'Trade violates salary matching rules',
        teamResults: [],
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
            sends: [],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await expect(executeTrade(worldId, tradeData)).rejects.toThrow('Trade invalid');
    });

    it('handles 3-team trade', async () => {
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

      const result = await executeTrade(worldId, tradeData);

      expect(result.success).toBe(true);
      expect(result.teams.length).toBe(3);
    });

    it('throws error when worldId is missing', async () => {
      const tradeData = {
        teams: [
          { teamCode: 'LAL', sends: [], picksOut: [], cashSent: 0 },
          { teamCode: 'GSW', sends: [], picksOut: [], cashSent: 0 },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await expect(executeTrade(null, tradeData)).rejects.toThrow('worldId is required');
    });

    it('throws error when trade has less than 2 teams', async () => {
      const tradeData = {
        teams: [{ teamCode: 'LAL', sends: [], picksOut: [], cashSent: 0 }],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      await expect(executeTrade(worldId, tradeData)).rejects.toThrow(
        'Trade must include at least 2 teams'
      );
    });
  });

  describe('signFreeAgent', () => {
    it('signs player to roster', async () => {
      const signingData = {
        playerId: 'test_player',
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

      const result = await signFreeAgent(worldId, signingData);

      expect(result.success).toBe(true);
      expect(result.team.roster).toContain('test_player');
    });

    it('updates exceptions (MLE usage)', async () => {
      const signingData = {
        playerId: 'test_player',
        teamCode: 'LAL',
        signedUsing: 'MLE',
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
      };

      await signFreeAgent(worldId, signingData);

      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      expect(lalSnapshot.exceptions.mle.usedAmount).toBe(10_000_000);
      expect(lalSnapshot.exceptions.mle.remainingAmount).toBe(2_860_000);
    });

    it('triggers hard cap when using non-taxpayer MLE', async () => {
      const signingData = {
        playerId: 'test_player',
        teamCode: 'LAL',
        signedUsing: 'MLE',
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
      };

      await signFreeAgent(worldId, signingData);

      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      expect(lalSnapshot.totals.isHardCapped).toBe(true);
      expect(lalSnapshot.totals.hardCapLevel).toBe('firstApron');
    });

    it('removes cap hold after signing', async () => {
      // First, create a team with a cap hold
      const teamWithHold = createMockTeam({
        teamCode: 'BOS',
        capHolds: [
          {
            playerId: 'test_player',
            playerName: 'Test Player',
            amount: 12_000_000,
            type: 'Bird',
          },
        ],
      });
      const { seedMockData } = await import('../setupFirebaseMocks.js');
      seedMockData(`architect/worlds/${worldId}/snapshot/teams/BOS`, teamWithHold);

      const signingData = {
        playerId: 'test_player',
        teamCode: 'BOS',
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

      await signFreeAgent(worldId, signingData);

      const bosSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/BOS`);
      const remainingHolds = bosSnapshot.capHolds?.filter((h) => h.playerId === 'test_player');
      expect(remainingHolds.length).toBe(0);
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        signFreeAgent(null, {
          playerId: 'test',
          teamCode: 'LAL',
          contract: {},
        })
      ).rejects.toThrow('worldId is required');
    });
  });

  describe('waivePlayer', () => {
    it('removes player from roster', async () => {
      const result = await waivePlayer(worldId, 'LAL', 'lebron_james');

      expect(result.success).toBe(true);
      expect(result.team.roster).not.toContain('lebron_james');
    });

    it('creates dead cap entry', async () => {
      await waivePlayer(worldId, 'LAL', 'lebron_james');

      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      expect(lalSnapshot.deadCap).toBeDefined();
      expect(Array.isArray(lalSnapshot.deadCap)).toBe(true);
      const deadCapEntry = lalSnapshot.deadCap.find((d) => d.playerId === 'lebron_james');
      expect(deadCapEntry).toBeDefined();
    });

    it('handles stretch provision', async () => {
      await waivePlayer(worldId, 'LAL', 'lebron_james', { stretch: true, stretchYears: 3 });

      const lalSnapshot = getMockData(`architect/worlds/${worldId}/snapshot/teams/LAL`);
      const deadCapEntry = lalSnapshot.deadCap.find((d) => d.playerId === 'lebron_james');
      expect(deadCapEntry.amountByYear.length).toBeGreaterThan(1); // Stretched over multiple years
    });

    it('throws error when worldId is missing', async () => {
      await expect(waivePlayer(null, 'LAL', 'lebron_james')).rejects.toThrow(
        'worldId, teamCode, and playerId are required'
      );
    });
  });

  describe('extendPlayer', () => {
    it('extends contract correctly', async () => {
      const extensionData = {
        playerId: 'lebron_james',
        teamCode: 'LAL',
        newContract: {
          contractType: 'Extension',
          startSeason: '2026-27',
          endSeason: '2028-29',
          totalValue: 150_000_000,
          salariesByYear: [
            {
              season: '2026-27',
              salary: 50_000_000,
              capHit: 50_000_000,
              guaranteed: true,
            },
            {
              season: '2027-28',
              salary: 50_000_000,
              capHit: 50_000_000,
              guaranteed: true,
            },
            {
              season: '2028-29',
              salary: 50_000_000,
              capHit: 50_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const result = await extendPlayer(worldId, extensionData);

      expect(result.success).toBe(true);
      expect(result.player.contract.contractType).toBe('Extension');
    });

    it('updates salariesByYear array', async () => {
      const extensionData = {
        playerId: 'lebron_james',
        teamCode: 'LAL',
        newContract: {
          contractType: 'Extension',
          startSeason: '2026-27',
          endSeason: '2027-28',
          totalValue: 100_000_000,
          salariesByYear: [
            {
              season: '2026-27',
              salary: 50_000_000,
              capHit: 50_000_000,
              guaranteed: true,
            },
            {
              season: '2027-28',
              salary: 50_000_000,
              capHit: 50_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const result = await extendPlayer(worldId, extensionData);

      expect(result.player.contract.salariesByYear.length).toBeGreaterThanOrEqual(2);
      const newYear = result.player.contract.salariesByYear.find((y) => y.season === '2026-27');
      expect(newYear).toBeDefined();
      expect(newYear.salary).toBe(50_000_000);
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        extendPlayer(null, {
          playerId: 'lebron_james',
          teamCode: 'LAL',
          newContract: {},
        })
      ).rejects.toThrow('worldId is required');
    });
  });

  describe('updateTeamCapTotals', () => {
    it('calculates total salary correctly', async () => {
      const teamData = createMockTeam({
        teamCode: 'LAL',
        players: [
          createMockPlayer({
            playerId: 'player1',
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
          createMockPlayer({
            playerId: 'player2',
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 15_000_000,
                  capHit: 15_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
        ],
        season: '2025-26',
      });

      const totals = await updateTeamCapTotals(teamData);

      expect(totals.totalSalary).toBe(25_000_000);
    });

    it('includes dead cap in totals', async () => {
      const teamData = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        deadCap: [
          {
            playerId: 'waived_player',
            playerName: 'Waived Player',
            originalSalary: 10_000_000,
            amountByYear: [
              {
                season: '2025-26',
                amount: 5_000_000,
              },
            ],
          },
        ],
      });

      const totals = await updateTeamCapTotals(teamData);

      expect(totals.deadCapTotal).toBe(5_000_000);
      expect(totals.capHit).toBeGreaterThanOrEqual(5_000_000);
    });

    it('includes cap holds in totals', async () => {
      const teamData = createMockTeam({
        teamCode: 'BOS',
        season: '2025-26',
        capHolds: [
          {
            playerId: 'fa_player',
            playerName: 'FA Player',
            amount: 12_000_000,
            type: 'Bird',
          },
        ],
      });

      const totals = await updateTeamCapTotals(teamData);

      expect(totals.capHoldsTotal).toBe(12_000_000);
      expect(totals.capHit).toBeGreaterThanOrEqual(12_000_000);
    });

    it('handles guaranteed vs non-guaranteed', async () => {
      const teamData = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        players: [
          createMockPlayer({
            playerId: 'guaranteed_player',
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
          createMockPlayer({
            playerId: 'non_guaranteed_player',
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 5_000_000,
                  capHit: 5_000_000,
                  guaranteed: false,
                },
              ],
            },
          }),
        ],
      });

      const totals = await updateTeamCapTotals(teamData);

      expect(totals.guaranteedSalary).toBe(10_000_000);
      expect(totals.nonGuaranteedSalary).toBe(5_000_000);
    });
  });
});

