/**
 * FILE: src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js
 * PURPOSE: Normalize TPE schema from dual-source (legacy tradeExceptions + canonical exceptions.tpe)
 *          to single canonical location (exceptions.tpe) for persistence.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
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
 * Deduplication strategy:
 * - Uses TPE `id` field as primary identity key
 * - Falls back to deterministic JSON signature if no `id` present (edge case)
 * - When duplicates exist, canonical (exceptions.tpe) wins over legacy (tradeExceptions)
 */

/**
 * Generate a deterministic identity key for a TPE item.
 * Prefers `id` field if available; falls back to stable JSON hash.
 *
 * @param {Object} tpe - Trade exception object
 * @returns {string} Identity key for deduplication
 */
function getTpeIdentityKey(tpe) {
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
    .map((key) => `${key}:${JSON.stringify(tpe[key])}`)
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
 *
 * @param {Object} team - Team object (may contain tradeExceptions and/or exceptions.tpe)
 * @returns {Object} New team object with canonical TPE location only (pure, no mutation)
 */
export function normalizeTeamTpeSchema(team) {
  // Null/undefined passthrough
  if (!team || typeof team !== 'object') {
    return team;
  }

  // Start with a shallow copy
  const result = { ...team };

  // Collect legacy TPEs
  const legacyTPEs = Array.isArray(result.tradeExceptions)
    ? result.tradeExceptions
    : [];

  // Collect canonical TPEs
  const canonicalTPEs = Array.isArray(result.exceptions?.tpe)
    ? result.exceptions.tpe
    : [];

  // If neither source has TPEs and tradeExceptions doesn't exist, nothing to do
  if (
    legacyTPEs.length === 0 &&
    canonicalTPEs.length === 0 &&
    !('tradeExceptions' in result)
  ) {
    return result;
  }

  // Build merged set with canonical taking precedence
  // Use Map for dedup: key = identity, value = TPE object
  const mergedMap = new Map();

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

  return result;
}

/**
 * Read helper for getting team TPE list.
 * Prefers canonical location, falls back to legacy for old worlds.
 *
 * Use this helper in read-heavy logic that needs to access TPEs
 * from teams that may still have data in the legacy location.
 *
 * @param {Object} team - Team object
 * @returns {Array} Array of TPE objects (may be empty)
 */
export function getTeamTpeList(team) {
  if (!team || typeof team !== 'object') {
    return [];
  }

  // Prefer canonical location
  if (Array.isArray(team.exceptions?.tpe) && team.exceptions.tpe.length > 0) {
    return team.exceptions.tpe;
  }

  // Fallback to legacy location for old worlds
  if (Array.isArray(team.tradeExceptions)) {
    return team.tradeExceptions;
  }

  return [];
}

// Export identity key function for testing
export { getTpeIdentityKey };
