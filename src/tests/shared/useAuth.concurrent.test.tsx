import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as unknown },
  authReady: vi.fn(async () => {}),
  customSignIn: vi.fn(),
  mode: 'EMULATOR',
  emulatorConnected: true,
  project: 'demo-architect-review',
  endpoints: { auth: { host: '127.0.0.1', port: 9099 }, firestore: { host: '127.0.0.1', port: 8082 } },
  listeners: new Set<(user: unknown) => void>(),
  signIn: vi.fn(),
}));
vi.mock('@/firebaseConfig', () => ({
  auth: {
    get currentUser() { return mocks.auth.currentUser; }, authStateReady: mocks.authReady,
    get emulatorConfig() { return mocks.emulatorConnected ? mocks.endpoints.auth : null; },
  },
  db: { app: { options: { get projectId() { return mocks.project; } } } },
  get FIREBASE_TARGET_MODE() { return mocks.mode; },
  FIREBASE_EMULATOR_ENDPOINTS: mocks.endpoints,
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
  signInAnonymously: mocks.signIn,
  signInWithCustomToken: mocks.customSignIn,
}));

import { useAuth } from '@/shared/hooks/useAuth';
import { resumeCloudSession } from '../../../scripts/dev/cloudSession.browser';

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

describe('cloud session recovery boundary', () => {
  beforeEach(() => {
    mocks.mode = 'EMULATOR';
    mocks.emulatorConnected = true;
    mocks.project = 'demo-architect-review';
    mocks.endpoints.auth.host = '127.0.0.1';
    mocks.endpoints.firestore.port = 8082;
    mocks.customSignIn.mockReset();
  });
  it('refuses production mode, another project and nonlocal endpoints before authentication', async () => {
    mocks.mode = 'PROD';
    await expect(resumeCloudSession('synthetic-local-token', 'test-user')).rejects.toThrow(/restricted/);
    mocks.mode = 'EMULATOR'; mocks.project = 'scoutzero-bf1ae';
    await expect(resumeCloudSession('synthetic-local-token', 'test-user')).rejects.toThrow(/restricted/);
    mocks.project = 'demo-architect-review'; mocks.endpoints.auth.host = 'remote.test';
    await expect(resumeCloudSession('synthetic-local-token', 'test-user')).rejects.toThrow(/restricted/);
    mocks.endpoints.auth.host = '127.0.0.1'; mocks.endpoints.firestore.port = 8080;
    await expect(resumeCloudSession('synthetic-local-token', 'test-user')).rejects.toThrow(/restricted/);
    mocks.endpoints.firestore.port = 8082; mocks.emulatorConnected = false;
    await expect(resumeCloudSession('synthetic-local-token', 'test-user')).rejects.toThrow(/restricted/);
    expect(mocks.customSignIn).not.toHaveBeenCalled();
  });
  it('recovers only the expected identity on the fixed demo target', async () => {
    mocks.customSignIn.mockResolvedValueOnce({ user: { uid: 'test-user' } });
    await resumeCloudSession('synthetic-local-token', 'test-user');
    expect(mocks.customSignIn).toHaveBeenCalledTimes(1);
    mocks.customSignIn.mockResolvedValueOnce({ user: { uid: 'another-user' } });
    await expect(resumeCloudSession('synthetic-local-token', 'test-user')).rejects.toThrow(/mismatch/);
  });
});
