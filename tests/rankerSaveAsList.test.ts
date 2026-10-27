import { describe, it, expect, vi } from 'vitest';
import {
  createRankerListFromRanking,
  resolveFinalOrderIds,
  resolveLinkedList,
} from '@/features/ranker/utils/saveAsListBridge';

describe('ranker save as list bridge', () => {
  it('uses adjustments for final order when adjustments exist', async () => {
    const createListFn = vi.fn().mockResolvedValue('list_1');
    const saveListFn = vi.fn().mockResolvedValue(undefined);

    await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_1',
      sessionName: 'Top 10',
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
      adjustments: null,
      currentRanking: [{ id: 'p2', name: 'B' }, { id: 'p1', name: 'A' }],
      createListFn,
      saveListFn,
    });

    const payload = saveListFn.mock.calls[0][1];
    expect(payload.playerIds).toEqual(['p2', 'p1']);
    expect(payload.playerOrder).toEqual(['p2', 'p1']);
    expect(payload.playerIds.every((id) => typeof id === 'string')).toBe(true);
    expect(payload.playerOrder.every((id) => typeof id === 'string')).toBe(true);
  });

  it('saves only the ranked players of a Top-N list, not the whole pool', async () => {
    const createListFn = vi.fn().mockResolvedValue('list_top');
    const saveListFn = vi.fn().mockResolvedValue(undefined);

    // The pool had p1-p5; the Top 3 is p2, p1, p4
    await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_1',
      sessionName: 'My Top 3',
      currentRanking: ['p2', 'p1', 'p4'],
      createListFn,
      saveListFn,
    });

    const payload = saveListFn.mock.calls[0][1];
    expect(payload.playerOrder).toEqual(['p2', 'p1', 'p4']);
    expect(payload.playerIds).toEqual(['p2', 'p1', 'p4']);
  });

  it('updates the linked list instead of creating a duplicate', async () => {
    const createListFn = vi.fn();
    const saveListFn = vi.fn().mockResolvedValue(undefined);

    const saved = await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_1',
      sessionName: 'Top 10',
      existingListId: 'list_existing',
      existingListName: 'Ranker — Top 10 — 2026-10-01',
      currentRanking: ['p2', 'p1'],
      createListFn,
      saveListFn,
    });

    expect(createListFn).not.toHaveBeenCalled();
    expect(saveListFn).toHaveBeenCalledWith(
      'list_existing',
      expect.objectContaining({ playerOrder: ['p2', 'p1'] }),
      'owner_1'
    );
    expect(saved).toEqual({
      listId: 'list_existing',
      listName: 'Ranker — Top 10 — 2026-10-01',
    });
  });

  it('creates a new list when the linked list was deleted', async () => {
    const createListFn = vi.fn().mockResolvedValue('list_new');
    const saveListFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Document not found.'))
      .mockResolvedValue(undefined);

    const saved = await createRankerListFromRanking({
      isOwner: true,
      userId: 'owner_1',
      sessionName: 'Top 10',
      existingListId: 'list_gone',
      currentRanking: ['p1', 'p2'],
      createListFn,
      saveListFn,
    });

    expect(createListFn).toHaveBeenCalledTimes(1);
    expect(saved?.listId).toBe('list_new');
  });

  describe('the list a ranking was saved as', () => {
    const lists = [{ id: 'list_1', name: 'My best players (renamed)' }];

    it('still counts after a reload, under its current name', () => {
      expect(resolveLinkedList(null, 'list_1', lists)).toEqual({
        listId: 'list_1',
        listName: 'My best players (renamed)',
      });
    });

    it("doesn't count once deleted on the Lists page", () => {
      expect(resolveLinkedList(null, 'list_gone', lists)).toBeNull();
    });

    it('a list just saved counts before the lists catch up', () => {
      const justSaved = { listId: 'list_new', listName: 'Ranker — Top 10 — 2026-10-27' };
      expect(resolveLinkedList(justSaved, 'list_new', lists)).toEqual(justSaved);
    });

    it('nothing saved yet', () => {
      expect(resolveLinkedList(null, null, lists)).toBeNull();
    });
  });
});
