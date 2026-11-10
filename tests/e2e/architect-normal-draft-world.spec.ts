/** Ordinary product flow on explicit governed software fixtures. No NBA certification. */
import { expect as baseExpect, test, type Page } from '@playwright/test';
import {
  readReviewUserId,
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  openDashboardTab,
} from './helpers/architectReviewWorld';
import { draftFinancialState } from '../../src/features/architect/utils/tradeContext/draftFinancialPreservation';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'on' });
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(300000);

async function selectFirst(page: Page, code: string, destination: string) {
  const card = page.getByTestId(`trade-team-card-${code}`);
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  const row = card.locator(
    `[data-entitlement-id="software:${code}:2028:first"]`
  );
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: `Trade to ${destination}`, exact: true })
    .click();
}

test('normal creation → Validate → Apply → receipt → both teams → reload', async ({
  page,
}) => {
  await page.goto('/gm/BOS?season=2026', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  // Actual ordinary createWorld API and trusted callable; no Admin-created
  // world, installed review manifest, injected authority or mocked SDK.
  const worldId = await page.evaluate(async (uid) => {
    const modulePath = '/src/features/architect/utils/worldManager.ts';
    const { createWorld } = await import(modulePath);
    const { worldId, metadata } = await createWorld({
      userId: uid,
      name: 'Reusable draft lifecycle',
      currentSeason: '2025-26',
    });
    if (metadata.draftBaseline?.classification !== 'software-fixture')
      throw new Error(
        'Start the local demo with SCOUTZERO_GOVERNED_DRAFT_FIXTURE=software-normal-world-original-firsts-v1.'
      );
    localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
    localStorage.setItem('hz.currentSeasonEndYear', '2026');
    return worldId;
  }, uid);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const sourceBefore = (
    await root.collection('draftBaselines').doc('root').get()
  ).data();
  expect(sourceBefore?.release.identities).toHaveLength(21);
  expect(
    (await root.collection('contractBaselines').get()).size
  ).toBeGreaterThan(30);
  const before = Object.fromEntries(
    await Promise.all(
      ['BOS', 'MIA'].map(async (code) => [
        code,
        await getWorldTeamDocument(worldId, code),
      ])
    )
  );
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('Software fixture', { timeout: 30000 });
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByTestId('trade-team-card-BOS')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption('heat');
  await expect(dialog.getByTestId('trade-team-card-MIA')).toBeVisible({
    timeout: 60000,
  });
  await selectFirst(page, 'BOS', 'Miami Heat');
  await selectFirst(page, 'MIA', 'Boston Celtics');
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 60000 });
  await dialog.getByTestId('trade-summary-button').click();
  await expect(
    page.getByTestId('trade-export-simulation-notice').last()
  ).toContainText('not verified NBA');
  await page.getByTitle('Close', { exact: true }).click();
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(1);
  await expect(dialog).toBeHidden({ timeout: 30000 });
  const event = (await getWorldEventDocuments(worldId))[0];
  expect(event.metadata.draftReviewReceipt.scope).toBe(
    'governed-world-fixture'
  );
  expect(event.metadata.draftReviewReceipt.movements).toHaveLength(2);
  expect((await root.get()).data()?.draftInventoryRevision).toBe(1);
  expect(
    (await root.collection('draftBaselines').doc('root').get()).data()
  ).toEqual(sourceBefore);
  for (const [code, other] of [
    ['BOS', 'MIA'],
    ['MIA', 'BOS'],
  ]) {
    const after = (await getWorldTeamDocument(worldId, code))!;
    expect(draftFinancialState(after)).toEqual(
      draftFinancialState(before[code]!)
    );
    expect(after.entitlementIds).toContain(`software:${other}:2028:first`);
    expect(after.entitlementIds).not.toContain(`software:${code}:2028:first`);
    await page.goto(`/gm/${code}?season=2026`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).toContainText('Software fixture');
    await page.getByTestId('cockpit-activity-rail-assets-open').click();
    await expect(
      page.getByTestId('cockpit-assets-panel-picks-2028-first')
    ).toContainText(`via ${other}`, { timeout: 30000 });
    await page.getByTestId('cockpit-assets-panel-close').click();
    await openDashboardTab(page, 'Team History');
    const history = page
      .getByTestId('team-history-section-timeline')
      .getByRole('button', { name: /Trade Executed:/ });
    await expect(history).toHaveCount(1, { timeout: 30000 });
    await history.click();
    const receipt = page.getByTestId('team-history-detail-modal');
    await expect(receipt).toContainText(
      'Software fixture — not authenticated NBA data.'
    );
    await expect(receipt).toContainText('Existing financial state preserved.');
    await expect(receipt).toContainText('2028');
    await receipt.getByRole('button', { name: /close/i }).click();
    await page.reload();
    await page.getByTestId('cockpit-activity-rail-assets-open').click();
    await expect(
      page.getByTestId('cockpit-assets-panel-picks-2028-first')
    ).toContainText(`via ${other}`, { timeout: 30000 });
    await page.getByTestId('cockpit-assets-panel-close').click();
  }
  await page.screenshot({
    path: 'tmp/browser-proofs/bze345-normal-world-reloaded.png',
  });
});
