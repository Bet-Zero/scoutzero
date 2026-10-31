import { DraftPenaltyPlacementInputZ } from '@/schemas/draftPenaltyPlacement';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from '@/features/architect/utils/leagueTeams';
import { multiseasonApronFixture } from './multiseasonApronWorld';
import { seedApronDraftWorld } from './apronDraftWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';

export const penaltyBaseOrder = [
  'TOR',
  'MIA',
  'BOS',
  ...[...AUTHORITATIVE_WORLD_TEAM_CODES]
    .filter((c) => !['TOR', 'MIA', 'BOS'].includes(c))
    .sort(),
];

export function penaltyDraftInput(
  penalized = ['TOR'],
  originals = penaltyBaseOrder.map((originalTeam) => ({
    originalTeam,
    entitlementId: `${originalTeam}-2033`,
    holderTeam: originalTeam,
  })),
  reviewedRightIds: string[] = []
) {
  return DraftPenaltyPlacementInputZ.parse({
    kind: 'governed-software-draft-placement-v1',
    draftYear: 2033,
    date: '2033-06-23',
    regularSeasonCompletedOn: '2033-04-10',
    evidenceReference: 'explicit-software-2033-draft-inputs',
    ordering: 'complete-including-lottery-and-ties',
    membershipComplete: true,
    penalizedPickIds: penalized.map((t) => `${t}_2033_1st`),
    selections: penaltyBaseOrder.map((originalTeam) => {
      const p = originals.find((p) => p.originalTeam === originalTeam)!;
      return {
        ...p,
        originalTeamWinningPercentage:
          originalTeam === 'TOR'
            ? '0.600'
            : originalTeam === 'MIA'
              ? '0.400'
              : '0.500',
        claimsComplete: true,
        claimEntitlementIds: [p.entitlementId],
      };
    }),
    reviewedRightIds,
  });
}
export async function seedPenaltyDraftWorld(
  uid: string,
  worldId: string,
  multiple: boolean
) {
  const penalized = multiple ? ['TOR', 'MIA', 'BOS'] : ['TOR'];
  const fixture = multiseasonApronFixture([1, 1, 0, 0], 8, penalized);
  const result = await seedApronDraftWorld(uid, worldId, 1, fixture);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const docs = (await root.collection('entitlements').get()).docs;
  // Stipulated starting ownership; this does not assert an NBA transfer occurred.
  if (multiple) {
    const batch = getReviewAdminDb().batch();
    for (const team of ['TOR', 'MIA']) {
      const id = result.original(team, 2033);
      batch.update(root.collection('entitlements').doc(id), {
        holderTeam: team === 'TOR' ? 'MIA' : 'TOR',
      });
    }
    for (const team of ['TOR', 'MIA'])
      batch.update(root.collection('teams').doc(team), {
        entitlementIds: docs
          .filter((d) => {
            const original = result.catalogue.data.records.find(
              (r) => r.entitlementId === d.id
            )?.originalPick;
            const holder =
              original?.draftYear === 2033 &&
              ['TOR', 'MIA'].includes(original.originalTeam)
                ? original.originalTeam === 'TOR'
                  ? 'MIA'
                  : 'TOR'
                : d.data().holderTeam;
            return holder === team;
          })
          .map((d) => d.id),
      });
    await batch.commit();
  }
  const current = (await root.collection('entitlements').get()).docs;
  const originals = result.catalogue.data.records
    .filter((r) => r.originalPick?.draftYear === 2033)
    .map((r) => ({
      originalTeam: r.originalPick!.originalTeam,
      entitlementId: r.entitlementId,
      holderTeam: String(
        current.find((d) => d.id === r.entitlementId)!.data().holderTeam
      ),
    }));
  const input = penaltyDraftInput(
    penalized,
    originals,
    result.catalogue.data.records
      .filter((r) => !r.originalPick)
      .map((r) => r.entitlementId)
  );
  await root.update({
    draftPenaltyInput: input,
    draftSimulationCalendar: [{ year: 2033, date: input.date }],
  });
  return { ...result, input };
}
