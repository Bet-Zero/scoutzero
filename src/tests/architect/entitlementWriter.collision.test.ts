import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

const mocks = vi.hoisted(() => ({
  mockDoc: vi.fn((...segments: string[]) => ({
    path: segments.slice(1).join('/'),
    _segments: segments,
  })),
  mockRunTransaction: vi.fn(),
  mockArrayUnion: vi.fn((value: string) => ({ __op: 'arrayUnion', value })),
  mockArrayRemove: vi.fn((value: string) => ({ __op: 'arrayRemove', value })),
  mockServerTimestamp: vi.fn(() => ({ __op: 'serverTimestamp' })),
  mockDeleteField: vi.fn(() => ({ __op: 'deleteField' })),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mocks.mockDoc(...(args as string[])),
  runTransaction: (...args: unknown[]) => mocks.mockRunTransaction(...args),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  arrayUnion: (...args: unknown[]) =>
    mocks.mockArrayUnion(...(args as [string])),
  arrayRemove: (...args: unknown[]) =>
    mocks.mockArrayRemove(...(args as [string])),
  serverTimestamp: () => mocks.mockServerTimestamp(),
  deleteField: () => mocks.mockDeleteField(),
}));

import { writeWorldEntitlementAndAttachToTeamAtomic } from '@/features/architect/utils/entitlements/entitlementWriter';

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    holderTeam: 'LAL',
    seasonYear: 2028,
    round: 1,
    kind: 'pick_ownership',
    underlyingPickId: 'LAL_2028_1st',
    identityKey: 'own|LAL|2028|1|lal_2028_1st',
    ...overrides,
  };
}

function makeMockFirestore(): Firestore {
  return {} as Firestore;
}

describe('writeWorldEntitlementAndAttachToTeamAtomic collision safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FEATURE_ENTITLEMENT_AUTHORING', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when entitlementId exists with a different identity key', async () => {
    const tx = {
      get: vi.fn(async () => ({
        exists: () => true,
        id: 'ent:LAL:2028:1:own:abcd1234',
        data: () => ({
          identityKey: 'own|LAL|2028|1|mia_2028_1st',
        }),
      })),
      set: vi.fn(),
      update: vi.fn(),
    };
    mocks.mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (transaction: typeof tx) => unknown) =>
        callback(tx)
    );

    const result = await writeWorldEntitlementAndAttachToTeamAtomic(
      makeMockFirestore(),
      {
        worldId: 'world-1',
        entitlementId: 'ent:LAL:2028:1:own:abcd1234',
        document: makeDoc(),
        userId: 'user-1',
      }
    );

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('ENTITLEMENT_ID_COLLISION');
    expect(result.error).toContain('ENTITLEMENT_ID_COLLISION');
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('allows idempotent writes when entitlementId maps to same identity key', async () => {
    const tx = {
      get: vi.fn(async () => ({
        exists: () => true,
        id: 'ent:LAL:2028:1:own:abcd1234',
        data: () => ({
          identityKey: 'own|LAL|2028|1|lal_2028_1st',
        }),
      })),
      set: vi.fn(),
      update: vi.fn(),
    };
    mocks.mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (transaction: typeof tx) => unknown) =>
        callback(tx)
    );

    const result = await writeWorldEntitlementAndAttachToTeamAtomic(
      makeMockFirestore(),
      {
        worldId: 'world-1',
        entitlementId: 'ent:LAL:2028:1:own:abcd1234',
        document: makeDoc(),
        userId: 'user-1',
      }
    );

    expect(result.success).toBe(true);
    expect(tx.set).toHaveBeenCalledTimes(2);
    expect(tx.update).not.toHaveBeenCalled();
  });
});
