/** Run after the current journey, with the emulator's starting package rotated. */
import { test, expect } from '@playwright/test';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import {
  getReviewAdminDb,
  readReviewUserId,
} from './helpers/architectReviewWorld';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';

test.skip(
  process.env.SCOUTZERO_SIMULATION_FINANCIAL_PROOF !== 'true' ||
    process.env.SCOUTZERO_CURRENT_SEASON_PROOF !== 'true',
  'Requires both opt-ins, retained real current worlds and a different active starting package.'
);
test.setTimeout(180000);
test.use({ viewport: { width: 1280, height: 720 } });

test('copies a real current world after the active starting package changes', async ({
  page,
}) => {
  const db = getReviewAdminDb();
  const worlds = await db.collection('architect_worlds').get();
  const parent = worlds.docs
    .filter(
      (doc) =>
        doc.data().currentSeason === '2026-27' &&
        doc.data().simulationFinancialBaseline?.sha256 ===
          '577df3452b1c54cfcd80d14d96f7b1adb35dff2c967bf386c7171190eee05419'
    )
    .sort(
      (a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis()
    )[0];
  expect(
    parent,
    'Run the actual current-package journey before rotating packages.'
  ).toBeTruthy();
  const uid = parent.data().createdBy as string;
  // Reauthenticate the existing exported local account, as cloud:check --resume
  // does. A new anonymous browser must not fabricate a replacement parent.
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  const app = getApps().find(
    (app) => app.options.projectId === 'demo-architect-review'
  );
  if (!app) throw new Error('The local demo Admin app is unavailable.');
  const auth = getAuth(app);
  await auth.getUser(uid);
  const token = await auth.createCustomToken(uid);
  const entry = 'http://127.0.0.1:5173/src/main.tsx';
  await page.route(entry, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' })
  );
  await page.goto('/');
  await page.evaluate(
    async ({ token, uid }) => {
      const { resumeCloudSession } = await import(
        '/scripts/dev/cloudSession.browser.ts'
      );
      await resumeCloudSession(token, uid);
    },
    { token, uid }
  );
  await page.unroute(entry);
  await page.goto('/gm/CHI?season=2027');
  await expect.poll(() => readReviewUserId(page)).toBe(uid);
  const before = await parent.ref.collection('contractBaselines').get();
  const retained = canonicalStringify(before.docs.map((doc) => doc.data()));
  const result = await page.evaluate(
    async ({ uid, parentId }) => {
      const { createWorld, branchWorld } = await import(
        '/src/features/architect/utils/worldManager.ts'
      );
      const { loadGovernedDraftWorld } = await import(
        '/src/features/architect/utils/governedDraftWorld.load.ts'
      );
      const fresh = await createWorld({
        userId: uid,
        name: 'Rotated package witness',
      });
      const copy = await branchWorld(
        parentId,
        'Copy after package rotation',
        '',
        uid
      );
      const reloaded = await loadGovernedDraftWorld(copy.worldId);
      return {
        freshId: fresh.worldId,
        copyId: copy.worldId,
        transfers: reloaded?.transfers.length,
      };
    },
    { uid, parentId: parent.id }
  );
  const fresh = (
    await db.doc(`architect_worlds/${result.freshId}`).get()
  ).data()!;
  const copied = (
    await db.doc(`architect_worlds/${result.copyId}`).get()
  ).data()!;
  expect(fresh.currentSeason).toBe('2025-26');
  expect(fresh.contractSourceRelease).not.toEqual(
    parent.data().contractSourceRelease
  );
  expect(copied.currentSeason).toBe('2026-27');
  expect(copied.contractSourceRelease).toEqual(
    parent.data().contractSourceRelease
  );
  expect(copied.contractBaselineCoverage).toEqual(
    parent.data().contractBaselineCoverage
  );
  expect(result.transfers).toBe(parent.data().draftWorldTransfers.length);
  const copiedTeams = await db
    .doc(`architect_worlds/${result.copyId}`)
    .collection('teams')
    .get();
  expect(copiedTeams.size).toBe(30);
  const parentTeams = await parent.ref.collection('teams').get();
  for (const team of parentTeams.docs) {
    const expected = team.data();
    if (expected.source)
      expected.source = { ...expected.source, worldId: result.copyId };
    expect(copiedTeams.docs.find((d) => d.id === team.id)?.data()).toEqual(
      expected
    );
  }
  const after = await parent.ref.collection('contractBaselines').get();
  expect(canonicalStringify(after.docs.map((doc) => doc.data()))).toBe(
    retained
  );
});
