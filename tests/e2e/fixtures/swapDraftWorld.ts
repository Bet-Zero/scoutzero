/** Explicit software holders, order and terms; source identities remain intact. */
import { seedConditionalDraftWorld } from './conditionalDraftWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import { retainedSimulationEntitlement } from '@/features/architect/utils/draftReview/simulationInventory';
import { DraftSwapProgramZ } from '@/schemas/draftSwapProgram';

export async function seedSwapDraftWorld(uid: string, worldId: string) {
  const { catalogue, considerationId } = await seedConditionalDraftWorld(
    uid,
    worldId,
    'WAS',
    'MIA'
  );
  const db = getReviewAdminDb();
  const root = db.doc(`architect_worlds/${worldId}`);
  const originals = catalogue.data.records.filter((r) => r.originalPick);
  const original = (team: string, year = 2026) =>
    originals.find(
      (r) =>
        r.originalPick!.originalTeam === team &&
        r.originalPick!.draftYear === year
    )!.entitlementId;
  const rightId = 'ent:WAS:2026:1:swap:00ca3e46';
  const laterId = 'ent:ORL:2026:1:conv:a2c80e04';
  const program = DraftSwapProgramZ.parse({
    kind: 'ordered-swap-pool-v1',
    year: 2026,
    tradedRightId: rightId,
    grantorTeam: 'WAS',
    slots: ['WAS', 'PHX', 'ORL'].map((team) => ({
      entitlementId: original(team),
      originalTeam: team,
      holderTeam: team === 'WAS' ? 'MIA' : team,
      protectedThrough: 0,
    })),
    steps: [
      {
        rightId,
        controllerId: original('WAS'),
        poolIds: [original('WAS'), original('PHX')],
        comparator: 'best_of',
        election: 'exercise-or-waive',
      },
      {
        rightId: laterId,
        controllerId: original('ORL'),
        poolIds: [original('ORL'), original('PHX')],
        comparator: 'best_of',
        election: 'exercise-or-waive',
      },
    ],
    inactiveClaimIds: [],
    result: null,
  });
  const docs = (await root.collection('entitlements').get()).docs;
  const entitlements = Object.fromEntries(docs.map((d) => [d.id, d.data()]));
  const batch = db.batch();
  const sourceDocs = await Promise.all(
    originals
      .filter((r) =>
        ['WAS', 'MIA', 'PHX', 'ORL'].includes(r.originalPick!.originalTeam)
      )
      .map((r) => db.doc(`architect_baseEntitlements/${r.entitlementId}`).get())
  );
  for (const row of originals) {
    if (!['WAS', 'MIA', 'PHX', 'ORL'].includes(row.originalPick!.originalTeam))
      continue;
    const source = sourceDocs.find((d) => d.id === row.entitlementId)!.data()!;
    entitlements[row.entitlementId] = {
      ...retainedSimulationEntitlement(catalogue, row.entitlementId, source),
      holderTeam:
        program.slots.find((s) => s.entitlementId === row.entitlementId)
          ?.holderTeam ?? row.originalPick!.originalTeam,
    };
    batch.set(
      root.collection('entitlements').doc(row.entitlementId),
      entitlements[row.entitlementId]
    );
  }
  for (const team of (await root.collection('teams').get()).docs)
    batch.update(team.ref, {
      entitlementIds: Object.entries(entitlements)
        .filter(([, e]) => e.holderTeam === team.id)
        .map(([id]) => id),
    });
  batch.update(root, {
    draftSimulationBranches: 'swap-program',
    draftConditionalPrograms: [],
    draftSwapProgram: program,
  });
  await batch.commit();
  return { catalogue, program, considerationId, original, rightId, laterId };
}
