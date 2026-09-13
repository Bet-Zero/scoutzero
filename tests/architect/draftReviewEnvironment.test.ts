import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@/firebaseConfig');

const mock = vi.hoisted(() => ({ alreadyStarted: false, connects: 0 }));
vi.mock('firebase/app', () => ({
  initializeApp: (options: unknown) => ({ options }),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: (app: unknown) => ({ app }),
  connectFirestoreEmulator: () => {
    mock.connects++;
    if (mock.alreadyStarted)
      throw new Error('The client has already been started');
  },
}));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  connectAuthEmulator: () => {},
}));
vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => {},
}));
vi.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  connectStorageEmulator: () => {},
}));
beforeEach(() => {
  vi.resetModules();
  mock.alreadyStarted = false;
  mock.connects = 0;
  vi.stubEnv('DEV', true);
  vi.stubEnv('VITE_ARCHITECT_REVIEW_MODE', 'true');
  vi.stubEnv('VITE_ARCHITECT_DRAFT_REVIEW', 'true');
  vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', 'true');
  vi.stubEnv('VITE_FIRESTORE_EMULATOR_HOST', '127.0.0.1');
  vi.stubEnv('VITE_FIRESTORE_EMULATOR_PORT', '8082');
});
afterEach(() => vi.unstubAllEnvs());
describe('actual Firebase review environment gate', () => {
  it('allows the explicit development demo connection', async () => {
    const { isSyntheticDraftReviewEnvironment } = await import(
      '@/firebaseConfig'
    );
    expect(mock.connects).toBe(1);
    expect(isSyntheticDraftReviewEnvironment()).toBe(true);
  });
  it('rejects production even with every client review/emulator flag enabled', async () => {
    vi.stubEnv('DEV', false);
    const { isSyntheticDraftReviewEnvironment } = await import(
      '@/firebaseConfig'
    );
    expect(mock.connects).toBe(1);
    expect(isSyntheticDraftReviewEnvironment()).toBe(false);
  });
  it('rejects default mode, a nonlocal endpoint, and an unproven prior connection', async () => {
    vi.stubEnv('VITE_ARCHITECT_DRAFT_REVIEW', 'false');
    expect(
      (await import('@/firebaseConfig')).isSyntheticDraftReviewEnvironment()
    ).toBe(false);
    vi.resetModules();
    vi.stubEnv('VITE_ARCHITECT_DRAFT_REVIEW', 'true');
    vi.stubEnv('VITE_FIRESTORE_EMULATOR_HOST', '192.0.2.1');
    expect(
      (await import('@/firebaseConfig')).isSyntheticDraftReviewEnvironment()
    ).toBe(false);
    vi.resetModules();
    vi.stubEnv('VITE_FIRESTORE_EMULATOR_HOST', '127.0.0.1');
    mock.alreadyStarted = true;
    expect(
      (await import('@/firebaseConfig')).isSyntheticDraftReviewEnvironment()
    ).toBe(false);
  });
});
