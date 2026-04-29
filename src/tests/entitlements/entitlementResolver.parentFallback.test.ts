import type { Firestore } from 'firebase/firestore';
import { describe, it, expect, beforeEach, vi } from 'vitest';

type DocData = Record<string, unknown>;

const mockDocsByPath = new Map<string, DocData | null>();
const mockCollectionDocsByPath = new Map<string, Array<{ id: string; data: DocData }>>();

function seedDoc(path: string, data: DocData | null): void {
  mockDocsByPath.set(path, data);
}

function seedCollectionDoc(
  collectionPath: string,
  id: string,
  data: DocData
): void {
  const existing = mockCollectionDocsByPath.get(collectionPath) || [];
  existing.push({ id, data });
  mockCollectionDocsByPath.set(collectionPath, existing);
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
  query: (collectionRef: { _path: string }, ...constraints: Array<{ _value?: unknown }>) => ({
    _collectionPath: collectionRef._path,
    _constraints: constraints,
  }),
  getDocs: vi.fn(async (queryRef: {
    _collectionPath: string;
    _constraints: Array<{ _value?: unknown }>;
  }) => {
    const idsConstraint = queryRef._constraints.find((c) => Array.isArray(c._value));
    const requestedIds = (idsConstraint?._value || []) as string[];
    const all = mockCollectionDocsByPath.get(queryRef._collectionPath) || [];
    const docs = all
      .filter((entry) => requestedIds.includes(entry.id))
      .map((entry) => ({
        id: entry.id,
        data: () => entry.data,
      }));
    return { docs };
  }),
}));

import { resolveEntitlementsForTeamWithDb } from '@/features/architect/utils/entitlements/entitlementResolver';

describe('entitlementResolver parent-world fallback chain', () => {
  const db = {} as Firestore;

  beforeEach(() => {
    mockDocsByPath.clear();
    mockCollectionDocsByPath.clear();

    seedDoc('architect_worlds/world-child', { parentWorldId: 'world-parent' });
    seedDoc('architect_worlds/world-parent', { parentWorldId: null });
    seedDoc('architect_baseTeams/BOS', { entitlementIds: ['ent-base'] });
    seedDoc('architect_worlds/world-child/teams/BOS', {});
    seedDoc('architect_worlds/world-parent/teams/BOS', {
      entitlementIds: ['ent-1'],
    });

    seedCollectionDoc('architect_baseEntitlements', 'ent-1', {
      holderTeam: 'BOS',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      description: 'base description',
      underlyingStatus: 'encumbered',
    });
    seedCollectionDoc('architect_worlds/world-parent/entitlements', 'ent-1', {
      description: 'parent override',
      underlyingStatus: 'encumbered',
    });
    seedCollectionDoc('architect_worlds/world-child/entitlements', 'ent-1', {
      underlyingStatus: 'clean',
      notes: 'child override',
    });
  });

  it('uses world -> parent -> base for team entitlementIds', async () => {
    const result = await resolveEntitlementsForTeamWithDb(db, 'world-child', 'BOS');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ent-1');
    expect(result[0].description).toBe('parent override');
    expect(result[0].underlyingStatus).toBe('clean');
    expect(result[0].notes).toBe('child override');
  });

  it('stops fallback when child team explicitly sets entitlementIds', async () => {
    seedDoc('architect_worlds/world-child/teams/BOS', { entitlementIds: [] });

    const result = await resolveEntitlementsForTeamWithDb(db, 'world-child', 'BOS');
    expect(result).toEqual([]);
  });
});
