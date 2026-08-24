/**
 * Season Manager Tests
 *
 * Comprehensive unit tests for legacy and authoritative season managers.
 *
 * @file tests/architect/seasonManager.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  SeasonAdvanceFailureResult,
  SeasonAdvanceResult,
  SeasonAdvanceSuccessResult,
} from '@/features/architect/utils/seasonManager';
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
  getMockTeamSnapshot,
  getMockWorldMetadata,
} from '../helpers/architectTestHelpers.js';
import type {
  MockTeam,
  MockWorldMetadata,
} from '../helpers/architectTestHelpers.js';
import {
  getAllMockData,
  getMockData,
  seedMockData,
} from '../__mocks__/firebase.js';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';

describe('Season Manager', () => {
  const worldId = 'world_123';
  const userId = 'user_123';
  type AdvanceSeasonInWorld =
    typeof import('@/features/architect/utils/seasonManager').advanceSeasonInWorld;
  type PersistedSeasonAdvanceEvent = {
    seasonId: string;
    metadata: {
      toSeason: string;
    };
  };
  type PersistedTeamSnapshotView = {
    season?: string;
    roster?: unknown[];
    players?: unknown[];
    capHolds?: unknown[];
    totals?: unknown;
  };

  function requireDefined<T>(value: T | null | undefined, label: string): T {
    expect(value, `${label} should be defined`).toBeDefined();
    if (value == null) {
      throw new Error(`${label} should be defined`);
    }
    return value;
  }

  function requireWorldMetadata(targetWorldId: string): MockWorldMetadata {
    return requireDefined(
      getMockWorldMetadata(targetWorldId),
      `world metadata ${targetWorldId}`
    );
  }

  function requireTeamSnapshot(teamCode: string): MockTeam {
    const snapshot = requireDefined(
      getMockTeamSnapshot(worldId, teamCode),
      `team snapshot ${teamCode}`
    );
    expect(snapshot.season, `team snapshot ${teamCode} season`).toBeDefined();
    expect(snapshot.players, `team snapshot ${teamCode} players`).toBeDefined();
    return snapshot as MockTeam;
  }

  function requirePersistedTeamSnapshotView(
    teamCode: string
  ): PersistedTeamSnapshotView {
    const snapshot = getMockData(
      `architect_worlds/${worldId}/teams/${teamCode}`
    );
    expect(snapshot).toBeDefined();
    if (typeof snapshot !== 'object' || snapshot === null) {
      throw new Error(
        `persisted team snapshot ${teamCode} should be an object`
      );
    }
    return snapshot as PersistedTeamSnapshotView;
  }

  function isPersistedSeasonAdvanceEvent(
    value: unknown
  ): value is PersistedSeasonAdvanceEvent {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const event = value as Record<string, unknown>;
    const metadata = event.metadata;
    return (
      typeof event.seasonId === 'string' &&
      typeof metadata === 'object' &&
      metadata !== null &&
      'toSeason' in metadata &&
      typeof metadata.toSeason === 'string'
    );
  }

  function requirePersistedSeasonAdvanceEvent(
    eventId: string
  ): PersistedSeasonAdvanceEvent {
    const event = getMockData(`architect_worlds/${worldId}/events/${eventId}`);
    expect(event).toBeDefined();
    if (!isPersistedSeasonAdvanceEvent(event)) {
      throw new Error(
        `season advance event ${eventId} was not persisted correctly`
      );
    }
    return event;
  }

  function expectSeasonAdvanceSuccess(
    result: SeasonAdvanceResult
  ): SeasonAdvanceSuccessResult {
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Expected season advance success');
    }
    return result;
  }

  function expectSeasonAdvanceFailure(
    result: SeasonAdvanceResult
  ): SeasonAdvanceFailureResult {
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected season advance failure');
    }
    return result;
  }

  function seedTargetSeasonTeam(
    teamCode: string,
    team: MockTeam,
    options: { padRoster?: boolean } = {}
  ) {
    seedTeamSnapshot(
      worldId,
      teamCode,
      withDerivedGovernedSalaryBooks(team, {
        salaryCapYear: 2027,
        asOfDate: '2026-07-01T00:00:00Z',
        apronDelta: 1_000_000,
        taxDelta: 2_000_000,
      }) as MockTeam,
      options
    );
  }

  beforeEach(() => {
    // processSeasonTransition calls getLeague which needs all 30 teams
    seedBaseData('all');
    for (const [path, value] of getAllMockData()) {
      if (
        path.startsWith('architect_baseTeams/') &&
        value &&
        typeof value === 'object'
      ) {
        seedMockData(
          path,
          withDerivedGovernedSalaryBooks(value as Record<string, unknown>, {
            salaryCapYear: 2027,
            asOfDate: '2026-07-01T00:00:00Z',
            apronDelta: 1_000_000,
            taxDelta: 2_000_000,
          })
        );
      }
    }
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

      const metadata = requireWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2026-27');
    });

    it('advances to specific target season', async () => {
      const result = await advanceSeason(worldId, '2027-28');

      expect(result.success).toBe(true);
      expect(result.fromSeason).toBe('2025-26');
      expect(result.toSeason).toBe('2027-28');

      const metadata = requireWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2027-28');
    });

    it('throws error when worldId is missing', async () => {
      await expect(advanceSeason('')).rejects.toThrow('worldId is required');
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
      const updatedTeam = requireTeamSnapshot('LAL');
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

      const updatedTeam = requireTeamSnapshot('LAL');
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

      const updatedTeam = requireTeamSnapshot('LAL');
      const player = requireDefined(
        updatedTeam.players.find((existingPlayer) => {
          return existingPlayer.playerId === 'player_with_option';
        }),
        'player_with_option after exercising option'
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

      const updatedTeam = requireTeamSnapshot('LAL');
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
      seedTeamSnapshot(worldId, 'LAL', teamWithSmallRoster, {
        padRoster: false,
      });

      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const updatedTeam = requireTeamSnapshot('LAL');
      const updatedTotals = requireDefined(
        updatedTeam.totals,
        'LAL totals after season transition'
      );
      const incompleteRosterCharge = requireDefined(
        updatedTotals._meta?.incompleteRosterCharge,
        'LAL incomplete roster charge metadata'
      );
      // Phase 77 replaces totals with computeTeamCapTotals output which uses incompleteChargesTotal
      expect(updatedTotals.incompleteChargesTotal).toBeGreaterThan(0);
      expect(incompleteRosterCharge.standardRosterCount).toBe(2);
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

      const updatedTeam = requireTeamSnapshot('BOS');
      // Signed player's cap hold should be removed
      const signedHold = updatedTeam.capHolds?.find(
        (capHold) => capHold.playerId === 'signed_player'
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

      const updatedTeam = requireTeamSnapshot('LAL');
      const pick = updatedTeam.draftPicks?.find(
        (draftPick) => draftPick.id === 'lal_2026_1'
      );
      // Pick year has passed, status may be updated
      expect(pick).toBeDefined();
    });

    it('updates world metadata season', async () => {
      await processSeasonTransition(worldId, '2025-26', '2026-27');

      const metadata = requireWorldMetadata(worldId);
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

      const updatedTeam = requireTeamSnapshot('LAL');
      const player = requireDefined(
        updatedTeam.players.find(
          (existingPlayer) => existingPlayer.playerId === 'player1'
        ),
        'player1 after season transition'
      );
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

      const updatedTeam = requireTeamSnapshot('LAL');
      const player = requireDefined(
        updatedTeam.players.find(
          (existingPlayer) => existingPlayer.playerId === 'player1'
        ),
        'player1 salary history after season transition'
      );
      // Expired years (2024-25, 2025-26) should be removed
      const expiredYears = player.contract.salariesByYear.filter(
        (salaryYear) =>
          salaryYear.season === '2024-25' || salaryYear.season === '2025-26'
      );
      expect(expiredYears.length).toBe(0);
      // Only future years should remain
      expect(player.contract.salariesByYear.length).toBe(1);
      expect(player.contract.salariesByYear[0].season).toBe('2026-27');
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        processSeasonTransition('', '2025-26', '2026-27')
      ).rejects.toThrow('worldId, fromSeason, and toSeason are required');
    });

    it('throws error when fromSeason is missing', async () => {
      await expect(
        processSeasonTransition(worldId, '', '2026-27')
      ).rejects.toThrow('worldId, fromSeason, and toSeason are required');
    });

    it('throws error when toSeason is missing', async () => {
      await expect(
        processSeasonTransition(worldId, '2025-26', '')
      ).rejects.toThrow('worldId, fromSeason, and toSeason are required');
    });
  });

  // ===========================================================================
  // Phase 3B: advanceSeasonInWorld Tests
  // ===========================================================================
  describe('advanceSeasonInWorld', () => {
    let advanceSeasonInWorld: AdvanceSeasonInWorld;

    beforeEach(async () => {
      // Import the new function
      const module = await import('@/features/architect/utils/seasonManager');
      advanceSeasonInWorld = module.advanceSeasonInWorld;
    });

    it('requires worldId', async () => {
      const result = expectSeasonAdvanceFailure(await advanceSeasonInWorld(''));
      expect(result.error).toBe('worldId is required');
    });

    it('fails closed when caller fromSeason disagrees with world metadata', async () => {
      const result = expectSeasonAdvanceFailure(
        await advanceSeasonInWorld(worldId, {
          fromSeason: '2024-25',
          optionDecisions: {},
        })
      );
      expect(result.error).toContain('Season mismatch');
      expect(result.worldSeason).toBe('2025-26');
      expect(result.attemptedFromSeason).toBe('2024-25');
    });

    it('fails closed when caller toSeason disagrees with the next world season', async () => {
      const result = expectSeasonAdvanceFailure(
        await advanceSeasonInWorld(worldId, {
          toSeason: '2027-28',
          optionDecisions: {},
        })
      );
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
      seedTargetSeasonTeam('LAL', teamWithoutOptions);

      const result = expectSeasonAdvanceSuccess(
        await advanceSeasonInWorld(worldId)
      );
      expect(result.fromSeason).toBe('2025-26');
      expect(result.toSeason).toBe('2026-27');
    });

    it('rejects an exercise decision without immutable contract-event authority', async () => {
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
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
                {
                  season: '2026-27',
                  salary: 11_000_000,
                  capHit: 11_000_000,
                  guaranteed: true,
                  option: 'Player Option',
                },
                {
                  season: '2027-28',
                  salary: 12_000_000,
                  capHit: 12_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
        ],
      });
      seedTargetSeasonTeam('LAL', teamWithOption);

      const result = expectSeasonAdvanceFailure(
        await advanceSeasonInWorld(worldId, {
          optionDecisions: {
            player_with_option: {
              decision: 'exercise',
              optionType: 'player',
              season: '2026-27',
            },
          },
        })
      );
      expect(result.error).toContain('immutable governed contract event');
      expect(requireWorldMetadata(worldId).currentSeason).toBe('2025-26');
    });

    it('rejects a decline decision without immutable contract-event authority', async () => {
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
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
                {
                  season: '2026-27',
                  salary: 11_000_000,
                  capHit: 11_000_000,
                  guaranteed: true,
                  option: 'Player Option',
                },
                {
                  season: '2027-28',
                  salary: 12_000_000,
                  capHit: 12_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
        ],
      });
      seedTargetSeasonTeam('LAL', teamWithOption);

      const result = expectSeasonAdvanceFailure(
        await advanceSeasonInWorld(worldId, {
          optionDecisions: {
            player_with_option: {
              decision: 'decline',
              optionType: 'player',
              season: '2026-27',
            },
          },
        })
      );
      expect(result.error).toContain('immutable governed contract event');
      expect(requireWorldMetadata(worldId).currentSeason).toBe('2025-26');
    });

    it('creates no cap hold when decline authority is unavailable', async () => {
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
                {
                  season: '2025-26',
                  salary: 10_000_000,
                  capHit: 10_000_000,
                  guaranteed: true,
                },
                {
                  season: '2026-27',
                  salary: 11_000_000,
                  capHit: 11_000_000,
                  guaranteed: true,
                  option: 'Player Option',
                },
                {
                  season: '2027-28',
                  salary: 12_000_000,
                  capHit: 12_000_000,
                  guaranteed: true,
                },
              ],
            },
          }),
        ],
        capHolds: [],
      });
      seedTargetSeasonTeam('LAL', teamWithOption);

      const result = expectSeasonAdvanceFailure(
        await advanceSeasonInWorld(worldId, {
          optionDecisions: {
            player_with_option: {
              decision: 'decline',
              optionType: 'player',
              season: '2026-27',
            },
          },
        })
      );
      expect(result.error).toContain('immutable governed contract event');
      expect(requireTeamSnapshot('LAL').capHolds).toEqual([]);
    });

    it('updates world metadata season', async () => {
      const result = expectSeasonAdvanceSuccess(
        await advanceSeasonInWorld(worldId, {
          focusTeamCode: 'LAL',
        })
      );

      const metadata = requireWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2026-27');
      expect(metadata.asOfDate).toBe('2026-07-01');
      expect(result.committedState.metadata).toEqual({
        currentSeason: '2026-27',
        currentYear: 2027,
        asOfDate: '2026-07-01',
        lastModifiedTeams: result.updatedTeams,
      });
      expect(result.committedState.focusTeamCode).toBe('LAL');
      const persistedFocusTeam = requirePersistedTeamSnapshotView('LAL');
      expect(result.committedState.focusTeamSnapshot).toEqual(
        expect.objectContaining({
          teamCode: 'LAL',
          season: persistedFocusTeam.season,
          roster: persistedFocusTeam.roster,
          players: persistedFocusTeam.players,
          capHolds: persistedFocusTeam.capHolds,
          totals: persistedFocusTeam.totals,
        })
      );

      const persistedEvent = requirePersistedSeasonAdvanceEvent(
        result.committedState.event.eventId
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
            playerId: 'player_staying',
            displayName: 'Staying Player',
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
      seedTargetSeasonTeam('LAL', teamWithExpiring);

      const result = expectSeasonAdvanceSuccess(
        await advanceSeasonInWorld(worldId)
      );
      // Other base teams may also have expiring contracts, so just check our player is included
      const expiringEntry = result.summary.expiredContracts.find(
        (c) => c.playerName === 'Expiring Player'
      );
      expect(expiringEntry).toBeDefined();
    });

    it('fails closed when saved positions require unavailable entitlement-transition authority', async () => {
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
      seedTargetSeasonTeam('MIA', teamWithProtectedPick);

      const result = expectSeasonAdvanceFailure(
        await advanceSeasonInWorld(worldId)
      );
      expect(result.error).toContain('CBA2-A12.3/CBA2-L09.2');
      expect(requireWorldMetadata(worldId).currentSeason).toBe('2025-26');
    });

    it('does not claim a Stepien verdict while preserving draft entitlements', async () => {
      // Create team that has traded 2026 and 2028 firsts, keeping 2027
      const teamWithTradedPicks = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: [],
        players: [],
        draftPicks: [
          // 2026 first - traded away
          {
            id: 'lal_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'LAL',
            currentOwner: 'BOS',
            tradedTo: 'BOS',
          },
          // 2027 first - owned
          {
            id: 'lal_2027_1',
            year: 2027,
            round: 1,
            originalTeam: 'LAL',
            currentOwner: 'LAL',
            owner: 'LAL',
          },
          // 2028 first - traded away
          {
            id: 'lal_2028_1',
            year: 2028,
            round: 1,
            originalTeam: 'LAL',
            currentOwner: 'GSW',
            tradedTo: 'GSW',
          },
        ],
      });
      seedTargetSeasonTeam('LAL', teamWithTradedPicks);

      expectSeasonAdvanceSuccess(await advanceSeasonInWorld(worldId));

      const updatedTeam = requireTeamSnapshot('LAL');
      const pick2027 = requireDefined(
        updatedTeam.draftPicks?.find((pick) => pick.id === 'lal_2027_1'),
        '2027 pick after entitlement-preserving season advance'
      );

      expect(pick2027.stepienBlocked).toBeUndefined();
      expect(pick2027.stepienReason).toBeUndefined();
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
          {
            id: 'lal_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'LAL',
            currentOwner: 'BOS',
            tradedTo: 'BOS',
          },
          // 2027 first - owned
          {
            id: 'lal_2027_1',
            year: 2027,
            round: 1,
            originalTeam: 'LAL',
            currentOwner: 'LAL',
            owner: 'LAL',
          },
          // 2028 first - owned
          {
            id: 'lal_2028_1',
            year: 2028,
            round: 1,
            originalTeam: 'LAL',
            currentOwner: 'LAL',
            owner: 'LAL',
          },
        ],
      });
      seedTargetSeasonTeam('LAL', teamWithOneTradedPick);

      expectSeasonAdvanceSuccess(await advanceSeasonInWorld(worldId));

      const updatedTeam = requireTeamSnapshot('LAL');
      const pick2027 = requireDefined(
        updatedTeam.draftPicks?.find((pick) => pick.id === 'lal_2027_1'),
        '2027 pick when adjacent years are not both traded'
      );
      const pick2028 = requireDefined(
        updatedTeam.draftPicks?.find((pick) => pick.id === 'lal_2028_1'),
        '2028 pick when adjacent years are not both traded'
      );

      // Neither pick should be blocked
      expect(pick2027.stepienBlocked).toBeFalsy();
      expect(pick2028.stepienBlocked).toBeFalsy();
    });

    it('does not rewrite draft-pick status without entitlement authority', async () => {
      // Create team with a 2026 pick that has passed
      const teamWithPastPick = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: [],
        players: [],
        draftPicks: [
          {
            id: 'lal_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'LAL',
            owner: 'LAL',
            status: 'future',
          },
          {
            id: 'lal_2027_1',
            year: 2027,
            round: 1,
            originalTeam: 'LAL',
            owner: 'LAL',
            status: 'future',
          },
        ],
      });
      seedTargetSeasonTeam('LAL', teamWithPastPick);

      expectSeasonAdvanceSuccess(await advanceSeasonInWorld(worldId));

      const updatedTeam = requireTeamSnapshot('LAL');
      const pick2026 = requireDefined(
        updatedTeam.draftPicks?.find((pick) => pick.id === 'lal_2026_1'),
        '2026 pick after season advance'
      );

      expect(pick2026.status).toBe('future');
    });
  });
});
