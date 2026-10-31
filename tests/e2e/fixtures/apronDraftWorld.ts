import { packApronPlan } from '@/features/architect/utils/draftReview/apronPlanStorage';
import { ARCHITECT_WORLD_DRAFT_SEASON_INPUTS_SUBCOLLECTION } from '@/constants/collections';
/** Complete stipulated books/calendars; none of these observations are NBA facts. */
import { syntheticDraftSeasonFixture } from './syntheticDraftSeasonWorld';
import { seedRetainedDraftSimulation } from './retainedDraftSimulationWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { DraftApronSimulationPlanZ } from '@/schemas/draftApronSimulation';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { TeamListFull } from '@/constants/teamList';

const source = {
  id: 'software-apron-scenario',
  artifactSha256: 'a'.repeat(64),
  locator: 'explicit-software-scenario',
  scope: 'software-test-only',
  qualification: 'qualified' as const,
  publishedAt: null,
  capturedAt: null,
  review: {
    status: 'accepted' as const,
    reference: 'Governed test inputs only; not NBA facts',
    limitations: [],
  },
};
export function apronDraftFixture(excessCents = 1) {
  const base = syntheticDraftSeasonFixture('u', 'w');
  const teams = Object.fromEntries(
    Object.entries(base.teams).map(([code, team]) => {
      const totalCents =
        code === 'TOR'
          ? 20782400000 + excessCents
          : code === 'MIA'
            ? 20782400000
            : 3000000000;
      const standard = Math.floor(totalCents / 15);
      const players = team.players.map((p, index) => ({
        ...p,
        contract: {
          ...p.contract,
          startSeason: '2025-26',
          endSeason: '2026-27',
          salariesByYear: ['2025-26', '2026-27'].map((season) => ({
            season,
            salary: p.isTwoWay
              ? 578577
              : (index === 14 ? totalCents - standard * 14 : standard) / 100,
            capHit: p.isTwoWay
              ? 578577
              : (index === 14 ? totalCents - standard * 14 : standard) / 100,
            guaranteed: !p.isTwoWay,
            option: null,
          })),
        },
      }));
      const bare = {
        ...team,
        players,
        teamName: TeamListFull.find((t) => t.code === code)!.teamName,
        hardCapped: false,
        hardCapLevel: null,
        entitlementIds: [] as string[],
      };
      const current = withDerivedGovernedSalaryBooks(bare, {
        salaryCapYear: 2026,
        asOfDate: '2026-04-12T00:00:00-04:00',
      });
      delete current.salaryBookInputs.incompleteRosterCharge;
      current.salaryBookInputs.unsignedFirstRoundPickState = {
        ...team.salaryBookInputs.unsignedFirstRoundPickState!,
        salaryCapYear: 2026,
        source: {
          ...team.salaryBookInputs.unsignedFirstRoundPickState!.source,
          authenticatedAt: '2026-04-12T00:00:00-04:00',
        },
      };
      return [code, current];
    })
  );
  const observations = Object.entries(teams).map(([team, value]) => ({
    team,
    seasonStartYear: 2025,
    state: 'supported' as const,
    sourceResultId: `software-observation:${team}:2025`,
    pendingUntil: null,
    sources: [source],
    value: {
      apronTeamSalaryCents: Math.round(
        value.players
          .filter((p) => !p.isTwoWay)
          .reduce((sum, p) => sum + p.contract.salariesByYear[0].salary, 0) *
          100
      ),
      secondApronCents: 20782400000,
      measuredAt: '2026-04-12T19:00:00-04:00',
      lastRegularSeasonGameStart: '2026-04-12T19:00:00-04:00',
    },
  }));
  const targetBooks = Object.fromEntries(
    Object.entries(teams).map(([team, value]) => {
      const books = withDerivedGovernedSalaryBooks(value, {
        salaryCapYear: 2027,
        asOfDate: '2026-07-01T00:00:00-04:00',
      }).salaryBookInputs;
      delete books.incompleteRosterCharge;
      books.unsignedFirstRoundPickState = {
        ...value.salaryBookInputs.unsignedFirstRoundPickState!,
        salaryCapYear: 2027,
      };
      const template =
        base.teams[team].salaryBookInputs.seasonCloseApronMeasurement!;
      books.seasonCloseApronMeasurement = {
        ...template,
        apronTeamSalary:
          observations.find((o) => o.team === team)!.value
            .apronTeamSalaryCents / 100,
        source: {
          ...template.source,
          identity: `software-only:${team}:2025`,
          measurementRecordId: `software:${team}:2025`,
        },
      };
      return [team, books];
    })
  );
  const futureObservations = Array.from(
    { length: 4 },
    (_, i) => 2026 + i
  ).flatMap((seasonStartYear) =>
    Object.keys(teams).map((team) => ({
      team,
      seasonStartYear,
      state: 'future-pending' as const,
      sourceResultId: null,
      value: null,
      pendingUntil:
        seasonStartYear === 2026
          ? '2027-04-11T19:00:00-04:00'
          : `${seasonStartYear + 1}-04-12T19:00:00-04:00`,
      sources: [source],
    }))
  );
  const plan = DraftApronSimulationPlanZ.parse({
    kind: 'governed-apron-lifecycle-v1',
    startingSeason: '2025-26',
    futureObservations,
    steps: [
      {
        seasonStartYear: 2025,
        observations,
        targetBooks,
        regularSeasonEnd: {
          seasonStartYear: 2025,
          date: '2026-04-12',
          dayAfterStartsAt: '2026-04-13T00:00:00-04:00',
          sources: [source],
        },
        tradingWindow: {
          kind: 'governed-test-seven-draft-window',
          asOf: '2026-07-01T00:00:00-04:00',
          previousDraftCompletedAt: '2026-06-30T23:00:00-04:00',
          firstFutureDraftStartsAt: '2027-06-23T19:00:00-04:00',
          firstYear: 2027,
          lastYear: 2033,
        },
      },
    ],
  });
  return {
    teams,
    plan,
    metadata: {
      currentSeason: '2025-26',
      asOfDate: '2026-04-12',
      draftSimulationBranches: 'apron-lifecycle',
      draftApronPlan: plan,
      draftApronHistory: [],
    },
  };
}

export async function seedApronDraftWorld(
  uid: string,
  worldId: string,
  excessCents = 1,
  fixture = apronDraftFixture(excessCents)
) {
  const catalogue = await seedRetainedDraftSimulation(uid, worldId);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const entitlements = (await root.collection('entitlements').get()).docs.map(
    (d) => ({ id: d.id, data: d.data() })
  );
  const batch = getReviewAdminDb().batch();
  for (const row of catalogue.data.records)
    if (
      row.originalPick &&
      ['TOR', 'MIA'].includes(row.originalPick.originalTeam)
    ) {
      const entitlement = entitlements.find((e) => e.id === row.entitlementId)!;
      entitlement.data.holderTeam = row.originalPick.originalTeam;
      batch.set(
        root.collection('entitlements').doc(row.entitlementId),
        entitlement.data
      );
    }
  for (const [team, value] of Object.entries(fixture.teams)) {
    value.entitlementIds = entitlements
      .filter((e) => e.data.holderTeam === team)
      .map((e) => e.id);
    batch.set(root.collection('teams').doc(team), {
      ...value,
      totals: createCanonicalTeamTotalsSnapshot(value, 2026, {
        asOfDate: '2026-04-12',
      }),
    });
  }
  const packed =
    fixture.plan.kind === 'governed-apron-lifecycle-v2'
      ? packApronPlan(fixture.plan)
      : null;
  if (packed)
    for (const [id, value] of Object.entries(packed.documents))
      batch.set(
        root
          .collection(ARCHITECT_WORLD_DRAFT_SEASON_INPUTS_SUBCOLLECTION)
          .doc(id),
        value
      );
  batch.update(root, {
    ...fixture.metadata,
    ...(packed ? { draftApronPlan: packed.reference } : {}),
    draftSimulationTeams: ['TOR', 'MIA'],
    worldName: 'Apron lifecycle — governed software scenario',
  });
  await batch.commit();
  return {
    ...fixture,
    catalogue,
    original: (team: string, year: number) =>
      catalogue.data.records.find(
        (r) =>
          r.originalPick?.originalTeam === team &&
          r.originalPick.draftYear === year
      )!.entitlementId,
  };
}
