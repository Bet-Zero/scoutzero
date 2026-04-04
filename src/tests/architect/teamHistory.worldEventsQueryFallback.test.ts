import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  query: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  db: { __mockDb: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collection,
  where: firestoreMocks.where,
  orderBy: firestoreMocks.orderBy,
  limit: firestoreMocks.limit,
  startAfter: firestoreMocks.startAfter,
  query: firestoreMocks.query,
  getDocs: firestoreMocks.getDocs,
}));

import { fetchWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';

function makeDoc(id: string, data: Record<string, unknown> = {}) {
  return {
    id,
    data: () => data,
  };
}

describe('fetchWorldTeamEvents Team History query contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    firestoreMocks.collection.mockReturnValue({ kind: 'collection' });
    firestoreMocks.where.mockImplementation((field, op, value) => ({
      kind: 'where',
      field,
      op,
      value,
    }));
    firestoreMocks.orderBy.mockImplementation((field, direction) => ({
      kind: 'orderBy',
      field,
      direction,
    }));
    firestoreMocks.limit.mockImplementation((value) => ({
      kind: 'limit',
      value,
    }));
    firestoreMocks.startAfter.mockImplementation((doc) => ({
      kind: 'startAfter',
      doc,
    }));
    firestoreMocks.query.mockImplementation(
      (collectionRef, ...constraints) => ({
        collectionRef,
        constraints,
      })
    );
  });

  it('merges canonical and legacy rows into one sorted Team History page when both contracts contribute unique rows', async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          makeDoc('evt_canon_1', {
            mutationType: 'executeTrade',
            occurredAt: '2026-03-05T12:00:00.000Z',
          }),
          makeDoc('evt_shared_1', {
            mutationType: 'signFreeAgent',
            occurredAt: '2026-03-03T12:00:00.000Z',
          }),
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          makeDoc('evt_legacy_1', {
            type: 'buyoutPlayer',
            timestamp: '2026-03-04T12:00:00.000Z',
            teamsAffected: ['LAL'],
          }),
          makeDoc('evt_shared_1', {
            type: 'signFreeAgent',
            timestamp: '2026-03-03T12:00:00.000Z',
            teamsAffected: ['LAL'],
          }),
        ],
      });

    const result = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 3,
    });

    expect(result.events.map((event) => event.id)).toEqual([
      'evt_canon_1',
      'evt_legacy_1',
      'evt_shared_1',
    ]);
    expect(result.resolution).toBe('mixed-compatible');
    expect(result.hasMore).toBe(false);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamsAffected',
    ]);
    expect(firestoreMocks.orderBy.mock.calls.map((call) => call[0])).toEqual([
      'occurredAt',
      'timestamp',
    ]);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(1, 4);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(2, 4);
  });

  it('returns a legacy-compatible page when canonical rows are absent', async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [makeDoc('evt_legacy', { mutationType: 'waivePlayer' })],
      });

    const result = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 50,
    });

    expect(result.events).toHaveLength(1);
    expect(result.resolution).toBe('legacy-compatible');
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamsAffected',
    ]);
  });

  it('returns an empty resolution after the canonical and legacy contracts both return no rows', async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });

    const result = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 50,
    });

    expect(result.events).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.resolution).toBe('empty');
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(2);
  });

  it('reuses paginationState and only refetches contracts that still have more rows', async () => {
    const legacyOverfetchSentinel = makeDoc('legacy_evt_sentinel', {
      type: 'setExceptions',
      timestamp: '2026-03-01T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });

    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          makeDoc('legacy_evt_1', {
            type: 'waivePlayer',
            timestamp: '2026-03-03T12:00:00.000Z',
            teamsAffected: ['LAL'],
          }),
          makeDoc('legacy_evt_2', {
            type: 'executeTrade',
            timestamp: '2026-03-02T12:00:00.000Z',
            teamsAffected: ['LAL', 'BOS'],
          }),
          legacyOverfetchSentinel,
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          makeDoc('legacy_evt_3', {
            type: 'createTradeException',
            timestamp: '2026-02-28T12:00:00.000Z',
            teamsAffected: ['LAL'],
          }),
        ],
      });

    const firstPage = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 2,
    });

    const secondPage = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 2,
      paginationState: firstPage.paginationState,
    });

    expect(firstPage.events.map((event) => event.id)).toEqual([
      'legacy_evt_1',
      'legacy_evt_2',
    ]);
    expect(firstPage.resolution).toBe('legacy-compatible');
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.events.map((event) => event.id)).toEqual([
      'legacy_evt_sentinel',
      'legacy_evt_3',
    ]);
    expect(secondPage.resolution).toBe('legacy-compatible');
    expect(secondPage.hasMore).toBe(false);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(3);
    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamsAffected',
      'teamsAffected',
    ]);
    expect(firestoreMocks.startAfter).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(
      legacyOverfetchSentinel
    );
  });

  it('surfaces canonical query errors instead of silently falling through to compatibility fallback', async () => {
    firestoreMocks.getDocs.mockRejectedValueOnce(new Error('missing index'));

    await expect(
      fetchWorldTeamEvents({
        worldId: 'world_1',
        teamCode: 'LAL',
        limit: 50,
      })
    ).rejects.toThrow(/canonical Team History contract failed: missing index/);

    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
  });
});
