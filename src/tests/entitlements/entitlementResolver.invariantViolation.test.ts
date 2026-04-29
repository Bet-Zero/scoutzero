import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

type DocData = Record<string, unknown>;

const mockDocsByPath = new Map<string, DocData | null>();
const mockCollectionDocsByPath = new Map<
  string,
  Array<{ id: string; data: DocData }>
>();

function seedDoc(path: string, data: DocData | null): void {
  mockDocsByPath.set(path, data);
}

function seedCollectionDoc(collectionPath: string, id: string, data: DocData): void {
  const existing = mockCollectionDocsByPath.get(collectionPath) || [];
  existing.push({ id, data });
  mockCollectionDocsByPath.set(collectionPath, existing);
}

function makeMockFirestore(): Firestore {
  return {} as Firestore;
}

vi.mock('@/constants/collections', () => ({
  ARCHITECT_BASE_ENTITLEMENTS_PATH: 'architect_baseEntitlements',
  ARCHITECT_BASE_TEAMS_PATH: 'architect_baseTeams',
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION: 'entitlements',
  ARCHITECT_WORLDS_COLLECTION: 'architect_worlds',
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...pathParts: string[]) => ({
    _path: pathParts.join('/'),
  }),
  doc: (_db: unknown, ...pathParts: string[]) => ({
    _path: pathParts.join('/'),
  }),
  documentId: () => '__documentId__',
  getDoc: vi.fn(async (ref: { _path: string }) => {
    const data = mockDocsByPath.get(ref._path);
    return {
      id: ref._path.split('/').at(-1) || '',
      exists: () => Boolean(data),
      data: () => data || {},
    };
  }),
  where: (_field: string, _op: string, value: unknown) => ({
    _value: value,
  }),
  query: (
    collectionRef: { _path: string },
    ...constraints: Array<{ _value?: unknown }>
  ) => ({
    _collectionPath: collectionRef._path,
    _constraints: constraints,
  }),
  getDocs: vi.fn(
    async (queryRef: {
      _collectionPath: string;
      _constraints: Array<{ _value?: unknown }>;
    }) => {
      const idsConstraint = queryRef._constraints.find((c) =>
        Array.isArray(c._value)
      );
      const requestedIds = (idsConstraint?._value || []) as string[];
      const all = mockCollectionDocsByPath.get(queryRef._collectionPath) || [];
      const docs = all
        .filter((entry) => requestedIds.includes(entry.id))
        .map((entry) => ({
          id: entry.id,
          data: () => entry.data,
        }));
      return { docs };
    }
  ),
}));

import {
  EntitlementInvariantError,
  resolveEntitlementsForTeamWithDb,
} from '@/features/architect/utils/entitlements/entitlementResolver';

describe('entitlementResolver invariant violations (E3)', () => {
  const db = makeMockFirestore();

  beforeEach(() => {
    mockDocsByPath.clear();
    mockCollectionDocsByPath.clear();
  });

  it('throws on duplicate identity keys instead of silently deduping', async () => {
    seedDoc('architect_baseTeams/BOS', { entitlementIds: ['ent-1', 'ent-2'] });
    seedCollectionDoc('architect_baseEntitlements', 'ent-1', {
      holderTeam: 'BOS',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2028_1st',
      identityKey: 'own|BOS|2028|1|bos_2028_1st',
    });
    seedCollectionDoc('architect_baseEntitlements', 'ent-2', {
      holderTeam: 'BOS',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2028_1st',
      identityKey: 'own|BOS|2028|1|bos_2028_1st',
    });

    await expect(
      resolveEntitlementsForTeamWithDb(db, null, 'BOS')
    ).rejects.toMatchObject({
      code: 'ENTITLEMENT_INVARIANT_VIOLATION',
      details: expect.objectContaining({
        kind: 'DUPLICATE_IDENTITY_KEY',
        teamCode: 'BOS',
        worldId: null,
        identityKey: 'own|BOS|2028|1|bos_2028_1st',
      }),
    });
  });

  it('throws on duplicate entitlement IDs in team inventory', async () => {
    seedDoc('architect_baseTeams/BOS', { entitlementIds: ['ent-1', 'ent-1'] });
    seedCollectionDoc('architect_baseEntitlements', 'ent-1', {
      holderTeam: 'BOS',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2028_1st',
      identityKey: 'own|BOS|2028|1|bos_2028_1st',
    });

    await expect(
      resolveEntitlementsForTeamWithDb(db, null, 'BOS')
    ).rejects.toMatchObject({
      code: 'ENTITLEMENT_INVARIANT_VIOLATION',
      details: expect.objectContaining({
        kind: 'DUPLICATE_ENTITLEMENT_ID',
        teamCode: 'BOS',
        entitlementIds: ['ent-1'],
      }),
    });
  });

  it('throws when identity conflicts across parent/child world override layers', async () => {
    seedDoc('architect_worlds/world-child', { parentWorldId: 'world-parent' });
    seedDoc('architect_worlds/world-parent', { parentWorldId: null });
    seedDoc('architect_worlds/world-child/teams/BOS', {});
    seedDoc('architect_worlds/world-parent/teams/BOS', {
      entitlementIds: ['ent-1'],
    });

    seedCollectionDoc('architect_baseEntitlements', 'ent-1', {
      holderTeam: 'BOS',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2028_1st',
      identityKey: 'own|BOS|2028|1|bos_2028_1st',
    });
    seedCollectionDoc('architect_worlds/world-parent/entitlements', 'ent-1', {
      identityKey: 'own|BOS|2028|1|bos_2028_1st',
    });
    seedCollectionDoc('architect_worlds/world-child/entitlements', 'ent-1', {
      identityKey: 'own|BOS|2028|1|mia_2028_1st',
    });

    await expect(
      resolveEntitlementsForTeamWithDb(db, 'world-child', 'BOS')
    ).rejects.toBeInstanceOf(EntitlementInvariantError);

    try {
      await resolveEntitlementsForTeamWithDb(db, 'world-child', 'BOS');
      expect.unreachable('Expected invariant violation');
    } catch (error) {
      const invariantError = error as EntitlementInvariantError;
      expect(invariantError.code).toBe('ENTITLEMENT_INVARIANT_VIOLATION');
      expect(invariantError.details.kind).toBe('CONFLICTING_LAYER_IDENTITY');
      expect(invariantError.details.teamCode).toBe('BOS');
      expect(invariantError.details.worldId).toBe('world-child');
      expect(invariantError.details.entitlementIds).toEqual(['ent-1']);
      expect(invariantError.details.layerProvenance).toEqual([
        'world:world-parent',
        'world:world-child',
      ]);
    }
  });
});
