import { expect, it, vi } from 'vitest';
import { seedSyntheticDraftReviewWorld } from '../e2e/fixtures/syntheticDraftReviewWorld';

const writes = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock('../e2e/helpers/architectReviewWorld', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../e2e/helpers/architectReviewWorld')
    >();
  const ref = (path: string) => ({
    path,
    collection: (name: string) => ref(`${path}/${name}`),
    doc: (id: string) => ref(`${path}/${id}`),
    set: async (data: Record<string, unknown>) => {
      writes.set(path, data);
    },
  });
  return {
    ...actual,
    getReviewAdminDb: () => ({
      collection: (name: string) => ref(name),
      recursiveDelete: async () => {},
      batch: () => ({
        set: (r: { path: string }, data: Record<string, unknown>) =>
          writes.set(r.path, data),
        commit: async () => {},
      }),
    }),
  };
});
it('supplies complete independent salary books and 15+3 rosters without writing source paths', async () => {
  await seedSyntheticDraftReviewWorld('synthetic-owner', 'fixture-check');
  expect(
    [...writes.keys()].every((p) =>
      p.startsWith('architect_worlds/fixture-check')
    )
  ).toBe(true);
  for (const code of ['BOS', 'MIA']) {
    const team = writes.get(`architect_worlds/fixture-check/teams/${code}`)!;
    expect(team.players).toHaveLength(18);
    expect(team.totals).toMatchObject({
      teamSalary: 30000000,
      apronTeamSalary: 30000000,
      taxSalary: 30000000,
    });
    expect(team.salaryBookInputs).not.toHaveProperty('incompleteRosterCharge');
  }
});
