/** Actual PR #659 packages + owner HTTP route + existing Trade Machine and Firestore rules. */
import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
} from './helpers/architectReviewWorld';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';

test.skip(
  process.env.SCOUTZERO_WORLD_HTTP_PROOF !== 'true',
  'Requires private current packages and the owner-only HTTP emulator proof.'
);
test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30000 });
test.setTimeout(300000);
const owner = 'zero_billing_owner';
async function digest(worldId: string) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const rows: Array<[string, unknown]> = [
    [root.path, (await root.get()).data()],
  ];
  async function descend(ref: typeof root) {
    for (const c of await ref.listCollections())
      for (const doc of (await c.get()).docs) {
        rows.push([doc.ref.path, doc.data()]);
        await descend(doc.ref);
      }
  }
  await descend(root);
  return createHash('sha256')
    .update(
      canonicalStringify(
        JSON.parse(JSON.stringify(rows.sort(([a], [b]) => a.localeCompare(b))))
      )
    )
    .digest('hex');
}
async function signIn(page: Page) {
  await page.goto('/gm/CHI?season=2027');
  const uid = await page.evaluate(async () => {
    const { auth } = await import('/src/firebaseConfig.ts');
    const { getAnonymousUser } = await import('/src/shared/hooks/useAuth.ts');
    // Finish ordinary guest bootstrap before the explicit owner sign-in.
    await getAnonymousUser();
    const { signInWithEmailAndPassword } = await import(
      '/node_modules/.vite/deps/firebase_auth.js'
    );
    return (
      await signInWithEmailAndPassword(
        auth,
        'zero-billing-owner@example.test',
        'local-proof-only-password'
      )
    ).user.uid;
  });
  expect(uid).toBe(owner);
}

test('owner creates a current world, trades, saves and reloads while original worlds and immutable roots stay unchanged', async ({
  page,
}) => {
  const originals = ['zero-proof-historical', 'zero-proof-predecessor'];
  const before = await Promise.all(originals.map(digest));
  await signIn(page);
  await expect(page.getByTestId('cockpit-world-menu-trigger')).toBeVisible({
    timeout: 60000,
  });
  await page.getByTestId('cockpit-world-menu-trigger').click();
  await page.getByTitle('Create new world', { exact: true }).click();
  await page
    .getByLabel('World Name', { exact: true })
    .fill('Free owner-only current world');
  const sent: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/architect/world'))
      sent.push(request.postDataJSON());
  });
  page.once('dialog', (dialog) => dialog.accept());
  const creationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/architect/world') &&
      response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  expect((await creationResponse).status()).toBe(200);
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 60000 });
  expect(sent).toHaveLength(1);
  const worldId = await page.evaluate(
    (uid) => localStorage.getItem(`architect.activeWorldId.${uid}`)!,
    owner
  );
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const metadata = (await root.get()).data()!;
  expect(metadata).toMatchObject({
    createdBy: owner,
    currentSeason: '2026-27',
    asOfDate: '2026-11-14',
    simulationFinancialBaseline: {
      sha256:
        '577df3452b1c54cfcd80d14d96f7b1adb35dff2c967bf386c7171190eee05419',
    },
    draftBaseline: {
      sha256:
        '43d725448133c416b93af0d82529cb3f6c6021a01be07a6030b493987ffbf331',
    },
  });
  expect((await root.collection('teams').get()).size).toBe(30);
  expect((await root.collection('entitlements').get()).size).toBe(332);
  const replay = await page.evaluate(async (body) => {
    const { auth } = await import('/src/firebaseConfig.ts');
    const response = await fetch('/api/architect/world', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await auth.currentUser!.getIdToken()}`,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, sent[0]);
  expect(replay).toEqual({ status: 200, body: { ok: true, worldId } });
  const immutable = canonicalStringify(
    (await root.collection('draftBaselines').doc('root').get()).data()
  );
  await page.getByTestId('cockpit-world-menu-trigger').click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if (!(await picker.count()))
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption('raptors');
  for (const [code, id, to] of [
    ['CHI', 'ent:CHI:2028:1:own:2afbfb42', 'Toronto Raptors'],
    ['TOR', 'ent:TOR:2028:1:own:d917f516', 'Chicago Bulls'],
  ]) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await card
      .locator(`[data-entitlement-id="${id}"]`)
      .getByRole('button', { name: '•••' })
      .click();
    await page
      .getByRole('button', { name: new RegExp(`^Trade to ${to}$`, 'i') })
      .click();
  }
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 60000 });
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(1);
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 60000 });
  if (!(await dialog.isVisible()))
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const reloadedCard = dialog.getByTestId('trade-team-card-CHI');
  await expect(reloadedCard).toBeVisible({ timeout: 60000 });
  await reloadedCard
    .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
    .click();
  await expect(
    reloadedCard.locator('[data-entitlement-id="ent:TOR:2028:1:own:d917f516"]')
  ).toBeVisible();
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))!.entitlementIds
  ).toContain('ent:TOR:2028:1:own:d917f516');
  expect(
    (await getWorldTeamDocument(worldId, 'TOR'))!.entitlementIds
  ).toContain('ent:CHI:2028:1:own:2afbfb42');
  expect(
    (await getWorldEventDocuments(worldId))[0].metadata.draftReviewReceipt
      .movements
  ).toHaveLength(2);
  expect(
    canonicalStringify(
      (await root.collection('draftBaselines').doc('root').get()).data()
    )
  ).toBe(immutable);
  expect(await Promise.all(originals.map(digest))).toEqual(before);
  for (const path of [
    '/.scoutzero-dev/world-packages/financial-current-v4.json',
    '/@fs/workspace/scoutzero/.scoutzero-dev/world-packages/draft-connected-v5.json',
    '/work/zero-billing/private/current/current-season-v1/financial-current-v4.json',
  ]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(403);
  }
  await page.screenshot({ path: '.scoutzero-dev/free-world-proof.png' });
});
