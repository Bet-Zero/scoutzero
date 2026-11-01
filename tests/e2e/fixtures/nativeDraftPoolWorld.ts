/** Private native terms; retained identities and an explicit software 2028–29 start. */
import fs from 'node:fs';
import { seedRetainedDraftSimulation } from './retainedDraftSimulationWorld';
import { multiseasonApronFixture } from './multiseasonApronWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import { DraftNativePoolProgramZ } from '@/schemas/draftNativePool';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { registerSoftwareSeasonEnvironment } from '@/features/architect/utils/governedSeason/softwareSeasonEnvironment';

export async function seedNativeDraftPoolWorld(uid: string, worldId: string) {
  registerSoftwareSeasonEnvironment(
    () =>
      process.env.PLAYWRIGHT_DRAFT_SIMULATION === 'true' &&
      getReviewAdminDb().projectId === 'demo-architect-review'
  );
  const file = process.env.SCOUTZERO_DRAFT_NATIVE_POOL;
  if (!file)
    throw new Error('Private source-linked native pool terms required.');
  const program = DraftNativePoolProgramZ.parse(
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
      salaryBookInputs: fixture.plan.steps[2].targetBooks[code],
      entitlementIds: Object.entries(entitlements)
        .filter(([, e]) => e.holderTeam === code)
        .map(([id]) => id),
    };
    batch.set(root.collection('teams').doc(code), {
      ...team,
      totals: createCanonicalTeamTotalsSnapshot(team, 2029, {
        asOfDate: '2029-06-05',
      }),
    });
  }
  batch.update(root, {
    worldName: 'Native pooled selections — governed 2029 scenario',
    currentSeason: '2028-29',
    asOfDate: '2029-06-05',
    draftSimulationTeams: [
      program.nativePool.beneficiaryTeam,
      program.nativePool.residualTeam,
    ],
    draftSimulationBranches: 'swap-program',
    draftConditionalPrograms: [],
    draftSwapProgram: program,
    draftSimulationCalendar: [{ year: 2029, date: '2029-06-30' }],
  });
  await batch.commit();
  return { catalogue, program };
}
