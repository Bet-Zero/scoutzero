/** Requires cloud:dev with a privately prepared SIMULATION financial package. */
import { expect, test } from '@playwright/test';
import {
  readReviewUserId,
  getReviewAdminDb,
} from './helpers/architectReviewWorld';

test.skip(
  process.env.SCOUTZERO_SIMULATION_FINANCIAL_PROOF !== 'true',
  'Opt in with SCOUTZERO_SIMULATION_FINANCIAL_PROOF=true and a privately prepared local simulation package.'
);

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(180000);
test('ordinary real-data simulation creation, books and reload retain assumptions and gates', async ({
  page,
}) => {
  await page.goto('/gm/CHI?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const id = await page.evaluate(async (uid) => {
    const path = '/src/features/architect/utils/worldManager.ts';
    const { createWorld } = await import(path);
    const result = await createWorld({
      userId: uid,
      name: 'Public-data starting world',
      currentSeason: '2025-26',
    });
    if (
      result.metadata.simulationFinancialBaseline?.classification !==
      'SIMULATION'
    )
      throw new Error('Local SIMULATION baseline not configured.');
    localStorage.setItem(`architect.activeWorldId.${uid}`, result.worldId);
    localStorage.setItem('hz.currentSeasonEndYear', '2026');
    return result.worldId;
  }, uid);
  const root = getReviewAdminDb().doc(`architect_worlds/${id}`);
  expect((await root.collection('teams').get()).size).toBe(30);
  expect((await root.get()).data()?.draftBaseline).toBeUndefined();
  const snapshots = {} as Record<string, unknown>;
  for (const [code, apron] of [
    ['CHI', 185036418],
    ['TOR', 193613510],
  ] as const) {
    await page.goto(`/gm/${code}?season=2026`);
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).toContainText('SIMULATION', { timeout: 30000 });
    const read = async () =>
      page.evaluate(
        async ({ id, code }) => {
          const loader = '/src/features/architect/utils/teamLoader.ts';
          const totalsPath =
            '/src/features/architect/utils/capTotals/computeTeamCapTotals.ts';
          const { getTeam } = await import(loader);
          const { createCanonicalTeamTotalsSnapshot } = await import(
            totalsPath
          );
          const team = await getTeam(id, code);
          const totals = createCanonicalTeamTotalsSnapshot(team, 2026, {
            asOfDate: '2026-06-05',
          });
          return {
            inputs: team.salaryBookInputs,
            apron: totals.apronTeamSalary,
            tax: totals.taxSalary,
            hardCapLevel: team.hardCapLevel,
            roster: team.roster,
          };
        },
        { id, code }
      );
    snapshots[code] = await read();
    expect(snapshots[code]).toMatchObject({
      apron,
      tax: null,
      hardCapLevel: 'firstApron',
      inputs: { simulationAssumptions: { classification: 'SIMULATION' } },
    });
    await page.reload();
    expect(await read()).toEqual(snapshots[code]);
  }
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });
  await page.screenshot({ path: '/tmp/bze345-simulation-world.png' });
  // Ordinary SDK cannot erase the distinction from metadata.
  const denied = await page.evaluate(async (id) => {
    const sdk = await import('/node_modules/.vite/deps/firebase_firestore.js');
    const config = await import('/src/firebaseConfig.ts');
    try {
      await sdk.updateDoc(sdk.doc(config.db, 'architect_worlds', id), {
        simulationFinancialBaseline: sdk.deleteField(),
      });
      return false;
    } catch {
      return true;
    }
  }, id);
  expect(denied).toBe(true);
  expect((await root.collection('events').get()).size).toBe(0);
});
