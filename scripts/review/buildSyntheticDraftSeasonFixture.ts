/** Deterministic software evidence only. No network or database access. */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SYNTHETIC_DRAFT_RELEASES } from '../../tests/e2e/fixtures/syntheticDraftMutationReleases';
import { SyntheticDraftMutationSourceV2Z } from '../../src/schemas/draftPickReviewMutation';
import { SyntheticDraftSeasonSourceZ } from '../../src/schemas/draftReviewSeason';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import { withGovernedSalaryBooks } from '../../src/tests/fixtures/governedSalaryBookInputs';

const hash = (v: unknown) =>
  createHash('sha256').update(canonicalStringify(v)).digest('hex');
const retained = JSON.parse(SYNTHETIC_DRAFT_RELEASES.legal);
const raw = retained.retainedArtifacts[0].content;
raw.version = 2;
raw.asOf = '2026-07-01T04:00:00Z';
raw.proposal.asOfDate = raw.proposal.tradeCtx.asOfDate = '2026-07-01';
for (const review of raw.reviews) {
  review.request.context.asOf = raw.asOf;
  for (const fact of review.facts) fact.context.asOf = raw.asOf;
  for (const apron of review.apron)
    apron.context.asOf = apron.input.asOf = raw.asOf;
}
for (const team of Object.keys(raw.teamEntitlementIds)) {
  if (team === 'BOS') continue;
  const id = `review-${team}-2033-1`;
  raw.teamEntitlementIds[team].push(id);
  raw.entitlements[id] = {
    ...raw.entitlements['review-BOS-2033-1'],
    id,
    entitlementId: id,
    holderTeam: team,
    originalTeam: team,
    description: `${team} 2033 first-round pick`,
    underlyingPickId: `${team}_2033_1`,
  };
}
const source = SyntheticDraftMutationSourceV2Z.parse(raw);
retained.retained.summary.asOf = source.asOf;
retained.retained.entitlements = Object.values(source.entitlements).map(
  (entitlement) => ({
    entitlementId: entitlement.id,
    kind: 'pick_ownership',
    baselineUnderlyingAssetIdsUnchanged: [entitlement.underlyingPickId],
    dependencyIds: [],
    occurrenceIds: [],
    positivePathAuthority: 'unavailable',
    wholeAssetCertified: false,
  })
);
const measurements = Object.fromEntries(
  Object.keys(source.teamEntitlementIds).map((team) => {
    const record = withGovernedSalaryBooks(
      { teamCode: team, players: [] },
      {
        salaryCapYear: 2027,
        asOfDate: source.asOf,
        teamSalary: team === 'BOS' ? 255000000 : 30000000,
      }
    ).salaryBookInputs.seasonCloseApronMeasurement!;
    return [team, record];
  })
);
const lifecycle = SyntheticDraftSeasonSourceZ.parse({
  kind: 'synthetic-freeze-season-review-only',
  version: 1,
  fromSeason: '2025-26',
  toSeason: '2026-27',
  closeDate: '2026-04-12',
  effectiveAt: '2026-07-01T00:00:00-04:00',
  noRequiredDraftResolution: true,
  measurements,
  freezeInputs: Object.entries(measurements).map(([team, m]) => ({
    team,
    triggerSeasonStartYear: 2025,
    originalPick: {
      id: `${team}_2033_1st`,
      originalTeam: team,
      draftYear: 2033,
      round: 1,
    },
    asOf: source.asOf,
    regularSeasonEnds: [],
    observations: [
      {
        team,
        seasonStartYear: 2025,
        state: 'supported',
        sourceResultId: `synthetic-freeze-result:${team}:2025-26`,
        pendingUntil: null,
        value: {
          apronTeamSalaryCents: m.apronTeamSalary * 100,
          // Explicit invented test threshold. Never registered as an official salary level.
          secondApronCents: 20000000000,
          measuredAt: m.measuredAt,
          lastRegularSeasonGameStart: m.measuredAt,
        },
        sources: [
          {
            id: `synthetic-close:${team}`,
            artifactSha256: hash(m),
            scope: 'apron-observation',
            locator: `synthetic-measurements#${team}`,
            qualification: 'qualified',
            publishedAt: m.source.authenticatedAt,
            capturedAt: m.source.authenticatedAt,
            review: {
              status: 'accepted',
              reference:
                'BZE-317 synthetic fixture only; threshold is not an NBA fact',
              limitations: [],
            },
          },
        ],
      },
    ],
  })),
});
retained.release = {
  ...retained.release,
  id: 'synthetic-draft-review-v2-season',
  asOf: source.asOf,
  evidenceSha256: hash(source),
  assessmentSha256: hash('BZE-317 synthetic software scope only'),
  review: {
    status: 'accepted',
    reference: 'BZE-317 synthetic software fixture only',
    limitations: [],
  },
};
retained.retainedArtifacts = [
  {
    id: 'synthetic-mutation-source',
    sha256: hash(source),
    scope: source.kind,
    review: retained.release.review,
    content: source,
  },
  {
    id: 'synthetic-season-source',
    sha256: hash(lifecycle),
    scope: lifecycle.kind,
    review: retained.release.review,
    content: lifecycle,
  },
];
// Retained foundation is evidence storage; do not promote its real-asset execution flags.
const serialized = canonicalStringify(retained);
const pin = {
  payloadSha256: createHash('sha256').update(serialized).digest('hex'),
  release: retained.release,
};
writeFileSync(
  'tests/e2e/fixtures/syntheticDraftSeasonRelease.ts',
  `// Generated synthetic fixture only.\nexport const SYNTHETIC_DRAFT_SEASON_RELEASE = ${JSON.stringify(serialized)};\n`
);
writeFileSync(
  'src/features/architect/utils/draftReview/seasonFixturePin.ts',
  `// Independent fixed synthetic pin. No caller-supplied pin is authority.\nimport type { DraftPickReleasePin } from '@/schemas/draftPickRelease';\nexport const SYNTHETIC_DRAFT_SEASON_PIN: DraftPickReleasePin = ${JSON.stringify(pin, null, 2)};\n`
);
