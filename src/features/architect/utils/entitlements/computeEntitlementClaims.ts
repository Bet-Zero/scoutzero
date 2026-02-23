/**
 * FILE: src/features/architect/utils/entitlements/computeEntitlementClaims.ts
 * PURPOSE: Pure "Claims Model" that converts an entitlement into a normalized set
 *          of claim fingerprints for explainability, display, and comparison.
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates — Explainability)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E4 (Claims Model + Explainability).
 *
 * INVARIANTS:
 *  - Pure function — no Firestore, no side effects.
 *  - Claims are deterministic and stable: same entitlement always produces same claims.
 *  - Claim keys use the same normalization as the exclusivity validator.
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.9
 */

import type { EntitlementDocLike } from './entitlementExclusivityValidator';

// ─── claim types ─────────────────────────────────────────────────────────────

/**
 * The type of resource an entitlement claims.
 *
 * - OWNERSHIP_UNDERLIER: "I own this pick."
 * - SWAP_CONTROLLER: "I control the swap decision for this pick."
 * - CONVEYANCE_POOL_RANK_EXACT: "I claim exactly these ranks from this pool."
 * - CONVEYANCE_POOL_RANK_OVERLAP: "I claim some ranks from this pool (may overlap with others)."
 */
export type EntitlementClaimType =
  | 'OWNERSHIP_UNDERLIER'
  | 'SWAP_CONTROLLER'
  | 'CONVEYANCE_POOL_RANK_EXACT'
  | 'CONVEYANCE_POOL_RANK_OVERLAP';

/**
 * Human-readable metadata for a single claim.
 */
export interface EntitlementClaimMeta {
  /** One-line explanation for non-technical users. */
  explanation: string;
  /** The entitlement kind that produced this claim. */
  kind: string;
  /** Underlying pick ID (for ownership / swap). */
  underlyingPickId?: string;
  /** Pool pick IDs (for conveyance). */
  poolPickIds?: string[];
  /** Comparator used for conveyance selection. */
  comparator?: string;
  /** Ranks claimed (for conveyance). */
  ranks?: number[];
}

/**
 * A single normalized claim fingerprint.
 */
export interface EntitlementClaim {
  /** What type of resource is claimed. */
  type: EntitlementClaimType;
  /** Canonical collision key — matches the validator's comparison logic. */
  key: string;
  /** Human-readable context for UI display. */
  meta: EntitlementClaimMeta;
}

/**
 * Result of computing claims for a single entitlement.
 */
export interface EntitlementClaimsResult {
  /** The entitlement ID (or '(no id)' if missing). */
  entitlementId: string;
  /** All claims derived from this entitlement. */
  claims: EntitlementClaim[];
}

// ─── normalization helpers (mirror validator) ────────────────────────────────

/** Sort and join pool IDs for order-insensitive key. */
function normalizePoolKey(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return '';
  return [...ids].sort().join('|');
}

/** Parse to integers, sort, dedupe, return stable array. */
function normalizeRanks(ranks: (number | string)[] | undefined): number[] {
  if (!ranks || ranks.length === 0) return [];
  const parsed = ranks
    .map((r) => (typeof r === 'string' ? parseInt(r, 10) : r))
    .filter((n) => !isNaN(n));
  return [...new Set(parsed)].sort((a, b) => a - b);
}

/** Lowercase + trim comparator. */
function normalizeComparator(c: string | undefined): string {
  return (c || '').toLowerCase().trim();
}

// ─── human-readable helpers ──────────────────────────────────────────────────

/** Format a pick ID for display: "LAL_2026_1st" → "LAL 2026 1st". */
function formatPickId(pickId: string): string {
  return pickId.replace(/_/g, ' ');
}

/** Format a comparator for display. */
function formatComparator(comp: string): string {
  switch (comp) {
    case 'more_favorable':
      return 'most favorable';
    case 'less_favorable':
      return 'least favorable';
    case 'middle':
      return 'middle';
    default:
      return comp || '(unknown)';
  }
}

/** Format ranks for display. */
function formatRanks(ranks: number[]): string {
  if (ranks.length === 0) return '(none)';
  if (ranks.length === 1) return `rank #${ranks[0]}`;
  return `ranks #${ranks.join(', #')}`;
}

// ─── main function ───────────────────────────────────────────────────────────

/**
 * Compute the normalized claim fingerprints for a single entitlement document.
 *
 * This is purely derived from the entitlement doc — no Firestore, no side effects.
 * Claims are deterministic: the same entitlement always produces the same claims.
 *
 * @param doc — An entitlement document (or doc-like shape from the validator).
 * @returns `{ entitlementId, claims }` — the list of claims this entitlement makes.
 */
export function computeEntitlementClaims(
  doc: EntitlementDocLike
): EntitlementClaimsResult {
  const entitlementId = (doc.id as string) || '(no id)';
  const claims: EntitlementClaim[] = [];

  const kind = doc.kind || '';

  // ── pick_ownership → OWNERSHIP_UNDERLIER ──
  if (kind === 'pick_ownership' && doc.underlyingPickId) {
    const pickId = doc.underlyingPickId;
    claims.push({
      type: 'OWNERSHIP_UNDERLIER',
      key: `own:${pickId}`,
      meta: {
        explanation: `Owns the ${formatPickId(pickId)} pick`,
        kind,
        underlyingPickId: pickId,
      },
    });
  }

  // ── swap_right → SWAP_CONTROLLER ──
  if (kind === 'swap_right' && doc.swapControllerPickId) {
    const pickId = doc.swapControllerPickId;
    claims.push({
      type: 'SWAP_CONTROLLER',
      key: `swap:${pickId}`,
      meta: {
        explanation: `Controls swap decision for ${formatPickId(pickId)}`,
        kind,
        underlyingPickId: pickId,
      },
    });
  }

  // ── conveyance_right → CONVEYANCE_POOL_RANK_EXACT ──
  // One claim per conveyance: captures the exact pool+comparator+ranks fingerprint,
  // plus an overlap variant for partial-match detection.
  if (kind === 'conveyance_right') {
    const pool = doc.poolUnderlyingPickIds || [];
    const ranks = normalizeRanks(doc.receivesRank);
    const comparator = normalizeComparator(doc.receivesComparator);
    const poolKey = normalizePoolKey(pool);

    if (poolKey && comparator) {
      // Exact claim: full pool + comparator + ranks
      const ranksKey = ranks.join(',');
      claims.push({
        type: 'CONVEYANCE_POOL_RANK_EXACT',
        key: `conv:${poolKey}:${comparator}:${ranksKey}`,
        meta: {
          explanation: `Receives ${formatComparator(comparator)} pick from pool [${pool.map(formatPickId).join(', ')}] at ${formatRanks(ranks)}`,
          kind,
          poolPickIds: [...pool].sort(),
          comparator,
          ranks,
        },
      });

      // Overlap claim: each individual pool pick + rank combination.
      // These are the atomic units that can conflict with other conveyance entitlements.
      if (pool.length > 0 && ranks.length > 0) {
        claims.push({
          type: 'CONVEYANCE_POOL_RANK_OVERLAP',
          key: `conv-overlap:${poolKey}:${comparator}:${ranksKey}`,
          meta: {
            explanation: `Claims ${formatRanks(ranks)} from pool [${pool.map(formatPickId).join(', ')}] under ${formatComparator(comparator)} selection`,
            kind,
            poolPickIds: [...pool].sort(),
            comparator,
            ranks,
          },
        });
      }
    }
  }

  return { entitlementId, claims };
}

// ─── batch helper ────────────────────────────────────────────────────────────

/**
 * Compute claims for an array of entitlements.
 * Convenience wrapper for UI components that display multiple entitlements.
 */
export function computeEntitlementClaimsBatch(
  docs: EntitlementDocLike[]
): EntitlementClaimsResult[] {
  return docs.map(computeEntitlementClaims);
}

// ─── conflict explainer ──────────────────────────────────────────────────────

/**
 * Human-readable conflict type labels for non-technical users.
 */
export const CONFLICT_TYPE_LABELS: Record<string, string> = {
  DUP_PICK_OWNERSHIP_UNDERLIER: 'Duplicate pick ownership',
  DUP_SWAP_CONTROLLER: 'Duplicate swap controller',
  DUP_CONVEYANCE_POOL_RANK: 'Duplicate conveyance right',
  OVERLAP_CONVEYANCE_POOL_RANK: 'Overlapping conveyance right',
  OVERLAP_PROTECTION_RANGE: 'Overlapping protection ranges',
};

/**
 * Generate a short, user-friendly "why this conflicts" string
 * given two sets of claims and a violation type.
 */
export function explainConflict(
  violationType: string,
  claimsA: EntitlementClaim[],
  claimsB: EntitlementClaim[]
): string {
  const label = CONFLICT_TYPE_LABELS[violationType] ?? 'Entitlement conflict';

  // Find the matching claim pair
  const matchingClaimA = claimsA.find((a) =>
    claimsB.some((b) => a.key === b.key)
  );

  if (matchingClaimA) {
    return `${label}: ${matchingClaimA.meta.explanation}`;
  }

  // Fallback: just use the label
  return label;
}
