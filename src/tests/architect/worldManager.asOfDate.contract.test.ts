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

const worldManagerMocks = vi.hoisted(() => {
  const transaction = { get: vi.fn(), update: vi.fn() };
  return {
    updateDoc: vi.fn(async () => undefined),
    transaction,
    runTransaction: vi.fn(async (_db, action) => action(transaction)),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    worldMetadataRef: vi.fn((worldId: string) => ({ path: `architect_worlds/${worldId}` })),
  };
});

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
  runTransaction: worldManagerMocks.runTransaction,
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
  const setPersistedWorld = (metadata: Record<string, unknown>) => {
    worldManagerMocks.transaction.get.mockResolvedValue({
      exists: () => true,
      data: () => metadata,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setPersistedWorld({ asOfDate: '2026-07-14' });
    worldManagerMocks.serverTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    worldManagerMocks.worldMetadataRef.mockImplementation((worldId: string) => ({
      path: `architect_worlds/${worldId}`,
    }));
  });

  it('routes valid as-of writes through the dedicated persistence helper', async () => {
    await updateWorldAsOfDate('world_1', '2026-07-15');

    expect(worldManagerMocks.worldMetadataRef).toHaveBeenCalledWith('world_1');
    expect(worldManagerMocks.transaction.update).toHaveBeenCalledWith(
      { path: 'architect_worlds/world_1' },
      {
        asOfDate: '2026-07-15',
        lastModifiedAt: 'SERVER_TIMESTAMP',
      }
    );
  });

  it.each(['2026-7-15', '2026-11-31'])('rejects invalid date %s before touching Firestore', async (input) => {
    await expect(
      updateWorldAsOfDate('world_1', input)
    ).rejects.toThrow('asOfDate must be a YYYY-MM-DD string');

    expect(worldManagerMocks.runTransaction).not.toHaveBeenCalled();
  });

  describe('current-season simulation', () => {
    beforeEach(() => {
      setPersistedWorld({
        asOfDate: '2026-11-14',
        currentSeason: '2026-27',
        simulationFinancialBaseline: { classification: 'SIMULATION' },
      });
    });

    it('accepts a forward move in the saved Salary Cap Year', async () => {
      await updateWorldAsOfDate('world_1', '2026-11-15');
      expect(worldManagerMocks.transaction.update).toHaveBeenCalledWith(
        { path: 'architect_worlds/world_1' },
        { asOfDate: '2026-11-15', lastModifiedAt: 'SERVER_TIMESTAMP' }
      );
    });

    it.each([
      ['2026-11-13', /cannot move backward/],
      ['2026-06-30', /season transition/],
      ['2027-07-01', /season transition/],
    ] as const)('leaves the saved world unchanged when %s is rejected', async (date, message) => {
      await expect(updateWorldAsOfDate('world_1', date)).rejects.toThrow(message);
      expect(worldManagerMocks.transaction.update).not.toHaveBeenCalled();
    });

    it('keeps a repeated date update idempotent', async () => {
      await updateWorldAsOfDate('world_1', '2026-11-14');
      expect(worldManagerMocks.transaction.update).not.toHaveBeenCalled();
    });
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
