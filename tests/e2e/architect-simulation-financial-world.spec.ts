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
  const teamDocs = await root.collection('teams').get();
  expect(teamDocs.size).toBe(30);
  // Every team carries release-built players and dated SIMULATION books.
  for (const team of teamDocs.docs) {
    const data = team.data();
    expect(data.players?.length, team.id).toBeGreaterThan(12);
    expect(data.salaryBookInputs?.simulationAssumptions?.teamCode).toBe(
      team.id
    );
  }
  // The SIMULATION draft baseline is optional alongside the money baseline.
  expect([undefined, 'simulation']).toContain(
    (await root.get()).data()?.draftBaseline?.classification
  );
  const snapshots = {} as Record<string, unknown>;
  // TOR's snapshot label says no hard cap; the retained March 6 report
  // raises it to the First Apron (A3).
  for (const [code, apron, hardCapLevel] of [
    ['CHI', 185036418, 'firstApron'],
    ['TOR', 193613510, 'firstApron'],
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
            hardCapped: team.hardCapped,
            roster: team.roster,
          };
        },
        { id, code }
      );
    snapshots[code] = await read();
    expect(snapshots[code]).toMatchObject({
      apron,
      // The Tax Salary ledger (added for SIMULATION player trades) is ready.
      tax: expect.any(Number),
      hardCapLevel,
      hardCapped: true,
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
    const sdk = await import(
      // The app's own, version-stamped dependency URL (re-optimization safe).
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => url.includes('/deps/firebase_firestore.js')) ??
        '/node_modules/.vite/deps/firebase_firestore.js'
    );
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

  // A6: copy the SIMULATION world. The copy carries the same books, hard caps
  // and draft source, and the parent is unchanged.
  const parentBefore = (await root.get()).data()!;
  if (parentBefore.draftBaseline) {
    // A copy read at a stale parent revision is refused before anything is written.
    const stale = await page.evaluate(
      async ({ id, uid }) => {
        const fns = await import(
          // The app's own, version-stamped dependency URL (re-optimization safe).
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .find((url) => url.includes('/deps/firebase_functions.js')) ??
            '/node_modules/.vite/deps/firebase_functions.js'
        );
        const config = await import('/src/firebaseConfig.ts');
        try {
          await fns.httpsCallable(
            config.functions,
            'initializeArchitectWorld'
          )({
            worldId: 'world_stale_copy',
            worldName: 'Stale',
            description: '',
            userId: uid,
            parentWorldId: id,
            expectedParentDraftRevision: 999,
          });
          return 'accepted';
        } catch (error) {
          return String((error as Error).message);
        }
      },
      { id, uid }
    );
    expect(stale).toContain('changed while it was being copied');
    expect(
      (await getReviewAdminDb().doc('architect_worlds/world_stale_copy').get())
        .exists
    ).toBe(false);
  }
  const copy = await page.evaluate(
    async ({ id, uid }) => {
      const manager = '/src/features/architect/utils/worldManager.ts';
      const { branchWorld } = await import(manager);
      const result = await branchWorld(id, 'Copy', '', uid);
      localStorage.setItem(`architect.activeWorldId.${uid}`, result.worldId);
      return {
        worldId: result.worldId,
        name: result.metadata.worldName,
      };
    },
    { id, uid }
  );
  expect(copy.name).toBe('SIMULATION — Copy');
  const child = getReviewAdminDb().doc(`architect_worlds/${copy.worldId}`);
  const childMeta = (await child.get()).data()!;
  expect(childMeta).toMatchObject({
    parentWorldId: id,
    isArchived: false,
    simulationFinancialBaseline: parentBefore.simulationFinancialBaseline,
  });
  expect((await child.collection('teams').get()).size).toBe(30);
  const parentAfter = (await root.get()).data()!;
  expect(parentAfter.childWorlds).toEqual([copy.worldId]);
  expect({ ...parentAfter, childWorlds: [], lastModifiedAt: null }).toEqual({
    ...parentBefore,
    childWorlds: [],
    lastModifiedAt: null,
  });
  for (const code of ['CHI', 'TOR'] as const) {
    await page.goto(`/gm/${code}?season=2026`);
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).toContainText('SIMULATION', { timeout: 30000 });
    const copied = await page.evaluate(
      async ({ id, code }) => {
        const { getTeam } = await import(
          '/src/features/architect/utils/teamLoader.ts'
        );
        const { createCanonicalTeamTotalsSnapshot } = await import(
          '/src/features/architect/utils/capTotals/computeTeamCapTotals.ts'
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
          hardCapped: team.hardCapped,
          roster: team.roster,
        };
      },
      { id: copy.worldId, code }
    );
    expect(copied).toEqual(snapshots[code]);
  }
  if (childMeta.draftBaseline) {
    expect(childMeta).toMatchObject({
      draftBaseline: parentBefore.draftBaseline,
      draftWorldTransfers: parentBefore.draftWorldTransfers,
      draftCopy: { parentWorldId: id, receiptWorldIds: {} },
    });
    expect(childMeta.draftInventoryRevision).toBeGreaterThan(0);
    const [childRoot, parentRoot] = await Promise.all([
      child.collection('draftBaselines').doc('root').get(),
      root.collection('draftBaselines').doc('root').get(),
    ]);
    expect(childRoot.data()).toEqual({
      worldId: copy.worldId,
      release: parentRoot.data()?.release,
    });
    // The copy passes the same custody, identity and terms checks.
    const loaded = await page.evaluate(async (worldId) => {
      const { loadGovernedDraftWorld } = await import(
        '/src/features/architect/utils/governedDraftWorld.load.ts'
      );
      const world = await loadGovernedDraftWorld(worldId);
      return world ? Object.keys(world.entitlements).length : null;
    }, copy.worldId);
    expect(loaded).toBe((await root.collection('entitlements').get()).size);
    // The copy's lineage is server-written only.
    const lineageDenied = await page.evaluate(async (worldId) => {
      const sdk = await import(
        // The app's own, version-stamped dependency URL (re-optimization safe).
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => url.includes('/deps/firebase_firestore.js')) ??
          '/node_modules/.vite/deps/firebase_firestore.js'
      );
      const config = await import('/src/firebaseConfig.ts');
      try {
        await sdk.updateDoc(sdk.doc(config.db, 'architect_worlds', worldId), {
          'draftCopy.receiptWorldIds.forged': worldId,
        });
        return false;
      } catch {
        return true;
      }
    }, copy.worldId);
    expect(lineageDenied).toBe(true);
  }
});
