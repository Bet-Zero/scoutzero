// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

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

import { useWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';

function makeDoc(id: string, data: Record<string, unknown> = {}) {
  return {
    id,
    data: () => data,
  };
}

describe('useWorldTeamEvents guardrails', () => {
  beforeEach(() => {
    cleanup();
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

  it('merges canonical and legacy rows into one paginated feed, reuses both cursors, and preserves newest-first dedupe when pages overlap', async () => {
    const canonicalPageLead = makeDoc('evt_canon_1', {
      mutationType: 'executeTrade',
      occurredAt: '2026-03-05T12:00:00.000Z',
    });
    const sharedCanonicalTrade = makeDoc('evt_shared_1', {
      mutationType: 'signFreeAgent',
      occurredAt: '2026-03-03T12:00:00.000Z',
    });
    const sharedCanonicalTail = makeDoc('evt_shared_2', {
      mutationType: 'waivePlayer',
      occurredAt: '2026-03-02T12:00:00.000Z',
    });
    const sharedCanonicalSentinel = makeDoc('evt_shared_tail', {
      mutationType: 'setExceptions',
      occurredAt: '2026-02-01T12:00:00.000Z',
    });
    const legacyPageLead = makeDoc('evt_legacy_1', {
      type: 'buyoutPlayer',
      timestamp: '2026-03-04T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const sharedLegacyTrade = makeDoc('evt_shared_1', {
      type: 'signFreeAgent',
      timestamp: '2026-03-03T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const sharedLegacyTail = makeDoc('evt_shared_2', {
      type: 'waivePlayer',
      timestamp: '2026-03-02T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const sharedLegacySentinel = makeDoc('evt_shared_tail', {
      type: 'setExceptions',
      timestamp: '2026-02-01T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const canonicalNextRow = makeDoc('evt_canon_2', {
      mutationType: 'setDeadCap',
      occurredAt: '2026-01-15T12:00:00.000Z',
    });
    const legacyNextRow = makeDoc('evt_legacy_2', {
      type: 'createTradeException',
      timestamp: '2026-01-10T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });

    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          canonicalPageLead,
          sharedCanonicalTrade,
          sharedCanonicalTail,
          sharedCanonicalSentinel,
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          legacyPageLead,
          sharedLegacyTrade,
          sharedLegacyTail,
          sharedLegacySentinel,
        ],
      })
      .mockResolvedValueOnce({
        docs: [canonicalNextRow],
      })
      .mockResolvedValueOnce({
        docs: [legacyNextRow],
      });

    const { result } = renderHook(() =>
      useWorldTeamEvents({
        worldId: 'world_1',
        teamCode: 'LAL',
        limit: 3,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.resolution).toBe('mixed-compatible');
    expect(result.current.hasMore).toBe(true);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'evt_canon_1',
      'evt_legacy_1',
      'evt_shared_1',
    ]);

    await act(async () => {
      await result.current.loadMore?.();
    });

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });

    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamsAffected',
      'teamCodes',
      'teamsAffected',
    ]);
    expect(firestoreMocks.orderBy.mock.calls.map((call) => call[0])).toEqual([
      'occurredAt',
      'timestamp',
      'occurredAt',
      'timestamp',
    ]);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(1, 4);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(2, 4);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(3, 4);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(4, 4);
    expect(firestoreMocks.startAfter).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(
      1,
      sharedCanonicalSentinel
    );
    expect(firestoreMocks.startAfter).toHaveBeenNthCalledWith(
      2,
      sharedLegacySentinel
    );

    expect(result.current.hasMore).toBe(true);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'evt_canon_1',
      'evt_legacy_1',
      'evt_shared_1',
      'evt_shared_2',
      'evt_shared_tail',
      'evt_canon_2',
    ]);

    await act(async () => {
      await result.current.loadMore?.();
    });

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });

    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(4);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'evt_canon_1',
      'evt_legacy_1',
      'evt_shared_1',
      'evt_shared_2',
      'evt_shared_tail',
      'evt_canon_2',
      'evt_legacy_2',
    ]);
  });

  it('reuses the legacy compatibility cursor for load-more after canonical returns no rows', async () => {
    const legacyFirstRow = makeDoc('legacy_evt_1', {
      type: 'waivePlayer',
      timestamp: '2026-03-03T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const legacySecondRow = makeDoc('legacy_evt_2', {
      type: 'executeTrade',
      timestamp: '2026-03-02T12:00:00.000Z',
      teamsAffected: ['LAL', 'BOS'],
    });
    const legacyOverfetchSentinel = makeDoc('legacy_evt_sentinel', {
      type: 'setExceptions',
      timestamp: '2026-03-01T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const legacyThirdRow = makeDoc('legacy_evt_3', {
      type: 'createTradeException',
      timestamp: '2026-02-28T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });

    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [legacyFirstRow, legacySecondRow, legacyOverfetchSentinel],
      })
      .mockResolvedValueOnce({
        docs: [legacyThirdRow],
      });

    const { result } = renderHook(() =>
      useWorldTeamEvents({
        worldId: 'world_1',
        teamCode: 'LAL',
        limit: 2,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.resolution).toBe('legacy-compatible');
    expect(result.current.hasMore).toBe(true);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'legacy_evt_1',
      'legacy_evt_2',
    ]);

    await act(async () => {
      await result.current.loadMore?.();
    });

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });

    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamsAffected',
      'teamsAffected',
    ]);
    expect(firestoreMocks.orderBy.mock.calls.map((call) => call[0])).toEqual([
      'occurredAt',
      'timestamp',
      'timestamp',
    ]);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(1, 3);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(2, 3);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(3, 3);
    expect(firestoreMocks.startAfter).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(
      legacyOverfetchSentinel
    );

    expect(result.current.resolution).toBe('legacy-compatible');
    expect(result.current.hasMore).toBe(false);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'legacy_evt_1',
      'legacy_evt_2',
      'legacy_evt_sentinel',
      'legacy_evt_3',
    ]);
  });
});
