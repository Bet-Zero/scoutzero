import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { TeamListFull } from '@/constants/teamList';
import { JUNE5_START } from '@/schemas/draftStartingState';
import {
  prepareDraftStartingState,
  prepareDraftWorldBaseline,
  previewStartingStateOriginals,
} from '@/features/architect/utils/draftStartingState';
import { syntheticDraftReview } from './fixtures/draftPickReview';
import { QUALIFIED_JUNE5_DRAFT_HORIZON } from '@/features/architect/utils/draftReview/horizon';
import { requireDraftReviewApply } from '@/features/architect/utils/draftReview/capability';

// Only private catalogue authentication is substituted. Its installed-pin verifier
// has its own tests; the private full-inventory compiler is replayed separately.
vi.mock('@/features/architect/utils/draftPickRealReview', () => ({
  verifyRealDraftReviewPackage: async (text: string) => ({
    data: JSON.parse(text),
  }),
}));
const contractRelease = JSON.parse(
  readFileSync(
    new URL(
      '../../public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json',
      import.meta.url
    ),
    'utf8'
  )
);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function fixture() {
  const review = syntheticDraftReview();
  review.request.context.asOf = JUNE5_START;
  for (const f of review.facts as any[]) {
    f.context = structuredClone(review.request.context);
    f.effectiveAt = JUNE5_START;
  }
  const stepien = review.facts[1] as any;
  stepien.firstFutureDraftYear = 2026;
  delete stepien.previousDraft;
  delete stepien.firstFutureDraftStartsAt;
  stepien.throughDraftYear = 2032;
  stepien.laterDrafts = 'outside-qualified-scope';
  stepien.finiteScope = {
    authorityId: QUALIFIED_JUNE5_DRAFT_HORIZON.id,
    explanationSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.explanationSha256,
    calendarSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.calendarSha256,
    completeRelevantObligationCoverage: true,
    knownObligationDraftYears: [],
    unresolvedDependencyIds: [],
  };
  stepien.branches[0].drafts = Array.from({ length: 7 }, (_, i) => ({
    draftYear: 2026 + i,
    retained:
      i === 2
        ? []
        : [
            {
              ...review.request.outgoing[0],
              id: `BOS_${2026 + i}_1st`,
              draftYear: 2026 + i,
            },
          ],
    inventoryComplete: true,
  }));
  (review.apron[0] as any).context = review.request.context;
  (review.apron[0] as any).input.asOf = JUNE5_START;
  const { context: _, ...ownership } = review.facts[0] as any;
  const assessment = {
    summary: { asOf: JUNE5_START, salaryCapYear: 2026 },
    records: Array.from({ length: 278 }, (_, i) => ({
      entitlementId: `synthetic:${i}`,
      asOf: JUNE5_START,
      originalPick: i === 0 ? review.request.outgoing[0] : null,
      group: i === 0 ? 'original-supported' : 'archival-generated-alias',
      ownershipComponent:
        i === 0
          ? { acceptedState: 'supported', dependencyId: 'synthetic-holder' }
          : null,
      nativeAssets: [],
      duplicateRepresentationNote: null,
      baselineDependencyIdsUnchanged: [],
      laterDatedAssertionIdsExcludedFromStart: [],
    })),
    exactUnresolvedMappings: Array.from({ length: 29 }, (_, i) => ({
      dependencyId: `unresolved:${i}`,
      entitlementIds: ['synthetic:1'],
      occurrenceIds: [`occurrence:${i}`],
      actions: ['transfer'],
      reason: 'Synthetic unresolved separate right',
      missingSource: 'Synthetic missing term',
      sourceRefs: ['synthetic-only'],
    })),
  };
  const catalogue = {
    inventorySha256: 'b'.repeat(64),
    unresolved: assessment.exactUnresolvedMappings,
    records: assessment.records.map((r, i) => ({
      ...r,
      ownership: i === 0 ? ownership : null,
    })),
  };
  const assessmentText = JSON.stringify(assessment);
  const catalogueText = JSON.stringify(catalogue);
  const candidate = {
    version: 1,
    purpose: 'private-starting-state-preparation',
    asOf: JUNE5_START,
    salaryCapYear: 2026,
    authority: 'pending-independent-source-admission',
    apply: 'blocked',
    inventorySha256: catalogue.inventorySha256,
    assessmentSha256: sha(assessmentText),
    catalogueSha256: sha(catalogueText),
    sourceFiles: [{ locator: 'synthetic-only', sha256: 'c'.repeat(64) }],
    contractRelease: {
      releaseId: contractRelease.releaseId,
      releaseVersion: contractRelease.releaseVersion,
      releaseDigest: contractRelease.releaseDigest,
    },
    records: assessment.records.map((r, i) => ({
      entitlementId: r.entitlementId,
      originalPick: r.originalPick,
      group: r.group,
      acceptedHolderState: i === 0 ? 'supported' : null,
      reportedHolder: i === 0 ? 'BOS' : null,
      holderEvidenceRefs: i === 0 ? ['synthetic'] : [],
      holderLimitations: [],
      ownershipFact: i === 0 ? ownership : null,
      nativeAssets: [],
      duplicateRepresentationNote: null,
      retainedAssessment: r,
      retainedTerms: [
        {
          dependencyId: `source-context:${r.entitlementId}`,
          sourceRefs: ['synthetic'],
          content: {},
        },
      ],
      excludedLaterAssertionIds: [],
    })),
    unresolved: assessment.exactUnresolvedMappings,
    apronHistory: TeamListFull.flatMap((t) =>
      [2024, 2025, 2026, 2027, 2028, 2029].map((y) => ({
        dependencyId: `season:${t.code}:${y}-${String(y + 1).slice(-2)}:last-regular-game-start`,
        team: t.code,
        seasonStartYear: y,
        state: y <= 2025 ? 'unresolved' : 'future-pending',
        aboveSecondApron: null,
        valueBinding: 'not-established',
        lifecycleRelevance: 'retained',
        restoreIfGateReopened: [],
        sourceRefs: ['synthetic'],
        limitations: [],
        numericSalaryEstablished: false,
      }))
    ),
    teamInputs: TeamListFull.map((t) => ({
      team: t.code,
      missingInputs: ['dated-financial-inputs'],
      salaryBookInputs: {
        version: 1,
        salaryCapYear: 2026,
        apronAdjustments: {
          status: 'needs-input',
          missingInputs: ['apron'],
          reason: 'No numeric amounts.',
        },
        taxSalary: {
          status: 'needs-input',
          missingInputs: ['tax'],
          reason: 'No tax inputs.',
        },
      },
    })),
  };
  return { candidate, assessmentText, catalogueText, contractRelease, review };
}

describe('private June 5 starting-state preparation', () => {
  it('reuses the Contract baseline, round-trips all identities, and produces no writes or Apply authority', async () => {
    const f = fixture();
    const result = await prepareDraftWorldBaseline({
      ...f,
      worldId: 'review-world',
      asOfDate: '2026-06-05',
      season: '2025-26',
    });
    expect(result.contractDocuments.flatMap((d) => d.ledgers)).toHaveLength(
      774
    );
    expect(
      result.contractDocuments.every((d) => d.worldId === 'review-world')
    ).toBe(true);
    expect(result.draftCandidate.records).toHaveLength(278);
    expect(result.draftCandidate.unresolved).toHaveLength(29);
    expect(result.writes).toEqual([]);
    expect(result.apply).toBe('blocked');
    expect(() => requireDraftReviewApply(result)).toThrow();
    const reloaded = await prepareDraftStartingState({
      ...f,
      candidate: JSON.parse(JSON.stringify(result.draftCandidate)),
    });
    expect(reloaded).toEqual(result.draftCandidate);
    expect(() =>
      previewStartingStateOriginals(JSON.parse(JSON.stringify(reloaded)), {
        request: f.review.request,
      })
    ).toThrow('prepared-candidate-required');
  }, 20000);

  it('allows complete unrelated component evidence while financial and activation gates remain closed', async () => {
    const f = fixture();
    const c = await prepareDraftStartingState(f);
    const p = previewStartingStateOriginals(c, {
      request: f.review.request,
      supplementalFacts: f.review.facts.slice(1),
      apron: f.review.apron,
    });
    expect(p.retainedMappingReferences).toEqual([]);
    expect(p.consumption.eligible).toBe(true);
    expect(p.financialMissingInputs).toEqual(['dated-financial-inputs']);
    expect(p.apply).toBe('blocked');
    expect(p.tradingVerdict).toBe('not-evaluated');
    expect(() =>
      previewStartingStateOriginals(c, {
        request: f.review.request,
        supplementalFacts: [f.review.facts[0]],
      })
    ).toThrow('supplemental-ownership-not-admitted');
    const missing = previewStartingStateOriginals(c, {
      request: f.review.request,
    });
    expect(missing.consumption.eligible).toBe(false);
    expect(
      missing.consumption.review.status === 'reviewed' &&
        missing.consumption.review.ownership.status
    ).toBe('component-permits');
    const stale = structuredClone(f.review.facts[1]) as any;
    stale.context.stateVersion = 'stale';
    expect(
      previewStartingStateOriginals(c, {
        request: f.review.request,
        supplementalFacts: [stale],
      }).consumption.eligible
    ).toBe(false);
  });

  it.each([
    [
      'changed assessment bytes',
      (f: any) => {
        f.assessmentText += ' ';
      },
      'assessment-bytes',
    ],
    [
      'lost identity',
      (f: any) => {
        f.candidate.records[1] = f.candidate.records[2];
      },
      'identity-membership',
    ],
    [
      'changed unresolved mapping',
      (f: any) => {
        f.candidate.unresolved[0].occurrenceIds = ['invented'];
      },
      'exact-unresolved-mappings',
    ],
    [
      'invented current holder',
      (f: any) => {
        f.candidate.records[1].reportedHolder = 'BOS';
      },
      'unestablished-holder',
    ],
    [
      'upgraded ownership',
      (f: any) => {
        f.candidate.records[0].ownershipFact.claims[0].team = 'MIA';
      },
      'unadmitted-operation-ownership',
    ],
    [
      'missing terms',
      (f: any) => {
        f.candidate.records[0].retainedTerms = [];
      },
      'retained-terms-membership',
    ],
    [
      'missing historical restriction',
      (f: any) => {
        f.candidate.apronHistory.pop();
      },
      'apron-membership',
    ],
    [
      'invented numeric input',
      (f: any) => {
        f.candidate.teamInputs[0].salaryBookInputs.apronAdjustments = {
          status: 'ready',
          lineItems: [],
        };
      },
      'unadmitted-financial-input',
    ],
    [
      'wrong Contract release',
      (f: any) => {
        f.candidate.contractRelease.releaseId = 'other';
      },
      'contract-release-mismatch',
    ],
  ])('rejects %s', async (_, mutate, reason) => {
    const f = fixture();
    mutate(f);
    await expect(prepareDraftStartingState(f)).rejects.toThrow(reason);
  });

  it('rejects current-date adoption and proposal rebinding to another date', async () => {
    const f = fixture();
    await expect(
      prepareDraftWorldBaseline({
        ...f,
        worldId: 'world',
        asOfDate: '2026-11-06',
        season: '2026-27',
      })
    ).rejects.toThrow('world-date');
    const c = await prepareDraftStartingState(f);
    f.review.request.context.asOf = '2026-11-06T00:00:00Z';
    expect(() =>
      previewStartingStateOriginals(c, { request: f.review.request })
    ).toThrow('proposal-date');
  });
});
