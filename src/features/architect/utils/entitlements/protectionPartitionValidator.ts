/**
 * FILE: src/features/architect/utils/entitlements/protectionPartitionValidator.ts
 * PURPOSE: Pure validation for partitioned protection ranges on the same underlying pick.
 *          Ensures two entitlements claiming the same pick define disjoint position ranges.
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E5 (Structured Protections + Partition Validation).
 *
 * INVARIANTS:
 *  - Pure function — no Firestore, no side effects.
 *  - Integrity-first: missing structuredCondition → VALIDATION_UNAVAILABLE.
 *  - Works only on pick_ownership entitlements sharing the same underlyingPickId.
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.10
 */

// ─── types ───────────────────────────────────────────────────────────────────

/** Minimal structured condition for position-range coverage. */
export interface StructuredConditionLike {
  positionStart: number;
  positionEnd: number;
}

/** Minimal protection ladder tier shape needed for partition validation. */
export interface ProtectionTierLike {
  year: number;
  condition?: string;
  structuredCondition?: StructuredConditionLike;
}

/** Minimal entitlement shape needed for partition validation. */
export interface PartitionEntitlementLike {
  id?: string;
  kind?: string;
  underlyingPickId?: string;
  protectionLadder?: ProtectionTierLike[];
}

/** Coverage sets produced by expandProtectionCoverage. */
export interface ProtectionCoverageResult {
  /** Draft positions protected by this tier (e.g., 1–10 for "Top 10"). */
  protectedPositions: Set<number>;
  /** Remaining draft positions not covered by the protection. */
  unprotectedPositions: Set<number>;
}

/** Result of partition validation for a single pair. */
export type PartitionPairResult = 'VALID_PARTITION' | 'OVERLAP' | 'UNAVAILABLE';

/** Violation detail for overlapping protection ranges. */
export interface ProtectionPartitionViolation {
  type: 'OVERLAP_PROTECTION_RANGE';
  message: string;
  entitlementIds: string[];
  underlyingPickId: string;
  details: {
    overlappingPositions: number[];
    rangeA: StructuredConditionLike;
    rangeB: StructuredConditionLike;
    year: number;
  };
}

/** Full partition validation result. */
export type ProtectionPartitionResult =
  | { status: 'VALID' }
  | { status: 'INVALID'; violations: ProtectionPartitionViolation[] }
  | {
      status: 'VALIDATION_UNAVAILABLE';
      reason: string;
      entitlementIds: string[];
    }
  | { status: 'NOT_APPLICABLE' };

// ─── constants ───────────────────────────────────────────────────────────────

/** Default number of first-round draft positions (NBA = 30 teams). */
const DEFAULT_MAX_POSITION = 30;

// ─── expandProtectionCoverage ────────────────────────────────────────────────

/**
 * Given a draft year and a protection ladder, expand the tier for that year
 * into explicit sets of protected and unprotected positions.
 *
 * @param year — The draft year to look up.
 * @param ladder — Protection ladder (array of tiers).
 * @param maxPosition — Maximum position to consider (default: 30).
 * @returns Coverage sets, or null if no tier found for that year
 *          or if structuredCondition is missing.
 *
 * @example
 * // "Top 10 protected" for 2026
 * expandProtectionCoverage(2026, [
 *   { year: 2026, condition: 'Top 10', structuredCondition: { positionStart: 1, positionEnd: 10 } }
 * ]);
 * // => { protectedPositions: Set(1..10), unprotectedPositions: Set(11..30) }
 */
export function expandProtectionCoverage(
  year: number,
  ladder: ProtectionTierLike[] | null | undefined,
  maxPosition: number = DEFAULT_MAX_POSITION
): ProtectionCoverageResult | null {
  if (!ladder || ladder.length === 0) return null;

  // Find the tier for the requested year
  const tier = ladder.find((t) => t.year === year);
  if (!tier) return null;

  // Require structuredCondition for machine-readable expansion
  const sc = tier.structuredCondition;
  if (
    !sc ||
    typeof sc.positionStart !== 'number' ||
    typeof sc.positionEnd !== 'number'
  ) {
    return null;
  }

  const protectedPositions = new Set<number>();
  const unprotectedPositions = new Set<number>();

  const start = Math.max(1, sc.positionStart);
  const end = Math.min(maxPosition, sc.positionEnd);

  for (let pos = 1; pos <= maxPosition; pos++) {
    if (pos >= start && pos <= end) {
      protectedPositions.add(pos);
    } else {
      unprotectedPositions.add(pos);
    }
  }

  return { protectedPositions, unprotectedPositions };
}

// ─── checkProtectionPartitionPair ────────────────────────────────────────────

/**
 * Check whether two entitlements with the same underlyingPickId form a valid
 * (disjoint) protection partition or have overlapping coverage.
 *
 * Used internally by the exclusivity validator for Rule #5.
 *
 * @param a — First entitlement.
 * @param b — Second entitlement.
 * @returns 'VALID_PARTITION' if disjoint, 'OVERLAP' if ranges conflict,
 *          'UNAVAILABLE' if structuredCondition is missing.
 */
export function checkProtectionPartitionPair(
  a: PartitionEntitlementLike,
  b: PartitionEntitlementLike
): PartitionPairResult {
  const ladderA = a.protectionLadder;
  const ladderB = b.protectionLadder;

  // Both must have protection ladders
  if (!ladderA?.length || !ladderB?.length) {
    return 'UNAVAILABLE';
  }

  // Collect structuredConditions by year
  const byYearA = new Map<number, StructuredConditionLike>();
  const byYearB = new Map<number, StructuredConditionLike>();

  for (const tier of ladderA) {
    if (tier.structuredCondition) {
      byYearA.set(tier.year, tier.structuredCondition);
    }
  }
  for (const tier of ladderB) {
    if (tier.structuredCondition) {
      byYearB.set(tier.year, tier.structuredCondition);
    }
  }

  // At least one side must have structuredConditions
  if (byYearA.size === 0 && byYearB.size === 0) {
    return 'UNAVAILABLE';
  }

  // Find shared years
  const sharedYears: number[] = [];
  for (const year of byYearA.keys()) {
    if (byYearB.has(year)) {
      sharedYears.push(year);
    }
  }

  // If no shared years: cannot confirm partition but both have ladders with
  // structuredConditions, so they partition by year — treat as valid
  if (sharedYears.length === 0) {
    // If one side has structuredConditions and the other doesn't for any year,
    // we still can't confirm overlap. Treat as unavailable if NEITHER has shared years
    // but both claim the same underlyingPickId.
    if (byYearA.size > 0 && byYearB.size > 0) {
      return 'VALID_PARTITION';
    }
    return 'UNAVAILABLE';
  }

  // Check each shared year for overlap
  for (const year of sharedYears) {
    const scA = byYearA.get(year)!;
    const scB = byYearB.get(year)!;

    if (rangesOverlap(scA, scB)) {
      return 'OVERLAP';
    }
  }

  return 'VALID_PARTITION';
}

/**
 * Get the first overlapping year's detail for violation reporting.
 */
export function getPartitionOverlapDetail(
  a: PartitionEntitlementLike,
  b: PartitionEntitlementLike,
  maxPosition: number = DEFAULT_MAX_POSITION
): {
  year: number;
  rangeA: StructuredConditionLike;
  rangeB: StructuredConditionLike;
  overlappingPositions: number[];
} | null {
  const ladderA = a.protectionLadder;
  const ladderB = b.protectionLadder;
  if (!ladderA?.length || !ladderB?.length) return null;

  const byYearA = new Map<number, StructuredConditionLike>();
  const byYearB = new Map<number, StructuredConditionLike>();
  for (const tier of ladderA) {
    if (tier.structuredCondition)
      byYearA.set(tier.year, tier.structuredCondition);
  }
  for (const tier of ladderB) {
    if (tier.structuredCondition)
      byYearB.set(tier.year, tier.structuredCondition);
  }

  for (const year of byYearA.keys()) {
    if (!byYearB.has(year)) continue;
    const scA = byYearA.get(year)!;
    const scB = byYearB.get(year)!;
    if (rangesOverlap(scA, scB)) {
      const overlapping = computeOverlappingPositions(scA, scB, maxPosition);
      return {
        year,
        rangeA: scA,
        rangeB: scB,
        overlappingPositions: overlapping,
      };
    }
  }

  return null;
}

// ─── validateProtectionPartition ─────────────────────────────────────────────

/**
 * Validate that entitlements sharing the same underlyingPickId have disjoint
 * protection ranges (valid partition) or detect overlaps.
 *
 * Only applies to pick_ownership entitlements. Other kinds are ignored.
 *
 * @param entitlements — Full entitlement set to validate.
 * @returns Partition validation result.
 *
 * @example
 * // Valid partition: Top 10 + 11–30
 * validateProtectionPartition([
 *   { id: 'a', kind: 'pick_ownership', underlyingPickId: 'LAL_2026_1st',
 *     protectionLadder: [{ year: 2026, condition: 'Top 10',
 *       structuredCondition: { positionStart: 1, positionEnd: 10 } }] },
 *   { id: 'b', kind: 'pick_ownership', underlyingPickId: 'LAL_2026_1st',
 *     protectionLadder: [{ year: 2026, condition: '11-30',
 *       structuredCondition: { positionStart: 11, positionEnd: 30 } }] },
 * ]);
 * // => { status: 'VALID' }
 */
export function validateProtectionPartition(
  entitlements: PartitionEntitlementLike[]
): ProtectionPartitionResult {
  // Group pick_ownership entitlements by underlyingPickId
  const groups = new Map<string, PartitionEntitlementLike[]>();

  for (const ent of entitlements) {
    if (ent.kind !== 'pick_ownership' || !ent.underlyingPickId) continue;
    const key = ent.underlyingPickId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ent);
  }

  // Filter to groups with >1 entitlement (potential partitions)
  const partitionedGroups = [...groups.entries()].filter(
    ([, ents]) => ents.length > 1
  );

  if (partitionedGroups.length === 0) {
    return { status: 'NOT_APPLICABLE' };
  }

  const violations: ProtectionPartitionViolation[] = [];

  for (const [pickId, ents] of partitionedGroups) {
    // Pairwise comparison within each group
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i];
        const b = ents[j];
        const pairResult = checkProtectionPartitionPair(a, b);

        if (pairResult === 'UNAVAILABLE') {
          // Fail-closed: cannot verify partition → VALIDATION_UNAVAILABLE
          return {
            status: 'VALIDATION_UNAVAILABLE',
            reason: `Cannot verify protection partition for ${pickId}: structuredCondition missing on one or both entitlements.`,
            entitlementIds: [a.id || '(no id)', b.id || '(no id)'],
          };
        }

        if (pairResult === 'OVERLAP') {
          const detail = getPartitionOverlapDetail(a, b);
          violations.push({
            type: 'OVERLAP_PROTECTION_RANGE',
            message: `Overlapping protection ranges for ${pickId}${detail ? ` in ${detail.year}: positions ${detail.overlappingPositions.join(', ')}` : ''}`,
            entitlementIds: [a.id || '(no id)', b.id || '(no id)'],
            underlyingPickId: pickId,
            details: {
              overlappingPositions: detail?.overlappingPositions ?? [],
              rangeA: detail?.rangeA ?? { positionStart: 0, positionEnd: 0 },
              rangeB: detail?.rangeB ?? { positionStart: 0, positionEnd: 0 },
              year: detail?.year ?? 0,
            },
          });
        }
        // pairResult === 'VALID_PARTITION' → no violation for this pair
      }
    }
  }

  if (violations.length > 0) {
    return { status: 'INVALID', violations };
  }

  return { status: 'VALID' };
}

// ─── private helpers ─────────────────────────────────────────────────────────

/** True if two ranges have any overlapping positions. */
function rangesOverlap(
  a: StructuredConditionLike,
  b: StructuredConditionLike
): boolean {
  return a.positionStart <= b.positionEnd && b.positionStart <= a.positionEnd;
}

/** Compute the set of overlapping positions between two ranges. */
function computeOverlappingPositions(
  a: StructuredConditionLike,
  b: StructuredConditionLike,
  maxPosition: number = DEFAULT_MAX_POSITION
): number[] {
  const start = Math.max(a.positionStart, b.positionStart);
  const end = Math.min(a.positionEnd, b.positionEnd, maxPosition);
  const positions: number[] = [];
  for (let pos = start; pos <= end; pos++) {
    positions.push(pos);
  }
  return positions;
}
