/**
 * FILE: src/features/architect/utils/entitlements/entitlementResolver.ts
 * PURPOSE: Resolve effective entitlements by merging base definitions with world overrides.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-21: Created by plan `plans/pst-phase-10-firestore-entitlements/plan.md`, no chunks
 *
 * LINKS:
 *  - Plan: plans/pst-phase-10-firestore-entitlements/plan.md
 *  - Latest Chunk: n/a
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLDS_COLLECTION,
} from '@/constants/collections';

type EntitlementRecord = Record<string, unknown>;

export type EffectiveEntitlement = EntitlementRecord;

type ResolverDb = Firestore;

type ResolverResult = EffectiveEntitlement | null;

type EntitlementMap = Map<string, EntitlementRecord>;

const DEFAULT_IN_QUERY_LIMIT = 30;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base: EntitlementRecord, override: EntitlementRecord) => {
  const merged: EntitlementRecord = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = deepMerge(baseValue, value);
      return;
    }
    merged[key] = value;
  });
  return merged;
};

const toEntitlementMap = (snapshots: EntitlementRecord[]) => {
  const map: EntitlementMap = new Map();
  snapshots.forEach((docData) => {
    const id = docData.id as string | undefined;
    if (id) map.set(id, docData);
  });
  return map;
};

const chunkIds = (ids: string[], size = DEFAULT_IN_QUERY_LIMIT) => {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
};

const resolveDefaultDb = async (): Promise<ResolverDb> => {
  const module = await import('@/firebaseConfig');
  return module.db as ResolverDb;
};

const fetchEntitlementsByIds = async (
  db: ResolverDb,
  pathSegments: string[],
  entitlementIds: string[]
): Promise<EntitlementRecord[]> => {
  if (!entitlementIds.length) return [];

  const results: EntitlementRecord[] = [];
  const chunks = chunkIds(entitlementIds);

  for (const chunk of chunks) {
    const entitlementsQuery = query(
      collection(db, ...pathSegments),
      where(documentId(), 'in', chunk)
    );
    const snapshot = await getDocs(entitlementsQuery);
    snapshot.docs.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...(docSnap.data() as EntitlementRecord) });
    });
  }

  return results;
};

const resolveTeamEntitlementIds = async (
  db: ResolverDb,
  worldId: string | null,
  teamCode: string
): Promise<string[]> => {
  if (worldId) {
    const worldTeamRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      'teams',
      teamCode
    );
    const worldTeamSnap = await getDoc(worldTeamRef);
    if (worldTeamSnap.exists()) {
      const worldData = worldTeamSnap.data() as { entitlementIds?: string[] };
      return Array.isArray(worldData.entitlementIds)
        ? worldData.entitlementIds
        : [];
    }
  }

  const baseTeamRef = doc(db, ARCHITECT_BASE_TEAMS_PATH, teamCode);
  const baseTeamSnap = await getDoc(baseTeamRef);
  if (!baseTeamSnap.exists()) return [];

  const baseData = baseTeamSnap.data() as { entitlementIds?: string[] };
  return Array.isArray(baseData.entitlementIds) ? baseData.entitlementIds : [];
};

export const resolveEntitlementWithDb = async (
  db: ResolverDb,
  worldId: string | null,
  entitlementId: string
): Promise<ResolverResult> => {
  const baseRef = doc(db, ARCHITECT_BASE_ENTITLEMENTS_PATH, entitlementId);
  const baseSnap = await getDoc(baseRef);
  const baseData = baseSnap.exists()
    ? ({
        id: baseSnap.id,
        ...(baseSnap.data() as EntitlementRecord),
      } as EntitlementRecord)
    : null;

  let overrideData: EntitlementRecord | null = null;
  if (worldId) {
    const overrideRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      entitlementId
    );
    const overrideSnap = await getDoc(overrideRef);
    if (overrideSnap.exists()) {
      overrideData = {
        id: overrideSnap.id,
        ...(overrideSnap.data() as EntitlementRecord),
      };
    }
  }

  if (baseData && overrideData) {
    return deepMerge(baseData, overrideData);
  }

  return baseData || overrideData || null;
};

export const resolveEntitlementsForTeamWithDb = async (
  db: ResolverDb,
  worldId: string | null,
  teamCode: string
): Promise<EffectiveEntitlement[]> => {
  const entitlementIds = await resolveTeamEntitlementIds(db, worldId, teamCode);
  if (!entitlementIds.length) return [];

  const baseDocs = await fetchEntitlementsByIds(
    db,
    [ARCHITECT_BASE_ENTITLEMENTS_PATH],
    entitlementIds
  );
  const overrideDocs = worldId
    ? await fetchEntitlementsByIds(db, [
        ARCHITECT_WORLDS_COLLECTION,
        worldId,
        ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      ], entitlementIds)
    : [];

  const baseMap = toEntitlementMap(baseDocs);
  const overrideMap = toEntitlementMap(overrideDocs);

  return entitlementIds
    .map((id) => {
      const base = baseMap.get(id) || null;
      const override = overrideMap.get(id) || null;
      if (base && override) return deepMerge(base, override);
      return base || override || null;
    })
    .filter((entitlement): entitlement is EffectiveEntitlement => Boolean(entitlement));
};

export const resolveEntitlement = async (
  worldId: string | null,
  entitlementId: string
): Promise<ResolverResult> => {
  const db = await resolveDefaultDb();
  return resolveEntitlementWithDb(db, worldId, entitlementId);
};

export const resolveEntitlementsForTeam = async (
  worldId: string | null,
  teamCode: string
): Promise<EffectiveEntitlement[]> => {
  const db = await resolveDefaultDb();
  return resolveEntitlementsForTeamWithDb(db, worldId, teamCode);
};
