/** Complete synthetic contracts. These prove no actual NBA ownership or readiness. */
import type {
  DraftOperationRequest,
  DraftOriginalFirst,
  DraftOriginalOwnershipFact,
  DraftStepienFact,
} from '@/schemas/draftPickOperation';

export const syntheticOriginal = (
  draftYear: number,
  originalTeam = 'BOS'
): DraftOriginalFirst => ({
  kind: 'authenticated-original-pick',
  id: `${originalTeam}_${draftYear}_1st`,
  originalTeam,
  draftYear,
  round: 1,
});
export function syntheticDraftOperation() {
  const request: DraftOperationRequest = {
    context: {
      proposalSha256: 'a'.repeat(64),
      stateVersion: 'synthetic-world-v1',
      releaseId: 'synthetic-only',
      asOf: '2026-07-15T12:00:00-04:00',
      team: 'BOS',
    },
    outgoing: [syntheticOriginal(2028)],
  };
  function evidence(
    scope: 'original-pick-ownership' | 'stepien-post-trade-branches'
  ) {
    return {
      id: `synthetic:${scope}`,
      context: structuredClone(request.context),
      status: 'supported in stated scope' as const,
      effectiveAt: '2026-07-01T00:00:00Z',
      validUntil: null,
      unresolvedDependencyIds: [],
      sources: [
        {
          id: `synthetic-source:${scope}`,
          artifactSha256: 'b'.repeat(64),
          locator: `synthetic#${scope}`,
          scope,
          qualification: 'qualified' as const,
          publishedAt: '2026-07-10T00:00:00Z',
          capturedAt: '2026-07-11T00:00:00Z',
          review: {
            status: 'accepted' as const,
            reference: 'synthetic-only-review',
            limitations: [],
          },
        },
      ],
    };
  }
  const ownership: DraftOriginalOwnershipFact = {
    ...evidence('original-pick-ownership'),
    scope: 'original-pick-ownership',
    pick: syntheticOriginal(2028),
    claimCoverage: 'complete',
    claims: [
      {
        id: 'synthetic-owned-right',
        team: 'BOS',
        status: 'owned-unconditionally',
      },
    ],
  };
  const stepien: DraftStepienFact = {
    ...evidence('stepien-post-trade-branches'),
    scope: 'stepien-post-trade-branches',
    outgoing: structuredClone(request.outgoing),
    firstFutureDraftYear: 2027,
    firstFutureDraftStartsAt: '2027-06-23T20:00:00-04:00',
    previousDraft: {
      draftYear: 2026,
      completedAt: '2026-06-25T23:00:00-04:00',
    },
    throughDraftYear: 2030,
    laterDrafts: 'guaranteed-first-every-draft',
    branchesComplete: true,
    branches: [
      {
        id: 'synthetic-P1',
        possible: true,
        unresolvedDependencyIds: [],
        drafts: [2027, 2028, 2029, 2030].map((draftYear) => ({
          draftYear,
          retained: draftYear === 2028 ? [] : [syntheticOriginal(draftYear)],
          inventoryComplete: true,
        })),
      },
    ],
  };
  return { request, ownership, stepien };
}
