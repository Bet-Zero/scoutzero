/**
 * FILE: src/features/architect/utils/entitlements/entitlementIdentity.ts
 * PURPOSE: Deterministic identity and ID generation for entitlements.
 *          Ensures the same logical entitlement always produces the same identity key/ID,
 *          enabling deduplication and upsert semantics.
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Dedupe Prevention (R1-R4).
 *
 * INVARIANTS:
 *  - R1: Same logical entitlement always produces the same identity key.
 *  - The identity key is deterministic based on identity fields (no randomness).
 *
 * DEDUPLICATION PHILOSOPHY:
 *  - For standard `pick_ownership`: identity is (holderTeam, year, round, kind, underlyingPickId)
 *  - For `swap_right`: identity is (holderTeam, year, round, kind, swapControllerPickId, swapTargetDefinition)
 *  - For `conveyance_right`: identity includes (poolUnderlyingPickIds sorted, receivesComparator, receivesRank)
 *  - Arrays are sorted before joining to ensure stable keys.
 */

// ─── types ───────────────────────────────────────────────────────────────────

export type EntitlementKind =
  | 'pick_ownership'
  | 'swap_right'
  | 'conveyance_right';

export interface EntitlementDocumentLike {
  holderTeam?: string;
  seasonYear?: number;
  round?: number;
  kind?: EntitlementKind | string;
  identityKey?: string;
  // pick_ownership identity fields
  underlyingPickId?: string;
  // swap_right identity fields
  swapControllerPickId?: string;
  swapTargetDefinition?: string;
  // conveyance_right identity fields
  poolUnderlyingPickIds?: string[];
  receivesComparator?: string;
  receivesRank?: number[];
  // Allow other fields
  [key: string]: unknown;
}

// ─── constants ───────────────────────────────────────────────────────────────

const KIND_SHORT: Record<string, string> = {
  pick_ownership: 'own',
  swap_right: 'swap',
  conveyance_right: 'conv',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a team code: uppercase and trimmed.
 */
function normalizeTeamCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

/**
 * Normalize a string for identity: trim, lowercase, collapse whitespace,
 * strip punctuation, and replace spaces with underscores.
 * Used for free text fields like swapTargetDefinition.
 *
 * R4: Aggressive normalization ensures visually-identical swap targets
 * produce the same identity key even if they differ in whitespace,
 * punctuation, or casing.
 */
function normalizeIdentityString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip all punctuation
    .replace(/\s+/g, '_') // collapse whitespace → underscore
    .replace(/_+/g, '_') // collapse repeated underscores
    .replace(/^_|_$/g, ''); // trim leading/trailing underscores
}

/**
 * Normalize and sort an array of strings for identity.
 * Ensures stable ordering regardless of input order.
 */
function normalizeAndSortStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

/**
 * Normalize and sort an array of numbers for identity.
 */
function normalizeAndSortNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is number =>
        typeof item === 'number' && Number.isFinite(item)
    )
    .sort((a, b) => a - b);
}

/**
 * Numeric year/round normalization.
 */
function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function hasNormalizedIdentityValue(value: unknown): boolean {
  return normalizeIdentityString(value).length > 0;
}

function hasNonEmptySortedStringArray(value: unknown): boolean {
  return normalizeAndSortStringArray(value).length > 0;
}

function hasNonEmptySortedNumberArray(value: unknown): boolean {
  return normalizeAndSortNumberArray(value).length > 0;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Compute a stable identity key for an entitlement document.
 *
 * This key uniquely identifies the "logical" entitlement based on its identity fields.
 * Two documents with the same identity key represent the same underlying entitlement.
 *
 * Format varies by kind:
 *   - pick_ownership: `own|{TEAM}|{YEAR}|{ROUND}|{underlyingPickId}`
 *   - swap_right: `swap|{TEAM}|{YEAR}|{ROUND}|{swapControllerPickId}|{swapTargetDefinition_normalized}`
 *   - conveyance_right: `conv|{TEAM}|{YEAR}|{ROUND}|{sortedPoolIds}|{comparator}|{sortedRanks}`
 *
 * @param document - The entitlement document (or partial document with identity fields)
 * @returns A stable identity key string
 */
export function getEntitlementIdentityKey(
  document: EntitlementDocumentLike
): string {
  const team = normalizeTeamCode(document.holderTeam);
  const year = normalizeNumber(document.seasonYear);
  const round = normalizeNumber(document.round);
  const kind = (document.kind as string) || 'pick_ownership';
  const kindShort = KIND_SHORT[kind] || kind;

  // Base key parts common to all kinds
  const baseParts = [kindShort, team, year, round];

  switch (kind) {
    case 'pick_ownership': {
      const underlyingPickId = normalizeIdentityString(
        document.underlyingPickId
      );
      return [...baseParts, underlyingPickId].join('|');
    }

    case 'swap_right': {
      const swapControllerPickId = normalizeIdentityString(
        document.swapControllerPickId
      );
      const swapTargetDefinition = normalizeIdentityString(
        document.swapTargetDefinition
      );
      return [...baseParts, swapControllerPickId, swapTargetDefinition].join(
        '|'
      );
    }

    case 'conveyance_right': {
      const poolIds = normalizeAndSortStringArray(
        document.poolUnderlyingPickIds
      );
      const comparator = normalizeIdentityString(document.receivesComparator);
      const ranks = normalizeAndSortNumberArray(document.receivesRank);
      // Join pool IDs with + to distinguish from other delimiters
      const poolStr = poolIds.join('+') || '_empty_';
      const rankStr = ranks.join('+') || '_empty_';
      return [...baseParts, poolStr, comparator, rankStr].join('|');
    }

    default: {
      // Fallback for unknown kinds: use base parts only
      return baseParts.join('|');
    }
  }
}

/**
 * Returns true when the document contains enough identity fields to compute
 * a reliable identity key without using persisted identityKey.
 */
export function canComputeEntitlementIdentityKey(
  document: EntitlementDocumentLike
): boolean {
  const team = normalizeTeamCode(document.holderTeam);
  const year = normalizeNumber(document.seasonYear);
  const round = normalizeNumber(document.round);
  const kind = (document.kind as string) || 'pick_ownership';

  if (!team || !year || !round) {
    return false;
  }

  switch (kind) {
    case 'pick_ownership':
      return hasNormalizedIdentityValue(document.underlyingPickId);
    case 'swap_right':
      return (
        hasNormalizedIdentityValue(document.swapControllerPickId) &&
        hasNormalizedIdentityValue(document.swapTargetDefinition)
      );
    case 'conveyance_right':
      return (
        hasNonEmptySortedStringArray(document.poolUnderlyingPickIds) &&
        hasNormalizedIdentityValue(document.receivesComparator) &&
        hasNonEmptySortedNumberArray(document.receivesRank)
      );
    default:
      return false;
  }
}

/**
 * Resolve identity key from persisted value first, then computed fallback.
 * Returns null when reliable identity computation is not possible.
 */
export function resolveStoredOrComputedIdentityKey(
  document: EntitlementDocumentLike
): string | null {
  const persisted =
    typeof document.identityKey === 'string' ? document.identityKey.trim() : '';
  if (persisted) {
    return persisted;
  }
  if (!canComputeEntitlementIdentityKey(document)) {
    return null;
  }
  return getEntitlementIdentityKey(document);
}

/**
 * Compute a deterministic entitlement ID from the document's identity fields.
 *
 * This replaces random ID generation for "create" operations, enabling upsert semantics.
 * The ID is URL-safe and follows the existing ID format patterns.
 *
 * Format: `ent:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{hash}`
 * where hash is a deterministic 8-char hash of the identity key.
 *
 * @param document - The entitlement document (or partial document with identity fields)
 * @returns A deterministic entitlement ID string
 */
export function getEntitlementDeterministicId(
  document: EntitlementDocumentLike
): string {
  const team = normalizeTeamCode(document.holderTeam);
  const year = normalizeNumber(document.seasonYear);
  const round = normalizeNumber(document.round);
  const kind = (document.kind as string) || 'pick_ownership';
  const kindShort = KIND_SHORT[kind] || kind;

  // Compute the identity key
  const identityKey = getEntitlementIdentityKey(document);

  // Generate a deterministic hash from the identity key
  // Using a simple but effective hash function (djb2)
  const hash = deterministicHash(identityKey);

  return `ent:${team}:${year}:${round}:${kindShort}:${hash}`;
}

/**
 * Compute a deterministic vacuum-prefixed entitlement ID.
 *
 * Format: `vacuum:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{hash}`
 *
 * @param document - The entitlement document (or partial document with identity fields)
 * @returns A deterministic vacuum entitlement ID string
 */
export function getVacuumDeterministicId(
  document: EntitlementDocumentLike
): string {
  const team = normalizeTeamCode(document.holderTeam);
  const year = normalizeNumber(document.seasonYear);
  const round = normalizeNumber(document.round);
  const kind = (document.kind as string) || 'pick_ownership';
  const kindShort = KIND_SHORT[kind] || kind;

  // Compute the identity key
  const identityKey = getEntitlementIdentityKey(document);

  // Generate a deterministic hash from the identity key
  const hash = deterministicHash(identityKey);

  return `vacuum:${team}:${year}:${round}:${kindShort}:${hash}`;
}

/**
 * Check if two entitlements have the same identity (represent the same logical entitlement).
 *
 * @param doc1 - First entitlement document
 * @param doc2 - Second entitlement document
 * @returns true if they represent the same logical entitlement
 */
export function isSameEntitlementIdentity(
  doc1: EntitlementDocumentLike,
  doc2: EntitlementDocumentLike
): boolean {
  return getEntitlementIdentityKey(doc1) === getEntitlementIdentityKey(doc2);
}

/**
 * Extract the identity-relevant fields from a document.
 * Useful for debugging and logging.
 *
 * @param document - The entitlement document
 * @returns Object with only the identity-relevant fields
 */
export function extractIdentityFields(
  document: EntitlementDocumentLike
): Partial<EntitlementDocumentLike> {
  const kind = document.kind || 'pick_ownership';
  const base = {
    holderTeam: document.holderTeam,
    seasonYear: document.seasonYear,
    round: document.round,
    kind: document.kind,
  };

  switch (kind) {
    case 'pick_ownership':
      return { ...base, underlyingPickId: document.underlyingPickId };

    case 'swap_right':
      return {
        ...base,
        swapControllerPickId: document.swapControllerPickId,
        swapTargetDefinition: document.swapTargetDefinition,
      };

    case 'conveyance_right':
      return {
        ...base,
        poolUnderlyingPickIds: document.poolUnderlyingPickIds,
        receivesComparator: document.receivesComparator,
        receivesRank: document.receivesRank,
      };

    default:
      return base;
  }
}

// ─── internal helpers ────────────────────────────────────────────────────────

/**
 * Deterministic hash function (djb2 variant).
 * Produces an 8-character hex string from the input.
 *
 * This is NOT cryptographic — it's designed for stable ID generation.
 */
function deterministicHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and then to hex
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, '0');
}
