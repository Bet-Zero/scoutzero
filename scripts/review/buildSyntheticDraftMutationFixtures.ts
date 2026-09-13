/** Reproducible software fixtures only. No network or Firestore access. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { syntheticDraftReview } from '../../tests/architect/fixtures/draftPickReview';
import { syntheticOriginal } from '../../tests/architect/fixtures/draftPickOperation';
import { SyntheticDraftMutationSourceZ } from '../../src/schemas/draftPickReviewMutation';
import {
  DraftOriginalOwnershipFactZ,
  DraftStepienFactZ,
} from '../../src/schemas/draftPickOperation';
import { DraftPickConsiderationFactZ } from '../../src/schemas/draftPickConsideration';
import { DraftPickApronContextZ } from '../../src/schemas/draftPickReview';
import { buildDraftPickFoundation } from '../../src/features/architect/utils/draftPickFoundation';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const teamCodes =
  'ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(
    ' '
  );
const cases = [
  'legal',
  'ownership',
  'stepien',
  'cash',
  'apron',
  'missing',
  'conflicting',
] as const;
const fixtures: Record<string, string> = {};
const pins: Record<string, unknown> = {};
for (const variant of cases) {
  const year = variant === 'apron' ? 2032 : 2028;
  const review = syntheticDraftReview();
  review.request.context.asOf = '2026-07-15T00:00:00Z';
  review.request.outgoing = [syntheticOriginal(year)];
  const owner = DraftOriginalOwnershipFactZ.parse(review.facts[0]);
  const stepien = DraftStepienFactZ.parse(review.facts[1]);
  const cash = DraftPickConsiderationFactZ.parse(review.facts[2]);
  const apron = DraftPickApronContextZ.parse(review.apron[0]);
  owner.pick = syntheticOriginal(year);
  if (variant === 'ownership') owner.claims[0].team = 'MIA';
  stepien.outgoing = cash.outgoing = [...review.request.outgoing];
  stepien.throughDraftYear = 2033;
  stepien.branches[0].drafts = Array.from(
    { length: 7 },
    (_, i) => i + 2027
  ).map((draftYear) => ({
    draftYear,
    retained:
      draftYear === year || (variant === 'stepien' && draftYear === 2027)
        ? []
        : [syntheticOriginal(draftYear)],
    inventoryComplete: true,
  }));
  cash.consideration =
    variant === 'cash'
      ? [{ id: 'cash-1-dollar', kind: 'cash', amountCents: 100 }]
      : [
          {
            id: 'review-MIA-2028-2',
            kind: 'established-noncash',
            amountCents: null,
          },
        ];
  for (const fact of [owner, stepien, cash])
    fact.context = { ...review.request.context };
  if (variant === 'missing') stepien.branchesComplete = false;
  review.facts = [owner, stepien, cash];
  if (variant === 'conflicting') review.facts.push(structuredClone(owner));
  apron.context = { ...review.request.context };
  apron.input.asOf = review.request.context.asOf;
  apron.input.originalPick = {
    id: `BOS_${year}_1st`,
    originalTeam: 'BOS',
    draftYear: year,
    round: 1,
  };
  apron.input.triggerSeasonStartYear = year - 8;
  if (variant === 'apron') {
    apron.input.observations = Array.from({ length: 5 }, (_, i) => ({
      team: 'BOS',
      seasonStartYear: 2024 + i,
      state: i < 2 ? ('supported' as const) : ('future-pending' as const),
      sourceResultId: i < 2 ? `synthetic-apron-${2024 + i}` : null,
      value:
        i < 2
          ? {
              apronTeamSalaryCents: 20001,
              secondApronCents: 20000,
              measuredAt: `${2025 + i}-04-15T12:00:00Z`,
              lastRegularSeasonGameStart: `${2025 + i}-04-15T12:00:00Z`,
            }
          : null,
      pendingUntil: i < 2 ? null : `${2025 + i}-04-15T12:00:00Z`,
      sources: owner.sources,
    }));
  }
  review.apron = [apron];
  const teamEntitlementIds = Object.fromEntries(
    teamCodes.map((t) => [t, [] as string[]])
  );
  const entitlements: Record<string, Record<string, string | number>> = {};
  for (let draftYear = 2027; draftYear <= 2033; draftYear++) {
    if (variant === 'stepien' && draftYear === 2027) continue;
    const id = `review-BOS-${draftYear}-1`;
    const holder =
      variant === 'ownership' && draftYear === year ? 'MIA' : 'BOS';
    teamEntitlementIds[holder].push(id);
    entitlements[id] = {
      id,
      entitlementId: id,
      holderTeam: holder,
      originalTeam: 'BOS',
      seasonYear: draftYear,
      year: draftYear,
      round: 1,
      kind: 'pick_ownership',
      description: `BOS ${draftYear} first-round pick`,
      underlyingPickId: `BOS_${draftYear}_1`,
      underlyingStatus: 'clean',
    };
  }
  const secondId = 'review-MIA-2028-2';
  entitlements[secondId] = {
    id: secondId,
    entitlementId: secondId,
    holderTeam: 'MIA',
    originalTeam: 'MIA',
    seasonYear: 2028,
    year: 2028,
    round: 2,
    kind: 'pick_ownership',
    description: 'MIA 2028 second-round pick',
    underlyingPickId: 'MIA_2028_2',
    underlyingStatus: 'clean',
  };
  teamEntitlementIds.MIA.push(secondId);
  const first = { ...entitlements[`review-BOS-${year}-1`], toTeamId: 'MIA' };
  const proposal = {
    asOfDate: '2026-07-15',
    tradeCtx: {
      source: 'tradeMachine',
      yearKey: 2027,
      asOfDate: '2026-07-15',
    },
    teams: [
      {
        teamCode: 'BOS',
        sends: [],
        entitlementsOut: [first],
        picksOut: [],
        cashSent: 0,
        cashReceived: variant === 'cash' ? 1 : 0,
      },
      {
        teamCode: 'MIA',
        sends: [],
        entitlementsOut:
          variant === 'cash'
            ? []
            : [{ ...entitlements[secondId], toTeamId: 'BOS' }],
        picksOut: [],
        cashSent: variant === 'cash' ? 1 : 0,
        cashReceived: 0,
      },
    ],
  };
  const source = SyntheticDraftMutationSourceZ.parse({
    kind: 'synthetic-original-first-review-only',
    version: 1,
    asOf: review.request.context.asOf,
    seasonId: '2026-27',
    noUnlistedClaimsOrConditionalPrograms: true,
    teamEntitlementIds,
    entitlements,
    proposal,
    reviews: [review],
  });
  const sourceHash = hash(canonicalStringify(source));
  const id = `synthetic-draft-review-v1-${variant}`;
  const release = {
    id,
    schemaVersion: 1,
    evidenceSha256: sourceHash,
    assessmentSha256: hash(
      'BZE-315 synthetic software expectations; no NBA readiness'
    ),
    asOf: source.asOf,
    review: {
      status: 'accepted',
      reference: 'BZE-315 authorized synthetic fixture scope only',
      limitations: [],
    },
  };
  const foundation = buildDraftPickFoundation({
    release,
    retained: {
      dependencies: [],
      entitlements: Object.values(entitlements).map((e) => ({
        entitlementId: e.id,
        kind: 'pick_ownership',
        baselineUnderlyingAssetIdsUnchanged: [e.underlyingPickId],
        dependencyIds: [],
        occurrenceIds: [],
        positivePathAuthority: 'unavailable',
        wholeAssetCertified: false,
      })),
      occurrences: [],
      predecessorDependencies: [],
      summary: { asOf: source.asOf },
    },
    overlay: [],
    assertions: [],
    sourceRights: [],
    programs: [],
    poolScopeNotes: [],
    retainedArtifacts: [
      {
        id: 'synthetic-mutation-source',
        sha256: sourceHash,
        scope: source.kind,
        review: release.review,
        content: source,
      },
    ],
    retainedBranchDetails: [],
  });
  const {
    originalPicks: _p,
    legacyRecords: _l,
    execution: _e,
    ...retained
  } = foundation;
  const serialized = canonicalStringify(retained);
  fixtures[variant] = serialized;
  pins[id] = { payloadSha256: hash(serialized), release };
}
mkdirSync('tests/e2e/fixtures', { recursive: true });
mkdirSync('src/features/architect/utils/draftReview', { recursive: true });
writeFileSync(
  'tests/e2e/fixtures/syntheticDraftMutationReleases.ts',
  `// Generated by scripts/review/buildSyntheticDraftMutationFixtures.ts. Synthetic only.\nexport const SYNTHETIC_DRAFT_RELEASES = ${JSON.stringify(fixtures, null, 2)} as const;\n`
);
writeFileSync(
  'src/features/architect/utils/draftReview/fixturePins.ts',
  `// Independently retained expected pins. Never accept a pin from mutation payloads.\n// Synthetic software authority only; not NBA readiness or production permission.\nimport type { DraftPickReleasePin } from '@/schemas/draftPickRelease';\nexport const SYNTHETIC_DRAFT_REVIEW_PINS: Readonly<Record<string, DraftPickReleasePin>> = ${JSON.stringify(pins, null, 2)};\n`
);
