import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadWorldTeamFreeAgentPool,
  resetWorldTeamFreeAgentPool,
  saveWorldTeamFreeAgentPool,
} from '@/features/architect/freeAgency/freeAgentPoolPersistence';

const persistenceMocks = vi.hoisted(() => ({
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  worldTeamFreeAgentPoolRef: vi.fn(
    (worldId: string, teamCode: string, seasonKey: string) =>
      `architect_worlds/${worldId}/teams/${teamCode}/freeAgentPools/${seasonKey}`
  ),
}));

vi.mock('firebase/firestore', () => ({
  deleteDoc: persistenceMocks.deleteDoc,
  getDoc: persistenceMocks.getDoc,
  setDoc: persistenceMocks.setDoc,
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldTeamFreeAgentPoolRef: persistenceMocks.worldTeamFreeAgentPoolRef,
}));

describe('freeAgentPoolPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a normalized pool snapshot under world/team/season scope', async () => {
    const snapshot = await saveWorldTeamFreeAgentPool({
      worldId: 'world_1',
      teamCode: 'LAL',
      seasonKey: '2025-26',
      selectionKeys: ['player_1', 'player_1', '', ' player_2 '],
    });

    expect(snapshot.selectionKeys).toEqual(['player_1', 'player_2']);
    expect(persistenceMocks.setDoc).toHaveBeenCalledWith(
      'architect_worlds/world_1/teams/LAL/freeAgentPools/2025-26',
      expect.objectContaining({
        schemaVersion: 1,
        source: 'architect-free-agent-pool-management',
        worldId: 'world_1',
        teamCode: 'LAL',
        seasonKey: '2025-26',
        selectionKeys: ['player_1', 'player_2'],
        updatedAt: '2026-06-13T00:00:00.000Z',
      })
    );
  });

  it('loads and normalizes a saved pool snapshot', async () => {
    persistenceMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        selectionKeys: ['player_1', '', 'player_1', 'player_3'],
        updatedAt: '2026-06-12T20:00:00.000Z',
      }),
    });

    const snapshot = await loadWorldTeamFreeAgentPool({
      worldId: 'world_1',
      teamCode: 'LAL',
      seasonKey: '2025-26',
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        worldId: 'world_1',
        teamCode: 'LAL',
        seasonKey: '2025-26',
        selectionKeys: ['player_1', 'player_3'],
        updatedAt: '2026-06-12T20:00:00.000Z',
      })
    );
  });

  it('returns null when no saved pool exists and can reset the scoped document', async () => {
    persistenceMocks.getDoc.mockResolvedValue({ exists: () => false });

    await expect(
      loadWorldTeamFreeAgentPool({
        worldId: 'world_1',
        teamCode: 'LAL',
        seasonKey: '2025-26',
      })
    ).resolves.toBeNull();

    await resetWorldTeamFreeAgentPool({
      worldId: 'world_1',
      teamCode: 'LAL',
      seasonKey: '2025-26',
    });

    expect(persistenceMocks.deleteDoc).toHaveBeenCalledWith(
      'architect_worlds/world_1/teams/LAL/freeAgentPools/2025-26'
    );
  });
});
