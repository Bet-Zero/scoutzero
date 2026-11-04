/** Accepted ordered-swap software world, full 15+3 rosters and two unchanged
 * retained ordinary Contracts. No simulated option decisions or NBA authority.
 */
import fs from 'node:fs';
import { seedSwapDraftWorld } from './swapDraftWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  verifyContractSourceRelease,
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';

export const SWAP_PLAYERS = {
  WAS: {
    id: 'corey_kispert',
    name: 'Corey Kispert',
    salary: 13975000,
    matching: 13975000,
    nextSalary: 13975000,
  },
  MIA: {
    id: 'davion_mitchell',
    name: 'Davion Mitchell',
    salary: 11600000,
    matching: 11600000,
    nextSalary: 12400000,
  },
} as const;

export async function seedMixedSwapWorld(uid: string, worldId: string) {
  const seeded = await seedSwapDraftWorld(uid, worldId);
  const release = await verifyContractSourceRelease(
    JSON.parse(
      fs.readFileSync(
        'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json',
        'utf8'
      )
    ),
    BUNDLED_CONTRACT_SOURCE_RELEASE_PIN
  );
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const batch = getReviewAdminDb().batch();
  const metadata = (await root.get()).data()!;
  const nextBooks = metadata.draftSimulationSeasonBooks;
  for (const document of buildContractBaselineTeamDocuments(release, worldId))
    batch.set(
      root.collection('contractBaselines').doc(document.shardId),
      document
    );
  for (const team of ['WAS', 'MIA'] as const) {
    const ref = root.collection('teams').doc(team);
    const before = (await ref.get()).data()!;
    const observation = release.observations.filter(
      (o) => o.teamId === team && o.playerId === SWAP_PLAYERS[team].id
    );
    if (observation.length !== 1)
      throw new Error('Exactly one retained ordinary Contract is required.');
    const source = JSON.parse(observation[0].artifactContent);
    const record = release.records.find(
      (r) => r.playerId === observation[0].playerId && r.teamId === team
    );
    if (!record) throw new Error('Retained Contract identity is required.');
    const real = {
      ...source,
      contract: { ...source.contract, contractId: record.contractId },
      id: observation[0].playerId,
      playerId: observation[0].playerId,
      player_id: observation[0].playerId,
      name: source.displayName,
      teamCode: team,
      teamId: team,
    };
    const players = before.players.map((p: any, i: number) =>
      i === 0
        ? real
        : {
            ...p,
            contract: {
              ...p.contract,
              salariesByYear: p.contract.salariesByYear.map((s: any) => ({
                ...s,
                salary: p.isTwoWay ? 578577 : 11000000,
                capHit: p.isTwoWay ? 578577 : 11000000,
              })),
            },
          }
    );
    const bare = {
      ...before,
      roster: players.map((p: any) => p.playerId ?? p.id),
      players,
      contractEventLedgers: [],
      hardCapped: true,
      hardCapLevel: 'firstApron',
    };
    const books = (year: number) => {
      const { incompleteRosterCharge: _unused, ...value } =
        withDerivedGovernedSalaryBooks(bare, {
          salaryCapYear: year,
          asOfDate:
            year === 2026
              ? '2026-06-05T00:00:00Z'
              : '2026-07-01T00:00:00-04:00',
        }).salaryBookInputs;
      return {
        ...value,
        unsignedFirstRoundPickState: {
          ...before.salaryBookInputs.unsignedFirstRoundPickState,
          salaryCapYear: year,
        },
      };
    };
    // Separate governed next-year tax inputs follow this scenario's player exchange.
    // Team and Apron Salary remain derived from the actual committed Contracts.
    nextBooks[team] = books(2027);
    nextBooks[team].taxSalary.lineItems[0].amount =
      154000000 + SWAP_PLAYERS[team === 'WAS' ? 'MIA' : 'WAS'].nextSalary;
    const ready = { ...bare, salaryBookInputs: books(2026) };
    batch.set(ref, {
      ...ready,
      totals: createCanonicalTeamTotalsSnapshot(ready, 2026, {
        asOfDate: '2026-06-05',
      }),
    });
  }
  batch.update(root, {
    ...contractBaselineMetadata(release),
    worldName: 'Players and Unresolved Swap Right — Governed Test',
    draftSimulationSeasonBooks: nextBooks,
  });
  await batch.commit();
  return seeded;
}
