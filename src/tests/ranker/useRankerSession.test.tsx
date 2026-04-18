import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRankerSession } from '@/features/ranker/hooks/useRankerSession';
import { useAuth } from '@/shared/hooks/useAuth';
import { getMockData } from '../../../tests/__mocks__/firebase.js';

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/config/ownerConfig', () => ({
  isOwnerUid: (userId: string | null | undefined) => userId === 'owner-1',
}));

const mockedUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  sessionStorage.clear();
  mockedUseAuth.mockReturnValue({
    user: null,
    userId: 'owner-1',
    loading: false,
  });
});

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useRankerSession', () => {
  it('creates, persists, and hydrates a local draft with closure cache', () => {
    const { result } = renderHook(() => useRankerSession());

    act(() => {
      result.current.createLocalDraft({
        playerPoolIds: ['player-a', 'player-b'],
        name: 'Test ranking',
      });
    });

    expect(result.current.hasLocalSession).toBe(true);
    expect(result.current.localDraft?.name).toBe('Test ranking');

    act(() => {
      result.current.updateLocalDraftNow({
        results: [{ winner: 'player-a', loser: 'player-b' }],
        isFinished: true,
      });
    });

    const stored = JSON.parse(
      sessionStorage.getItem('ranker_draft_v1') || '{}'
    );
    expect(stored.results).toEqual([
      { winner: 'player-a', loser: 'player-b' },
    ]);
    expect(stored.isFinished).toBe(true);

    const hydrated = result.current.loadAndHydrateLocalDraft();

    expect(hydrated?.results).toEqual([
      { winner: 'player-a', loser: 'player-b' },
    ]);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(hydrated?.closureCache.addEdge('player-b', 'player-a')).toBe(false);
  });

  it('saves owner drafts to Firestore only through the explicit action', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));
    const { result } = renderHook(() => useRankerSession());

    act(() => {
      result.current.createLocalDraft({
        playerPoolIds: ['player-a', 'player-b'],
        name: 'Owner ranking',
      });
      result.current.updateLocalDraftNow({
        results: [{ winner: 'player-a', loser: 'player-b' }],
        anchorDone: true,
      });
    });

    let savedId: string | null = null;
    await act(async () => {
      savedId = await result.current.saveToFirestore();
    });

    expect(savedId).toEqual(expect.any(String));
    expect(result.current.firestoreSessionId).toBe(savedId);
    expect(result.current.saveStatus).toBe('saved');
    expect(getMockData(`rankerSessions/${savedId}`)).toMatchObject({
      ownerUid: 'owner-1',
      name: 'Owner ranking',
      playerPoolIds: ['player-a', 'player-b'],
      results: [{ winner: 'player-a', loser: 'player-b' }],
      anchorDone: true,
      isFinished: false,
      skippedPairs: [],
      adjustments: null,
    });
  });
});
