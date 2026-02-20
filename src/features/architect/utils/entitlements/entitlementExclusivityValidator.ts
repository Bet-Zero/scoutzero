/**
 * FILE: src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts
 * PURPOSE: Pure exclusivity validator for entitlements.
 *          Blocks overlapping claims: duplicate pick ownership, swap controllers,
 *          and conflicting conveyance rights.
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E1 (Entitlement Exclusivity Foundation).
 *
 * INVARIANTS:
 *  - Pure function — no Firestore, no side effects, no imports beyond types.
 *  - Callers must provide the comparison set; this module does not load data.
 *  - Self-edit exception: two entries sharing the same `id` never conflict.
 *
 * RULES ENFORCED:
 *  1. DUP_PICK_OWNERSHIP_UNDERLIER — Two pick_ownership with same underlyingPickId.
 *  2. DUP_SWAP_CONTROLLER — Two swap_right with same swapControllerPickId.
 *  3. DUP_CONVEYANCE_POOL_RANK — Two conveyance_right with exact same pool+comparator+ranks.
 *  4. OVERLAP_CONVEYANCE_POOL_RANK — Two conveyance_right with overlapping pool+rank under same comparator.
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10
 */

// ─── violation types ─────────────────────────────────────────────────────────

export type EntitlementViolationType =
  | 'DUP_PICK_OWNERSHIP_UNDERLIER'
  | 'DUP_SWAP_CONTROLLER'
  | 'DUP_CONVEYANCE_POOL_RANK'
  | 'OVERLAP_CONVEYANCE_POOL_RANK';

export interface EntitlementViolation {
  type: EntitlementViolationType;
  message: string;
  /** IDs of the entitlements that conflict with each other. */
  entitlementIds: string[];
  /** Underlying pick IDs involved (when applicable). */
  underlyingPickIds?: string[];
  /** Additional machine-readable context. */
  details?: Record<string, unknown>;
}

export interface ExclusivityResult {
  valid: boolean;
  violations: EntitlementViolation[];
}

// ─── minimal input type ──────────────────────────────────────────────────────

/**
 * Minimal shape required by the validator.
 * Compatible with the Zod schema output, flat Firestore docs,
 * post-trade entitlement arrays, and resolver output.
 */
export interface EntitlementDocLike {
  id?: string;
  kind?: string;
  underlyingPickId?: string;
  swapControllerPickId?: string;
  poolUnderlyingPickIds?: string[];
  receivesComparator?: string;
  receivesRank?: (number | string)[];
}

export interface ExclusivityCandidate {
  /** If editing an existing entitlement, provide its ID to skip self-collision. */
  id?: string;
  doc: EntitlementDocLike;
}

export interface ExclusivityInput {
  /** Existing entitlement set (team's current inventory). */
  entitlements: EntitlementDocLike[];
  /** Optional candidate being saved/validated against the existing set. */
  candidate?: ExclusivityCandidate;
}

// ─── normalization helpers (private) ─────────────────────────────────────────

/** Sort and join an array of IDs for order-insensitive set comparison. */
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

/** Order-insensitive equality of two string sets. */
function isSameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
}

/** True if any element exists in both arrays. */
function hasOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.some((v) => setB.has(v));
}

/** True if any element exists in both number arrays. */
function hasRankOverlap(a: number[], b: number[]): boolean {
  const setB = new Set(b);
  return a.some((v) => setB.has(v));
}

/** Normalize comparator string (lowercase, trim). */
function normalizeComparator(c: string | undefined): string {
  return (c || '').toLowerCase().trim();
}

/** Get a display-friendly ID for an entitlement (for error messages). */
function displayId(ent: EntitlementDocLike): string {
  return (ent.id as string) || '(no id)';
}

// ─── main validator ──────────────────────────────────────────────────────────

/**
 * Validate that a set of entitlements contains no overlapping/duplicate claims.
 *
 * @param input.entitlements — The existing entitlement set.
 * @param input.candidate — Optional candidate being authored/saved.
 *   If provided, it is appended to the comparison set and its `id` is used
 *   to skip self-collisions (editing an existing entitlement without identity change).
 *
 * @returns `{ valid: true, violations: [] }` if no conflicts,
 *          `{ valid: false, violations: [...] }` otherwise.
 */
export function validateEntitlementExclusivity(
  input: ExclusivityInput
): ExclusivityResult {
  const { entitlements, candidate } = input;
  const violations: EntitlementViolation[] = [];

  // Build the comparison set.
  // If a candidate is provided, append its doc (with an id marker for self-edit detection).
  const set: EntitlementDocLike[] = [...entitlements];
  if (candidate) {
    set.push({ ...candidate.doc, id: candidate.id ?? candidate.doc.id });
  }

  // Skip self-edit: two entries share the same truthy id → same entitlement being edited.
  const isSelfPair = (
    a: EntitlementDocLike,
    b: EntitlementDocLike
  ): boolean => {
    const aId = a.id;
    const bId = b.id;
    return !!aId && !!bId && aId === bId;
  };

  // Pairwise comparison (O(n²) — acceptable for team-scoped sets which are ≤100).
  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) {
      const a = set[i];
      const b = set[j];

      // Self-edit exception: if both entries share the same ID, skip.
      if (isSelfPair(a, b)) continue;

      // ── Rule 1: Duplicate pick_ownership by underlyingPickId ──
      if (
        a.kind === 'pick_ownership' &&
        b.kind === 'pick_ownership' &&
        a.underlyingPickId &&
        b.underlyingPickId &&
        a.underlyingPickId === b.underlyingPickId
      ) {
        violations.push({
          type: 'DUP_PICK_OWNERSHIP_UNDERLIER',
          message: `Duplicate pick ownership for ${a.underlyingPickId}`,
          entitlementIds: [displayId(a), displayId(b)],
          underlyingPickIds: [a.underlyingPickId],
        });
      }

      // ── Rule 2: Duplicate swap_right by swapControllerPickId ──
      if (
        a.kind === 'swap_right' &&
        b.kind === 'swap_right' &&
        a.swapControllerPickId &&
        b.swapControllerPickId &&
        a.swapControllerPickId === b.swapControllerPickId
      ) {
        violations.push({
          type: 'DUP_SWAP_CONTROLLER',
          message: `Duplicate swap controller for ${a.swapControllerPickId}`,
          entitlementIds: [displayId(a), displayId(b)],
          underlyingPickIds: [a.swapControllerPickId],
        });
      }

      // ── Rules 3 & 4: Conveyance conflicts ──
      if (a.kind === 'conveyance_right' && b.kind === 'conveyance_right') {
        const aPool = a.poolUnderlyingPickIds || [];
        const bPool = b.poolUnderlyingPickIds || [];
        const aRanks = normalizeRanks(a.receivesRank);
        const bRanks = normalizeRanks(b.receivesRank);
        const aComp = normalizeComparator(a.receivesComparator);
        const bComp = normalizeComparator(b.receivesComparator);

        const sameComparator = aComp === bComp && aComp !== '';

        if (sameComparator) {
          const poolExact = isSameSet(aPool, bPool);
          const rankExact =
            aRanks.length === bRanks.length &&
            aRanks.every((r, idx) => r === bRanks[idx]);

          // Rule 3: Exact duplicate (same pool set + same comparator + same rank set)
          if (poolExact && rankExact) {
            violations.push({
              type: 'DUP_CONVEYANCE_POOL_RANK',
              message: `Duplicate conveyance right: same pool, comparator (${aComp}), and ranks`,
              entitlementIds: [displayId(a), displayId(b)],
              underlyingPickIds: aPool.length > 0 ? aPool : undefined,
              details: {
                poolKey: normalizePoolKey(aPool),
                comparator: aComp,
                ranks: aRanks,
              },
            });
          }
          // Rule 4: Overlap (pool overlaps AND rank overlaps AND same comparator)
          // Only fire if NOT also an exact duplicate (rule 3 is more specific).
          else if (hasOverlap(aPool, bPool) && hasRankOverlap(aRanks, bRanks)) {
            const sharedPools = aPool.filter((p) => new Set(bPool).has(p));
            const sharedRanks = aRanks.filter((r) => new Set(bRanks).has(r));
            violations.push({
              type: 'OVERLAP_CONVEYANCE_POOL_RANK',
              message: `Overlapping conveyance rights: pool overlap (${sharedPools.join(', ')}), rank overlap (${sharedRanks.join(', ')}), comparator ${aComp}`,
              entitlementIds: [displayId(a), displayId(b)],
              underlyingPickIds: sharedPools,
              details: {
                sharedPools,
                sharedRanks,
                comparator: aComp,
              },
            });
          }
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
