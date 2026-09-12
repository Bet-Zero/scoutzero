/** CBA2-A12.1 ownership component for authenticated, full original picks only. */
import { DraftOriginalOwnershipFactZ } from '@/schemas/draftPickOperation';
import { computeEntitlementClaims } from '@/features/architect/utils/entitlements/computeEntitlementClaims';
import {
  draftFactProblem,
  draftRuleDecision,
  parseDraftOperationRequest,
  selectDraftOperationFact,
  type DraftRuleDecision,
} from '@/features/architect/utils/draftPickInputResolver';

export function evaluateOriginalDraftPickOwnership(
  requestInput: unknown,
  facts: unknown[]
): DraftRuleDecision {
  const leaf = 'CBA2-A12.1';
  const request = parseDraftOperationRequest(requestInput);
  if (!request)
    return draftRuleDecision(leaf, 'needs-input', [
      'invalid-or-unsupported-request',
    ]);
  const missing: string[] = [],
    prohibited: string[] = [],
    evidence: string[] = [];
  for (const pick of request.outgoing) {
    const selected = selectDraftOperationFact(
      facts,
      DraftOriginalOwnershipFactZ,
      { scope: 'original-pick-ownership', pickId: pick.id }
    );
    if (!selected.fact) {
      missing.push(`${pick.id}:${selected.reason}`);
      continue;
    }
    const fact = selected.fact;
    const problem = draftFactProblem(fact, request.context);
    if (problem) {
      missing.push(`${pick.id}:${problem}`);
      continue;
    }
    evidence.push(fact.id);
    const current = fact.claims.filter(
      (c) => c.status === 'owned-unconditionally'
    );
    const normalized = current.flatMap(
      (c) =>
        computeEntitlementClaims({
          id: c.id,
          kind: 'pick_ownership',
          underlyingPickId: fact.pick.id,
        }).claims
    );
    if (
      new Set(fact.claims.map((c) => c.id)).size !== fact.claims.length ||
      new Set(normalized.map((c) => c.key)).size !== normalized.length
    ) {
      missing.push(`${pick.id}:conflicting-ownership-claims`);
      continue;
    }
    if (
      fact.claims.some((c) => c.status === 'conditional-right-unimplemented') ||
      fact.claimCoverage !== 'complete' ||
      fact.unresolvedDependencyIds.length
    ) {
      missing.push(`${pick.id}:incomplete-or-unsupported-claim-coverage`);
      continue;
    }
    if (current.length !== 1 || current[0].team !== request.context.team)
      prohibited.push(`${pick.id}:not-currently-owned-by-conveying-team`);
  }
  // An independently established ownership prohibition is enough to reject.
  if (prohibited.length)
    return draftRuleDecision(leaf, 'component-prohibits', prohibited, evidence);
  return draftRuleDecision(
    leaf,
    missing.length ? 'needs-input' : 'component-permits',
    missing,
    evidence
  );
}
