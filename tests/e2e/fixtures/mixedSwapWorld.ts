/** Accepted ordered-swap software world, full 15+3 rosters and unchanged
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
    id: 'jaden_hardy',
    name: 'Jaden Hardy',
    salary: 6000000,
    matching: 6000000,
    nextSalary: 6000000,
  },
  MIA: {
    id: 'davion_mitchell',
    name: 'Davion Mitchell',
    salary: 11600000,
    matching: 11600000,
    nextSalary: 12400000,
  },
  PHX: {
    id: 'grayson_allen',
    name: 'Grayson Allen',
    salary: 16875000,
    matching: 16875000,
    nextSalary: 18125000,
  },
} as const;

export const SWAP_COLLECTIONS = {
  WAS: [
    SWAP_PLAYERS.WAS,
    {
      id: 'tristan_vukcevic',
      name: 'Tristan Vukcevic',
      salary: 2857143,
      matching: 2857143,
      nextSalary: 3000000,
    },
  ],
  MIA: [
    SWAP_PLAYERS.MIA,
    {
      id: 'myron_gardner',
      name: 'Myron Gardner',
      salary: 395029,
      matching: 395029,
      nextSalary: 2150917,
    },
  ],
  PHX: [
    SWAP_PLAYERS.PHX,
    {
      id: 'rasheer_fleming',
      name: 'Rasheer Fleming',
      salary: 1272870,
      matching: 1272870,
      nextSalary: 2150917,
    },
  ],
} as const;

export function mixedSwapRoutes(threeTeam = false) {
  return threeTeam
    ? ([
        { from: 'WAS', to: 'MIA' },
        { from: 'MIA', to: 'PHX' },
        { from: 'PHX', to: 'WAS' },
      ] as const)
    : ([
        { from: 'WAS', to: 'MIA' },
        { from: 'MIA', to: 'WAS' },
      ] as const);
}

export async function seedMixedSwapWorld(
  uid: string,
  worldId: string,
  threeTeam = false
) {
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
  const routes = mixedSwapRoutes(threeTeam);
  for (const document of buildContractBaselineTeamDocuments(release, worldId))
    batch.set(
      root.collection('contractBaselines').doc(document.shardId),
      document
    );
  for (const { from: team } of routes) {
    const ref = root.collection('teams').doc(team);
    const before = (await ref.get()).data()!;
    const retained = SWAP_COLLECTIONS[team].map((ordinary) => {
      const record = release.records.find(
        (r) =>
          r.playerId === ordinary.id &&
          r.teamId === team &&
          r.sourceContractPath === 'contract'
      );
      if (!record) throw new Error('Retained Contract identity is required.');
      const observation = release.observations.find(
        (o) => o.observationId === record.sourceObservationId
      );
      if (!observation || observation.teamId !== team)
        throw new Error(
          'The selected retained Contract observation is required.'
        );
      const source = JSON.parse(observation.artifactContent);
      return {
        ...source,
        contract: { ...source.contract, contractId: record.contractId },
        id: observation.playerId,
        playerId: observation.playerId,
        player_id: observation.playerId,
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
                salary: p.isTwoWay ? 578577 : 8000000,
                capHit: p.isTwoWay ? 578577 : 8000000,
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
      104000000 +
      SWAP_COLLECTIONS[routes.find((r) => r.to === team)!.from].reduce(
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
    worldName: 'Players and Unresolved Swap Right — Governed Test',
    ...(threeTeam ? { draftSimulationTeams: routes.map((r) => r.from) } : {}),
    draftSimulationSeasonBooks: nextBooks,
  });
  await batch.commit();
  return seeded;
}
