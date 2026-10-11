/** Presentation fixture only: retained evidence still comes from the installed read service. */
import {
  ALL_TEAM_CODES,
  buildReviewDepthPlayer,
  getReviewAdminDb,
} from './architectReviewWorld';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
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
  asOfDate: string
) {
  const db = getReviewAdminDb(); // Always the demo emulator, never a source writer.
  const world = db
    .collection(ARCHITECT_WORLDS_COLLECTION)
    .doc(REAL_DRAFT_WORLD);
  await db.recursiveDelete(world);
  await world.set({
    worldId: REAL_DRAFT_WORLD,
    worldName: 'Retained Pick Review',
    createdBy: uid,
    createdAt: new Date(),
    lastModifiedAt: new Date(),
    currentSeason: '2026-27',
    baselineSeason: '2026-27',
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
    contractBaselineSalaryCapYear: 2027,
    contractBaselineCoverage: { total: 0, complete: 0, needsInput: 0 },
  });
  const batch = db.batch();
  for (const teamCode of ALL_TEAM_CODES) {
    const teamName =
      teamCode === scenario.team
        ? scenario.teamName
        : teamCode === 'DEN'
          ? 'Denver Nuggets'
          : teamCode;
    const players = [scenario.team, 'DEN'].includes(teamCode)
      ? Array.from({ length: 18 }, (_, i) =>
          buildReviewDepthPlayer(teamCode, teamName, i + 1)
        )
      : [];
    const team = withDerivedGovernedSalaryBooks(
      {
        id: teamCode,
        teamId: teamCode,
        teamCode,
        abbreviation: teamCode,
        teamName,
        season: '2026-27',
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
      { salaryCapYear: 2027, asOfDate: `${asOfDate}T00:00:00Z` }
    );
    batch.set(
      world.collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION).doc(teamCode),
      team
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
