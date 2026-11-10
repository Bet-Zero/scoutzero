/** Deterministic software inputs only. No NBA facts, credentials or remote writes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { withDerivedGovernedSalaryBooks } from '../../src/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '../../src/features/architect/utils/capTotals';
import { QUALIFIED_JUNE5_DRAFT_HORIZON as horizon } from '../../src/features/architect/utils/draftReview/horizon';
import { validateGovernedDraftBaseline } from '../../src/features/architect/utils/governedDraftWorld.baseline';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';

const asOf = horizon.asOf;
const teams = ['BOS', 'MIA', 'NYK'];
const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
const releaseId = 'software-normal-world-original-firsts-v1';
const evidence = (scope: string, team: string) => ({
  id: `software:${team}:${scope}`,
  scope,
  status: 'supported in stated scope',
  effectiveAt: asOf,
  validUntil: null,
  unresolvedDependencyIds: [],
  sources: [
    {
      id: 'software-fixture-only',
      artifactSha256: 'e'.repeat(64),
      locator: 'governedDraftWorldFixture:stipulated-inputs',
      scope,
      qualification: 'qualified',
      publishedAt: asOf,
      capturedAt: asOf,
      review: {
        status: 'accepted',
        reference: 'software fixture contract; no NBA authentication',
        limitations: [],
      },
    },
  ],
});
const records = teams.flatMap((team) =>
  years.map((year) => ({
    entitlement: {
      id: `software:${team}:${year}:first`,
      holderTeam: team,
      kind: 'pick_ownership',
      seasonYear: year,
      round: 1,
      underlyingPickId: `${team}_${year}_1st`,
      originalTeam: team,
      description: `${team} ${year} first-round pick (software fixture)`,
    },
    ownership: {
      ...evidence('original-pick-ownership', team),
      pick: {
        kind: 'authenticated-original-pick',
        id: `${team}_${year}_1st`,
        originalTeam: team,
        draftYear: year,
        round: 1,
      },
      claimCoverage: 'complete',
      claims: [
        {
          id: `software:${team}:${year}`,
          team,
          status: 'owned-unconditionally',
        },
      ],
    },
  }))
);
const initialTeams = Object.fromEntries(
  teams.map((teamCode) => {
    const players = Array.from({ length: 15 }, (_, i) => {
      const id = `software_${teamCode.toLowerCase()}_${i + 1}`;
      return {
        id,
        player_id: id,
        name: `Software ${teamCode} Player ${i + 1}`,
        displayName: `Software ${teamCode} Player ${i + 1}`,
        teamCode,
        bio: {
          playerId: id,
          displayName: `Software ${teamCode} Player ${i + 1}`,
          position: 'SF',
        },
        contract: {
          contractType: 'Standard',
          isTwoWay: false,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
              option: null,
            },
          ],
        },
      };
    });
    const team = withDerivedGovernedSalaryBooks(
      {
        teamCode,
        abbreviation: teamCode,
        teamName: {
          BOS: 'Boston Celtics',
          MIA: 'Miami Heat',
          NYK: 'New York Knicks',
        }[teamCode],
        season: '2025-26',
        players,
        roster: players.map((p) => p.id),
        entitlementIds: records
          .filter((r) => r.entitlement.holderTeam === teamCode)
          .map((r) => r.entitlement.id),
        capHolds: [],
        deadCap: [],
        exceptions: { tpe: [] },
        offerSheets: [],
        incomingOfferSheets: [],
        draftPicks: [],
      },
      { salaryCapYear: 2026, asOfDate: '2026-06-05T00:00:00Z' }
    );
    delete team.salaryBookInputs.incompleteRosterCharge;
    team.salaryBookInputs.unsignedFirstRoundPickState = {
      version: 1,
      status: 'ready',
      teamCode,
      salaryCapYear: 2026,
      entries: [],
      source: {
        evidenceId: `software:${teamCode}:unsigned-firsts`,
        evidenceVersion: 1,
        authority: 'external-determination',
        reference: 'software fixture: current draft has not occurred',
        authenticatedAt: '2026-06-05T00:00:00Z',
        recordStatus: 'current',
        canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
      },
    };
    const totals = createCanonicalTeamTotalsSnapshot(team, 2026, {
      asOfDate: '2026-06-05',
    });
    if (
      totals.apronTeamSalary !== 150_000_000 ||
      totals.taxSalary !== 150_000_000
    )
      throw new Error(
        'Fixture books must equal fifteen $10m standard contracts.'
      );
    return [teamCode, { ...team, totals }];
  })
);
const baseline = validateGovernedDraftBaseline({
  version: 1,
  releaseId,
  classification: 'software-fixture',
  asOf,
  seasonId: '2025-26',
  identities: records.map((r) => r.entitlement.id),
  retainedEntitlements: Object.fromEntries(
    records.map((r) => [r.entitlement.id, r.entitlement])
  ),
  unresolved: [],
  records,
  initialTeams,
  stepien: Object.fromEntries(
    teams.map((team) => [
      team,
      {
        ...evidence('stepien-post-trade-branches', team),
        firstFutureDraftYear: 2026,
        throughDraftYear: 2032,
        laterDrafts: 'outside-qualified-scope',
        branchesComplete: true,
        finiteScope: {
          authorityId: horizon.id,
          explanationSha256: horizon.explanationSha256,
          calendarSha256: horizon.calendarSha256,
          completeRelevantObligationCoverage: true,
          knownObligationDraftYears: [],
          unresolvedDependencyIds: [],
        },
      },
    ])
  ),
  // Later freeze exposures have no invented observations: their transfer stays blocked.
  apron: records
    .filter((r) => r.ownership.pick.draftYear < 2032)
    .map((r) => ({
      team: r.ownership.pick.originalTeam,
      triggerSeasonStartYear: r.ownership.pick.draftYear - 8,
      originalPick: {
        id: r.ownership.pick.id,
        originalTeam: r.ownership.pick.originalTeam,
        draftYear: r.ownership.pick.draftYear,
        round: 1,
      },
      asOf,
      observations: [],
      regularSeasonEnds: [],
    })),
});
const bytes = canonicalStringify(baseline);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const directory = 'functions/src/architect/fixtures';
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/governedDraftWorld.json`, bytes);
writeFileSync(
  `${directory}/governedDraftWorldPin.json`,
  JSON.stringify(
    { releaseId, sha256, classification: 'software-fixture' },
    null,
    2
  ) + '\n'
);
writeFileSync(
  'src/features/architect/utils/governedDraftWorldPin.ts',
  `/** No production source is installed. Fixture authority is local-emulator only. */\nexport const GOVERNED_DRAFT_WORLD_FIXTURE_PIN = Object.freeze(${JSON.stringify({ releaseId, sha256, classification: 'software-fixture' }, null, 2)} as const);\n`
);
console.log('Built ordinary-world software fixture', {
  records: records.length,
  teams: teams.length,
  sha256,
});
