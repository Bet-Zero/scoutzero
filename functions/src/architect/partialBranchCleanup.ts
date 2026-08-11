export const PARTIAL_BRANCH_CLEANUP_CLAIM_FIELD = 'partialBranchCleanupClaim';

export type PartialBranchCleanupRefusalReason =
  | 'child-identity-mismatch'
  | 'child-is-visible'
  | 'child-lineage-attached'
  | 'child-lineage-malformed'
  | 'child-not-branch'
  | 'cleanup-claim-mismatch'
  | 'parent-identity-mismatch'
  | 'parent-lineage-malformed'
  | 'parent-unavailable';

type JsonRecord = Record<string, unknown>;

export type PartialBranchCleanupEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason: PartialBranchCleanupRefusalReason;
    };

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * Pure fail-closed eligibility check for the trusted partial-branch purge.
 * The callable runs this check inside the same transaction that claims the
 * child, so finalization cannot race a stale pre-read.
 */
export function evaluatePartialBranchCleanupEligibility(args: {
  childWorldId: string;
  expectedParentWorldId: string;
  ownerId: string;
  child: JsonRecord;
  parent: JsonRecord | null;
}): PartialBranchCleanupEligibility {
  const { childWorldId, expectedParentWorldId, ownerId, child, parent } = args;

  if (child.worldId !== childWorldId || child.createdBy !== ownerId) {
    return { eligible: false, reason: 'child-identity-mismatch' };
  }
  if (child.isArchived !== true) {
    return { eligible: false, reason: 'child-is-visible' };
  }
  if (
    child.parentWorldId !== expectedParentWorldId ||
    child.branchedFrom == null
  ) {
    return { eligible: false, reason: 'child-not-branch' };
  }
  if (!isStringArray(child.childWorlds) || child.childWorlds.length > 0) {
    return { eligible: false, reason: 'child-lineage-malformed' };
  }
  if (
    Object.prototype.hasOwnProperty.call(
      child,
      PARTIAL_BRANCH_CLEANUP_CLAIM_FIELD
    )
  ) {
    const claim = child[PARTIAL_BRANCH_CLEANUP_CLAIM_FIELD];
    if (
      !isRecord(claim) ||
      claim.state !== 'claimed' ||
      claim.childWorldId !== childWorldId ||
      claim.parentWorldId !== expectedParentWorldId ||
      claim.ownerId !== ownerId
    ) {
      return { eligible: false, reason: 'cleanup-claim-mismatch' };
    }
  }
  if (!parent) {
    return { eligible: false, reason: 'parent-unavailable' };
  }
  if (
    parent.worldId !== expectedParentWorldId ||
    parent.createdBy !== ownerId
  ) {
    return { eligible: false, reason: 'parent-identity-mismatch' };
  }
  if (!isStringArray(parent.childWorlds)) {
    return { eligible: false, reason: 'parent-lineage-malformed' };
  }
  if (parent.childWorlds.includes(childWorldId)) {
    return { eligible: false, reason: 'child-lineage-attached' };
  }

  return { eligible: true };
}
