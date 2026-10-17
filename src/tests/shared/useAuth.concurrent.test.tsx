import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as unknown },
  listeners: new Set<(user: unknown) => void>(),
  signIn: vi.fn(),
}));
vi.mock('@/firebaseConfig', () => ({ auth: mocks.auth }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
  signInAnonymously: mocks.signIn,
}));

import { useAuth } from '@/shared/hooks/useAuth';

describe('shared anonymous session initialization', () => {
  beforeEach(() => {
    mocks.auth.currentUser = null;
    mocks.listeners.clear();
    mocks.signIn.mockReset();
  });

  it('two mounted consumers share one in-flight sign-in and the same user', async () => {
    let finish!: (value: { user: User }) => void;
    mocks.signIn.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, unmount } = renderHook(() => [useAuth(), useAuth()]);
    act(() => mocks.listeners.forEach((listener) => listener(null)));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    const user = { uid: 'isolated-test-user' } as User;
    await act(async () => { mocks.auth.currentUser = user; finish({ user }); });
    await waitFor(() => expect(result.current.map((value) => value.userId))
      .toEqual(['isolated-test-user', 'isolated-test-user']));
    expect(result.current.every((value) => !value.loading)).toBe(true);
    unmount();
  });

  it('a failed shared attempt settles every consumer and allows a later mount to retry', async () => {
    mocks.signIn.mockRejectedValueOnce(new Error('synthetic sign-in unavailable'));
    const first = renderHook(() => [useAuth(), useAuth()]);
    await act(async () => mocks.listeners.forEach((listener) => listener(null)));
    await waitFor(() => expect(first.result.current.every((value) => !value.loading)).toBe(true));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(first.result.current.every((value) => value.userId === null)).toBe(true);
    first.unmount();
    mocks.signIn.mockResolvedValueOnce({ user: { uid: 'retry-user' } });
    const next = renderHook(() => useAuth());
    await act(async () => mocks.listeners.forEach((listener) => listener(null)));
    await waitFor(() => expect(next.result.current.userId).toBe('retry-user'));
    expect(mocks.signIn).toHaveBeenCalledTimes(2);
    next.unmount();
  });

  it('uses an existing signed-in user without creating an anonymous account', async () => {
    const user = { uid: 'existing-test-user' } as User;
    mocks.auth.currentUser = user;
    const { result, unmount } = renderHook(() => useAuth());
    act(() => mocks.listeners.forEach((listener) => listener(user)));
    expect(result.current.userId).toBe(user.uid);
    expect(mocks.signIn).not.toHaveBeenCalled();
    unmount();
  });
});
