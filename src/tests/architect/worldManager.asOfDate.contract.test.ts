/**
 * FILE: src/tests/architect/worldManager.asOfDate.contract.test.ts
 * PURPOSE: Focused contract coverage for explicit world as-of persistence writes.
 * OWNERSHIP: Feature: architect/world-time
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  updateWorldAsOfDate,
  updateWorldMetadata,
} from '@/features/architect/utils/worldManager';

const worldManagerMocks = vi.hoisted(() => ({
  updateDoc: vi.fn(async () => undefined),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  worldMetadataRef: vi.fn((worldId: string) => ({ path: `architect_worlds/${worldId}` })),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(),
  updateDoc: worldManagerMocks.updateDoc,
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: worldManagerMocks.serverTimestamp,
  writeBatch: vi.fn(),
  arrayUnion: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldMetadataRef: worldManagerMocks.worldMetadataRef,
  worldsCol: vi.fn(),
}));

describe('worldManager as-of persistence contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldManagerMocks.serverTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    worldManagerMocks.worldMetadataRef.mockImplementation((worldId: string) => ({
      path: `architect_worlds/${worldId}`,
    }));
  });

  it('routes valid as-of writes through the dedicated persistence helper', async () => {
    await updateWorldAsOfDate('world_1', '2026-07-15');

    expect(worldManagerMocks.worldMetadataRef).toHaveBeenCalledWith('world_1');
    expect(worldManagerMocks.updateDoc).toHaveBeenCalledWith(
      { path: 'architect_worlds/world_1' },
      {
        asOfDate: '2026-07-15',
        lastModifiedAt: 'SERVER_TIMESTAMP',
      }
    );
  });

  it('rejects malformed as-of writes before touching Firestore', async () => {
    await expect(
      updateWorldAsOfDate('world_1', '2026-7-15')
    ).rejects.toThrow('asOfDate must be a YYYY-MM-DD string');

    expect(worldManagerMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('blocks asOfDate on the generic metadata helper', async () => {
    await expect(
      updateWorldMetadata('world_1', {
        asOfDate: '2026-07-15',
      } as unknown as Record<string, unknown>)
    ).rejects.toThrow('Use updateWorldAsOfDate(...) for world date writes');

    expect(worldManagerMocks.updateDoc).not.toHaveBeenCalled();
  });

  it('keeps generic metadata writes working for non-date fields', async () => {
    await updateWorldMetadata('world_1', {
      description: 'Updated description',
    });

    expect(worldManagerMocks.updateDoc).toHaveBeenCalledWith(
      { path: 'architect_worlds/world_1' },
      {
        description: 'Updated description',
        lastModifiedAt: 'SERVER_TIMESTAMP',
      }
    );
  });
});
