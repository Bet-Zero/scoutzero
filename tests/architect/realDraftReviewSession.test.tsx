import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRealDraftReview } from '@/features/architect/tradeMachine/useRealDraftReview';

const session = vi.hoisted(() => ({
  user: null as null | { uid: string; getIdToken: () => Promise<string> },
  loading: false,
}));
vi.mock('@/shared/hooks/useAuth', () => ({ useAuth: () => session }));
vi.mock('@/features/architect/utils/draftPickRealReview', () => ({
  loadRealDraftReview: vi.fn(async () => ({})),
  reviewRealDraftSelection: vi.fn(() => ({
    apply: 'blocked',
    tradingVerdict: 'not-evaluated',
  })),
}));
const teams = [
  {
    team: { teamCode: 'PHI' },
    entitlementsOut: [{ id: 'retained-pick', round: 1 }],
  },
];
const hook = () => useRealDraftReview(teams, '2026-06-05', 'saved-world');
afterEach(() => {
  session.user = null;
  session.loading = false;
  vi.unstubAllGlobals();
});

describe('draft review session boundary', () => {
  it('waits for existing sign-in and sends its ID token only to the same-origin API', async () => {
    session.loading = true;
    const request = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', request);
    const view = renderHook(hook);
    expect(request).not.toHaveBeenCalled();
    session.user = {
      uid: 'gm-a',
      getIdToken: vi.fn().mockResolvedValue('signed-session-token'),
    };
    session.loading = false;
    view.rerender();
    await waitFor(() =>
      expect(view.result.current).toHaveProperty('review.apply', 'blocked')
    );
    expect(request).toHaveBeenCalledWith(
      '/api/architect/draft-review',
      expect.objectContaining({
        headers: { Authorization: 'Bearer signed-session-token' },
        cache: 'no-store',
      })
    );
  });
  it('clears the old review immediately when the signed-in user changes', async () => {
    session.user = { uid: 'gm-a', getIdToken: async () => 'token-a' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    const view = renderHook(hook);
    await waitFor(() => expect(view.result.current).toHaveProperty('review'));
    session.user = null;
    view.rerender();
    expect(view.result.current).not.toHaveProperty('review');
    await waitFor(() =>
      expect(view.result.current).toHaveProperty(
        'error',
        'Sign in to load the retained pick review.'
      )
    );
  });
  it('does not send a token resolved after sign-out or resurrect a late review', async () => {
    let release!: (value: string) => void;
    session.user = {
      uid: 'gm-a',
      getIdToken: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    };
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const view = renderHook(hook);
    session.user = null;
    view.rerender();
    await act(async () => release('old-session-token'));
    expect(request).not.toHaveBeenCalled();
    expect(view.result.current).not.toHaveProperty('review');
  });
  it('shows the existing unavailable state on a rejected hosted session', async () => {
    session.user = {
      uid: 'gm-a',
      getIdToken: async () => 'expired-session-token',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 }))
    );
    const view = renderHook(hook);
    await waitFor(() =>
      expect(view.result.current).toHaveProperty(
        'error',
        'The retained pick review is unavailable. First-round trades still need a complete review.'
      )
    );
    expect(view.result.current).not.toHaveProperty('review');
  });
});
