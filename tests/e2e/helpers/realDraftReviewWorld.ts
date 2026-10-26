/** Presentation fixture only: retained evidence still comes from the installed read service. */
import {
  ALL_TEAM_CODES,
  buildReviewDepthPlayer,
  getReviewAdminDb,
} from './architectReviewWorld';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';

export type RealDraftBrowserCase = {
  name: string;
  team: (typeof ALL_TEAM_CODES)[number];
  teamName: string;
  entitlement: { id: string; seasonYear: number; [key: string]: unknown };
  expected: string[];
};
export const REAL_DRAFT_WORLD = 'world_retained_draft_read_only';
export async function seedRealDraftReviewWorld(
  uid: string,
  scenario: RealDraftBrowserCase,
  asOfDate: string,
  options: { worldId?: string; otherTeam?: string; createOnly?: boolean } = {}
) {
  const db = getReviewAdminDb(); // Always the demo emulator, never a source writer.
  // The original fixture only inspected picks. Actual trade validation also
  // requires books for the selected season to match this explicit test date.
  const seasonEndYear = asOfDate < '2026-07-01' ? 2026 : 2027;
  const season = seasonEndYear === 2026 ? '2025-26' : '2026-27';
  const nextSeason = `${seasonEndYear}-${String((seasonEndYear + 1) % 100).padStart(2, '0')}`;
  const world = db
    .collection(ARCHITECT_WORLDS_COLLECTION)
    .doc(options.worldId ?? REAL_DRAFT_WORLD);
  if (!options.createOnly) await db.recursiveDelete(world);
  const writeWorld = options.createOnly
    ? world.create.bind(world)
    : world.set.bind(world);
  await writeWorld({
    worldId: REAL_DRAFT_WORLD,
    worldName: 'Retained Pick Review',
    createdBy: uid,
    createdAt: new Date(),
    lastModifiedAt: new Date(),
    currentSeason: season,
    baselineSeason: '2025-26',
    asOfDate,
    parentWorldId: null,
    isArchived: false,
    contractBaselineVersion: 2,
    contractSourceRelease: {
      releaseId: 'presentation-only',
      releaseVersion: 1,
      releaseDigest: `sha256:${'3'.repeat(64)}`,
    },
    contractBaselineEffectiveAt: `${asOfDate}T00:00:00Z`,
    contractBaselineSalaryCapYear: seasonEndYear,
    contractBaselineCoverage: { total: 0, complete: 0, needsInput: 0 },
  });
  const batch = db.batch();
  for (const teamCode of ALL_TEAM_CODES) {
    const teamName =
      teamCode === scenario.team
        ? scenario.teamName
        : teamCode === (options.otherTeam ?? 'DEN')
          ? options.otherTeam === 'TOR'
            ? 'Toronto Raptors'
            : 'Denver Nuggets'
          : teamCode;
    const players = [scenario.team, options.otherTeam ?? 'DEN'].includes(
      teamCode
    )
      ? Array.from({ length: 18 }, (_, i) => {
          const player = buildReviewDepthPlayer(teamCode, teamName, i + 1);
          const isTwoWay = i >= 15;
          return {
            ...player,
            isTwoWay,
            contract: {
              ...player.contract,
              totalValue: (isTwoWay ? 578577 : 2000000) * 2,
              averageAnnualValue: isTwoWay ? 578577 : 2000000,
              guaranteedValue: (isTwoWay ? 578577 : 2000000) * 2,
              startSeason: season,
              endSeason: nextSeason,
              isTwoWay,
              contractType: isTwoWay ? 'TWO-WAY' : 'MINIMUM CONTRACT',
              salariesByYear: player.contract.salariesByYear.map(
                (row, index) => ({
                  ...row,
                  season: index === 0 ? season : nextSeason,
                  salary: isTwoWay ? 578577 : 2000000,
                  capHit: isTwoWay ? 578577 : 2000000,
                })
              ),
              freeAgency: {
                ...player.contract.freeAgency,
                year: seasonEndYear + 1,
              },
            },
          };
        })
      : [];
    const team = withDerivedGovernedSalaryBooks(
      {
        id: teamCode,
        teamId: teamCode,
        teamCode,
        abbreviation: teamCode,
        teamName,
        season,
        players,
        roster: players.map((p) => p.id),
        entitlementIds:
          teamCode === scenario.team ? [scenario.entitlement.id] : [],
        capHolds: [],
        deadCap: [],
        exceptions: { tpe: [] },
        offerSheets: [],
        incomingOfferSheets: [],
        draftPicks: [],
      },
      { salaryCapYear: seasonEndYear, asOfDate: `${asOfDate}T00:00:00Z` }
    );
    // Roster/book facts are stipulated software inputs, never NBA pick facts.
    // BZE-329 supplies only the date-correct official annual money levels.
    const salaryBookInputs = { ...team.salaryBookInputs };
    // The explicit unsigned-pick state selects governed roster counting;
    // its existing contract rejects the legacy editable charge field.
    delete salaryBookInputs.incompleteRosterCharge;
    const ready = {
      ...team,
      salaryBookInputs: {
        ...salaryBookInputs,
        unsignedFirstRoundPickState: {
          version: 1,
          status: 'ready',
          teamCode,
          salaryCapYear: seasonEndYear,
          entries: [],
          source: {
            evidenceId: `presentation:${teamCode}:unsigned-firsts`,
            evidenceVersion: 1,
            authority: 'external-determination',
            reference:
              'Presentation fixture only: no unsigned current-draft firsts',
            authenticatedAt: `${asOfDate}T00:00:00Z`,
            recordStatus: 'current',
            canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
          },
        },
      },
    };
    const totals = createCanonicalTeamTotalsSnapshot(ready, seasonEndYear, {
      asOfDate,
    });
    // A complete money envelope supplies no current pick rights or branches.
    batch.set(
      world.collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION).doc(teamCode),
      { ...ready, totals }
    );
  }
  batch.set(
    world
      .collection(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)
      .doc(scenario.entitlement.id),
    scenario.entitlement
  );
  await batch.commit();
}
export async function savedRealDraftState() {
  const world = getReviewAdminDb()
    .collection(ARCHITECT_WORLDS_COLLECTION)
    .doc(REAL_DRAFT_WORLD);
  const snapshot = await world.get();
  const children = await Promise.all(
    [
      ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
      ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
    ].map(async (name) => ({
      name,
      docs: (await world.collection(name).get()).docs.map((d) => ({
        id: d.id,
        data: d.data(),
      })),
    }))
  );
  return { metadata: snapshot.data(), children };
}
