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

describe('fetchWorldTeamEvents query fallback order', () => {
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

  it('falls back in exact order: teamCodes/occurredAt -> teamCodes/timestamp -> teamsAffected/occurredAt -> teamsAffected/timestamp', async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'evt_1',
            data: () => ({ mutationType: 'executeTrade' }),
          },
        ],
      });

    const result = await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 50,
    });

    expect(result.events).toHaveLength(1);

    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamCodes',
      'teamsAffected',
      'teamsAffected',
    ]);

    expect(firestoreMocks.orderBy.mock.calls.map((call) => call[0])).toEqual([
      'occurredAt',
      'timestamp',
      'occurredAt',
      'timestamp',
    ]);
  });

  it('uses only preferredConfig when provided (no fallback fan-out)', async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce({ docs: [] });

    const preferredConfig = {
      teamField: 'teamsAffected' as const,
      orderField: 'timestamp' as const,
    };

    await fetchWorldTeamEvents({
      worldId: 'world_1',
      teamCode: 'LAL',
      limit: 50,
      preferredConfig,
    });

    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.where).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.orderBy).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.where).toHaveBeenCalledWith(
      'teamsAffected',
      'array-contains',
      'LAL'
    );
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
  });
});
