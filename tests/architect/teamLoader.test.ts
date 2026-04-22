/**
 * Team Loader Tests
 *
 * Comprehensive unit tests for teamLoader.js covering fallback chain,
 * getLeague, getPlayer, mergePlayerOverride, and recursive parent fallback scenarios.
 *
 * @file tests/architect/teamLoader.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTeam,
  getLeague,
  getPlayer,
  mergePlayerOverride,
} from '@/features/architect/utils/teamLoader';
import {
  seedBaseData,
  seedWorldMetadata,
  seedTeamSnapshot,
  createMockWorld,
  createMockTeam,
  createMockPlayer,
  seedMockData,
} from '../helpers/architectTestHelpers.js';

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

function getSalaryBySeason(
  player: {
    contract?: {
      salariesByYear?: Array<{
        season?: string | null;
        salary?: number | null;
        capHit?: number | null;
        guaranteed?: boolean | null;
      }>;
    } | null;
  },
  season: string,
  message: string
) {
  const salaries = requireArray(
    player.contract?.salariesByYear,
    `${message}: expected salary rows`
  );

  return requireValue(
    salaries.find((salary) => salary.season === season),
    `${message}: expected ${season} salary row`
  );
}

function findTeamByCode<T extends { teamCode?: string | null }>(
  teams: T[],
  teamCode: string,
  message: string
): T {
  return requireValue(
    teams.find((team) => team.teamCode === teamCode),
    message
  );
}

describe('Team Loader', () => {
  beforeEach(() => {
    // Seed base data for all tests
    seedBaseData(['LAL', 'GSW', 'BOS']);
  });

  describe('getTeam', () => {
    it('returns base team when worldId is null', async () => {
      const team = await getTeam(null, 'LAL');

      expect(team).toBeDefined();
      expect(team.teamCode).toBe('LAL');
      expect(team.teamName).toBe('Los Angeles Lakers');
      expect(team.players).toBeDefined();
      expect(Array.isArray(team.players)).toBe(true);
    });

    it('returns world snapshot when exists', async () => {
      const worldId = 'world_123';
      const world = createMockWorld({ worldId });
      seedWorldMetadata(worldId, world);

      // Provide players array to avoid hydration (which would load from base)
      const modifiedTeam = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['lebron_james', 'anthony_davis'],
        players: [
          createMockPlayer({
            playerId: 'lebron_james',
            displayName: 'LeBron James',
          }),
          createMockPlayer({
            playerId: 'anthony_davis',
            displayName: 'Anthony Davis',
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', modifiedTeam, { padRoster: false });

      const team = await getTeam(worldId, 'LAL');
      const players = requireArray(
        team.players,
        'Expected snapshot team players'
      );

      expect(team.teamCode).toBe('LAL');
      // players array is used for roster content, roster array contains IDs
      expect(players.length).toBe(2);
      expect(players.map((player) => player.playerId)).toEqual([
        'lebron_james',
        'anthony_davis',
      ]);
    });

    it('hydrates snapshot roster from base players when players array is missing', async () => {
      const worldId = 'world_hydrate';
      const world = createMockWorld({ worldId });
      seedWorldMetadata(worldId, world);

      const snapshotWithoutPlayers = createMockTeam({
        teamCode: 'LAL',
        season: '2026-27',
        roster: ['lebron_james'],
      });
      const { players: _players, ...snapshotWithoutPlayersRecord } =
        snapshotWithoutPlayers;
      seedMockData(
        `architect_worlds/${worldId}/teams/LAL`,
        snapshotWithoutPlayersRecord
      );

      const team = await getTeam(worldId, 'LAL');
      const players = requireArray(
        team.players,
        'Expected hydrated team players'
      );

      expect(team.teamCode).toBe('LAL');
      expect(team.season).toBe('2026-27');
      expect(Array.isArray(team.players)).toBe(true);
      expect(players.map((player) => player.player_id)).toEqual([
        'lebron_james',
      ]);
    });

    it('canonicalizes stale stored totals when loading a world snapshot', async () => {
      const worldId = 'world_totals_sync';
      seedWorldMetadata(worldId, createMockWorld({ worldId }));

      const snapshotWithStaleTotals = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['lebron_james'],
        players: [
          createMockPlayer({
            playerId: 'lebron_james',
            displayName: 'LeBron James',
          }),
        ],
        totals: {
          yearKey: 2024,
          capHit: 999,
          totalSalary: 999,
        },
      });

      seedTeamSnapshot(worldId, 'LAL', snapshotWithStaleTotals, {
        padRoster: false,
      });

      const team = await getTeam(worldId, 'LAL');
      const totals = requireValue(
        team.totals,
        'Expected canonicalized team totals'
      );

      expect(totals.yearKey).toBe(2026);
      expect(totals.capHit).toBe(totals.totalCapAllocations);
      expect(totals.totalSalary).toBe(totals.totalCapAllocations);
      expect(totals.capHit).not.toBe(999);
    });

    it('falls back to parent world snapshot', async () => {
      // Create parent world with snapshot
      const parentWorldId = 'world_parent';
      const parentWorld = createMockWorld({ worldId: parentWorldId });
      seedWorldMetadata(parentWorldId, parentWorld);

      const parentTeam = createMockTeam({
        teamCode: 'LAL',
        roster: ['lebron_james'],
        players: [
          createMockPlayer({
            playerId: 'lebron_james',
            displayName: 'LeBron James',
          }),
        ],
      });
      seedTeamSnapshot(parentWorldId, 'LAL', parentTeam, { padRoster: false });

      // Create child world without snapshot
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      // Get team from child world - should fall back to parent
      const team = await getTeam(childWorldId, 'LAL');
      const players = requireArray(
        team.players,
        'Expected parent fallback players'
      );

      expect(team.teamCode).toBe('LAL');
      expect(players.map((player) => player.playerId)).toEqual([
        'lebron_james',
      ]);
    });

    it('falls back to base when no snapshot', async () => {
      const worldId = 'world_123';
      const world = createMockWorld({ worldId });
      seedWorldMetadata(worldId, world);

      // No snapshot exists, should fall back to base
      const team = await getTeam(worldId, 'LAL');

      expect(team.teamCode).toBe('LAL');
      expect(team.teamName).toBe('Los Angeles Lakers');
    });

    it('recursive parent fallback chain (3 levels)', async () => {
      // Create grandparent with snapshot
      const grandparentWorldId = 'world_grandparent';
      const grandparentWorld = createMockWorld({ worldId: grandparentWorldId });
      seedWorldMetadata(grandparentWorldId, grandparentWorld);

      const grandparentTeam = createMockTeam({
        teamCode: 'LAL',
        roster: ['lebron_james'],
        players: [
          createMockPlayer({
            playerId: 'lebron_james',
            displayName: 'LeBron James',
          }),
        ],
      });
      seedTeamSnapshot(grandparentWorldId, 'LAL', grandparentTeam, {
        padRoster: false,
      });

      // Create parent world
      const parentWorldId = 'world_parent';
      const parentWorld = createMockWorld({
        worldId: parentWorldId,
        parentWorldId: grandparentWorldId,
      });
      seedWorldMetadata(parentWorldId, parentWorld);

      // Create child world
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      // Get team from child - should recursively fall back to grandparent
      const team = await getTeam(childWorldId, 'LAL');
      const players = requireArray(
        team.players,
        'Expected recursive parent fallback players'
      );

      expect(team.teamCode).toBe('LAL');
      expect(players.map((player) => player.playerId)).toEqual([
        'lebron_james',
      ]);
    });

    it('throws error when teamCode is missing', async () => {
      const missingTeamCode = null as unknown as string;

      await expect(getTeam('world_123', missingTeamCode)).rejects.toThrow(
        'teamCode is required'
      );
    });

    it('throws error when base team not found', async () => {
      await expect(getTeam(null, 'INVALID')).rejects.toThrow(
        'Base team INVALID not found'
      );
    });
  });

  describe('getLeague', () => {
    beforeEach(() => {
      // getLeague needs all 30 teams seeded
      seedBaseData('all');
    });

    it('returns all 30 teams in base mode', async () => {
      const teams = await getLeague(null);

      expect(teams.length).toBe(30);
      expect(teams.every((t) => t.teamCode)).toBe(true);
    });

    it('returns mix of snapshots and base teams', async () => {
      const worldId = 'world_123';
      const world = createMockWorld({ worldId });
      seedWorldMetadata(worldId, world);

      // Create snapshot for LAL only
      const modifiedTeam = createMockTeam({
        teamCode: 'LAL',
        roster: ['lebron_james'],
        players: [
          createMockPlayer({
            playerId: 'lebron_james',
            displayName: 'LeBron James',
          }),
        ],
      });
      seedTeamSnapshot(worldId, 'LAL', modifiedTeam, { padRoster: false });

      const teams = await getLeague(worldId);
      const lalTeam = findTeamByCode(
        teams,
        'LAL',
        'Expected LAL team in league'
      );
      const lalPlayers = requireArray(
        lalTeam.players,
        'Expected LAL league players'
      );
      const gswTeam = findTeamByCode(
        teams,
        'GSW',
        'Expected GSW team in league'
      );

      expect(teams.length).toBe(30);
      expect(lalPlayers.map((player) => player.playerId)).toEqual([
        'lebron_james',
      ]);
      // Other teams should come from base
      expect(gswTeam.teamCode).toBe('GSW');
    });

    it('handles parent world fallback for league view', async () => {
      // Create parent with snapshot
      const parentWorldId = 'world_parent';
      const parentWorld = createMockWorld({ worldId: parentWorldId });
      seedWorldMetadata(parentWorldId, parentWorld);

      const parentTeam = createMockTeam({
        teamCode: 'LAL',
        roster: ['lebron_james'],
        players: [
          createMockPlayer({
            playerId: 'lebron_james',
            displayName: 'LeBron James',
          }),
        ],
      });
      seedTeamSnapshot(parentWorldId, 'LAL', parentTeam, { padRoster: false });

      // Create child without snapshot
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      const teams = await getLeague(childWorldId);
      const lalTeam = findTeamByCode(
        teams,
        'LAL',
        'Expected parent fallback LAL team in league'
      );
      const lalPlayers = requireArray(
        lalTeam.players,
        'Expected parent fallback league players'
      );

      expect(teams.length).toBe(30);
      expect(lalPlayers.map((player) => player.playerId)).toEqual([
        'lebron_james',
      ]);
    });
  });

  describe('getPlayer', () => {
    it('returns base player when worldId is null', async () => {
      const player = await getPlayer(null, 'LAL', 'lebron_james');

      expect(player).toBeDefined();
      expect(player.playerId).toBe('lebron_james');
      expect(player.displayName).toBe('LeBron James');
      expect(player.contract).toBeDefined();
    });

    it('returns player with override when exists', async () => {
      const worldId = 'world_123';
      const world = createMockWorld({ worldId });
      seedWorldMetadata(worldId, world);

      // Create player override
      const playerOverride = {
        contract: {
          salariesByYear: [
            {
              season: '2025-26',
              salary: 60_000_000,
              capHit: 60_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      // Path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
      const overridePath = `architect_worlds/${worldId}/teams/LAL/players/lebron_james`;
      seedMockData(overridePath, playerOverride);

      const player = await getPlayer(worldId, 'LAL', 'lebron_james');
      const salary2526 = getSalaryBySeason(
        player,
        '2025-26',
        'Expected override salary row'
      );

      expect(player.playerId).toBe('lebron_james');
      expect(salary2526.salary).toBe(60_000_000);
    });

    it('falls back to parent world override', async () => {
      // Create parent with player override
      const parentWorldId = 'world_parent';
      const parentWorld = createMockWorld({ worldId: parentWorldId });
      seedWorldMetadata(parentWorldId, parentWorld);

      const playerOverride = {
        contract: {
          salariesByYear: [
            {
              season: '2025-26',
              salary: 55_000_000,
              capHit: 55_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      // Path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
      const overridePath = `architect_worlds/${parentWorldId}/teams/LAL/players/lebron_james`;
      seedMockData(overridePath, playerOverride);

      // Create child without override
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      const player = await getPlayer(childWorldId, 'LAL', 'lebron_james');
      const salary2526 = getSalaryBySeason(
        player,
        '2025-26',
        'Expected parent override salary row'
      );

      expect(player.playerId).toBe('lebron_james');
      expect(salary2526.salary).toBe(55_000_000);
    });

    it('throws error when teamCode is missing', async () => {
      const missingTeamCode = null as unknown as string;

      await expect(
        getPlayer('world_123', missingTeamCode, 'lebron_james')
      ).rejects.toThrow('teamCode and playerId are required');
    });

    it('throws error when playerId is missing', async () => {
      const missingPlayerId = null as unknown as string;

      await expect(
        getPlayer('world_123', 'LAL', missingPlayerId)
      ).rejects.toThrow('teamCode and playerId are required');
    });

    it('throws error when base player not found', async () => {
      await expect(
        getPlayer(null, 'LAL', 'nonexistent_player')
      ).rejects.toThrow('Base player nonexistent_player not found');
    });
  });

  describe('mergePlayerOverride', () => {
    it('merges contract changes correctly', () => {
      const basePlayer = createMockPlayer({
        playerId: 'test_player',
        displayName: 'Test Player',
      });

      const override = {
        contract: {
          contractType: 'Extension',
          totalValue: 100_000_000,
        },
      };

      const merged = mergePlayerOverride(basePlayer, override);
      const contract = requireValue(
        merged.contract,
        'Expected merged contract'
      );

      expect(merged.playerId).toBe('test_player');
      expect(contract.contractType).toBe('Extension');
      expect(contract.totalValue).toBe(100_000_000);
      // Base contract fields should still exist
      expect(contract.startSeason).toBeDefined();
    });

    it('merges salariesByYear array correctly', () => {
      const basePlayer = createMockPlayer({
        playerId: 'test_player',
      });

      const override = {
        contract: {
          salariesByYear: [
            {
              season: '2025-26',
              salary: 20_000_000,
              capHit: 20_000_000,
              guaranteed: true,
            },
            {
              season: '2026-27',
              salary: 25_000_000,
              capHit: 25_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const merged = mergePlayerOverride(basePlayer, override);
      const contract = requireValue(
        merged.contract,
        'Expected merged contract'
      );
      const salariesByYear = requireArray(
        contract.salariesByYear,
        'Expected merged salariesByYear rows'
      );

      expect(salariesByYear.length).toBe(2);
      expect(salariesByYear[0]?.salary).toBe(20_000_000);
      expect(salariesByYear[1]?.salary).toBe(25_000_000);
    });

    it('replaces, appends, and sorts salariesByYear entries by season', () => {
      const basePlayer = createMockPlayer({
        playerId: 'test_player',
      });

      const override = {
        contract: {
          salariesByYear: [
            {
              season: '2026-27',
              salary: 30_000_000,
              capHit: 30_000_000,
            },
            {
              season: '2024-25',
              salary: 8_000_000,
              capHit: 8_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const merged = mergePlayerOverride(basePlayer, override);
      const contract = requireValue(
        merged.contract,
        'Expected merged contract'
      );
      const salariesByYear = requireArray(
        contract.salariesByYear,
        'Expected merged salariesByYear rows'
      );
      const salary202627 = requireValue(
        salariesByYear.find((salary) => salary.season === '2026-27'),
        'Expected 2026-27 salary row'
      );
      const salary202526 = requireValue(
        salariesByYear.find((salary) => salary.season === '2025-26'),
        'Expected 2025-26 salary row'
      );

      expect(salariesByYear.map((salary) => salary.season)).toEqual([
        '2024-25',
        '2025-26',
        '2026-27',
      ]);
      expect(salary202627.salary).toBe(30_000_000);
      expect(salary202526.salary).toBe(10_000_000);
    });

    it('merges bio changes correctly', () => {
      const basePlayer = createMockPlayer({
        playerId: 'test_player',
      });

      const override = {
        bio: {
          position: 'PG',
          age: 30,
        },
      };

      const merged = mergePlayerOverride(basePlayer, override);
      const bio = requireValue(merged.bio, 'Expected merged bio');

      expect(bio.position).toBe('PG');
      expect(bio.age).toBe(30);
      // Other bio fields should still exist
      expect(bio.experience).toBeDefined();
    });

    it('returns base player when override is null', () => {
      const basePlayer = createMockPlayer({
        playerId: 'test_player',
      });

      const merged = mergePlayerOverride(basePlayer, null);

      expect(merged).toEqual(basePlayer);
    });

    it('handles empty override', () => {
      const basePlayer = createMockPlayer({
        playerId: 'test_player',
      });

      const merged = mergePlayerOverride(basePlayer, {});

      expect(merged.playerId).toBe('test_player');
      expect(merged.contract).toBeDefined();
    });
  });
});
