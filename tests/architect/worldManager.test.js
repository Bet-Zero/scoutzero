/**
 * World Manager Tests
 * 
 * Comprehensive unit tests for worldManager.js covering all CRUD operations,
 * branching, archiving, purging, and world statistics updates.
 * 
 * @file tests/architect/worldManager.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as firestore from 'firebase/firestore';
import {
  createWorld,
  getWorldMetadata,
  listUserWorlds,
  updateWorldMetadata,
  branchWorld,
  updateWorldStats,
  getDraftPositions,
  getDraftPositionsMap,
  saveDraftPositions,
  clearDraftPositions,
  fixWorldOwnership,
  archiveWorld,
  purgeWorld,
} from '@/features/architect/utils/worldManager';
import {
  seedWorldMetadata,
  getMockWorldMetadata,
  createMockWorld,
} from '../helpers/architectTestHelpers.js';
import {
  setMockCallable,
  clearMockCallables,
  resetMockDataStore,
} from '../__mocks__/firebase.js';

describe('World Manager', () => {
  const userId = 'user_123';
  const otherUserId = 'user_456';

  beforeEach(() => {
    // Reset is handled by setupFirebaseMocks
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

    it('falls back to in-memory filtering and sorting when the primary query fails', async () => {
      resetMockDataStore();
      seedWorldMetadata(
        'world_alpha',
        createMockWorld({
          worldId: 'world_alpha',
          userId,
          worldName: 'Alpha World',
        })
      );
      seedWorldMetadata(
        'world_archived',
        createMockWorld({
          worldId: 'world_archived',
          userId,
          worldName: 'Middle World',
          isArchived: true,
        })
      );
      seedWorldMetadata(
        'world_zulu',
        createMockWorld({
          worldId: 'world_zulu',
          userId,
          worldName: 'Zulu World',
        })
      );
      seedWorldMetadata(
        'world_other',
        createMockWorld({
          worldId: 'world_other',
          userId: otherUserId,
          worldName: 'Beta World',
        })
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(firestore, 'getDocs').mockRejectedValueOnce(
        new Error('missing index')
      );

      const worlds = await listUserWorlds(userId, {
        orderBy: 'worldName',
        orderDirection: 'asc',
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(worlds.map((world) => world.worldId)).toEqual([
        'world_alpha',
        'world_zulu',
      ]);
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

    it('increments renounce counters', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      await updateWorldStats(worldResult.worldId, 'renounce', ['LAL']);

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.stats.totalRenounces).toBe(1);
      expect(metadata.actionCount).toBe(1);
      expect(metadata.modifiedTeams).toContain('LAL');
      expect(metadata.stats.teamsInvolved).toBe(1);
    });

    it('leaves stat totals unchanged for unsupported action types', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      await updateWorldStats(worldResult.worldId, 'mystery-action', ['LAL']);

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.stats.totalTrades).toBe(0);
      expect(metadata.stats.totalSignings).toBe(0);
      expect(metadata.stats.totalWaives).toBe(0);
      expect(metadata.stats.totalRenounces).toBe(0);
      expect(metadata.actionCount).toBe(1);
      expect(metadata.modifiedTeams).toContain('LAL');
      expect(metadata.stats.teamsInvolved).toBe(1);
    });

    it('throws error when worldId is missing', async () => {
      await expect(updateWorldStats(null, 'trade', [])).rejects.toThrow('worldId is required');
    });
  });

  describe('draft positions helpers', () => {
    it('returns draft positions for a seeded year', async () => {
      const world = createMockWorld({
        userId,
        draftPositionsByYear: {
          2026: {
            positionsMap: { ATL: 1, BOS: 2 },
            method: 'manual',
            updatedAtIso: '2026-01-01T00:00:00.000Z',
          },
        },
      });
      seedWorldMetadata(world.worldId, world);

      const draftPositions = await getDraftPositions(world.worldId, 2026);

      expect(draftPositions).toEqual({
        positionsMap: { ATL: 1, BOS: 2 },
        method: 'manual',
        updatedAtIso: '2026-01-01T00:00:00.000Z',
      });
    });

    it('returns positionsMap convenience data for a seeded year', async () => {
      const world = createMockWorld({
        userId,
        draftPositionsByYear: {
          2027: {
            positionsMap: { LAL: 12, PHI: 18 },
            method: 'manual',
            updatedAtIso: '2027-01-01T00:00:00.000Z',
          },
        },
      });
      seedWorldMetadata(world.worldId, world);

      const draftPositionsMap = await getDraftPositionsMap(world.worldId, 2027);

      expect(draftPositionsMap).toEqual({ LAL: 12, PHI: 18 });
    });

    it('returns null when draft positions are missing', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      await expect(getDraftPositions(world.worldId, 2028)).resolves.toBeNull();
      await expect(getDraftPositionsMap(world.worldId, 2028)).resolves.toBeNull();
    });

    it('preserves the exact updateDoc payload shape when saving draft positions', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      const updateDocSpy = vi.spyOn(firestore, 'updateDoc');
      const positionsMap = { ATL: 1, BOS: 2 };

      const result = await saveDraftPositions(world.worldId, 2026, positionsMap, {
        method: 'manual',
      });

      expect(result).toEqual({ success: true });
      expect(updateDocSpy).toHaveBeenCalledTimes(1);

      const [metadataRef, payload] = updateDocSpy.mock.calls[0];
      expect(metadataRef.path).toBe(`architect_worlds/${world.worldId}`);
      expect(Object.keys(payload)).toEqual([
        'draftPositionsByYear.2026',
        'lastModifiedAt',
      ]);
      expect(payload['draftPositionsByYear.2026']).toEqual({
        positionsMap,
        method: 'manual',
        updatedAtIso: expect.any(String),
      });
      expect(payload.lastModifiedAt).toEqual({
        __type: 'serverTimestamp',
        value: '2025-01-01T00:00:00.000Z',
      });
    });

    it('preserves the exact updateDoc payload shape when clearing draft positions', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      const updateDocSpy = vi.spyOn(firestore, 'updateDoc');

      const result = await clearDraftPositions(world.worldId, 2026);

      expect(result).toEqual({ success: true });
      expect(updateDocSpy).toHaveBeenCalledTimes(1);

      const [metadataRef, payload] = updateDocSpy.mock.calls[0];
      expect(metadataRef.path).toBe(`architect_worlds/${world.worldId}`);
      expect(Object.keys(payload)).toEqual([
        'draftPositionsByYear.2026',
        'lastModifiedAt',
      ]);
      expect(payload['draftPositionsByYear.2026']).toBeNull();
      expect(payload.lastModifiedAt).toEqual({
        __type: 'serverTimestamp',
        value: '2025-01-01T00:00:00.000Z',
      });
    });
  });

  describe('archiveWorld', () => {
    it('sets isArchived to true', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      await archiveWorld(worldResult.worldId, userId);

      const metadata = getMockWorldMetadata(worldResult.worldId);
      expect(metadata.isArchived).toBe(true);
    });

    it('hides world from listUserWorlds by default', async () => {
      const worldResult = await createWorld({
        name: 'Test World',
        userId,
      });

      // Before archive - world should be visible
      let worlds = await listUserWorlds(userId);
      expect(worlds.some(w => w.worldId === worldResult.worldId)).toBe(true);

      // Archive the world
      await archiveWorld(worldResult.worldId, userId);

      // After archive - world should be hidden from default list
      worlds = await listUserWorlds(userId);
      expect(worlds.some(w => w.worldId === worldResult.worldId)).toBe(false);

      // But visible with includeArchived option
      worlds = await listUserWorlds(userId, { includeArchived: true });
      expect(worlds.some(w => w.worldId === worldResult.worldId)).toBe(true);
    });

    it('throws error if user doesn\'t own world', async () => {
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      await expect(archiveWorld(world.worldId, otherUserId)).rejects.toThrow(
        'User does not have permission to archive this world'
      );
    });

    it('throws error when worldId is missing', async () => {
      await expect(archiveWorld(null, userId)).rejects.toThrow('worldId is required');
    });

    it('throws error when userId is missing', async () => {
      await expect(archiveWorld('world_123', null)).rejects.toThrow('userId is required');
    });
  });

  describe('purgeWorld', () => {
    beforeEach(() => {
      clearMockCallables();
    });

    it('calls purgeArchitectWorld callable function', async () => {
      let calledWith = null;
      setMockCallable('purgeArchitectWorld', (data) => {
        calledWith = data;
        return {
          ok: true,
          message: 'World deleted successfully',
          details: { teamsDeleted: 0, playersDeleted: 0, worldDeleted: true },
        };
      });

      const result = await purgeWorld('test_world_id');

      expect(calledWith).toEqual({ worldId: 'test_world_id' });
      expect(result.ok).toBe(true);
    });

    it('returns result from Cloud Function', async () => {
      setMockCallable('purgeArchitectWorld', () => ({
        ok: true,
        message: 'World "Test" permanently deleted',
        details: { teamsDeleted: 5, playersDeleted: 12, worldDeleted: true },
      }));

      const result = await purgeWorld('test_world_id');

      expect(result.ok).toBe(true);
      expect(result.details.teamsDeleted).toBe(5);
      expect(result.details.playersDeleted).toBe(12);
    });

    it('handles queued response for large worlds', async () => {
      setMockCallable('purgeArchitectWorld', () => ({
        ok: false,
        queued: true,
        message: 'Deletion in progress',
        details: { teamsDeleted: 10, playersDeleted: 50, worldDeleted: false },
      }));

      const result = await purgeWorld('large_world_id');

      expect(result.ok).toBe(false);
      expect(result.queued).toBe(true);
    });

    it('throws error when worldId is missing', async () => {
      await expect(purgeWorld(null)).rejects.toThrow('worldId is required');
    });

    it('throws user-friendly error for permission denied', async () => {
      setMockCallable('purgeArchitectWorld', () => {
        const error = new Error('Permission denied');
        error.code = 'functions/permission-denied';
        throw error;
      });

      await expect(purgeWorld('other_user_world')).rejects.toThrow(
        'You do not have permission to delete this world'
      );
    });

    it('throws user-friendly error for unauthenticated users', async () => {
      setMockCallable('purgeArchitectWorld', () => {
        const error = new Error('Unauthenticated');
        error.code = 'functions/unauthenticated';
        throw error;
      });

      await expect(purgeWorld('auth_world')).rejects.toThrow(
        'You must be logged in to delete worlds'
      );
    });

    it('throws user-friendly error when the world does not exist', async () => {
      setMockCallable('purgeArchitectWorld', () => {
        const error = new Error('World missing');
        error.code = 'functions/not-found';
        throw error;
      });

      await expect(purgeWorld('missing_world')).rejects.toThrow(
        'World missing_world not found'
      );
    });

    it('preserves failed-precondition message text', async () => {
      setMockCallable('purgeArchitectWorld', () => {
        const error = new Error('Cannot delete world with child branches');
        error.code = 'functions/failed-precondition';
        throw error;
      });

      await expect(purgeWorld('branch_world')).rejects.toThrow(
        'Cannot delete world with child branches'
      );
    });

    it('falls back to the generic delete failure message when no message is provided', async () => {
      setMockCallable('purgeArchitectWorld', () => {
        const error = new Error('placeholder');
        error.message = '';
        throw error;
      });

      await expect(purgeWorld('broken_world')).rejects.toThrow(
        'Failed to delete world'
      );
    });
  });

  describe('fixWorldOwnership', () => {
    it('updates createdBy in development mode', async () => {
      vi.stubEnv('PROD', false);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const world = createMockWorld({ userId });
      seedWorldMetadata(world.worldId, world);

      await fixWorldOwnership(world.worldId, 'new_owner');

      const updated = getMockWorldMetadata(world.worldId);
      expect(updated.createdBy).toBe('new_owner');
      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('throws when required inputs are missing', async () => {
      vi.stubEnv('PROD', false);

      await expect(fixWorldOwnership(null, 'new_owner')).rejects.toThrow(
        'worldId and newUserId are required'
      );
      await expect(fixWorldOwnership('world_123', null)).rejects.toThrow(
        'worldId and newUserId are required'
      );
    });

    it('is unavailable in production mode', async () => {
      vi.stubEnv('PROD', true);

      await expect(fixWorldOwnership('world_123', 'new_owner')).rejects.toThrow(
        'fixWorldOwnership is only available in development'
      );
    });
  });
});
