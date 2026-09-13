/** World-only fixture: no NBA facts, no source collection writes. */
import { SYNTHETIC_DRAFT_SEASON_RELEASE } from './syntheticDraftSeasonRelease';
import { SyntheticDraftMutationSourceV2Z } from '@/schemas/draftPickReviewMutation';
import { SyntheticDraftSeasonSourceZ } from '@/schemas/draftReviewSeason';
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

export function syntheticDraftSeasonFixture(uid: string, worldId: string) {
  const retained = JSON.parse(SYNTHETIC_DRAFT_SEASON_RELEASE);
  const source = SyntheticDraftMutationSourceV2Z.parse(
    retained.retainedArtifacts[0].content
  );
  const lifecycle = SyntheticDraftSeasonSourceZ.parse(
    retained.retainedArtifacts[1].content
  );
  const metadata = {
    worldId,
    worldName: 'Original Pick Season Review',
    createdBy: uid,
    createdAt: new Date('2026-04-12T00:00:00Z'),
    lastModifiedAt: new Date('2026-04-12T00:00:00Z'),
    currentSeason: '2025-26',
    baselineSeason: '2025-26',
    asOfDate: '2026-04-12',
    actionCount: 0,
    parentWorldId: null,
    isArchived: false,
    draftReviewReleaseId: retained.release.id,
    draftReviewSeasonReleaseId: retained.release.id,
    draftReviewReleaseText: SYNTHETIC_DRAFT_SEASON_RELEASE,
    contractBaselineVersion: 2,
    contractSourceRelease: {
      releaseId: 'synthetic-draft-season-overlay-only',
      releaseVersion: 1,
      releaseDigest: `sha256:${'4'.repeat(64)}`,
    },
    contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
    contractBaselineSalaryCapYear: 2027,
    contractBaselineCoverage: { total: 0, complete: 0, needsInput: 0 },
  };
  const teams = Object.fromEntries(
    ALL_TEAM_CODES.map((teamCode) => {
      const teamName =
        teamCode === 'BOS'
          ? 'Boston Celtics'
          : teamCode === 'MIA'
            ? 'Miami Heat'
            : teamCode;
      const players = Array.from({ length: 18 }, (_, i) => {
        const base = buildReviewDepthPlayer(teamCode, teamName, i + 1);
        const isTwoWay = i >= 15;
        const salary = isTwoWay
          ? 578577
          : teamCode === 'BOS'
            ? 17000000
            : 2000000;
        return {
          ...base,
          isTwoWay,
          contract: {
            ...base.contract,
            isTwoWay,
            contractType: isTwoWay ? 'TWO-WAY' : 'STANDARD CONTRACT',
            salariesByYear: ['2025-26', '2026-27'].map((season) => ({
              season,
              salary,
              capHit: salary,
              guaranteed: !isTwoWay,
              option: null,
            })),
          },
        };
      });
      const team = withDerivedGovernedSalaryBooks(
        {
          id: teamCode,
          teamCode,
          abbreviation: teamCode,
          teamName,
          season: '2025-26',
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
        { salaryCapYear: 2027, asOfDate: source.asOf }
      );
      const { incompleteRosterCharge: _unused, ...books } =
        team.salaryBookInputs;
      const ready = {
        ...team,
        salaryBookInputs: {
          ...books,
          seasonCloseApronMeasurement: lifecycle.measurements[teamCode],
          unsignedFirstRoundPickState: {
            version: 1,
            status: 'ready',
            teamCode,
            salaryCapYear: 2027,
            entries: [],
            source: {
              evidenceId: `synthetic-season:${teamCode}:unsigned-firsts`,
              evidenceVersion: 1,
              authority: 'external-determination',
              reference: 'Synthetic fixture: no current-draft unsigned firsts',
              authenticatedAt: source.asOf,
              recordStatus: 'current',
              canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
            },
          },
        },
      };
      const totals = createCanonicalTeamTotalsSnapshot(ready, 2027, {
        asOfDate: source.asOf,
      });
      const expected = teamCode === 'BOS' ? 255000000 : 30000000;
      if (
        [totals.teamSalary, totals.apronTeamSalary, totals.taxSalary].some(
          (value) => value !== expected
        )
      )
        throw new Error(
          `Incomplete synthetic books for ${teamCode}: ${JSON.stringify(totals.salaryBooks)}`
        );
      return [teamCode, { ...ready, totals }];
    })
  );
  return { metadata, teams, source, lifecycle };
}

export async function seedSyntheticDraftSeasonWorld(
  uid: string,
  worldId: string
) {
  const fixture = syntheticDraftSeasonFixture(uid, worldId);
  const db = getReviewAdminDb();
  const root = db.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId);
  await db.recursiveDelete(root);
  const batch = db.batch();
  batch.set(root, fixture.metadata);
  for (const [id, team] of Object.entries(fixture.teams))
    batch.set(
      root.collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION).doc(id),
      team
    );
  for (const [id, entitlement] of Object.entries(fixture.source.entitlements))
    batch.set(
      root.collection(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION).doc(id),
      entitlement
    );
  await batch.commit();
  return fixture.source;
}
