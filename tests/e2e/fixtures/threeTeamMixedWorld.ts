/** Existing 2028 software season/rosters and unchanged retained ordinary
 * Contracts. Neither historical continuity nor actual NBA legality is claimed.
 */
import fs from 'node:fs';
import { seedOverlappingDraftPoolWorld } from './overlappingDraftPoolWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  verifyContractSourceRelease,
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';

export const THREE_TEAM_PLAYERS = [
  {
    id: 'tyrese_maxey',
    name: 'Tyrese Maxey',
    salary: 43582280,
    from: 'PHI',
    to: 'CHI',
  },
  {
    id: 'josh_giddey',
    name: 'Josh Giddey',
    salary: 25000000,
    from: 'CHI',
    to: 'PHI',
  },
  {
    id: 'johni_broome',
    name: 'Johni Broome',
    salary: 2525901,
    from: 'PHI',
    to: 'BKN',
  },
  {
    id: 'terance_mann',
    name: 'Terance Mann',
    salary: 16000000,
    from: 'BKN',
    to: 'PHI',
  },
] as const;
export const NATIVE_MIXED_DATE = {
  seasonId: '2027-28',
  asOfDate: '2028-06-20',
  yearKey: 2028,
};

export async function seedThreeTeamMixedWorld(uid: string, worldId: string) {
  const seeded = await seedOverlappingDraftPoolWorld(uid, worldId, true);
  const release = await verifyContractSourceRelease(
    JSON.parse(
      fs.readFileSync(
        'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json',
        'utf8'
      )
    ),
    BUNDLED_CONTRACT_SOURCE_RELEASE_PIN
  );
  const db = getReviewAdminDb(),
    root = db.doc(`architect_worlds/${worldId}`);
  const metadata = (await root.get()).data()!;
  const batch = db.batch();
  for (const document of buildContractBaselineTeamDocuments(release, worldId))
    batch.set(
      root.collection('contractBaselines').doc(document.shardId),
      document
    );
  for (const code of ['PHI', 'BKN', 'CHI'] as const) {
    const ref = root.collection('teams').doc(code),
      before = (await ref.get()).data()!;
    const retained = THREE_TEAM_PLAYERS.filter((p) => p.from === code).map(
      (ordinary) => {
        const observed = release.observations.filter(
          (o) => o.teamId === ordinary.from && o.playerId === ordinary.id
        );
        const record = release.records.find(
          (r) => r.teamId === ordinary.from && r.playerId === ordinary.id
        );
        if (observed.length !== 1 || !record)
          throw new Error('Exact retained ordinary Contract required.');
        const source = JSON.parse(observed[0].artifactContent);
        return {
          ...source,
          contract: { ...source.contract, contractId: record.contractId },
          id: record.playerId,
          playerId: record.playerId,
          player_id: record.playerId,
          name: source.displayName,
          teamCode: code,
          teamId: code,
        };
      }
    );
    // Each full 15+3 software roster contains unchanged retained Contracts
    // and explicit $8m depth Contracts. This is not NBA salary authority.
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
      players,
      roster: players.map((p: any) => p.playerId ?? p.id),
      contractEventLedgers: [],
      hardCapped: true,
      hardCapLevel: 'firstApron',
    };
    const { incompleteRosterCharge: _unused, ...books } =
      withDerivedGovernedSalaryBooks(bare, {
        salaryCapYear: 2028,
        asOfDate: '2028-06-05T00:00:00Z',
      }).salaryBookInputs;
    const ready = {
      ...bare,
      salaryBookInputs: {
        ...books,
        softwareSeasonContext: before.salaryBookInputs.softwareSeasonContext,
        unsignedFirstRoundPickState:
          before.salaryBookInputs.unsignedFirstRoundPickState,
      },
    };
    batch.set(ref, {
      ...ready,
      totals: createCanonicalTeamTotalsSnapshot(ready, 2028, {
        asOfDate: '2028-06-05',
      }),
    });
  }
  // Actual retained originals already in these test inventories. No unknown
  // 2029 right, projection alias, or competing obligation supplies possession.
  const witnesses = [
    'PHI_2030_1st',
    'PHI_2032_1st',
    'BKN_2030_1st',
    'BKN_2032_1st',
  ];
  const retainedFirstIds = seeded.catalogue.data.records
    .filter(
      (r) =>
        r.role === 'original' &&
        r.originalPick &&
        witnesses.includes(r.originalPick.id)
    )
    .map((r) => r.entitlementId);
  if (retainedFirstIds.length !== witnesses.length)
    throw new Error('Complete retained Stepien witnesses required.');
  batch.update(root, {
    ...contractBaselineMetadata(release),
    worldName: 'Three-Team Players and Resolved 2028 Selections',
    draftSimulationTeams: ['PHI', 'BKN', 'CHI'],
    draftNativeLifecycle: {
      ...metadata.draftNativeLifecycle,
      retainedFirstIds,
      softwareRetainedFirsts: ['PHI', 'BKN'].map((team) => ({
        team,
        draftYear: 2034,
      })),
    },
  });
  await batch.commit();
  return seeded;
}
