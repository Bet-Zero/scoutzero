/** Uses the existing review-world money/roster fixture and real read-only sources. */
import fs from 'node:fs';
import { seedRealDraftReviewWorld } from '../helpers/realDraftReviewWorld';
import {
  getReviewAdminDb,
  ALL_TEAM_CODES,
} from '../helpers/architectReviewWorld';
import {
  loadSimulationCatalogue,
  retainedSimulationEntitlement,
  DRAFT_SIMULATION_KIND,
  DRAFT_SIMULATION_NOTICE,
} from '@/features/architect/utils/draftReview/simulationInventory';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
} from '@/constants/collections';

export async function seedRetainedDraftSimulation(
  uid: string,
  worldId: string,
  conditional = false
) {
  const file = process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE;
  if (!file)
    throw new Error(
      'The retained catalogue is required; no synthetic substitute.'
    );
  const catalogue = await loadSimulationCatalogue(
    fs.readFileSync(file, 'utf8')
  );
  const db = getReviewAdminDb();
  if (
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '') ||
    db.projectId !== 'demo-architect-review'
  )
    throw new Error('Review emulator required.');
  const sources = await Promise.all(
    catalogue.data.records.map((r) =>
      db.collection(ARCHITECT_BASE_ENTITLEMENTS_PATH).doc(r.entitlementId).get()
    )
  );
  const docs = sources.map((s) =>
    retainedSimulationEntitlement(catalogue, s.id, s.data() ?? {})
  );
  await seedRealDraftReviewWorld(
    uid,
    {
      name: 'governed-test',
      team: 'CHI',
      teamName: 'Chicago Bulls',
      entitlement: { id: 'ent:CHI:2028:1:own:2afbfb42', seasonYear: 2028 },
      expected: [],
    },
    '2026-06-05',
    { worldId, otherTeam: 'TOR', createOnly: true }
  );
  const world = db.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId);
  const batch = db.batch();
  for (const team of ALL_TEAM_CODES)
    batch.update(
      world.collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION).doc(team),
      {
        entitlementIds: docs
          .filter((d) => d.holderTeam === team)
          .map((d) => d.id),
        ...(['CHI', 'TOR'].includes(team)
          ? { hardCapped: true, hardCapLevel: 'firstApron' }
          : {}),
      }
    );
  for (const entitlement of docs)
    batch.set(
      world
        .collection(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)
        .doc(String(entitlement.id)),
      entitlement
    );
  batch.update(world, {
    worldName: 'Retained Picks — Governed Test',
    draftInventoryRevision: 0,
    draftSimulationKind: DRAFT_SIMULATION_KIND,
    draftSimulationNotice: DRAFT_SIMULATION_NOTICE,
    draftSimulationCatalogue: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    draftSimulationUnresolved: catalogue.data.unresolved,
    draftSimulationBranches: conditional ? 'conditional-2027' : 'unconditional',
  });
  await batch.commit();
  return catalogue;
}
