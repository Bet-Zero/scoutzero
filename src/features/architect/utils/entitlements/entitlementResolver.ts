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
import { getEntitlementIdentityKey } from './entitlementIdentity';

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
    ? await fetchEntitlementsByIds(
        db,
        [
          ARCHITECT_WORLDS_COLLECTION,
          worldId,
          ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
        ],
        entitlementIds
      )
    : [];

  const baseMap = toEntitlementMap(baseDocs);
  const overrideMap = toEntitlementMap(overrideDocs);

  const resolved = entitlementIds
    .map((id) => {
      const base = baseMap.get(id) || null;
      const override = overrideMap.get(id) || null;
      if (base && override) return deepMerge(base, override);
      return base || override || null;
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

  // ── R5: Deduplicate by identityKey ──
  // If base/world/vacuum merging produces two entries with the same logical
  // identity, keep only the preferred one:
  //   - Prefer world/vacuum-edited over plain base
  //   - Prefer later entries (vacuum creates appended last) when all else equal
  const seenIdentity = new Map<string, number>(); // identityKey → index in resolved
  for (let i = resolved.length - 1; i >= 0; i--) {
    const ent = resolved[i];
    const key = (ent.identityKey as string) || getEntitlementIdentityKey(ent);
    const existingIdx = seenIdentity.get(key);
    if (existingIdx !== undefined) {
      // Duplicate found — decide which to keep.
      // Prefer: __vacuumEdited > __vacuumSessionOnly > plain base
      const existing = resolved[existingIdx];
      const existingPriority =
        (existing.__vacuumEdited ? 2 : 0) +
        (existing.__vacuumSessionOnly ? 1 : 0);
      const currentPriority =
        (ent.__vacuumEdited ? 2 : 0) + (ent.__vacuumSessionOnly ? 1 : 0);

      if (currentPriority >= existingPriority) {
        // Current entry is higher/equal priority — remove the later one
        resolved.splice(existingIdx, 1);
        // Adjust indices in seenIdentity for anything shifted
        for (const [k, idx] of seenIdentity) {
          if (idx > existingIdx) seenIdentity.set(k, idx - 1);
        }
        seenIdentity.set(key, i > existingIdx ? i - 1 : i);
      } else {
        // Existing entry is higher priority — remove current
        resolved.splice(i, 1);
        // Adjust indices for anything shifted
        for (const [k, idx] of seenIdentity) {
          if (idx > i) seenIdentity.set(k, idx - 1);
        }
      }
    } else {
      seenIdentity.set(key, i);
    }
  }

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
