/**
 * FILE: src/features/architect/utils/persistenceContracts/normalizeTeamTpe.ts
 * PURPOSE: Normalize TPE schema from dual-source (legacy tradeExceptions + canonical exceptions.tpe)
 *          to single canonical location (exceptions.tpe) for persistence.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-03-11: Phase E50 - Migrated authoritative implementation to TypeScript
 *  - 2026-02-01: Phase 67 - Telemetry wind-down: quiet-by-default (LOG_LEGACY_TPE_FALLBACK=true to enable)
 *  - 2026-01-31: Phase 66 - Added legacy fallback telemetry to getTeamTpeList
 *  - 2026-01-30: Phase 64 - Created for TPE schema canonicalization (tradeExceptions → exceptions.tpe)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Contracts Doc: docs/architect/contracts/PERSISTENCE_CONTRACTS.md
 *  - Phase 64 Return: docs/architect/return_packages/PHASE_64_TPE_CANONICALIZATION_NO_LEGACY_PERSIST_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md
 *
 * DESIGN:
 * Phase 64 establishes `team.exceptions.tpe[]` as the ONLY canonical persisted location for TPEs.
 * Legacy `team.tradeExceptions[]` is supported for backward-compatible READS, but NEVER persisted.
 *
 * This module provides:
 * 1) `normalizeTeamTpeSchema(team)` - Merge legacy → canonical and remove legacy field (for persistence)
 * 2) `getTeamTpeList(team)` - Read helper that falls back to legacy for old worlds
 *
 * TELEMETRY (Phase 66/67):
 * - getTeamTpeList tracks when falling back to legacy tradeExceptions
 * - QUIET BY DEFAULT: Set LOG_LEGACY_TPE_FALLBACK=true to enable console warnings
 * - Counter still increments for programmatic access via getLegacyTpeFallbackCount()
 * - Telemetry hooks retained for future debugging; can be removed in Phase 68+
 */

import type { TradeExceptionRecord } from '@/features/architect/utils/tradeMachine/constants/types';

type UnknownRecord = Record<string, unknown>;

export interface TeamTpeLike extends UnknownRecord {
  teamCode?: unknown;
  id?: unknown;
  tradeExceptions?: unknown;
  exceptions?: (UnknownRecord & { tpe?: unknown }) | null;
}

export interface TradeExceptionLike
  extends TradeExceptionRecord,
    UnknownRecord {}

interface LegacyTpeFallbackTelemetry {
  count: number;
  lastWarning: number | null;
}

// ============================================================================
// Phase 66 Telemetry - Legacy Fallback Detection
// ============================================================================
/**
 * In-memory counter for legacy TPE fallback reads.
 * Used for telemetry during migration rollout.
 */
const legacyTpeFallbackTelemetry: LegacyTpeFallbackTelemetry = {
  count: 0,
  lastWarning: null,
};

/**
 * Check if legacy TPE fallback telemetry should be logged.
 * QUIET BY DEFAULT (Phase 67): Only logs when LOG_LEGACY_TPE_FALLBACK=true.
 * Counter still increments silently for programmatic access.
 */
function shouldLogLegacyTpeFallback(): boolean {
  // Only log when explicitly enabled via env var
  if (typeof process !== 'undefined' && process.env) {
    return process.env.LOG_LEGACY_TPE_FALLBACK === 'true';
  }
  // Default: quiet (no logging)
  return false;
}

/**
 * Record a legacy TPE fallback read for telemetry.
 */
function recordLegacyTpeFallback(team: TeamTpeLike | null | undefined): void {
  legacyTpeFallbackTelemetry.count++;

  if (shouldLogLegacyTpeFallback()) {
    // Rate limit warnings to avoid console spam (max 1 per 5 seconds)
    const now = Date.now();
    if (
      !legacyTpeFallbackTelemetry.lastWarning ||
      now - legacyTpeFallbackTelemetry.lastWarning > 5000
    ) {
      const teamId = team?.teamCode || team?.id || 'unknown';
      console.warn(
        `[Phase66 Telemetry] Legacy TPE fallback used for team "${teamId}". ` +
          `Total fallbacks: ${legacyTpeFallbackTelemetry.count}. ` +
          `Consider running migration script.`
      );
      legacyTpeFallbackTelemetry.lastWarning = now;
    }
  }
}

/**
 * Get the current legacy TPE fallback count.
 * Exported for testing telemetry behavior.
 */
export function getLegacyTpeFallbackCount(): number {
  return legacyTpeFallbackTelemetry.count;
}

/**
 * Reset legacy TPE fallback telemetry.
 * Exported for testing purposes only.
 */
export function resetLegacyTpeFallbackTelemetry(): void {
  legacyTpeFallbackTelemetry.count = 0;
  legacyTpeFallbackTelemetry.lastWarning = null;
}

/**
 * Generate a deterministic identity key for a TPE item.
 * Prefers `id` field if available; falls back to stable JSON hash.
 *
 * @param tpe - Trade exception object
 * @returns Identity key for deduplication
 */
export function getTpeIdentityKey(tpe: TradeExceptionLike | null | undefined): string {
  if (tpe && tpe.id) {
    return `id:${tpe.id}`;
  }
  // Fallback: stable JSON stringify (sorted keys for determinism)
  // This handles edge cases where TPE lacks an id field
  const stableFields = [
    'totalAmount',
    'amount',
    'createdFrom',
    'createdOn',
    'expiresOn',
    'createdSeason',
  ];
  const signature = stableFields
    .filter((key) => tpe && tpe[key] !== undefined)
    .map((key) => `${key}:${JSON.stringify(tpe?.[key])}`)
    .join('|');
  return `sig:${signature}`;
}

/**
 * Normalize team TPE schema for persistence.
 *
 * Behavior:
 * 1) If `team.tradeExceptions` exists and is an array:
 *    - Ensure `team.exceptions` object exists
 *    - Ensure `team.exceptions.tpe` array exists
 *    - Merge legacy entries into `team.exceptions.tpe` (deduped by id)
 * 2) Deduplicate deterministically (canonical wins over legacy)
 * 3) Remove `team.tradeExceptions` from the returned object
 */
export function normalizeTeamTpeSchema<T>(team: T): T {
  // Null/undefined passthrough
  if (!team || typeof team !== 'object') {
    return team;
  }

  const teamRecord = team as TeamTpeLike;

  // Start with a shallow copy
  const result: TeamTpeLike = { ...teamRecord };

  // Collect legacy TPEs
  const legacyTPEs = Array.isArray(result.tradeExceptions)
    ? (result.tradeExceptions as TradeExceptionLike[])
    : [];

  // Collect canonical TPEs
  const canonicalTPEs = Array.isArray(result.exceptions?.tpe)
    ? (result.exceptions?.tpe as TradeExceptionLike[])
    : [];

  // If neither source has TPEs and tradeExceptions doesn't exist, nothing to do
  if (
    legacyTPEs.length === 0 &&
    canonicalTPEs.length === 0 &&
    !('tradeExceptions' in result)
  ) {
    return result as T;
  }

  // Build merged set with canonical taking precedence
  // Use Map for dedup: key = identity, value = TPE object
  const mergedMap = new Map<string, TradeExceptionLike>();

  // Add legacy first (so canonical can override)
  for (const tpe of legacyTPEs) {
    const key = getTpeIdentityKey(tpe);
    mergedMap.set(key, tpe);
  }

  // Add canonical (overrides legacy if same key)
  for (const tpe of canonicalTPEs) {
    const key = getTpeIdentityKey(tpe);
    mergedMap.set(key, tpe);
  }

  // Convert to array (order by key for determinism)
  const mergedTPEs = Array.from(mergedMap.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([, tpe]) => tpe);

  // Ensure exceptions object exists
  result.exceptions = result.exceptions ? { ...result.exceptions } : {};

  // Set canonical TPE location
  result.exceptions.tpe = mergedTPEs;

  // CRITICAL: Remove legacy field so it cannot be persisted
  delete result.tradeExceptions;

  return result as T;
}

/**
 * Normalize a single TPE object to include UI-expected aliases.
 *
 * Firestore stores: totalAmount, remainingAmount, expiresOn
 * UI components read: amount, remaining, expirationDate
 *
 * This function ensures both sets of field names are present,
 * so downstream consumers work regardless of data source.
 */
function normalizeTpeFields<T>(tpe: T): T {
  if (!tpe || typeof tpe !== 'object') return tpe;

  const normalized = { ...(tpe as TradeExceptionLike) };

  // amount ↔ totalAmount (prefer whichever exists)
  if (normalized.totalAmount != null && normalized.amount == null) {
    normalized.amount = normalized.totalAmount;
  } else if (normalized.amount != null && normalized.totalAmount == null) {
    normalized.totalAmount = normalized.amount;
  }

  // remaining ↔ remainingAmount (prefer whichever exists, fall back to amount)
  if (normalized.remainingAmount != null && normalized.remaining == null) {
    normalized.remaining = normalized.remainingAmount;
  } else if (
    normalized.remaining != null &&
    normalized.remainingAmount == null
  ) {
    normalized.remainingAmount = normalized.remaining;
  } else if (
    normalized.remaining == null &&
    normalized.remainingAmount == null
  ) {
    // If neither is set, default to amount (full capacity)
    normalized.remaining = normalized.amount ?? normalized.totalAmount ?? 0;
    normalized.remainingAmount = normalized.remaining;
  }

  // expirationDate ↔ expiresOn (prefer whichever exists)
  if (normalized.expiresOn != null && normalized.expirationDate == null) {
    normalized.expirationDate = normalized.expiresOn;
  } else if (
    normalized.expirationDate != null &&
    normalized.expiresOn == null
  ) {
    normalized.expiresOn = normalized.expirationDate;
  }

  // name ↔ createdFrom (UI reads tpe.name, Firestore stores createdFrom)
  if (normalized.createdFrom != null && normalized.name == null) {
    normalized.name = normalized.createdFrom;
  } else if (normalized.name != null && normalized.createdFrom == null) {
    normalized.createdFrom = normalized.name;
  }

  return normalized as T;
}

type TeamTpeReadSource = 'canonical' | 'compatibility' | 'none';

interface ResolvedTeamTpeRead {
  source: TeamTpeReadSource;
  rawList: unknown[];
}

function getCanonicalTeamTpeList(
  team: TeamTpeLike | null | undefined
): unknown[] | null {
  if (Array.isArray(team?.exceptions?.tpe) && team.exceptions.tpe.length > 0) {
    return team.exceptions.tpe as unknown[];
  }

  return null;
}

function getLegacyTeamTpeFallbackList(
  team: TeamTpeLike | null | undefined
): unknown[] | null {
  if (Array.isArray(team?.tradeExceptions)) {
    return team.tradeExceptions as unknown[];
  }

  return null;
}

function resolveTeamTpeRead(
  team: TeamTpeLike | null | undefined
): ResolvedTeamTpeRead {
  if (!team || typeof team !== 'object') {
    return { source: 'none', rawList: [] };
  }

  const canonicalTpeList = getCanonicalTeamTpeList(team);
  if (canonicalTpeList) {
    return {
      source: 'canonical',
      rawList: canonicalTpeList,
    };
  }

  const legacyTpeList = getLegacyTeamTpeFallbackList(team);
  if (legacyTpeList) {
    recordLegacyTpeFallback(team);
    return {
      source: 'compatibility',
      rawList: legacyTpeList,
    };
  }

  return { source: 'none', rawList: [] };
}

/**
 * Read helper for getting team TPE list.
 * Prefers canonical location, falls back to legacy for old worlds.
 *
 * Use this helper in read-heavy logic that needs to access TPEs
 * from teams that may still have data in the legacy location.
 *
 * Phase 66: Records telemetry when fallback to legacy location is used.
 * Phase 68: Normalizes TPE field names so UI consumers always find
 *           amount, remaining, expirationDate regardless of data source.
 *
 * @param team - Team object
 * @returns Array of TPE objects with normalized fields (may be empty)
 */
export function getTeamTpeList(team: TeamTpeLike | null | undefined): TradeExceptionLike[] {
  const resolvedRead = resolveTeamTpeRead(team);

  if (resolvedRead.source === 'none') {
    return [];
  }

  // Phase 68: Normalize field names for all consumers
  return resolvedRead.rawList.map((tpe) =>
    normalizeTpeFields(tpe as TradeExceptionLike)
  );
}
