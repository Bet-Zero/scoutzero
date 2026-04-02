/**
 * Season Manager Tests
 *
 * Comprehensive unit tests for legacy and authoritative season managers.
 *
 * @file tests/architect/seasonManager.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  advanceSeasonLegacy as advanceSeason,
  processSeasonTransitionLegacy as processSeasonTransition,
} from '@/features/architect/utils/seasonManagerLegacy';
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
    // processSeasonTransition calls getLeague which needs all 30 teams
    seedBaseData('all');
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
              endSeason: '2026-27', // Contract continues if option exercised
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                  option: 'Player Option',
                  optionUsed: null,
                },
                {
                  season: '2026-27',
                  salary: 10_500_000,
                  capHit: 10_500_000,
                  guaranteed: true,
                  option: null,
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
      // Player should still be on roster since option was exercised (default behavior)
      expect(updatedTeam.roster).toContain('player_with_option');
      // Remaining salary should be the 2026-27 entry
      expect(player.contract.salariesByYear.length).toBe(1);
      expect(player.contract.salariesByYear[0].season).toBe('2026-27');
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
              endSeason: '2025-26', // Contract ends after this season if option declined
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
      seedTeamSnapshot(worldId, 'LAL', teamWithSmallRoster, { padRoster: false });

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      // Phase 77 replaces totals with computeTeamCapTotals output which uses incompleteChargesTotal
      expect(updatedTeam.totals.incompleteChargesTotal).toBeGreaterThan(0);
      expect(updatedTeam.totals._meta.incompleteRosterCharge.standardRosterCount).toBe(2);
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

  // ===========================================================================
  // Phase 3B: advanceSeasonInWorld Tests
  // ===========================================================================
  describe('advanceSeasonInWorld', () => {
    let advanceSeasonInWorld;

    beforeEach(async () => {
      // Import the new function
      const module = await import('@/features/architect/utils/seasonManager');
      advanceSeasonInWorld = module.advanceSeasonInWorld;
    });

    it('requires worldId', async () => {
      const result = await advanceSeasonInWorld(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('worldId is required');
    });

    it('fails closed when caller fromSeason disagrees with world metadata', async () => {
      const result = await advanceSeasonInWorld(worldId, {
        fromSeason: '2024-25',
        optionDecisions: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Season mismatch');
      expect(result.worldSeason).toBe('2025-26');
      expect(result.attemptedFromSeason).toBe('2024-25');
    });

    it('fails closed when caller toSeason disagrees with the next world season', async () => {
      const result = await advanceSeasonInWorld(worldId, {
        toSeason: '2027-28',
        optionDecisions: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Season mismatch');
      expect(result.worldSeason).toBe('2025-26');
      expect(result.attemptedToSeason).toBe('2027-28');
    });

    it('advances season with no options', async () => {
      // Create team without options
      const teamWithoutOptions = createMockTeam({
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
                { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2026-27', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2027-28', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithoutOptions);

      const result = await advanceSeasonInWorld(worldId);

      expect(result.success).toBe(true);
      expect(result.fromSeason).toBe('2025-26');
      expect(result.toSeason).toBe('2026-27');
    });

    it('exercises option when decision is exercise', async () => {
      // Create team with player option for toYear (2027 season = 2026-27)
      const teamWithOption = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_with_option'],
        players: [
          createMockPlayer({
            playerId: 'player_with_option',
            displayName: 'Option Player',
            contract: {
              endSeason: '2027-28',
              salariesByYear: [
                { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2026-27', salary: 11_000_000, capHit: 11_000_000, guaranteed: true, option: 'Player Option' },
                { season: '2027-28', salary: 12_000_000, capHit: 12_000_000, guaranteed: true },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithOption);

      const result = await advanceSeasonInWorld(worldId, {
        optionDecisions: {
          player_with_option: { decision: 'exercise', optionType: 'player', season: '2026-27' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.summary.exercisedOptions).toHaveLength(1);
      expect(result.summary.exercisedOptions[0].playerName).toBe('Option Player');

      // Player should still be on roster
      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.roster).toContain('player_with_option');
    });

    it('declines option when decision is decline', async () => {
      // Create team with player option
      const teamWithOption = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_with_option'],
        players: [
          createMockPlayer({
            playerId: 'player_with_option',
            displayName: 'Option Player',
            contract: {
              endSeason: '2027-28',
              salariesByYear: [
                { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2026-27', salary: 11_000_000, capHit: 11_000_000, guaranteed: true, option: 'Player Option' },
                { season: '2027-28', salary: 12_000_000, capHit: 12_000_000, guaranteed: true },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithOption);

      const result = await advanceSeasonInWorld(worldId, {
        optionDecisions: {
          player_with_option: { decision: 'decline', optionType: 'player', season: '2026-27' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.summary.declinedOptions).toHaveLength(1);
      expect(result.summary.declinedOptions[0].playerName).toBe('Option Player');

      // Player should be removed from roster
      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.roster).not.toContain('player_with_option');
    });

    it('creates cap hold for declined option', async () => {
      // Create team with player option
      const teamWithOption = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_with_option'],
        players: [
          createMockPlayer({
            playerId: 'player_with_option',
            displayName: 'Option Player',
            contract: {
              endSeason: '2027-28',
              salariesByYear: [
                { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2026-27', salary: 11_000_000, capHit: 11_000_000, guaranteed: true, option: 'Player Option' },
                { season: '2027-28', salary: 12_000_000, capHit: 12_000_000, guaranteed: true },
              ],
            },
          }),
        ],
        capHolds: [],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithOption);

      const result = await advanceSeasonInWorld(worldId, {
        optionDecisions: {
          player_with_option: { decision: 'decline', optionType: 'player', season: '2026-27' },
        },
      });

      expect(result.success).toBe(true);

      // Should have a cap hold created
      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      expect(updatedTeam.capHolds).toBeDefined();
      const hold = updatedTeam.capHolds.find((h) => h.playerId === 'player_with_option');
      expect(hold).toBeDefined();
      expect(hold.amount).toBeGreaterThan(0);
    });

    it('updates world metadata season', async () => {
      const result = await advanceSeasonInWorld(worldId, {
        focusTeamCode: 'LAL',
      });

      expect(result.success).toBe(true);

      const metadata = getMockWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2026-27');
      expect(result.committedState.metadata).toEqual({
        currentSeason: '2026-27',
        currentYear: 2027,
        lastModifiedTeams: result.updatedTeams,
      });
      expect(result.committedState.focusTeamCode).toBe('LAL');
      expect(result.committedState.focusTeamSnapshot).toEqual(
        getMockData(`architect_worlds/${worldId}/teams/LAL`)
      );

      const persistedEvent = getMockData(
        `architect_worlds/${worldId}/events/${result.committedState.event.eventId}`
      );
      expect(result.committedState.event.eventId).toContain('seasonAdvance_');
      expect(result.committedState.event.occurredAt).toBeDefined();
      expect(persistedEvent.seasonId).toBe('2026-27');
      expect(persistedEvent.metadata.toSeason).toBe('2026-27');
    });

    it('tracks expired contracts in summary', async () => {
      // Create team with expiring contract
      const teamWithExpiring = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['player_expiring', 'player_staying'],
        players: [
          createMockPlayer({
            playerId: 'player_expiring',
            displayName: 'Expiring Player',
            contract: {
              endSeason: '2025-26',
              yearsRemaining: 1,
              salariesByYear: [
                { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
              ],
            },
          }),
          createMockPlayer({
            playerId: 'player_staying',
            displayName: 'Staying Player',
            contract: {
              endSeason: '2027-28',
              yearsRemaining: 3,
              salariesByYear: [
                { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2026-27', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
                { season: '2027-28', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
              ],
            },
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithExpiring);

      const result = await advanceSeasonInWorld(worldId);

      expect(result.success).toBe(true);
      // Other base teams may also have expiring contracts, so just check our player is included
      const expiringEntry = result.summary.expiredContracts.find(
        (c) => c.playerName === 'Expiring Player'
      );
      expect(expiringEntry).toBeDefined();
    });

    it('uses the world-derived draft year even when future-year positions are also saved', async () => {
      seedWorldMetadata(
        worldId,
        createMockWorld({
          worldId,
          userId,
          currentSeason: '2025-26',
          draftPositionsByYear: {
            2026: {
              positionsMap: { LAL: 2 },
              method: 'manual',
              updatedAtIso: '2026-03-10T08:30:00.000Z',
            },
            2027: {
              positionsMap: { LAL: 7 },
              method: 'manual',
              updatedAtIso: '2027-03-10T08:30:00.000Z',
            },
          },
        })
      );

      const teamWithProtectedPick = createMockTeam({
        teamCode: 'MIA',
        season: '2025-26',
        roster: [],
        players: [],
        draftPicks: [
          {
            id: 'lal_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'LAL',
            owner: 'MIA',
            protection: 'Top 3',
            conveyance: {
              originalYear: 2026,
              currentYear: 2026,
              finalYear: 2027,
              conditions: {
                protection: 'Top 3',
              },
            },
          },
        ],
      });
      seedTeamSnapshot(worldId, 'MIA', teamWithProtectedPick);

      const result = await advanceSeasonInWorld(worldId);

      expect(result.success).toBe(true);

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/MIA`);
      const protectedPick = updatedTeam.draftPicks.find(
        (pick) => pick.id === 'lal_2026_1'
      );

      expect(protectedPick.status).toBe('rolled');
      expect(protectedPick.year).toBe(2027);
      expect(protectedPick.conveyanceResult.outcome).toBe('rolled');
    });

    // Stepien recalculation tests
    it('marks pick as stepienBlocked when adjacent years are traded', async () => {
      // Create team that has traded 2026 and 2028 firsts, keeping 2027
      const teamWithTradedPicks = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: [],
        players: [],
        draftPicks: [
          // 2026 first - traded away
          { id: 'lal_2026_1', year: 2026, round: 1, originalTeam: 'LAL', currentOwner: 'BOS', tradedTo: 'BOS' },
          // 2027 first - owned
          { id: 'lal_2027_1', year: 2027, round: 1, originalTeam: 'LAL', currentOwner: 'LAL', owner: 'LAL' },
          // 2028 first - traded away
          { id: 'lal_2028_1', year: 2028, round: 1, originalTeam: 'LAL', currentOwner: 'GSW', tradedTo: 'GSW' },
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithTradedPicks);

      const result = await advanceSeasonInWorld(worldId);

      expect(result.success).toBe(true);

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const pick2027 = updatedTeam.draftPicks.find((p) => p.id === 'lal_2027_1');
      
      // 2027 pick should be stepien-blocked because both 2026 and 2028 are traded
      expect(pick2027.stepienBlocked).toBe(true);
      expect(pick2027.stepienReason).toContain('consecutive years');
    });

    it('does not mark pick as blocked when adjacent years are not both traded', async () => {
      // Create team that has only traded 2026 first
      const teamWithOneTradedPick = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: [],
        players: [],
        draftPicks: [
          // 2026 first - traded away
          { id: 'lal_2026_1', year: 2026, round: 1, originalTeam: 'LAL', currentOwner: 'BOS', tradedTo: 'BOS' },
          // 2027 first - owned
          { id: 'lal_2027_1', year: 2027, round: 1, originalTeam: 'LAL', currentOwner: 'LAL', owner: 'LAL' },
          // 2028 first - owned
          { id: 'lal_2028_1', year: 2028, round: 1, originalTeam: 'LAL', currentOwner: 'LAL', owner: 'LAL' },
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithOneTradedPick);

      const result = await advanceSeasonInWorld(worldId);

      expect(result.success).toBe(true);

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const pick2027 = updatedTeam.draftPicks.find((p) => p.id === 'lal_2027_1');
      const pick2028 = updatedTeam.draftPicks.find((p) => p.id === 'lal_2028_1');
      
      // Neither pick should be blocked
      expect(pick2027.stepienBlocked).toBeFalsy();
      expect(pick2028.stepienBlocked).toBeFalsy();
    });

    it('updates pick status from future to available when year passes', async () => {
      // Create team with a 2026 pick that has passed
      const teamWithPastPick = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: [],
        players: [],
        draftPicks: [
          { id: 'lal_2026_1', year: 2026, round: 1, originalTeam: 'LAL', owner: 'LAL', status: 'future' },
          { id: 'lal_2027_1', year: 2027, round: 1, originalTeam: 'LAL', owner: 'LAL', status: 'future' },
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', teamWithPastPick);

      const result = await advanceSeasonInWorld(worldId);

      expect(result.success).toBe(true);

      const updatedTeam = getMockData(`architect_worlds/${worldId}/teams/LAL`);
      const pick2026 = updatedTeam.draftPicks.find((p) => p.id === 'lal_2026_1');
      
      // 2026 pick should now be 'available' since we advanced to 2026-27
      expect(pick2026.status).toBe('available');
    });
  });
});
