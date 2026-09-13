/** World-only emulator fixture. No source collection writes or source seed. */
import { SYNTHETIC_DRAFT_RELEASES } from './syntheticDraftMutationReleases';
import { SyntheticDraftMutationSourceZ } from '@/schemas/draftPickReviewMutation';
import {
  ALL_TEAM_CODES,
  buildReviewDepthPlayer,
  getReviewAdminDb,
} from '../helpers/architectReviewWorld';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';

export async function seedSyntheticDraftReviewWorld(
  uid: string,
  worldId: string,
  variant: keyof typeof SYNTHETIC_DRAFT_RELEASES = 'legal'
) {
  const db = getReviewAdminDb();
  const serialized = SYNTHETIC_DRAFT_RELEASES[variant];
  const retained = JSON.parse(serialized);
  const source = SyntheticDraftMutationSourceZ.parse(
    retained.retainedArtifacts[0].content
  );
  const world = db.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId);
  await db.recursiveDelete(world);
  const metadata = {
    worldId,
    worldName: 'Original Pick Review',
    createdBy: uid,
    createdAt: new Date(),
    lastModifiedAt: new Date(),
    currentSeason: '2026-27',
    baselineSeason: '2026-27',
    asOfDate: '2026-07-15',
    parentWorldId: null,
    isArchived: false,
    draftReviewReleaseId: retained.release.id,
    draftReviewReleaseText: serialized,
    contractBaselineVersion: 2,
    contractSourceRelease: {
      releaseId: 'synthetic-draft-world-overlay-only',
      releaseVersion: 1,
      releaseDigest: `sha256:${'3'.repeat(64)}`,
    },
    contractBaselineEffectiveAt: '2026-07-01T00:00:00Z',
    contractBaselineSalaryCapYear: 2027,
    contractBaselineCoverage: { total: 0, complete: 0, needsInput: 0 },
  };
  await world.set(metadata);
  const batch = db.batch();
  for (const teamCode of ALL_TEAM_CODES) {
    const players = ['BOS', 'MIA'].includes(teamCode)
      ? Array.from({ length: 18 }, (_, i) => {
          const base = buildReviewDepthPlayer(
            teamCode,
            teamCode === 'BOS' ? 'Boston Celtics' : 'Miami Heat',
            i + 1
          );
          const isTwoWay = i >= 15;
          const salary = isTwoWay ? 578577 : 2000000;
          return {
            ...base,
            isTwoWay,
            contract: {
              ...base.contract,
              isTwoWay,
              contractType: isTwoWay ? 'TWO-WAY' : 'MINIMUM CONTRACT',
              salariesByYear: [
                {
                  season: '2026-27',
                  salary,
                  capHit: salary,
                  guaranteed: !isTwoWay,
                  option: null,
                },
              ],
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
        teamName:
          teamCode === 'BOS'
            ? 'Boston Celtics'
            : teamCode === 'MIA'
              ? 'Miami Heat'
              : teamCode,
        season: '2026-27',
        players,
        roster: players.map((p) => p.id),
        entitlementIds: source.teamEntitlementIds[teamCode],
        capHolds: [],
        deadCap: [],
        exceptions: { tpe: [] },
        offerSheets: [],
        incomingOfferSheets: [],
        draftPicks: [],
      },
      { salaryCapYear: 2027, asOfDate: '2026-07-15T00:00:00Z' }
    );
    const salaryBookInputs = { ...team.salaryBookInputs };
    delete salaryBookInputs.incompleteRosterCharge;
    const ready = {
      ...team,
      salaryBookInputs: {
        ...salaryBookInputs,
        unsignedFirstRoundPickState: {
          version: 1,
          status: 'ready',
          teamCode,
          salaryCapYear: 2027,
          entries: [],
          source: {
            evidenceId: `synthetic-review:${teamCode}:unsigned-firsts`,
            evidenceVersion: 1,
            authority: 'external-determination',
            reference: 'synthetic fixture: no unsigned current-draft firsts',
            authenticatedAt: '2026-07-01T00:00:00Z',
            recordStatus: 'current',
            canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
          },
        },
      },
    };
    const totals = createCanonicalTeamTotalsSnapshot(ready, 2027, {
      asOfDate: '2026-07-15T00:00:00Z',
    });
    // Independent fixture arithmetic: 15 standard contracts x $2m. Two-way
    // salaries are outside these books; no money changes in the pick exchange.
    if (
      ['BOS', 'MIA'].includes(teamCode) &&
      (totals.teamSalary !== 30000000 ||
        totals.apronTeamSalary !== 30000000 ||
        totals.taxSalary !== 30000000)
    )
      throw new Error(
        `Synthetic salary books are incomplete: ${JSON.stringify(totals.salaryBooks)}`
      );
    batch.set(
      world.collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION).doc(teamCode),
      { ...ready, totals }
    );
  }
  for (const [id, entitlement] of Object.entries(source.entitlements))
    batch.set(
      world.collection(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION).doc(id),
      entitlement
    );
  await batch.commit();
  return source;
}
