/**
 * Team Loader Tests
 * 
 * Comprehensive unit tests for teamLoader.js covering fallback chain,
 * getLeague, getPlayer, mergePlayerOverride, and recursive parent fallback scenarios.
 * 
 * @file tests/architect/teamLoader.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTeam, getLeague, getPlayer, mergePlayerOverride } from '@/features/architect/utils/teamLoader';
import {
  seedBaseData,
  seedWorldMetadata,
  seedTeamSnapshot,
  createMockWorld,
  createMockTeam,
  createMockPlayer,
} from '../helpers/architectTestHelpers.js';
import { getMockData } from '../__mocks__/firebase.js';

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

      const modifiedTeam = createMockTeam({
        teamCode: 'LAL',
        season: '2025-26',
        roster: ['lebron_james', 'anthony_davis'],
      });
      seedTeamSnapshot(worldId, 'LAL', modifiedTeam);

      const team = await getTeam(worldId, 'LAL');

      expect(team.teamCode).toBe('LAL');
      expect(team.roster).toEqual(['lebron_james', 'anthony_davis']);
    });

    it('falls back to parent world snapshot', async () => {
      // Create parent world with snapshot
      const parentWorldId = 'world_parent';
      const parentWorld = createMockWorld({ worldId: parentWorldId });
      seedWorldMetadata(parentWorldId, parentWorld);

      const parentTeam = createMockTeam({
        teamCode: 'LAL',
        roster: ['lebron_james'],
      });
      seedTeamSnapshot(parentWorldId, 'LAL', parentTeam);

      // Create child world without snapshot
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      // Get team from child world - should fall back to parent
      const team = await getTeam(childWorldId, 'LAL');

      expect(team.teamCode).toBe('LAL');
      expect(team.roster).toEqual(['lebron_james']);
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
      });
      seedTeamSnapshot(grandparentWorldId, 'LAL', grandparentTeam);

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

      expect(team.teamCode).toBe('LAL');
      expect(team.roster).toEqual(['lebron_james']);
    });

    it('throws error when teamCode is missing', async () => {
      await expect(getTeam('world_123', null)).rejects.toThrow('teamCode is required');
    });

    it('throws error when base team not found', async () => {
      await expect(getTeam(null, 'INVALID')).rejects.toThrow('Base team INVALID not found');
    });
  });

  describe('getLeague', () => {
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
      });
      seedTeamSnapshot(worldId, 'LAL', modifiedTeam);

      const teams = await getLeague(worldId);

      expect(teams.length).toBe(30);
      const lalTeam = teams.find((t) => t.teamCode === 'LAL');
      expect(lalTeam.roster).toEqual(['lebron_james']);
      // Other teams should come from base
      const gswTeam = teams.find((t) => t.teamCode === 'GSW');
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
      });
      seedTeamSnapshot(parentWorldId, 'LAL', parentTeam);

      // Create child without snapshot
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      const teams = await getLeague(childWorldId);

      expect(teams.length).toBe(30);
      const lalTeam = teams.find((t) => t.teamCode === 'LAL');
      expect(lalTeam.roster).toEqual(['lebron_james']);
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

      const overridePath = `architect/worlds/${worldId}/snapshot/teams/LAL/players/lebron_james`;
      const { seedMockData } = await import('../setupFirebaseMocks.js');
      seedMockData(overridePath, playerOverride);

      const player = await getPlayer(worldId, 'LAL', 'lebron_james');

      expect(player.playerId).toBe('lebron_james');
      // Override should merge with base
      expect(player.contract.salariesByYear[0].salary).toBe(60_000_000);
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

      const overridePath = `architect/worlds/${parentWorldId}/snapshot/teams/LAL/players/lebron_james`;
      const { seedMockData } = await import('../setupFirebaseMocks.js');
      seedMockData(overridePath, playerOverride);

      // Create child without override
      const childWorldId = 'world_child';
      const childWorld = createMockWorld({
        worldId: childWorldId,
        parentWorldId: parentWorldId,
      });
      seedWorldMetadata(childWorldId, childWorld);

      const player = await getPlayer(childWorldId, 'LAL', 'lebron_james');

      expect(player.playerId).toBe('lebron_james');
      expect(player.contract.salariesByYear[0].salary).toBe(55_000_000);
    });

    it('throws error when teamCode is missing', async () => {
      await expect(getPlayer('world_123', null, 'lebron_james')).rejects.toThrow(
        'teamCode and playerId are required'
      );
    });

    it('throws error when playerId is missing', async () => {
      await expect(getPlayer('world_123', 'LAL', null)).rejects.toThrow(
        'teamCode and playerId are required'
      );
    });

    it('throws error when base player not found', async () => {
      await expect(getPlayer(null, 'LAL', 'nonexistent_player')).rejects.toThrow(
        'Base player nonexistent_player not found'
      );
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

      expect(merged.playerId).toBe('test_player');
      expect(merged.contract.contractType).toBe('Extension');
      expect(merged.contract.totalValue).toBe(100_000_000);
      // Base contract fields should still exist
      expect(merged.contract.startSeason).toBeDefined();
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

      expect(merged.contract.salariesByYear.length).toBe(2);
      expect(merged.contract.salariesByYear[0].salary).toBe(20_000_000);
      expect(merged.contract.salariesByYear[1].salary).toBe(25_000_000);
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

      expect(merged.bio.position).toBe('PG');
      expect(merged.bio.age).toBe(30);
      // Other bio fields should still exist
      expect(merged.bio.experience).toBeDefined();
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

