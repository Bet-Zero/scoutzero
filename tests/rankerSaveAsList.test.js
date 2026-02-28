import { describe, it, expect, vi } from 'vitest';
import {
  createRankerListFromRanking,
  resolveFinalOrderIds,
} from '@/features/ranker/utils/saveAsListBridge';

describe('ranker save as list bridge', () => {
  it('uses adjustments for final order when adjustments exist', async () => {
    const createListFn = vi.fn().mockResolvedValue('list_1');
    const saveListFn = vi.fn().mockResolvedValue(undefined);

    await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_1',
      sessionName: 'Top 10',
      poolIds: ['p1', 'p2', 'p3'],
      adjustments: ['p3', 'p2', 'p1'],
      currentRanking: ['p1', 'p2', 'p3'],
      createListFn,
      saveListFn,
    });

    expect(saveListFn).toHaveBeenCalledWith(
      'list_1',
      expect.objectContaining({
        playerOrder: ['p3', 'p2', 'p1'],
      }),
      'owner_1'
    );
  });

  it('uses current ranking when adjustments are empty', async () => {
    const createListFn = vi.fn().mockResolvedValue('list_2');
    const saveListFn = vi.fn().mockResolvedValue(undefined);

    const currentRanking = [{ id: 'p4' }, { id: 'p1' }, { id: 'p2' }];
    const finalOrder = resolveFinalOrderIds({ adjustments: [], currentRanking });
    expect(finalOrder).toEqual(['p4', 'p1', 'p2']);

    await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_2',
      sessionName: 'Ranking',
      poolIds: ['p1', 'p2', 'p4'],
      adjustments: null,
      currentRanking,
      createListFn,
      saveListFn,
    });

    expect(saveListFn).toHaveBeenCalledWith(
      'list_2',
      expect.objectContaining({
        playerOrder: ['p4', 'p1', 'p2'],
      }),
      'owner_2'
    );
  });

  it('blocks non-owner list creation calls', async () => {
    const createListFn = vi.fn();
    const saveListFn = vi.fn();

    const result = await createRankerListFromRanking({
      isOwner: false,
      userId: 'not_owner',
      sessionName: 'Ranking',
      poolIds: ['p1', 'p2'],
      adjustments: ['p1', 'p2'],
      currentRanking: ['p1', 'p2'],
      createListFn,
      saveListFn,
    });

    expect(result).toBe(null);
    expect(createListFn).not.toHaveBeenCalled();
    expect(saveListFn).not.toHaveBeenCalled();
  });

  it('saves IDs only in payload', async () => {
    const createListFn = vi.fn().mockResolvedValue('list_3');
    const saveListFn = vi.fn().mockResolvedValue(undefined);

    await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_3',
      sessionName: 'Objects Input',
      poolIds: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
      adjustments: null,
      currentRanking: [{ id: 'p2', name: 'B' }, { id: 'p1', name: 'A' }],
      createListFn,
      saveListFn,
    });

    const payload = saveListFn.mock.calls[0][1];
    expect(payload.playerIds).toEqual(['p1', 'p2']);
    expect(payload.playerOrder).toEqual(['p2', 'p1']);
    expect(payload.playerIds.every((id) => typeof id === 'string')).toBe(true);
    expect(payload.playerOrder.every((id) => typeof id === 'string')).toBe(true);
  });
});
