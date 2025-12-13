/**
 * Season Manager Tests
 *
 * Comprehensive unit tests for seasonManager.js covering advanceSeason,
 * processSeasonTransition, contract expirations, options, empty roster charges, and cap holds.
 *
 * @file tests/architect/seasonManager.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  advanceSeason,
  processSeasonTransition,
} from '@/features/architect/utils/seasonManager';
import {
  seedBaseData,
  seedWorldMetadata,
  seedTeamSnapshot,
  createMockWorld,
  createMockTeam,
  createMockPlayer,
  getMockWorldMetadata,
} from '../helpers/architectTestHelpers.js';
import { getMockData } from '../__mocks__/firebase.js';

describe('Season Manager', () => {
  const worldId = 'world_123';
  const userId = 'user_123';

  beforeEach(() => {
    seedBaseData(['LAL', 'GSW', 'BOS']);
    const world = createMockWorld({
      worldId,
      userId,
      currentSeason: '2025-26',
    });
    seedWorldMetadata(worldId, world);
  });

  describe('advanceSeason', () => {
    it('advances to next season', async () => {
      const result = await advanceSeason(worldId);

      expect(result.success).toBe(true);
      expect(result.fromSeason).toBe('2025-26');
      expect(result.toSeason).toBe('2026-27');

      const metadata = getMockWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2026-27');
    });

    it('advances to specific target season', async () => {
      const result = await advanceSeason(worldId, '2027-28');

      expect(result.success).toBe(true);
      expect(result.fromSeason).toBe('2025-26');
      expect(result.toSeason).toBe('2027-28');

      const metadata = getMockWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2027-28');
    });

    it('throws error when worldId is missing', async () => {
      await expect(advanceSeason(null)).rejects.toThrow('worldId is required');
    });
  });

  describe('processSeasonTransition', () => {
    it('processes contract expirations', async () => {
      // Create team with expiring contract
      const teamWithExpiring = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_expiring'],
        players: [
          createMockPlayer({
            playerId: 'player_expiring',
            contract: {
              startSeason: '2024-25',
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
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithExpiring);

      const result = await processSeasonTransition(
        worldId,
        '2025-26',
        '2026-27'
      );

      expect(result.success).toBe(true);
      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.roster).not.toContain('player_expiring');
    });

    it('removes expired contracts from roster', async () => {
      const teamWithExpiring = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player1', 'player_expiring'],
        players: [
          createMockPlayer({
            playerId: 'player1',
            contract: {
              endSeason: '2026-27',
              yearsRemaining: 2,
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
              ],
            },
          }),
          createMockPlayer({
            playerId: 'player_expiring',
            contract: {
              endSeason: '2025-26',
              yearsRemaining: 1,
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 5_000_000,
                  capHit: 5_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithExpiring);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.roster).toContain('player1');
      expect(updatedTeam.roster).not.toContain('player_expiring');
    });

    it('processes player options', async () => {
      const teamWithOption = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_with_option'],
        players: [
          createMockPlayer({
            playerId: 'player_with_option',
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                  option: 'Player Option',
                  optionUsed: null,
                },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithOption);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const player = updatedTeam.players.find(
        (p) => p.playerId === 'player_with_option'
      );
      // Option should be exercised by default
      expect(player.contract.salariesByYear[0].optionUsed).toBe(true);
    });

    it('declines options correctly', async () => {
      const teamWithOption = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_with_option'],
        players: [
          createMockPlayer({
            playerId: 'player_with_option',
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                  option: 'Player Option',
                  optionUsed: false, // Explicitly declined
                },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithOption);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.roster).not.toContain('player_with_option');
    });

    it('updates empty roster charges', async () => {
      const teamWithSmallRoster = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player1', 'player2'], // Only 2 players (below minimum of 12)
        players: [
          createMockPlayer({ playerId: 'player1' }),
          createMockPlayer({ playerId: 'player2' }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithSmallRoster);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.totals.emptyRosterCharges).toBeGreaterThan(0);
      expect(updatedTeam.totals.rosterCount).toBe(2);
    });

    it('updates cap holds', async () => {
      const teamWithCapHolds = createMockTeam({
        teamCode: 'BOS',
        season: '2025-26',
        capHolds: [
          {
            playerId: 'fa_player',
            playerName: 'FA Player',
            amount: 12_000_000,
            type: 'Bird',
            expiresOn: '2025-07-01',
            isSigned: false,
          },
          {
            playerId: 'signed_player',
            playerName: 'Signed Player',
            amount: 10_000_000,
            type: 'Bird',
            isSigned: true, // This should be removed
          },
        ],
      });
      seedTeamSnapshot(worldId, 'BOS', teamWithCapHolds);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/BOS`);
      // Signed player's cap hold should be removed
      const signedHold = updatedTeam.capHolds?.find(
        (h) => h.playerId === 'signed_player'
      );
      expect(signedHold).toBeUndefined();
    });

    it('updates draft pick status', async () => {
      const teamWithPicks = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        draftPicks: [
          {
            id: 'lal_2026_1',
            year: 2026,
            round: 1,
            owner: 'LAL',
            status: 'future',
          },
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithPicks);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const pick = updatedTeam.draftPicks.find((p) => p.id === 'lal_2026_1');
      // Pick year has passed, status may be updated
      expect(pick).toBeDefined();
    });

    it('updates world metadata season', async () => {
      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const metadata = getMockWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2026-27');
      expect(metadata.lastModifiedAt).toBeDefined();
    });

    it('updates yearsRemaining for contracts', async () => {
      const teamWithContract = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player1'],
        players: [
          createMockPlayer({
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
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithContract);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const player = updatedTeam.players.find((p) => p.playerId === 'player1');
      expect(player.contract.yearsRemaining).toBe(2);
    });

    it('removes expired salary years from salariesByYear', async () => {
      const teamWithContract = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player1'],
        players: [
          createMockPlayer({
            playerId: 'player1',
            contract: {
              salariesByYear: [
                {
                  season: '2024-25',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
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
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithContract);

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const player = updatedTeam.players.find((p) => p.playerId === 'player1');
      // Expired years (2024-25, 2025-26) should be removed
      const expiredYears = player.contract.salariesByYear.filter(
        (y) => y.season === '2024-25' || y.season === '2025-26'
      );
      expect(expiredYears.length).toBe(0);
      // Only future years should remain
      expect(player.contract.salariesByYear.length).toBe(1);
      expect(player.contract.salariesByYear[0].season).toBe('2026-27');
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        processSeasonTransition(null, '2025-26', '2026-27')
      ).rejects.toThrow('worldId, fromSeason, and toSeason are required');
    });

    it('throws error when fromSeason is missing', async () => {
      await expect(
        processSeasonTransition(worldId, null, '2026-27')
      ).rejects.toThrow('worldId, fromSeason, and toSeason are required');
    });

    it('throws error when toSeason is missing', async () => {
      await expect(
        processSeasonTransition(worldId, '2025-26', null)
      ).rejects.toThrow('worldId, fromSeason, and toSeason are required');
    });
  });
});
