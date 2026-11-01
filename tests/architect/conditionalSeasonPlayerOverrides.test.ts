import { beforeEach, describe, expect, it } from 'vitest';
import { doc, runTransaction, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  prepareSeasonPlayerOverrides,
  assertSeasonPlayerOverridesCurrent,
  writeSeasonPlayerOverrides,
  confirmSeasonPlayerOverrides,
} from '@/features/architect/utils/seasonManager.playerOverrides';
import type { PreparedSeasonAdvanceTeam } from '@/features/architect/utils/seasonManager.history';
import {
  resetMockDataStore,
  seedMockData,
  getMockData,
  getAllMockData,
  failMockBatchCommitAfter,
} from '../__mocks__/firebase';

const root = 'architect_worlds/season_players';
const path = `${root}/teams/CHI/players/p1`;
const missingPath = `${root}/teams/CHI/players/p2`;
const player = (id: string) => ({
  playerId: id,
  teamCode: 'CHI',
  contract: {
    contractId: `contract-${id}`,
    yearsRemaining: 2,
    salariesByYear: ['2025-26', '2026-27'].map((season) => ({
      season,
      salary: 8000000,
    })),
  },
});
function prepared() {
  const beforeTeam = { players: [player('p1'), player('p2')] };
  const committedTeam = {
    players: beforeTeam.players.map((p) => ({
      ...p,
      contract: {
        ...p.contract,
        yearsRemaining: 1,
        salariesByYear: p.contract.salariesByYear.slice(1),
      },
    })),
  };
  return [
    { teamCode: 'CHI', beforeTeam, committedTeam },
  ] as PreparedSeasonAdvanceTeam[];
}
const snapshot = () => structuredClone([...getAllMockData()]);
async function commit(
  plan: Awaited<ReturnType<typeof prepareSeasonPlayerOverrides>>
) {
  await runTransaction(db, async (transaction) => {
    await assertSeasonPlayerOverridesCurrent(transaction, plan);
    writeSeasonPlayerOverrides(transaction, plan);
    transaction.set(doc(db, `${root}/events/season`), { advanced: true });
  });
}
beforeEach(() => {
  resetMockDataStore();
  seedMockData(path, { ...player('p1'), privatePlanNote: 'preserve' });
});
describe('conditional season publication of continuing player overrides', () => {
  it('publishes the continuing Contract atomically and preserves override-only fields', async () => {
    const teams = prepared();
    const plan = await prepareSeasonPlayerOverrides('season_players', teams);
    await commit(plan);
    await confirmSeasonPlayerOverrides(plan);
    expect(getMockData(path)).toEqual({
      playerId: 'p1',
      teamCode: 'CHI',
      privatePlanNote: 'preserve',
      contract: {
        contractId: 'contract-p1',
        yearsRemaining: 1,
        salariesByYear: [{ season: '2026-27', salary: 8000000 }],
      },
    });
    expect(getMockData(missingPath)).toBeUndefined();
    expect(getMockData(`${root}/events/season`)).toEqual({ advanced: true });
  });
  it('rejects a conflicting pre-season Contract without repairing it silently', async () => {
    const altered = player('p1');
    altered.contract.salariesByYear[0].salary = 1;
    seedMockData(path, altered);
    const before = snapshot();
    await expect(
      prepareSeasonPlayerOverrides('season_players', prepared())
    ).rejects.toThrow(/conflicts/);
    expect(snapshot()).toEqual(before);
  });
  it('changes only the Contract, preserving custom fields that also exist on the team player', async () => {
    const teams = prepared();
    const current = teams[0].committedTeam.players as Record<string, unknown>[];
    current[0].bio = { displayName: 'Canonical name' };
    seedMockData(path, {
      ...player('p1'),
      bio: { displayName: 'Saved custom label' },
    });
    await commit(await prepareSeasonPlayerOverrides('season_players', teams));
    expect(getMockData(path)).toMatchObject({
      bio: { displayName: 'Saved custom label' },
      contract: {
        yearsRemaining: 1,
        salariesByYear: [{ season: '2026-27', salary: 8000000 }],
      },
    });
  });
  it.each(['changed', 'created', 'deleted'])(
    'rejects a concurrently %s player override with no partial publication',
    async (mode) => {
      const plan = await prepareSeasonPlayerOverrides(
        'season_players',
        prepared()
      );
      if (mode === 'deleted') await deleteDoc(doc(db, path));
      else
        seedMockData(mode === 'created' ? missingPath : path, {
          ...player(mode === 'created' ? 'p2' : 'p1'),
          concurrent: true,
        });
      const before = snapshot();
      await expect(commit(plan)).rejects.toThrow(
        /Stale\/concurrent player override/
      );
      expect(snapshot()).toEqual(before);
    }
  );
  it('keeps every document unchanged when the atomic publication fails', async () => {
    const plan = await prepareSeasonPlayerOverrides(
      'season_players',
      prepared()
    );
    const before = snapshot();
    failMockBatchCommitAfter(0, new Error('commit rejected'));
    await expect(commit(plan)).rejects.toThrow('commit rejected');
    expect(snapshot()).toEqual(before);
  });
  it('does not claim confirmed publication when the saved player differs', async () => {
    const plan = await prepareSeasonPlayerOverrides(
      'season_players',
      prepared()
    );
    await commit(plan);
    seedMockData(path, player('p1'));
    await expect(confirmSeasonPlayerOverrides(plan)).rejects.toThrow(
      /reload verification diverged/
    );
  });
});
