import { beforeEach, describe, expect, it } from 'vitest';
import {
  addPlayerToList,
  createListWithPlayer,
  createTierList,
  deleteList,
  deleteTierList,
  fetchAllLists,
  fetchAllTierLists,
  fetchList,
  fetchTierList,
  renameList,
  renameTierList,
  saveList,
  saveTierList,
} from '@/firebase/listHelpers';
import {
  getMockData,
  resetMockDataStore,
  seedMockData,
} from './__mocks__/firebase.js';

describe('listHelpers', () => {
  beforeEach(() => {
    resetMockDataStore();
  });

  it('round-trips owned player lists through create, read, update, rename, auto-claim, and delete', async () => {
    const listId = await createListWithPlayer('Draft Board', 'p1', 'user-1');
    const createdPath = `lists/${listId}`;

    expect(getMockData(createdPath)).toMatchObject({
      name: 'Draft Board',
      playerIds: ['p1'],
      playerOrder: ['p1'],
      playerNotes: {},
      description: '',
      ownerUid: 'user-1',
    });

    const allLists = await fetchAllLists('user-1');
    expect(allLists).toHaveLength(1);
    expect(allLists[0]).toMatchObject({
      id: listId,
      name: 'Draft Board',
      playerIds: ['p1'],
    });

    await addPlayerToList(listId, 'p2', 'user-1');
    await saveList(
      listId,
      {
        playerOrder: ['p2', 'divider::Tier 2', 'p1'],
        playerIds: ['p1', 'p2'],
        playerNotes: { p1: 'Franchise piece' },
        description: 'Created from smoke test',
      },
      'user-1'
    );

    expect(getMockData(createdPath)).toMatchObject({
      playerOrder: ['p2', 'divider::Tier 2', 'p1'],
      playerIds: ['p1', 'p2'],
      playerNotes: { p1: 'Franchise piece' },
      description: 'Created from smoke test',
    });

    await renameList(listId, 'Renamed Board', 'user-1');
    const fetched = await fetchList(listId, 'user-1');
    expect(fetched).toMatchObject({
      id: listId,
      name: 'Renamed Board',
      ownerUid: 'user-1',
      ownershipValid: true,
    });

    seedMockData('lists/legacy-list', {
      name: 'Legacy Board',
      playerIds: ['legacy-player'],
      playerOrder: ['legacy-player'],
      playerNotes: {},
      description: '',
    });

    const claimed = await fetchList('legacy-list', 'user-1');
    expect(claimed).toMatchObject({
      id: 'legacy-list',
      ownerUid: 'user-1',
      ownershipValid: true,
    });
    expect(getMockData('lists/legacy-list')?.ownerUid).toBe('user-1');

    await deleteList(listId, 'user-1');
    expect(getMockData(createdPath)).toBeUndefined();
  });

  it('round-trips owned tier lists through create, read, save, rename, auto-claim, and delete', async () => {
    const tierListId = await createTierList('Pyramid Board', 'pyramid', 'user-1');
    const createdPath = `tierLists/${tierListId}`;

    expect(getMockData(createdPath)).toMatchObject({
      name: 'Pyramid Board',
      ownerUid: 'user-1',
      mode: 'pyramid',
      tierOrder: ['Row1', 'Row2', 'Row3', 'Row4', 'Row5', 'Pool'],
    });

    const allTierLists = await fetchAllTierLists('user-1');
    expect(allTierLists).toHaveLength(1);
    expect(allTierLists[0]).toMatchObject({
      id: tierListId,
      name: 'Pyramid Board',
      mode: 'pyramid',
    });

    await saveTierList(
      tierListId,
      {
        tiers: {
          Row1: ['p1'],
          Row2: ['p2', 'p3'],
          Pool: [],
        },
        tierOrder: ['Row1', 'Row2', 'Pool'],
        mode: 'standard',
      },
      'user-1'
    );

    expect(getMockData(createdPath)).toMatchObject({
      mode: 'pyramid',
      tierOrder: ['Row1', 'Row2', 'Pool'],
      tiers: {
        Row1: ['p1'],
        Row2: ['p2', 'p3'],
        Pool: [],
      },
    });

    await renameTierList(tierListId, 'Renamed Pyramid', 'user-1');
    const fetched = await fetchTierList(tierListId, 'user-1');
    expect(fetched).toMatchObject({
      id: tierListId,
      name: 'Renamed Pyramid',
      ownerUid: 'user-1',
      ownershipValid: true,
      mode: 'pyramid',
    });

    seedMockData('tierLists/legacy-tier-list', {
      name: 'Legacy Tier Board',
      tiers: {
        S: ['p9'],
        Pool: [],
      },
      tierOrder: ['S', 'Pool'],
      mode: 'standard',
    });

    const claimed = await fetchTierList('legacy-tier-list', 'user-1');
    expect(claimed).toMatchObject({
      id: 'legacy-tier-list',
      ownerUid: 'user-1',
      ownershipValid: true,
      mode: 'standard',
    });
    expect(getMockData('tierLists/legacy-tier-list')?.ownerUid).toBe('user-1');

    await deleteTierList(tierListId, 'user-1');
    expect(getMockData(createdPath)).toBeUndefined();
  });

  it('rejects malformed and foreign list documents at the Firestore boundary', async () => {
    seedMockData('lists/bad-list', {
      name: 'Broken List',
      ownerUid: 'user-1',
      playerIds: 'not-an-array',
      playerOrder: [],
      playerNotes: {},
      description: '',
    });

    seedMockData('tierLists/foreign-tier-list', {
      name: 'Foreign Tier Board',
      ownerUid: 'user-2',
      tiers: {
        S: ['p1'],
        Pool: [],
      },
      tierOrder: ['S', 'Pool'],
      mode: 'standard',
    });

    await expect(fetchAllLists('user-1')).rejects.toThrow(/Invalid list bad-list/i);
    await expect(fetchTierList('foreign-tier-list', 'user-1')).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});
