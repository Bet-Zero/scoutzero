/** Source-to-world PREPARATION only. No Firestore, installed pin or capability. */
import { z } from 'zod';
import { TeamListFull } from '@/constants/teamList';
import {
  DraftStartingStateCandidateZ,
  JUNE5_START,
  type DraftStartingStateCandidate,
} from '@/schemas/draftStartingState';
import { DraftPickRealReviewPackageZ } from '@/schemas/draftPickRealReview';
import { DraftPickReviewInputZ } from '@/schemas/draftPickReview';
import { DraftOperationRequestZ } from '@/schemas/draftPickOperation';
import {
  canonicalStringify,
  sha256Digest,
} from './contractSource/deterministicDigest';
import {
  verifyContractSourceRelease,
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
  validateContractBaselineDocumentSet,
} from './contractSource/contractSourceRelease';
import { assessDraftReviewConsumption } from './draftReview/consumption';
import { reviewJune5DraftTradingWindow } from './draftReview/horizon';
import { verifyRealDraftReviewPackage } from './draftPickRealReview';
import { REAL_DRAFT_REVIEW_PIN } from './draftPickRealReviewPin';

const preparedCandidates = new WeakSet<object>();

const same = (a: unknown, b: unknown) =>
  canonicalStringify(a) === canonicalStringify(b);
const sorted = (a: string[]) => [...a].sort();
function requireCondition(ok: boolean, reason: string): asserts ok {
  if (!ok) throw new Error(`DRAFT_STARTING_STATE:${reason}`);
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const assessmentZ = z
  .object({
    records: z
      .array(
        z
          .object({
            entitlementId: z.string(),
            asOf: z.literal(JUNE5_START),
            originalPick: z.unknown(),
            group: z.string(),
            ownershipComponent: z
              .object({ acceptedState: z.string() })
              .passthrough()
              .nullable(),
            nativeAssets: z.array(z.string()),
            baselineDependencyIdsUnchanged: z.array(z.string()),
            duplicateRepresentationNote: z.string().nullable(),
            laterDatedAssertionIdsExcludedFromStart: z.array(z.string()),
          })
          .passthrough()
      )
      .length(278),
    exactUnresolvedMappings:
      DraftPickRealReviewPackageZ.shape.unresolved.length(29),
    summary: z
      .object({ asOf: z.literal(JUNE5_START), salaryCapYear: z.literal(2026) })
      .passthrough(),
  })
  .passthrough();

/** Integrity and consistency only. Expected hashes are review inputs, NOT trust pins. */
export async function prepareDraftStartingState(input: {
  candidate: unknown;
  assessmentText: string;
  catalogueText: string;
  contractRelease: unknown;
}): Promise<Readonly<DraftStartingStateCandidate>> {
  const c = DraftStartingStateCandidateZ.parse(input.candidate);
  const assessment = assessmentZ.parse(JSON.parse(input.assessmentText));
  const { data: catalogue } = await verifyRealDraftReviewPackage(
    input.catalogueText,
    REAL_DRAFT_REVIEW_PIN
  );
  const contract = await verifyContractSourceRelease(input.contractRelease);
  requireCondition(
    contract.effectiveAt === c.asOf &&
      contract.salaryCapYear === c.salaryCapYear,
    'contract-date-mismatch'
  );
  requireCondition(
    same(c.contractRelease, {
      releaseId: contract.releaseId,
      releaseVersion: contract.releaseVersion,
      releaseDigest: contract.releaseDigest,
    }),
    'contract-release-mismatch'
  );
  requireCondition(
    c.assessmentSha256 ===
      (await sha256Digest(input.assessmentText)).replace('sha256:', ''),
    'assessment-bytes'
  );
  requireCondition(
    c.catalogueSha256 ===
      (await sha256Digest(input.catalogueText)).replace('sha256:', ''),
    'catalogue-bytes'
  );
  requireCondition(
    c.inventorySha256 === catalogue.inventorySha256,
    'inventory-mismatch'
  );
  const ids = c.records.map((r) => r.entitlementId);
  requireCondition(
    new Set(ids).size === 278 &&
      same(
        sorted(ids),
        sorted(assessment.records.map((r) => r.entitlementId))
      ) &&
      same(sorted(ids), sorted(catalogue.records.map((r) => r.entitlementId))),
    'identity-membership'
  );
  requireCondition(
    new Set(c.unresolved.map((r) => r.dependencyId)).size === 29 &&
      same(c.unresolved, assessment.exactUnresolvedMappings) &&
      same(c.unresolved, catalogue.unresolved),
    'exact-unresolved-mappings'
  );
  for (const row of c.records) {
    const a = assessment.records.find(
      (r) => r.entitlementId === row.entitlementId
    )!;
    const cat = catalogue.records.find(
      (r) => r.entitlementId === row.entitlementId
    )!;
    requireCondition(
      same(row.retainedAssessment, a) &&
        same(row.originalPick, a.originalPick) &&
        same(row.originalPick, cat.originalPick) &&
        row.group === a.group &&
        row.acceptedHolderState ===
          (a.ownershipComponent?.acceptedState ?? null) &&
        same(row.nativeAssets, a.nativeAssets) &&
        row.duplicateRepresentationNote === a.duplicateRepresentationNote &&
        same(
          row.excludedLaterAssertionIds,
          a.laterDatedAssertionIdsExcludedFromStart
        ),
      'assessment-projection'
    );
    requireCondition(
      !row.reportedHolder ||
        (row.acceptedHolderState === 'supported' &&
          row.holderEvidenceRefs.length > 0),
      'unestablished-holder'
    );
    // This preparation reuses the already accepted operation projection only.
    // A new complete ownership fact needs separate source admission, not JSON editing.
    requireCondition(
      same(row.ownershipFact, cat.ownership),
      'unadmitted-operation-ownership'
    );
    if (row.ownershipFact)
      requireCondition(
        same(row.ownershipFact.pick, row.originalPick),
        'wrong-ownership-pick'
      );
    requireCondition(
      same(
        sorted(row.retainedTerms.map((t) => t.dependencyId)),
        sorted([
          ...a.baselineDependencyIdsUnchanged,
          `source-context:${row.entitlementId}`,
        ])
      ),
      'retained-terms-membership'
    );
  }
  const originals = c.records.flatMap((r) =>
    r.originalPick ? [r.originalPick.id] : []
  );
  requireCondition(
    new Set(originals).size === originals.length,
    'duplicate-original'
  );
  requireCondition(
    same(
      sorted(c.teamInputs.map((r) => r.team)),
      sorted(TeamListFull.map((t) => t.code))
    ),
    'team-membership'
  );
  for (const row of c.teamInputs) {
    requireCondition(
      row.salaryBookInputs.salaryCapYear === c.salaryCapYear,
      'financial-year'
    );
    // Actual numbers must arrive through separate qualified financial preparation.
    requireCondition(
      row.salaryBookInputs.apronAdjustments.status === 'needs-input' &&
        row.salaryBookInputs.taxSalary.status === 'needs-input' &&
        !row.salaryBookInputs.seasonCloseApronMeasurement &&
        !row.salaryBookInputs.incompleteRosterCharge &&
        !row.salaryBookInputs.unsignedFirstRoundPickState,
      'unadmitted-financial-input'
    );
  }
  requireCondition(
    new Set(c.apronHistory.map((r) => r.dependencyId)).size ===
      c.apronHistory.length,
    'duplicate-apron-history'
  );
  requireCondition(
    same(
      sorted(c.apronHistory.map((r) => r.dependencyId)),
      sorted(
        TeamListFull.flatMap((t) =>
          [2024, 2025, 2026, 2027, 2028, 2029].map(
            (y) =>
              `season:${t.code}:${y}-${String(y + 1).slice(-2)}:last-regular-game-start`
          )
        )
      )
    ),
    'apron-membership'
  );
  for (const row of c.apronHistory) {
    requireCondition(
      row.dependencyId ===
        `season:${row.team}:${row.seasonStartYear}-${String(row.seasonStartYear + 1).slice(-2)}:last-regular-game-start`,
      'apron-identity'
    );
    requireCondition(
      row.aboveSecondApron === null
        ? row.valueBinding !== 'bound'
        : row.state === 'supported' && row.valueBinding === 'bound',
      'apron-status-value'
    );
    requireCondition(
      row.seasonStartYear <= 2025 || row.state === 'future-pending',
      'future-measurement'
    );
  }
  preparedCandidates.add(c);
  return freeze(c);
}

/** Existing fresh-world Contract shape, with a separate non-executable draft sidecar.
 * The initializer and atomic writer remain the only eventual adoption/save owners. */
export async function prepareDraftWorldBaseline(input: {
  candidate: unknown;
  assessmentText: string;
  catalogueText: string;
  contractRelease: unknown;
  worldId: string;
  asOfDate: string;
  season: string;
}) {
  requireCondition(/^[A-Za-z0-9_-]+$/.test(input.worldId), 'world-id');
  requireCondition(
    input.asOfDate === JUNE5_START.slice(0, 10) && input.season === '2025-26',
    'world-date'
  );
  const candidate = await prepareDraftStartingState(input);
  const release = await verifyContractSourceRelease(input.contractRelease);
  const documents = buildContractBaselineTeamDocuments(release, input.worldId);
  validateContractBaselineDocumentSet(documents, release.records.length);
  return freeze({
    purpose: 'fresh-world-preparation-only' as const,
    worldId: input.worldId,
    asOfDate: input.asOfDate,
    season: input.season,
    contractMetadata: contractBaselineMetadata(release),
    contractDocuments: documents,
    draftCandidate: candidate,
    candidateSha256: await sha256Digest(canonicalStringify(candidate)),
    writes: [] as never[],
    apply: 'blocked' as const,
    requiredApprovals: [
      'independent-source-admission',
      'source-publication-and-trust-designation',
      'fresh-world-adoption',
      'normal-first-round-activation',
    ],
  });
}

/** Action-local component review. Unrelated unresolved rights are not a blanket veto.
 * Supplements use existing schemas/engines and retain their exact proposal context. */
export function previewStartingStateOriginals(
  candidateInput: unknown,
  input: {
    request: unknown;
    supplementalFacts?: unknown[];
    apron?: unknown[];
  }
) {
  requireCondition(
    Boolean(
      candidateInput &&
        typeof candidateInput === 'object' &&
        preparedCandidates.has(candidateInput)
    ),
    'prepared-candidate-required'
  );
  const candidate = candidateInput as Readonly<DraftStartingStateCandidate>;
  const request = DraftOperationRequestZ.parse(input.request);
  requireCondition(request.context.asOf === candidate.asOf, 'proposal-date');
  const rows = request.outgoing.map((pick) => {
    const matches = candidate.records.filter(
      (r) => r.originalPick?.id === pick.id
    );
    requireCondition(
      matches.length === 1 && same(matches[0].originalPick, pick),
      'proposal-original'
    );
    return matches[0];
  });
  const facts = rows.flatMap((row) =>
    row.ownershipFact
      ? [{ ...row.ownershipFact, context: request.context }]
      : []
  );
  requireCondition(
    !(input.supplementalFacts ?? []).some(
      (f) =>
        f &&
        typeof f === 'object' &&
        'scope' in f &&
        f.scope === 'original-pick-ownership'
    ),
    'supplemental-ownership-not-admitted'
  );
  const reviewInput = DraftPickReviewInputZ.parse({
    request,
    facts: [...facts, ...(input.supplementalFacts ?? [])],
    // Same empty-observation input as the installed real-draft reviewer. The
    // existing lifecycle engine decides pre-rule non-applicability; later picks
    // remain needs-input without numeric measurements. No fabricated amounts.
    apron:
      input.apron ??
      request.outgoing.map((pick) => ({
        context: request.context,
        input: {
          team: pick.originalTeam,
          triggerSeasonStartYear: pick.draftYear - 8,
          originalPick: {
            id: pick.id,
            originalTeam: pick.originalTeam,
            draftYear: pick.draftYear,
            round: pick.round,
          },
          asOf: request.context.asOf,
          observations: [],
          regularSeasonEnds: [],
        },
      })),
  });
  const consumption = assessDraftReviewConsumption(reviewInput);
  return freeze({
    scope: 'preparation-components-only' as const,
    apply: 'blocked' as const,
    tradingVerdict: 'not-evaluated' as const,
    reviewInput,
    consumption,
    tradingWindow: reviewJune5DraftTradingWindow(
      candidate.asOf,
      rows.map((r) => r.originalPick!.draftYear)
    ),
    retainedMappingReferences: candidate.unresolved.filter((r) =>
      rows.some((row) => r.entitlementIds.includes(row.entitlementId))
    ),
    // Navigation edges do not decide action scope. The actual engines above do.
    financialMissingInputs: candidate.teamInputs.find(
      (r) => r.team === request.context.team
    )?.missingInputs ?? ['unknown-team'],
    missingPreparation: rows
      .filter((r) => !r.ownershipFact)
      .map((r) => ({
        entitlementId: r.entitlementId,
        reason:
          r.acceptedHolderState === 'supported'
            ? 'complete-ownership-and-attached-claims-input'
            : 'conditional-or-unresolved-ownership-input',
      })),
  });
}
