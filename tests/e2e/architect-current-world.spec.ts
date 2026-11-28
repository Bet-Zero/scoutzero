import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { getReviewAdminDb, getWorldEventDocuments, openDashboardTab } from './helpers/architectReviewWorld';

test.skip(
  !process.env.ARCHITECT_FINANCIAL_PACKAGE || !process.env.ARCHITECT_DRAFT_PACKAGE,
  'Uses private pinned simulation packages in the local Firebase emulator.'
);

test.beforeAll(async () => {
  execFileSync(process.execPath, [
    '--import', 'tsx', 'scripts/emu/installCurrentWorldPackages.ts', '--install',
    'demo-architect-review', process.env.ARCHITECT_FINANCIAL_PACKAGE!,
    process.env.ARCHITECT_DRAFT_PACKAGE!,
  ], { env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082' } });
  const admin = await import('firebase-admin/auth');
  const { getApps } = await import('firebase-admin/app');
  getReviewAdminDb();
  const auth = admin.getAuth(getApps().find((app) => app.options.projectId === 'demo-architect-review'));
  for (const name of ['writer', 'reader']) {
    await auth.createUser({
      uid: `current-world-${name}`,
      email: `current-world-${name}@example.test`,
      password: 'local-test-password',
    });
  }
});

async function signIn(page: Page, name: 'writer' | 'reader') {
  await page.goto('/gm/CHI?season=2027');
  const uid = await page.evaluate(async (account) => {
    const { auth } = await import('/src/firebaseConfig.ts');
    const { getAnonymousUser } = await import('/src/shared/hooks/useAuth.ts');
    await getAnonymousUser();
    const { signInWithEmailAndPassword } = await import('/node_modules/.vite/deps/firebase_auth.js');
    return (await signInWithEmailAndPassword(auth, `current-world-${account}@example.test`, 'local-test-password')).user.uid;
  }, name);
  expect(uid).toBe(`current-world-${name}`);
}

test('normal accounts create, save a move, reload, manage and isolate a current world', async ({ browser, page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page, 'writer');
  const menu = page.getByTestId('cockpit-world-menu-trigger');
  page.setDefaultTimeout(20000);
  const openWorlds = async () => {
    const overlay = page.getByTestId('trade-overlay');
    if (await overlay.isVisible()) {
      await page.getByTestId('trade-overlay-close').click();
      await expect(overlay).toBeHidden();
    }
    if (!(await page.getByTitle('Create new world', { exact: true }).isVisible())) await menu.click();
  };
  await openWorlds();
  await page.getByTitle('Create new world', { exact: true }).click();
  await page.getByLabel('World Name', { exact: true }).fill('League simulation');
  page.once('dialog', (dialog) => dialog.accept());
  const creationResponse = page.waitForResponse((response) => response.url().endsWith('/api/architect/world'));
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const response = await creationResponse;
  expect(response.status()).toBe(200);
  const { worldId } = await response.json();
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  expect((await root.get()).data()).toMatchObject({
    createdBy: 'current-world-writer', currentSeason: '2026-27', asOfDate: '2026-11-14', worldLifecycleVersion: 1,
  });
  expect((await root.collection('teams').get()).size).toBe(30);
  await expect(menu).toContainText('League simulation', { timeout: 60_000 });

  const other = await browser.newPage();
  try {
    await signIn(other, 'reader');
    const authorization = await other.evaluate(async () => {
      const { auth } = await import('/src/firebaseConfig.ts');
      return `Bearer ${await auth.currentUser!.getIdToken()}`;
    });
    const paths = ['architect_worlds', 'architect_privateSimulationPackages', 'architect_worldInitializationClaims'];
    for (const path of paths) {
      const api = await other.request.get(
        `http://127.0.0.1:8082/v1/projects/demo-architect-review/databases/(default)/documents/${path}/${worldId}`,
        { headers: { Authorization: authorization }, timeout: 8000 }
      );
      expect(api.status()).toBe(403);
    }
    const denied = await other.request.post('/api/architect/world', {
      headers: { Authorization: authorization },
      data: { operation: 'delete', worldId, userId: 'current-world-reader' },
      timeout: 8000,
    });
    expect(denied.status()).toBe(403);
  } finally {
    await other.close();
  }

  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const trade = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(trade.getByTestId('trade-team-card-CHI')).toBeVisible({ timeout: 60_000 });
  const teamSelect = trade.locator('label', { hasText: /^Select Team$/ }).locator('xpath=following-sibling::select[1]');
  if (!(await teamSelect.count())) await trade.getByRole('button', { name: /^Add Team$/i }).click();
  await teamSelect.first().selectOption('raptors');
  for (const [code, id, to] of [
    ['CHI', 'ent:CHI:2028:1:own:2afbfb42', 'Toronto Raptors'],
    ['TOR', 'ent:TOR:2028:1:own:d917f516', 'Chicago Bulls'],
  ]) {
    const card = trade.getByTestId(`trade-team-card-${code}`);
    await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
    await card.locator(`[data-entitlement-id="${id}"]`).getByRole('button', { name: '•••' }).click();
    await page.getByRole('button', { name: new RegExp(`^Trade to ${to}$`, 'i') }).click();
  }
  await trade.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(trade.getByRole('button', { name: /^Apply Trade$/i })).toBeEnabled({ timeout: 60_000 });
  await trade.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect.poll(async () => (await getWorldEventDocuments(worldId)).length, { timeout: 60_000 }).toBe(1);
  await page.reload();
  await expect(menu).toContainText('League simulation', { timeout: 60_000 });
  if (!(await trade.isVisible())) await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const reloaded = trade.getByTestId('trade-team-card-CHI');
  await expect(reloaded).toBeVisible({ timeout: 60_000 });
  await reloaded.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  await expect(reloaded.locator('[data-entitlement-id="ent:TOR:2028:1:own:d917f516"]')).toBeVisible();
  await page.keyboard.press('Escape');
  if (await trade.isVisible()) await trade.getByRole('button', { name: /Close/i }).last().click();

  await openDashboardTab(page, 'Team History');
  await expect(page.getByTestId('team-history-section-timeline').getByRole('button', { name: /Trade Executed/ })).toBeVisible();
  await openWorlds();
  await page.getByTitle('World actions').click();
  await page.getByTitle('World actions').locator('..').screenshot({ path: testInfo.outputPath('world-actions-desktop.png') });
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('World Name', { exact: true }).fill('Renamed simulation');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await root.get()).data()?.worldName).toContain('Renamed simulation');

  await page.setViewportSize({ width: 390, height: 844 });
  await openWorlds();
  await page.getByTitle('World actions').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect.poll(async () => (await root.get()).data()?.isArchived).toBe(true);
  await page.reload();
  await openWorlds();
  await page.getByText('Archived and unfinished', { exact: true }).click();
  await expect(page.getByText('Renamed simulation', { exact: false }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).locator('..').screenshot({ path: testInfo.outputPath('archived-world-phone.png') });
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect.poll(async () => (await root.get()).data()?.isArchived).toBe(false);
  await expect(page.locator('#world-selector option', { hasText: 'Renamed simulation' })).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#world-selector').selectOption(worldId);
  await expect(menu).toContainText('Renamed simulation');
  await page.getByTitle('World actions').click();
  await page.getByRole('button', { name: 'Delete Permanently', exact: true }).click();
  await page.locator('#delete-confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete Permanently', exact: true }).click();
  await expect.poll(async () => (await root.get()).exists, { timeout: 90_000 }).toBe(false);
  expect(await root.listCollections()).toHaveLength(0);
});
