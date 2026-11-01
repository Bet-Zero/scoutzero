/** Existing source rosters/contracts, retained pick identities, stipulated books.
 * A software test world, never a factual NBA transaction determination.
 */
import fs from 'node:fs';
import { seedRetainedDraftSimulation } from './retainedDraftSimulationWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  verifyContractSourceRelease,
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

export const MIXED_PLAYERS = {
  CHI: 'tre_jones',
  ORL: 'anthony_black',
} as const;
export const MIXED_FIRSTS = {
  CHI: 'ent:CHI:2028:1:own:2afbfb42',
  ORL: '',
} as const;
export async function seedMixedDraftTradeWorld(uid: string, worldId: string) {
  const catalogue = await seedRetainedDraftSimulation(uid, worldId);
  const release = await verifyContractSourceRelease(
    JSON.parse(
      fs.readFileSync(
        'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json',
        'utf8'
      )
    ),
    BUNDLED_CONTRACT_SOURCE_RELEASE_PIN
  );
  const db = getReviewAdminDb();
  const world = db.doc(`architect_worlds/${worldId}`);
  const batch = db.batch();
  batch.update(world, {
    worldId,
    ...contractBaselineMetadata(release),
    worldName: 'Players and Original Firsts — Governed Test',
    draftSimulationTeams: ['CHI', 'ORL'],
  });
  for (const document of buildContractBaselineTeamDocuments(release, worldId))
    batch.set(
      world.collection('contractBaselines').doc(document.shardId),
      document
    );
  await batch.commit();
  for (const teamCode of ['CHI', 'ORL'] as const) {
    const ref = world.collection('teams').doc(teamCode);
    const prior = (await ref.get()).data()!;
    const source = (
      await db.doc(`architect_baseTeams/${teamCode}`).get()
    ).data()!;
    const roster = source.roster as string[];
    const players = roster.map((playerId) => {
      const observations = release.observations.filter(
        (o) => o.playerId === playerId && o.teamId === teamCode
      );
      if (observations.length !== 1)
        throw new Error(
          `Retained roster Contract missing or ambiguous: ${playerId}`
        );
      const p = JSON.parse(observations[0].artifactContent);
      return {
        ...p,
        id: playerId,
        playerId,
        player_id: playerId,
        name: p.displayName,
        teamCode,
        teamId: teamCode,
      };
    });
    const team = withDerivedGovernedSalaryBooks(
      {
        ...prior,
        teamName: source.teamName,
        roster,
        players,
        contractEventLedgers: [],
        hardCapped: true,
        hardCapLevel: 'firstApron',
      },
      {
        salaryCapYear: 2026,
        asOfDate: '2026-06-05T00:00:00Z',
      }
    );
    const { incompleteRosterCharge: _legacy, ...books } = team.salaryBookInputs;
    const ready = {
      ...team,
      salaryBookInputs: {
        ...books,
        unsignedFirstRoundPickState:
          prior.salaryBookInputs.unsignedFirstRoundPickState,
      },
    };
    await ref.set({
      ...ready,
      totals: createCanonicalTeamTotalsSnapshot(ready, 2026, {
        asOfDate: '2026-06-05',
      }),
    });
  }
  return catalogue;
}
