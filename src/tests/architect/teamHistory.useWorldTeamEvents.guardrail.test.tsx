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

  it('reuses the canonical winning contract, keeps lastDoc on retained rows, and preserves newest-first dedupe when pages overlap', async () => {
    const canonicalPageLead = makeDoc('evt_1', {
      mutationType: 'executeTrade',
      occurredAt: '2026-03-03T12:00:00.000Z',
    });
    const canonicalRetainedTail = makeDoc('evt_3', {
      mutationType: 'waivePlayer',
      occurredAt: '2026-03-01T12:00:00.000Z',
    });
    const canonicalOverfetchSentinel = makeDoc('evt_sentinel', {
      mutationType: 'setExceptions',
      occurredAt: '2026-02-28T12:00:00.000Z',
    });
    const overlappingMiddleRow = makeDoc('evt_2', {
      mutationType: 'signFreeAgent',
      occurredAt: '2026-03-02T12:00:00.000Z',
    });
    const overlappingDuplicateTail = makeDoc('evt_3', {
      mutationType: 'waivePlayer',
      occurredAt: '2026-03-01T12:00:00.000Z',
    });

    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        docs: [
          canonicalPageLead,
          canonicalRetainedTail,
          canonicalOverfetchSentinel,
        ],
      })
      .mockResolvedValueOnce({
        docs: [overlappingMiddleRow, overlappingDuplicateTail],
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

    expect(result.current.resolution).toBe('authoritative');
    expect(result.current.hasMore).toBe(true);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'evt_1',
      'evt_3',
    ]);

    await act(async () => {
      await result.current.loadMore?.();
    });

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });

    expect(firestoreMocks.where.mock.calls.map((call) => call[0])).toEqual([
      'teamCodes',
      'teamCodes',
    ]);
    expect(firestoreMocks.orderBy.mock.calls.map((call) => call[0])).toEqual([
      'occurredAt',
      'occurredAt',
    ]);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(1, 3);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(2, 3);
    expect(firestoreMocks.startAfter).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(
      canonicalRetainedTail
    );
    expect(firestoreMocks.startAfter).not.toHaveBeenCalledWith(
      canonicalOverfetchSentinel
    );

    expect(result.current.hasMore).toBe(false);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'evt_1',
      'evt_2',
      'evt_3',
    ]);
  });

  it('reuses the legacy compatibility contract for load-more after legacy resolution wins initial retrieval', async () => {
    const legacyFirstRow = makeDoc('legacy_evt_1', {
      type: 'waivePlayer',
      timestamp: '2026-03-02T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const legacyOverfetchSentinel = makeDoc('legacy_evt_sentinel', {
      type: 'setExceptions',
      timestamp: '2026-03-01T12:00:00.000Z',
      teamsAffected: ['LAL'],
    });
    const legacySecondRow = makeDoc('legacy_evt_2', {
      type: 'executeTrade',
      timestamp: '2026-02-28T12:00:00.000Z',
      teamsAffected: ['LAL', 'BOS'],
    });

    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [legacyFirstRow, legacyOverfetchSentinel],
      })
      .mockResolvedValueOnce({
        docs: [legacySecondRow],
      });

    const { result } = renderHook(() =>
      useWorldTeamEvents({
        worldId: 'world_1',
        teamCode: 'LAL',
        limit: 1,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.resolution).toBe('legacy-compatible');
    expect(result.current.hasMore).toBe(true);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'legacy_evt_1',
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
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(1, 2);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(2, 2);
    expect(firestoreMocks.limit).toHaveBeenNthCalledWith(3, 2);
    expect(firestoreMocks.startAfter).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.startAfter).toHaveBeenCalledWith(legacyFirstRow);

    expect(result.current.resolution).toBe('legacy-compatible');
    expect(result.current.hasMore).toBe(false);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'legacy_evt_1',
      'legacy_evt_2',
    ]);
  });
});
