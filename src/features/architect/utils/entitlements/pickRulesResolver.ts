/**
 * FILE: src/features/architect/utils/entitlements/pickRulesResolver.ts
 * PURPOSE: Resolve pick rules from Firestore for use in entitlement projection.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 12.3A)
 *
 * HISTORY:
 *  - 2026-01-31: Created for Phase 12.3A - Push Base Pick Rules to Firestore
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.3A)
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
import { ARCHITECT_BASE_PICK_RULES_PATH } from '@/constants/collections';

// --- Types ---

export type PickRuleProtection = {
  type?: 'top_n' | 'range' | 'lottery';
  protectedRange?: string;
  appliesToYears?: number[];
  description?: string;
};

export type PickRuleCondition = {
  kind: 'swap' | 'swap_right' | 'conveys' | 'did_not_convey';
  description: string;
  relatedPickIds?: string[];
  appliesToYears?: number[];
  controller?: string;
};

export type PickRuleDoc = {
  pickId: string;
  seasonYear: number;
  round: 1 | 2;
  protections?: PickRuleProtection[];
  conditions?: PickRuleCondition[];
  ownershipSource?: string;
  evidenceRowRefs?: string[];
  updatedAtISO: string;
  source: string;
};

export type PickRulesMap = Map<string, PickRuleDoc>;

// --- Constants ---

const DEFAULT_IN_QUERY_LIMIT = 30;

// --- Helpers ---

const chunkIds = (ids: string[], size = DEFAULT_IN_QUERY_LIMIT): string[][] => {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
};

const resolveDefaultDb = async (): Promise<Firestore> => {
  const module = await import('@/firebaseConfig');
  return module.db as Firestore;
};

// --- Public API ---

/**
 * Resolve a single pick rule by pickId.
 * Returns null if no rule exists for this pick.
 */
export const resolvePickRuleWithDb = async (
  db: Firestore,
  pickId: string
): Promise<PickRuleDoc | null> => {
  const docRef = doc(db, ARCHITECT_BASE_PICK_RULES_PATH, pickId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  return {
    pickId: snapshot.id,
    ...(snapshot.data() as Omit<PickRuleDoc, 'pickId'>),
  };
};

/**
 * Resolve multiple pick rules by pickIds.
 * Returns a Map for efficient lookup.
 */
export const resolvePickRulesByIdsWithDb = async (
  db: Firestore,
  pickIds: string[]
): Promise<PickRulesMap> => {
  const map: PickRulesMap = new Map();
  if (!pickIds.length) return map;

  const chunks = chunkIds(pickIds);

  for (const chunk of chunks) {
    const rulesQuery = query(
      collection(db, ARCHITECT_BASE_PICK_RULES_PATH),
      where(documentId(), 'in', chunk)
    );
    const snapshot = await getDocs(rulesQuery);

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as Omit<PickRuleDoc, 'pickId'>;
      map.set(docSnap.id, { pickId: docSnap.id, ...data });
    });
  }

  return map;
};

/**
 * Convenience wrapper that uses default db.
 */
export const resolvePickRule = async (
  pickId: string
): Promise<PickRuleDoc | null> => {
  const db = await resolveDefaultDb();
  return resolvePickRuleWithDb(db, pickId);
};

/**
 * Convenience wrapper that uses default db.
 */
export const resolvePickRulesByIds = async (
  pickIds: string[]
): Promise<PickRulesMap> => {
  const db = await resolveDefaultDb();
  return resolvePickRulesByIdsWithDb(db, pickIds);
};

/**
 * Convert PickRulesMap to a plain object for passing to projection layer.
 * This avoids async fetch inside the projection function.
 */
export const pickRulesMapToObject = (
  map: PickRulesMap
): Record<string, PickRuleDoc> => {
  const obj: Record<string, PickRuleDoc> = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
};
