/** Accepted conditional software world, full 15+3 rosters and two unchanged
 * retained ordinary Contracts. No simulated option decisions or NBA authority.
 */
import fs from 'node:fs';
import { seedConditionalDraftWorld } from './conditionalDraftWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  verifyContractSourceRelease,
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';

export const CONDITIONAL_PLAYERS = {
  CHI: {
    id: 'tre_jones',
    name: 'Tre Jones',
    salary: 8000000,
    matching: 8000000,
    nextSalary: 8000000,
  },
  CHA: {
    id: 'tre_mann',
    name: 'Tre Mann',
    salary: 8000000,
    matching: 8000000,
    nextSalary: 8000000,
  },
} as const;

export const CONDITIONAL_COLLECTIONS = {
  CHI: [
    CONDITIONAL_PLAYERS.CHI,
    {
      id: 'noa_essengue',
      name: 'Noa Essengue',
      salary: 5429520,
      matching: 5429520,
      nextSalary: 5701200,
    },
    {
      id: 'patrick_williams',
      name: 'Patrick Williams',
      salary: 18000000,
      matching: 18000000,
      nextSalary: 18000000,
    },
  ],
  CHA: [
    CONDITIONAL_PLAYERS.CHA,
    {
      id: 'grant_williams',
      name: 'Grant Williams',
      salary: 13645500,
      matching: 13645500,
      nextSalary: 14265750,
    },
    {
      id: 'kon_knueppel',
      name: 'Kon Knueppel',
      salary: 10015680,
      matching: 10015680,
      nextSalary: 10516560,
    },
  ],
} as const;

export async function seedMixedConditionalWorld(uid: string, worldId: string) {
  const seeded = await seedConditionalDraftWorld(uid, worldId, 'CHI', 'CHA');
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
  for (const team of ['CHI', 'CHA'] as const) {
    const ref = root.collection('teams').doc(team);
    const before = (await ref.get()).data()!;
    const retained = CONDITIONAL_COLLECTIONS[team].map((ordinary) => {
      const observation = release.observations.filter(
        (o) => o.teamId === team && o.playerId === ordinary.id
      );
      if (observation.length !== 1)
        throw new Error('Exactly one retained ordinary Contract is required.');
      const source = JSON.parse(observation[0].artifactContent);
      const record = release.records.find(
        (r) => r.playerId === observation[0].playerId && r.teamId === team
      );
      if (!record) throw new Error('Retained Contract identity is required.');
      return {
        ...source,
        contract: { ...source.contract, contractId: record.contractId },
        id: observation[0].playerId,
        playerId: observation[0].playerId,
        player_id: observation[0].playerId,
        name: source.displayName,
        teamCode: team,
        teamId: team,
      };
    });
    const players = before.players.map((p: any, i: number) =>
      i < retained.length
        ? retained[i]
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
      132000000 +
      CONDITIONAL_COLLECTIONS[team === 'CHI' ? 'CHA' : 'CHI'].reduce(
        (n, p) => n + p.nextSalary,
        0
      );
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
    worldName: 'Players and Protected First — Governed Test',
    draftSimulationSeasonBooks: nextBooks,
  });
  await batch.commit();
  return seeded;
}
