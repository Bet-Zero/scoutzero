/** Private overlapping terms; retained identities and an explicit software 2027–28 start. */
import fs from 'node:fs';
import { seedRetainedDraftSimulation } from './retainedDraftSimulationWorld';
import { multiseasonApronFixture } from './multiseasonApronWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import { DraftOverlappingPoolProgramZ } from '@/schemas/draftOverlappingPool';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { registerSoftwareSeasonEnvironment } from '@/features/architect/utils/governedSeason/softwareSeasonEnvironment';

export async function seedOverlappingDraftPoolWorld(
  uid: string,
  worldId: string,
  preDraft = false
) {
  registerSoftwareSeasonEnvironment(
    () =>
      process.env.PLAYWRIGHT_DRAFT_SIMULATION === 'true' &&
      getReviewAdminDb().projectId === 'demo-architect-review'
  );
  const file = process.env.SCOUTZERO_DRAFT_OVERLAPPING_POOL;
  if (!file)
    throw new Error('Private source-linked native pool terms required.');
  const program = DraftOverlappingPoolProgramZ.parse(
    JSON.parse(fs.readFileSync(file, 'utf8'))
  );
  const catalogue = await seedRetainedDraftSimulation(uid, worldId);
  const db = getReviewAdminDb(),
    root = db.doc(`architect_worlds/${worldId}`);
  const entitlements = Object.fromEntries(
    (await root.collection('entitlements').get()).docs.map((d) => [
      d.id,
      d.data(),
    ])
  );
  const batch = db.batch();
  for (const slot of program.slots) {
    entitlements[slot.entitlementId].holderTeam = slot.holderTeam;
    batch.set(
      root.collection('entitlements').doc(slot.entitlementId),
      entitlements[slot.entitlementId]
    );
  }
  // Reuse the accepted complete software finances; this fixture starts at the
  // selected draft season and does not assert three historical NBA transitions.
  const fixture = multiseasonApronFixture([0, 0, 0, 0]);
  for (const [code, base] of Object.entries(fixture.teams)) {
    const team = {
      ...base,
      salaryBookInputs: fixture.plan.steps[1].targetBooks[code],
      entitlementIds: Object.entries(entitlements)
        .filter(([, e]) => e.holderTeam === code)
        .map(([id]) => id),
    };
    batch.set(root.collection('teams').doc(code), {
      ...team,
      totals: createCanonicalTeamTotalsSnapshot(team, 2028, {
        asOfDate: '2028-06-05',
      }),
    });
  }
  batch.update(root, {
    worldName: 'Overlapping draft claims — governed 2028 scenario',
    currentSeason: '2027-28',
    asOfDate: '2028-06-05',
    // This existing field names the trade-room pair, not the draft family.
    // Complete allocation participants come from the validated seven slots.
    draftSimulationTeams: [
      program.claims[0].holderTeam,
      program.claims[2].holderTeam,
    ],
    draftSimulationBranches: 'swap-program',
    draftConditionalPrograms: [],
    draftSwapProgram: program,
    draftSimulationCalendar: [{ year: 2028, date: '2028-06-30' }],
    ...(preDraft
      ? {
          draftNativeLifecycle: {
            kind: 'governed-pre-draft-native-selections-v1',
            claimsEffectiveDate: '2028-06-20',
            selections: 'unconsumed-before-draft',
            tradingWindow: {
              kind: 'governed-test-seven-draft-window',
              asOf: '2028-06-20T12:00:00Z',
              previousDraftCompletedAt: '2027-06-30T23:59:59Z',
              firstFutureDraftStartsAt: '2028-06-30T00:00:00Z',
              firstYear: 2028,
              lastYear: 2034,
            },
            retainedFirstIds: catalogue.data.records
              .filter(
                (r) =>
                  r.originalPick &&
                  // WAS's own 2030 original has a competing claim. Use the
                  // unencumbered GSW original already held in its test inventory.
                  [
                    'BKN_2030_1st',
                    'BKN_2032_1st',
                    'GSW_2030_1st',
                    'WAS_2032_1st',
                  ].includes(r.originalPick.id)
              )
              .map((r) => r.entitlementId),
            softwareRetainedFirsts: ['BKN', 'WAS'].map((team) => ({
              team,
              draftYear: 2034,
            })),
          },
          draftNativeTransfers: [],
        }
      : {}),
  });
  await batch.commit();
  return { catalogue, program };
}
