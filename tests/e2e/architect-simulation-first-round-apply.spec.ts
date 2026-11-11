/**
 * V1 item D1: first-round Apply in a SIMULATION world (local emulator only).
 * Requires cloud:dev with privately prepared SIMULATION financial and draft
 * packages. Uses the ordinary Create World, Trade Machine and Apply flow.
 */
import { expect as baseExpect, test, type Page } from '@playwright/test';
import {
  readReviewUserId,
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
} from './helpers/architectReviewWorld';
import { draftFinancialState } from '../../src/features/architect/utils/tradeContext/draftFinancialPreservation';

test.skip(
  process.env.SCOUTZERO_SIMULATION_FINANCIAL_PROOF !== 'true',
  'Opt in with SCOUTZERO_SIMULATION_FINANCIAL_PROOF=true and privately prepared local simulation packages.'
);
test.use({ viewport: { width: 1280, height: 720 } });
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(300000);

const PICKS = {
  CHI: 'ent:CHI:2028:1:own:2afbfb42',
  TOR: 'ent:TOR:2028:1:own:d917f516',
} as const;

async function selectFirst(page: Page, code: 'CHI' | 'TOR', to: string) {
  const card = page.getByTestId(`trade-team-card-${code}`);
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  const row = card.locator(`[data-entitlement-id="${PICKS[code]}"]`);
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: new RegExp(`^Trade to ${to}$`, 'i') })
    .click();
}

test('SIMULATION world: first-round pick swap validates, applies and reloads', async ({
  page,
}) => {
  await page.goto('/gm/CHI?season=2026', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const worldId = await page.evaluate(async (uid) => {
    const { createWorld } = await import(
      '/src/features/architect/utils/worldManager.ts'
    );
    const { worldId, metadata } = await createWorld({
      userId: uid,
      name: 'First-round trades',
      currentSeason: '2025-26',
    });
    if (metadata.draftBaseline?.classification !== 'simulation')
      throw new Error('Local SIMULATION draft baseline not configured.');
    localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
    localStorage.setItem('hz.currentSeasonEndYear', '2026');
    return worldId;
  }, uid);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const sourceBefore = (
    await root.collection('draftBaselines').doc('root').get()
  ).data();
  const before = {
    CHI: (await getWorldTeamDocument(worldId, 'CHI'))!,
    TOR: (await getWorldTeamDocument(worldId, 'TOR'))!,
  };
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption('raptors');
  await expect(dialog.getByTestId('trade-team-card-TOR')).toBeVisible({
    timeout: 60000,
  });
  await selectFirst(page, 'CHI', 'Toronto Raptors');
  await selectFirst(page, 'TOR', 'Chicago Bulls');
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
  await expect(dialog).toBeHidden({ timeout: 30000 });
  const event = (await getWorldEventDocuments(worldId))[0];
  expect(event.metadata.draftReviewReceipt.scope).toBe(
    'governed-world-fixture'
  );
  expect(event.metadata.draftReviewReceipt.movements).toHaveLength(2);
  const metadata = (await root.get()).data()!;
  expect(metadata.draftInventoryRevision).toBe(1);
  expect(metadata.draftWorldTransfers).toHaveLength(1);
  expect(
    (await root.collection('draftBaselines').doc('root').get()).data()
  ).toEqual(sourceBefore);
  for (const [code, other] of [
    ['CHI', 'TOR'],
    ['TOR', 'CHI'],
  ] as const) {
    const after = (await getWorldTeamDocument(worldId, code))!;
    // A pick-only trade leaves every financial field as it was.
    expect(draftFinancialState(after)).toEqual(
      draftFinancialState(before[code])
    );
    expect(after.entitlementIds).toContain(PICKS[other]);
    expect(after.entitlementIds).not.toContain(PICKS[code]);
    expect(
      (await root.collection('entitlements').doc(PICKS[other]).get()).data()
        ?.holderTeam
    ).toBe(code);
  }
  // The traded world still loads, then copies with its receipt bound to it.
  const copied = await page.evaluate(
    async ({ worldId, uid }) => {
      const { loadGovernedDraftWorld } = await import(
        '/src/features/architect/utils/governedDraftWorld.load.ts'
      );
      const { branchWorld } = await import(
        '/src/features/architect/utils/worldManager.ts'
      );
      const loaded = await loadGovernedDraftWorld(worldId);
      const copy = await branchWorld(worldId, 'After trade', '', uid);
      const loadedCopy = await loadGovernedDraftWorld(copy.worldId);
      return {
        transfers: loaded?.transfers.length,
        copyTransfers: loadedCopy?.transfers.length,
        copyId: copy.worldId,
      };
    },
    { worldId, uid }
  );
  expect(copied).toMatchObject({ transfers: 1, copyTransfers: 1 });
  const copyMeta = (
    await getReviewAdminDb().doc(`architect_worlds/${copied.copyId}`).get()
  ).data()!;
  expect(Object.values(copyMeta.draftCopy.receiptWorldIds)).toEqual([worldId]);
});
