/** CBA2-A12.3 / L09.6: supplied possible branches, never inferred clause meaning. */
import {
  DraftStepienFactZ,
  type DraftStepienFact,
} from '@/schemas/draftPickOperation';
import {
  draftFactProblem,
  draftRuleDecision,
  parseDraftOperationRequest,
  selectDraftOperationFact,
  type DraftRuleDecision,
} from '@/features/architect/utils/draftPickInputResolver';

type Pair = {
  branchId: string;
  years: [number, number];
  possession: 'present' | 'empty' | 'unknown';
};
export type DraftStepienDecision = DraftRuleDecision & { pairs: Pair[] };

function invalidBranchStructure(fact: DraftStepienFact) {
  return (
    new Set(fact.branches.map((b) => b.id)).size !== fact.branches.length ||
    fact.branches.some(
      (b) =>
        new Set(b.drafts.map((d) => d.draftYear)).size !== b.drafts.length ||
        b.drafts.some(
          (d) =>
            d.draftYear < fact.firstFutureDraftYear ||
            d.draftYear > fact.throughDraftYear ||
            d.retained.some((p) => p.draftYear !== d.draftYear) ||
            new Set(d.retained.map((p) => p.id)).size !== d.retained.length
        )
    )
  );
}

export function evaluateSuppliedDraftStepien(
  requestInput: unknown,
  facts: unknown[]
): DraftStepienDecision {
  const leaf = 'CBA2-L09.6';
  const blocked = (reason: string): DraftStepienDecision => ({
    ...draftRuleDecision(leaf, 'needs-input', [reason]),
    pairs: [],
  });
  const request = parseDraftOperationRequest(requestInput);
  if (!request) return blocked('invalid-or-unsupported-request');
  const selected = selectDraftOperationFact(facts, DraftStepienFactZ, {
    scope: 'stepien-post-trade-branches',
  });
  if (!selected.fact) return blocked(selected.reason);
  const fact = selected.fact;
  const problem = draftFactProblem(fact, request.context);
  if (problem) return blocked(problem);
  if (fact.unresolvedDependencyIds.length)
    return blocked(
      `unresolved-common-branch-dependencies:${fact.unresolvedDependencyIds.join(',')}`
    );
  const at = Date.parse(request.context.asOf);
  if (
    fact.previousDraft.draftYear + 1 !== fact.firstFutureDraftYear ||
    Number(fact.previousDraft.completedAt.slice(0, 4)) !==
      fact.previousDraft.draftYear ||
    Number(fact.firstFutureDraftStartsAt.slice(0, 4)) !==
      fact.firstFutureDraftYear ||
    Date.parse(fact.previousDraft.completedAt) > at ||
    Date.parse(fact.firstFutureDraftStartsAt) <= at
  )
    return blocked('governed-between-drafts-calendar-required');
  const requestedIds = request.outgoing.map((p) => p.id).sort();
  if (
    JSON.stringify(fact.outgoing.map((p) => p.id).sort()) !==
    JSON.stringify(requestedIds)
  )
    return blocked('wrong-post-trade-outgoing-rights');
  if (
    fact.throughDraftYear < fact.firstFutureDraftYear ||
    request.outgoing.some(
      (p) =>
        p.draftYear < fact.firstFutureDraftYear ||
        p.draftYear > fact.throughDraftYear
    )
  )
    return blocked('incomplete-or-wrong-future-draft-window');
  if (invalidBranchStructure(fact))
    return blocked('conflicting-or-wrong-year-branch-inventory');
  if (
    fact.branches.some((b) =>
      b.drafts.some((d) => d.retained.some((p) => requestedIds.includes(p.id)))
    )
  )
    return blocked('outgoing-original-pick-still-retained');

  const pairs: Pair[] = [];
  for (const branch of fact.branches) {
    const possession = (year: number): 'present' | 'empty' | 'unknown' => {
      if (branch.unresolvedDependencyIds.length) return 'unknown';
      if (year > fact.throughDraftYear)
        return fact.laterDrafts === 'guaranteed-first-every-draft'
          ? 'present'
          : 'unknown';
      const draft = branch.drafts.find((d) => d.draftYear === year);
      return draft?.retained.length
        ? 'present'
        : draft?.inventoryComplete
          ? 'empty'
          : 'unknown';
    };
    // Include the boundary pair; all later pairs require the established tail.
    for (
      let year = fact.firstFutureDraftYear;
      year <= fact.throughDraftYear;
      year++
    ) {
      const a = possession(year),
        b = possession(year + 1);
      pairs.push({
        branchId: branch.id,
        years: [year, year + 1],
        possession:
          a === 'present' || b === 'present'
            ? 'present'
            : a === 'empty' && b === 'empty'
              ? 'empty'
              : 'unknown',
      });
    }
  }
  const violations = pairs.filter((p) => p.possession === 'empty');
  if (violations.length)
    return {
      ...draftRuleDecision(
        leaf,
        'component-prohibits',
        violations.map((p) => `${p.branchId}:no-first-in-${p.years.join('/')}`),
        [fact.id]
      ),
      pairs,
    };
  const missing = [
    ...(!fact.branchesComplete || !fact.branches.length
      ? ['complete-possible-branch-set-required']
      : []),
    ...(fact.laterDrafts !== 'guaranteed-first-every-draft'
      ? ['future-draft-tail-not-established']
      : []),
    ...fact.unresolvedDependencyIds.map(
      (id) => `unresolved-branch-dependency:${id}`
    ),
    ...pairs
      .filter((p) => p.possession === 'unknown')
      .map((p) => `${p.branchId}:unknown-${p.years.join('/')}`),
  ];
  return {
    ...draftRuleDecision(
      leaf,
      missing.length ? 'needs-input' : 'component-permits',
      missing,
      [fact.id]
    ),
    pairs,
  };
}
