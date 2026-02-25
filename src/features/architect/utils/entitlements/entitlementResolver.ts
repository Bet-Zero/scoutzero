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
import {
  getTeamOverlay,
  getTransfersForTeam,
} from './vacuumEntitlementOverlayStore';
import {
  getEntitlementIdentityKey,
  resolveStoredOrComputedIdentityKey,
} from './entitlementIdentity';

type EntitlementRecord = Record<string, unknown>;

export type EffectiveEntitlement = EntitlementRecord;

type ResolverDb = Firestore;

type ResolverResult = EffectiveEntitlement | null;

type EntitlementMap = Map<string, EntitlementRecord>;

type ResolverLayerLabel = `world:${string}` | 'base';

export type EntitlementInvariantViolationKind =
  | 'DUPLICATE_ENTITLEMENT_ID'
  | 'DUPLICATE_IDENTITY_KEY'
  | 'CONFLICTING_LAYER_IDENTITY';

export interface EntitlementInvariantViolationDetails {
  code: 'ENTITLEMENT_INVARIANT_VIOLATION';
  kind: EntitlementInvariantViolationKind;
  teamCode: string;
  worldId: string | null;
  entitlementIds?: string[];
  identityKey?: string;
  conflictingIdentityKeys?: string[];
  layerProvenance?: string[];
}

export class EntitlementInvariantError extends Error {
  readonly code = 'ENTITLEMENT_INVARIANT_VIOLATION';

  readonly details: EntitlementInvariantViolationDetails;

  constructor(details: EntitlementInvariantViolationDetails) {
    super(
      `ENTITLEMENT_INVARIANT_VIOLATION (${details.kind}) for team ${details.teamCode} in world ${details.worldId ?? 'base'}`
    );
    this.name = 'EntitlementInvariantError';
    this.details = details;
  }
}

const DEFAULT_IN_QUERY_LIMIT = 30;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base: EntitlementRecord, override: EntitlementRecord) => {
  const merged: EntitlementRecord = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    // BUG #3 fix: treat null as "delete this key" so clearing fields
    // in vacuum overlay edits actually removes them from the merged result.
    if (value === null) {
      delete merged[key];
      return;
    }
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

function resolveIdentityKeyForInvariant(entitlement: EntitlementRecord): string {
  return (
    resolveStoredOrComputedIdentityKey(entitlement) ??
    getEntitlementIdentityKey(entitlement)
  );
}

function throwInvariant(details: Omit<EntitlementInvariantViolationDetails, 'code'>): never {
  throw new EntitlementInvariantError({
    code: 'ENTITLEMENT_INVARIANT_VIOLATION',
    ...details,
  });
}

function assertNoDuplicateIdsInList(params: {
  entitlementIds: string[];
  worldId: string | null;
  teamCode: string;
}): void {
  const counts = new Map<string, number>();
  for (const entitlementId of params.entitlementIds) {
    if (!entitlementId) continue;
    counts.set(entitlementId, (counts.get(entitlementId) || 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  if (duplicates.length === 0) {
    return;
  }
  throwInvariant({
    kind: 'DUPLICATE_ENTITLEMENT_ID',
    teamCode: params.teamCode,
    worldId: params.worldId,
    entitlementIds: duplicates,
  });
}

function assertNoDuplicateIdsInResolvedSet(params: {
  entitlements: EffectiveEntitlement[];
  worldId: string | null;
  teamCode: string;
}): void {
  const ids = params.entitlements
    .map((entitlement) => entitlement.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  assertNoDuplicateIdsInList({
    entitlementIds: ids,
    worldId: params.worldId,
    teamCode: params.teamCode,
  });
}

function assertNoDuplicateIdentityKeys(params: {
  entitlements: EffectiveEntitlement[];
  worldId: string | null;
  teamCode: string;
}): void {
  const byIdentity = new Map<string, string[]>();
  for (const entitlement of params.entitlements) {
    const identityKey = resolveIdentityKeyForInvariant(entitlement);
    const entitlementId = (entitlement.id as string) || '(no id)';
    if (!byIdentity.has(identityKey)) {
      byIdentity.set(identityKey, []);
    }
    byIdentity.get(identityKey)!.push(entitlementId);
  }

  for (const [identityKey, entitlementIds] of byIdentity.entries()) {
    if (entitlementIds.length <= 1) continue;
    throwInvariant({
      kind: 'DUPLICATE_IDENTITY_KEY',
      teamCode: params.teamCode,
      worldId: params.worldId,
      identityKey,
      entitlementIds: [...new Set(entitlementIds)].sort(),
    });
  }
}

function assertNoLayerIdentityConflict(params: {
  teamCode: string;
  worldId: string | null;
  entitlementId: string;
  currentLayer: ResolverLayerLabel;
  currentDocument: EntitlementRecord;
  incomingLayer: ResolverLayerLabel;
  incomingDocument: EntitlementRecord;
}): void {
  const currentIdentity = resolveStoredOrComputedIdentityKey(
    params.currentDocument
  );
  const incomingIdentity = resolveStoredOrComputedIdentityKey(
    params.incomingDocument
  );
  if (!currentIdentity || !incomingIdentity) {
    return;
  }
  if (currentIdentity === incomingIdentity) {
    return;
  }
  throwInvariant({
    kind: 'CONFLICTING_LAYER_IDENTITY',
    teamCode: params.teamCode,
    worldId: params.worldId,
    entitlementIds: [params.entitlementId],
    conflictingIdentityKeys: [currentIdentity, incomingIdentity],
    layerProvenance: [params.currentLayer, params.incomingLayer],
  });
}

const resolveWorldFallbackChain = async (
  db: ResolverDb,
  worldId: string | null
): Promise<string[]> => {
  if (!worldId) return [];

  const chain: string[] = [];
  const seen = new Set<string>();
  let currentWorldId: string | null = worldId;

  while (currentWorldId && !seen.has(currentWorldId)) {
    seen.add(currentWorldId);
    chain.push(currentWorldId);

    try {
      const worldRef = doc(db, ARCHITECT_WORLDS_COLLECTION, currentWorldId);
      const worldSnap = await getDoc(worldRef);
      if (!worldSnap.exists()) break;

      const worldData = worldSnap.data() as { parentWorldId?: string };
      currentWorldId =
        typeof worldData?.parentWorldId === 'string' &&
        worldData.parentWorldId.trim().length > 0
          ? worldData.parentWorldId
          : null;
    } catch {
      // Match teamLoader resilience: if parent lookup fails, stop chaining.
      break;
    }
  }

  return chain;
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
    const collectionPath = pathSegments as [string, ...string[]];
    const entitlementsQuery = query(
      collection(db, ...collectionPath),
      where(documentId(), 'in', chunk)
    );
    const snapshot = await getDocs(entitlementsQuery);
    snapshot.docs.forEach((docSnap) => {
      results.push({
        id: docSnap.id,
        ...(docSnap.data() as EntitlementRecord),
      });
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
    const worldChain = await resolveWorldFallbackChain(db, worldId);
    for (const scopedWorldId of worldChain) {
      const worldTeamRef = doc(
        db,
        ARCHITECT_WORLDS_COLLECTION,
        scopedWorldId,
        'teams',
        teamCode
      );
      const worldTeamSnap = await getDoc(worldTeamRef);
      if (!worldTeamSnap.exists()) continue;

      const worldData = worldTeamSnap.data() as { entitlementIds?: unknown };
      // Align with world → parent → base semantics:
      // if this snapshot explicitly carries entitlementIds, honor it.
      // if entitlementIds is absent, continue fallback to parent.
      if ('entitlementIds' in worldData) {
        const entitlementIds = Array.isArray(worldData.entitlementIds)
          ? (worldData.entitlementIds as string[])
          : [];
        assertNoDuplicateIdsInList({
          entitlementIds,
          worldId,
          teamCode,
        });
        return entitlementIds;
      }
    }
  }

  const baseTeamRef = doc(db, ARCHITECT_BASE_TEAMS_PATH, teamCode);
  const baseTeamSnap = await getDoc(baseTeamRef);
  if (!baseTeamSnap.exists()) return [];

  const baseData = baseTeamSnap.data() as { entitlementIds?: string[] };
  const entitlementIds = Array.isArray(baseData.entitlementIds)
    ? baseData.entitlementIds
    : [];
  assertNoDuplicateIdsInList({
    entitlementIds,
    worldId,
    teamCode,
  });
  return entitlementIds;
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

  let resolvedData: EntitlementRecord | null = baseData || null;
  let resolvedLayer: ResolverLayerLabel | null = baseData ? 'base' : null;
  const worldChain = await resolveWorldFallbackChain(db, worldId);

  // Merge from oldest parent → ... → current world.
  for (const scopedWorldId of [...worldChain].reverse()) {
    const overrideRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      scopedWorldId,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      entitlementId
    );
    const overrideSnap = await getDoc(overrideRef);
    if (!overrideSnap.exists()) continue;

    const overrideData: EntitlementRecord = {
      id: overrideSnap.id,
      ...(overrideSnap.data() as EntitlementRecord),
    };

    if (resolvedData && resolvedLayer) {
      assertNoLayerIdentityConflict({
        teamCode: 'UNKNOWN',
        worldId,
        entitlementId,
        currentLayer: resolvedLayer,
        currentDocument: resolvedData,
        incomingLayer: `world:${scopedWorldId}`,
        incomingDocument: overrideData,
      });
    }

    resolvedData = resolvedData
      ? deepMerge(resolvedData, overrideData)
      : overrideData;
    resolvedLayer = `world:${scopedWorldId}`;
  }

  return resolvedData;
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

  const baseMap = toEntitlementMap(baseDocs);
  const worldChain = await resolveWorldFallbackChain(db, worldId);
  const overrideLayers: Array<{
    layer: ResolverLayerLabel;
    map: EntitlementMap;
  }> = [];

  // Merge order: oldest parent → ... → current world.
  for (const scopedWorldId of [...worldChain].reverse()) {
    const overrideDocs = await fetchEntitlementsByIds(
      db,
      [
        ARCHITECT_WORLDS_COLLECTION,
        scopedWorldId,
        ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      ],
      entitlementIds
    );
    overrideLayers.push({
      layer: `world:${scopedWorldId}`,
      map: toEntitlementMap(overrideDocs),
    });
  }

  const resolved = entitlementIds
    .map((id) => {
      let merged = (baseMap.get(id) || null) as EntitlementRecord | null;
      let mergedLayer: ResolverLayerLabel | null = merged ? 'base' : null;

      for (const overrideLayer of overrideLayers) {
        const override = overrideLayer.map.get(id) || null;
        if (!override) continue;
        if (merged && mergedLayer) {
          assertNoLayerIdentityConflict({
            teamCode,
            worldId,
            entitlementId: id,
            currentLayer: mergedLayer,
            currentDocument: merged,
            incomingLayer: overrideLayer.layer,
            incomingDocument: override,
          });
        }
        merged = merged ? deepMerge(merged, override) : override;
        mergedLayer = overrideLayer.layer;
      }

      return merged;
    })
    .filter((entitlement): entitlement is EffectiveEntitlement =>
      Boolean(entitlement)
    );

  // ── Vacuum mode overlay merge (single merge seam) ──
  // When worldId is null, apply session overlay edits/creates from localStorage.
  // When worldId is truthy, this block is skipped — world mode is unchanged.
  if (!worldId) {
    // TM-PICKS-E1: Apply transfers first (trade-executed entitlement moves)
    const { transfersIn, transfersOut } = getTransfersForTeam(teamCode);

    // Remove transferred-out entitlements
    if (transfersOut.length > 0) {
      const outSet = new Set(transfersOut);
      for (let i = resolved.length - 1; i >= 0; i--) {
        if (outSet.has(resolved[i].id as string)) {
          resolved.splice(i, 1);
        }
      }
    }

    // Add transferred-in entitlements (fetch from base collection)
    if (transfersIn.length > 0) {
      const alreadyResolved = new Set(resolved.map((e) => e.id as string));
      const toFetch = transfersIn.filter((id) => !alreadyResolved.has(id));

      if (toFetch.length > 0) {
        const incomingDocs = await fetchEntitlementsByIds(
          db,
          [ARCHITECT_BASE_ENTITLEMENTS_PATH],
          toFetch
        );
        for (const doc of incomingDocs) {
          resolved.push({
            ...doc,
            holderTeam: teamCode, // Patch holderTeam to reflect new owner
          });
        }
      }
    }

    const teamOverlay = getTeamOverlay(teamCode);
    if (teamOverlay) {
      // Apply edits: deep-merge patches onto matching base entitlements
      if (teamOverlay.edits) {
        for (const [editId, patch] of Object.entries(teamOverlay.edits)) {
          const idx = resolved.findIndex((ent) => ent.id === editId);
          if (idx !== -1) {
            resolved[idx] = {
              ...deepMerge(resolved[idx], patch),
              __vacuumEdited: true,
            };
          }
        }
      }
      // Append creates: vacuum-prefixed entitlements added to end of list
      if (teamOverlay.creates) {
        for (const [vacuumId, fullDoc] of Object.entries(teamOverlay.creates)) {
          resolved.push({
            ...fullDoc,
            id: vacuumId,
            __vacuumSessionOnly: true,
          });
        }
      }
    }
  }

  // E3 hardening: resolver must fail loud on corruption, not silently dedupe.
  assertNoDuplicateIdsInResolvedSet({
    entitlements: resolved,
    worldId,
    teamCode,
  });
  assertNoDuplicateIdentityKeys({
    entitlements: resolved,
    worldId,
    teamCode,
  });

  return resolved;
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
