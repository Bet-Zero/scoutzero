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

  it('uses the canonical teamCodes/occurredAt contract when authoritative rows exist', async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [makeDoc('evt_1', { mutationType: 'executeTrade' })],
    });

    const result = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 50,
    });

    expect(result.events).toHaveLength(1);
    expect(result.resolution).toBe('authoritative');
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.where).toHaveBeenCalledWith(
      'teamCodes',
      'array-contains',
      'LAL'
    );
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('occurredAt', 'desc');
    expect(firestoreMocks.limit).toHaveBeenCalledWith(51);
  });

  it('falls back only from canonical to legacy compatibility when canonical returns no rows', async () => {
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
    expect(firestoreMocks.orderBy.mock.calls.map((call) => call[0])).toEqual([
      'occurredAt',
      'timestamp',
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

  it('uses exact overfetch pagination and reuses the preferred contract without fallback fan-out', async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        makeDoc('evt_1', { mutationType: 'executeTrade' }),
        makeDoc('evt_2', { mutationType: 'waivePlayer' }),
        makeDoc('evt_3', { mutationType: 'setExceptions' }),
      ],
    });

    const result = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 2,
      preferredContract: {
        id: 'team-history-legacy-compat-v1',
        label: 'legacy Team History compatibility contract',
        teamField: 'teamsAffected',
        orderField: 'timestamp',
      },
    });

    expect(result.events.map((event) => event.id)).toEqual(['evt_1', 'evt_2']);
    expect(result.lastDoc?.id).toBe('evt_2');
    expect(result.hasMore).toBe(true);
    expect(result.resolution).toBe('legacy-compatible');
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.limit).toHaveBeenCalledWith(3);
    expect(firestoreMocks.where).toHaveBeenCalledWith(
      'teamsAffected',
      'array-contains',
      'LAL'
    );
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
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
