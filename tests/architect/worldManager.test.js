/**
 * World Manager Tests
 * 
 * Comprehensive unit tests for worldManager.js covering all CRUD operations,
 * branching, and world statistics updates.
 * 
 * @file tests/architect/worldManager.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorld,
  getWorldMetadata,
  listUserWorlds,
  updateWorldMetadata,
  deleteWorld,
  branchWorld,
  updateWorldStats,
} from '@/features/architect/utils/worldManager';
import {
  seedWorldMetadata,
  getMockWorldMetadata,
  createMockWorld,
} from '../helpers/architectTestHelpers.js';

describe('World Manager', () => {
  const userId = 'user_123';
  const otherUserId = 'user_456';

  beforeEach(() => {
    // Reset is handled by setupFirebaseMocks
  });

  describe('createWorld', () => {
    it('creates world with correct metadata structure', async () => {
      const result = await createWorld({
        name: 'Test World',
        description: 'A test world',
        userId,
      });

      expect(result.worldId).toBeDefined();
      expect(result.worldId).toMatch(/^world_\d+_[a-z0-9]+$/);
      expect(result.metadata.worldName).toBe('Test World');
      expect(result.metadata.description).toBe('A test world');
      expect(result.metadata.createdBy).toBe(userId);
      expect(result.metadata.currentSeason).toBeDefined();
      expect(result.metadata.baselineSeason).toBe(result.metadata.currentSeason);
      expect(result.metadata.parentWorldId).toBeNull();
      expect(result.metadata.childWorlds).toEqual([]);
      expect(result.metadata.modifiedTeams).toEqual([]);
      expect(result.metadata.actionCount).toBe(0);
      expect(result.metadata.stats.totalTrades).toBe(0);
      expect(result.metadata.stats.totalSignings).toBe(0);
      expect(result.metadata.stats.totalWaives).toBe(0);

      // Verify world was saved to Firestore
      const saved = getMockWorldMetadata(result.worldId);
      expect(saved).toBeDefined();
      expect(saved.worldName).toBe('Test World');
    });

    it('handles branching (parentWorldId, childWorlds update)', async () => {
      // Create parent world
      const parentResult = await createWorld({
        name: 'Parent World',
        userId,
      });

      // Create child world
      const childResult = await createWorld({
        name: 'Child World',
        parentWorldId: parentResult.worldId,
        userId,
      });

      expect(childResult.metadata.parentWorldId).toBe(parentResult.worldId);
      expect(childResult.metadata.branchedFrom).toBeDefined();

      // Verify parent's childWorlds was updated
      const parentMetadata = getMockWorldMetadata(parentResult.worldId);
      expect(parentMetadata.childWorlds).toContain(childResult.worldId);
    });

    it('throws error when userId is missing', async () => {
      await expect(
        createWorld({
          name: 'Test World',
        })
      ).rejects.toThrow('userId is required');
    });

    it('throws error when name is missing', async () => {
      await expect(
        createWorld({
          userId,
        })
      ).rejects.toThrow('World name is required');
    });

    it('uses provided currentSeason', async () => {
      const result = await createWorld({
        name: 'Test World',
        userId,
        currentSeason: '2026-27',
      });

      expect(result.metadata.currentSeason).toBe('2026-27');
      expect(result.metadata.baselineSeason).toBe('2026-27');
    });
  });

  describe('getWorldMetadata', () => {
    it('returns world metadata', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      const metadata = await getWorldMetadata(world.worldId);

      expect(metadata.worldId).toBe(world.worldId);
      expect(metadata.worldName).toBe(world.worldName);
      expect(metadata.createdBy).toBe(userId);
    });

    it('throws error for non-existent world', async () => {
      await expect(getWorldMetadata('nonexistent_world')).rejects.toThrow(
        'World nonexistent_world not found'
      );
    });

    it('throws error when worldId is missing', async () => {
      await expect(getWorldMetadata(null)).rejects.toThrow('worldId is required');
    });
  });

  describe('listUserWorlds', () => {
    beforeEach(() => {
      // Seed multiple worlds for different users
      seedWorldMetadata('world_1', createMockWorld({ worldId: 'world_1', userId }));
      seedWorldMetadata('world_2', createMockWorld({ worldId: 'world_2', userId }));
      seedWorldMetadata('world_3', createMockWorld({ worldId: 'world_3', userId: otherUserId }));
      seedWorldMetadata(
        'world_4',
        createMockWorld({ worldId: 'world_4', userId, isArchived: true })
      );
    });

    it('returns only user\'s worlds', async () => {
      const worlds = await listUserWorlds(userId);

      expect(worlds.length).toBeGreaterThanOrEqual(2);
      worlds.forEach((world) => {
        expect(world.createdBy).toBe(userId);
      });
    });

    it('filters archived worlds by default', async () => {
      const worlds = await listUserWorlds(userId);

      const archivedWorlds = worlds.filter((w) => w.isArchived);
      expect(archivedWorlds.length).toBe(0);
    });

    it('includes archived worlds when requested', async () => {
      const worlds = await listUserWorlds(userId, { includeArchived: true });

      const archivedWorlds = worlds.filter((w) => w.isArchived);
      expect(archivedWorlds.length).toBeGreaterThan(0);
    });

    it('sorts by lastModifiedAt by default', async () => {
      const worlds = await listUserWorlds(userId);

      // Check that worlds are sorted (most recent first)
      for (let i = 0; i < worlds.length - 1; i++) {
        const current = new Date(worlds[i].lastModifiedAt || worlds[i].createdAt);
        const next = new Date(worlds[i + 1].lastModifiedAt || worlds[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('sorts by custom field and direction', async () => {
      const worlds = await listUserWorlds(userId, {
        orderBy: 'worldName',
        orderDirection: 'asc',
      });

      for (let i = 0; i < worlds.length - 1; i++) {
        expect(worlds[i].worldName <= worlds[i + 1].worldName).toBe(true);
      }
    });

    it('throws error when userId is missing', async () => {
      await expect(listUserWorlds(null)).rejects.toThrow('userId is required');
    });
  });

  describe('updateWorldMetadata', () => {
    it('updates allowed fields only', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      await updateWorldMetadata(world.worldId, {
        worldName: 'Updated Name',
        description: 'Updated description',
        tags: ['tag1', 'tag2'],
        isFavorite: true,
        isArchived: false,
        // These should be ignored
        worldId: 'hacked_id',
        createdBy: 'hacked_user',
      });

      const updated = getMockWorldMetadata(world.worldId);
      expect(updated.worldName).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.tags).toEqual(['tag1', 'tag2']);
      expect(updated.isFavorite).toBe(true);
      expect(updated.isArchived).toBe(false);
      // Verify ignored fields weren't changed
      expect(updated.worldId).toBe(world.worldId);
      expect(updated.createdBy).toBe(userId);
    });

    it('updates lastModifiedAt automatically', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await updateWorldMetadata(world.worldId, {
        worldName: 'Updated',
      });

      const updated = getMockWorldMetadata(world.worldId);
      expect(updated.lastModifiedAt).toBeDefined();
      // In mock, timestamps are processed, so we just check it exists
    });

    it('does nothing when no valid updates provided', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);
      const original = getMockWorldMetadata(world.worldId);

      await updateWorldMetadata(world.worldId, {
        invalidField: 'should be ignored',
      });

      const updated = getMockWorldMetadata(world.worldId);
      expect(updated.worldName).toBe(original.worldName);
    });

    it('throws error when worldId is missing', async () => {
      await expect(updateWorldMetadata(null, { worldName: 'Test' })).rejects.toThrow(
        'worldId is required'
      );
    });
  });

  describe('deleteWorld', () => {
    it('deletes world and removes from parent\'s childWorlds', async () => {
      // Create parent and child
      const parentResult = await createWorld({
        name: 'Parent',
        userId,
      });

      const childResult = await createWorld({
        name: 'Child',
        parentWorldId: parentResult.worldId,
        userId,
      });

      // Verify child is in parent's childWorlds
      let parentMetadata = getMockWorldMetadata(parentResult.worldId);
      expect(parentMetadata.childWorlds).toContain(childResult.worldId);

      // Delete child
      await deleteWorld(childResult.worldId, userId);

      // Verify child is removed from parent
      parentMetadata = getMockWorldMetadata(parentResult.worldId);
      expect(parentMetadata.childWorlds).not.toContain(childResult.worldId);

      // Verify child metadata is deleted
      await expect(getWorldMetadata(childResult.worldId)).rejects.toThrow();
    });

    it('throws error if user doesn\'t own world', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      await expect(deleteWorld(world.worldId, otherUserId)).rejects.toThrow(
        'User does not have permission to delete this world'
      );
    });

    it('throws error when worldId is missing', async () => {
      await expect(deleteWorld(null, userId)).rejects.toThrow('worldId is required');
    });

    it('throws error when userId is missing', async () => {
      await expect(deleteWorld('world_123', null)).rejects.toThrow('userId is required');
    });
  });

  describe('branchWorld', () => {
    it('creates branch with parent relationship', async () => {
      const parentResult = await createWorld({
        name: 'Parent',
        userId,
      });

      const branchResult = await branchWorld(
        parentResult.worldId,
        'Branch',
        'Branch description',
        userId
      );

      expect(branchResult.metadata.parentWorldId).toBe(parentResult.worldId);
      expect(branchResult.metadata.worldName).toBe('Branch');
      expect(branchResult.metadata.description).toBe('Branch description');
      expect(branchResult.metadata.branchedFrom).toBeDefined();

      // Verify parent's childWorlds was updated
      const parentMetadata = getMockWorldMetadata(parentResult.worldId);
      expect(parentMetadata.childWorlds).toContain(branchResult.worldId);
    });

    it('inherits season from parent', async () => {
      const parentResult = await createWorld({
        name: 'Parent',
        userId,
        currentSeason: '2026-27',
      });

      const branchResult = await branchWorld(
        parentResult.worldId,
        'Branch',
        '',
        userId
      );

      expect(branchResult.metadata.currentSeason).toBe('2026-27');
      expect(branchResult.metadata.baselineSeason).toBe('2026-27');
    });

    it('throws error when parentWorldId is missing', async () => {
      await expect(branchWorld(null, 'Branch', '', userId)).rejects.toThrow(
        'parentWorldId is required'
      );
    });

    it('throws error when name is missing', async () => {
      const parentResult = await createWorld({
        name: 'Parent',
        userId,
      });

      await expect(branchWorld(parentResult.worldId, '', '', userId)).rejects.toThrow(
        'Branch name is required'
      );
    });
  });

  describe('updateWorldStats', () => {
    it('increments action counters', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      // Update stats for trade
      await updateWorldStats(worldResult.worldId, 'trade', ['LAL', 'GSW']);

      let metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.stats.totalTrades).toBe(1);
      expect(metadata.actionCount).toBe(1);
      expect(metadata.modifiedTeams).toContain('LAL');
      expect(metadata.modifiedTeams).toContain('GSW');
      expect(metadata.stats.teamsInvolved).toBe(2);

      // Update stats for signing
      await updateWorldStats(worldResult.worldId, 'signing', ['BOS']);

      metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.stats.totalSignings).toBe(1);
      expect(metadata.stats.totalTrades).toBe(1); // Should still be 1
      expect(metadata.actionCount).toBe(2);
      expect(metadata.modifiedTeams).toContain('BOS');
      expect(metadata.stats.teamsInvolved).toBe(3);

      // Update stats for waive
      await updateWorldStats(worldResult.worldId, 'waive', ['LAL']);

      metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.stats.totalWaives).toBe(1);
      expect(metadata.actionCount).toBe(3);
    });

    it('tracks modified teams', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      await updateWorldStats(worldResult.worldId, 'trade', ['LAL', 'GSW']);
      await updateWorldStats(worldResult.worldId, 'signing', ['BOS', 'LAL']);

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.modifiedTeams).toContain('LAL');
      expect(metadata.modifiedTeams).toContain('GSW');
      expect(metadata.modifiedTeams).toContain('BOS');
      expect(metadata.stats.teamsInvolved).toBe(3); // Unique teams
    });

    it('updates lastModifiedAt', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      await updateWorldStats(worldResult.worldId, 'trade', []);

      const updated = getMockWorldMetadata(worldResult.worldId);
      expect(updated.lastModifiedAt).toBeDefined();
    });

    it('throws error when worldId is missing', async () => {
      await expect(updateWorldStats(null, 'trade', [])).rejects.toThrow('worldId is required');
    });
  });
});

