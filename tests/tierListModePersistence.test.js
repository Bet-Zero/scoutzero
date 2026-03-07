import { describe, it, expect } from 'vitest';
import {
  createTierList,
  fetchTierList,
  resolveTierListMode,
  saveTierList,
} from '@/firebase/listHelpers';
import { getMockData, seedMockData } from './__mocks__/firebase.js';

describe('tier list mode persistence', () => {
  it('resolves row-shaped standard docs as pyramid', () => {
    expect(
      resolveTierListMode({
        mode: 'standard',
        tiers: {
          Row1: ['p1'],
          Row2: ['p2', 'p3'],
          Pool: [],
        },
        tierOrder: ['Row1', 'Row2', 'Pool'],
      })
    ).toBe('pyramid');
  });

  it('creates pyramid lists with row defaults and persisted mode', async () => {
    const id = await createTierList('Pyramid Board', 'pyramid', 'user-1');
    const created = getMockData(`tierLists/${id}`);

    expect(created.mode).toBe('pyramid');
    expect(created.tierOrder).toEqual([
      'Row1',
      'Row2',
      'Row3',
      'Row4',
      'Row5',
      'Pool',
    ]);
    expect(created.tiers).toEqual({
      Row1: [],
      Row2: [],
      Row3: [],
      Row4: [],
      Row5: [],
      Pool: [],
    });
  });

  it('persists mode on save', async () => {
    seedMockData('tierLists/list_1', {
      name: 'Existing Board',
      ownerUid: 'user-1',
      tiers: {
        S: ['p1'],
        Pool: [],
      },
      tierOrder: ['S', 'Pool'],
      mode: 'standard',
    });

    await saveTierList(
      'list_1',
      {
        tiers: {
          Row1: ['p1'],
          Pool: ['p2'],
        },
        tierOrder: ['Row1', 'Pool'],
        mode: 'pyramid',
      },
      'user-1'
    );

    const saved = getMockData('tierLists/list_1');
    expect(saved.mode).toBe('pyramid');
    expect(saved.tierOrder).toEqual(['Row1', 'Pool']);
  });

  it('repairs mismatched stored mode on owner read', async () => {
    seedMockData('tierLists/legacy_mode', {
      name: 'Legacy Pyramid',
      ownerUid: 'user-1',
      tiers: {
        Row1: ['p1'],
        Row2: ['p2', 'p3'],
        Pool: [],
      },
      tierOrder: ['Row1', 'Row2', 'Pool'],
      mode: 'standard',
    });

    const fetched = await fetchTierList('legacy_mode', 'user-1');

    expect(fetched.mode).toBe('pyramid');
    expect(getMockData('tierLists/legacy_mode').mode).toBe('pyramid');
  });

  it('throws a coded error when there is no active session', async () => {
    await expect(fetchTierList('missing', null)).rejects.toMatchObject({
      code: 'no-session',
    });
  });

  it('throws a coded error when the list does not exist', async () => {
    await expect(fetchTierList('missing', 'user-1')).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('throws a coded error when the tier list belongs to another session', async () => {
    seedMockData('tierLists/foreign_list', {
      name: 'Foreign Board',
      ownerUid: 'user-2',
      tiers: {
        S: ['p1'],
        Pool: [],
      },
      tierOrder: ['S', 'Pool'],
      mode: 'standard',
    });

    await expect(fetchTierList('foreign_list', 'user-1')).rejects.toMatchObject(
      {
        code: 'permission-denied',
      }
    );
  });
});
