import { expect, test, type Locator, type Page } from '@playwright/test';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { TWO_WAY_TRADE_MATCHING_EXPLANATION } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';

const CANDIDATE = process.env.SCOUTZERO_PROOF_CANDIDATE ?? '';
const ARTIFACT_DIR = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? '';
const MIA_URL = '/gm/MIA?room=trade';
const REVIEW_PROJECT_ID = 'demo-architect-review';
const REVIEW_FIRESTORE_HOST = '127.0.0.1:8082';

test.use({ viewport: { width: 1280, height: 720 } });

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const reviewDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_HOST;
  const app =
    admin.apps.find((candidate) => candidate?.name === 'trade-receipt-proof') ||
    admin.initializeApp(
      { projectId: REVIEW_PROJECT_ID },
      'trade-receipt-proof'
    );
  return app.firestore();
};

const worldCount = async () =>
  reviewDb()
    .collection('architect_worlds')
    .get()
    .then((snapshot) => snapshot.size);

const teamCard = (dialog: Locator, page: Page, teamName: string) =>
  dialog
    .locator('div')
    .filter({
      has: page.getByRole('button', {
        name: new RegExp(escapeRegExp(teamName), 'i'),
      }),
    })
    .filter({
      has: page.getByRole('button', { name: /(?:Plyr|Players) \(\d+\)/i }),
    })
    .first();

const routePlayer = async (
  dialog: Locator,
  page: Page,
  sourceTeam: string,
  playerName: string,
  destinationTeam: string
) => {
  const card = teamCard(dialog, page, sourceTeam);
  await expect(card).toBeVisible();
  const player = card
    .getByAltText(playerName, { exact: true })
    .or(card.getByText(playerName, { exact: true }));
  const menu = player.locator('xpath=following::button[1]');
  await expect(menu).toBeVisible();
  await menu.click();
  const route = page.getByRole('button', {
    name: new RegExp(`^Trade to ${escapeRegExp(destinationTeam)}$`, 'i'),
  });
  await expect(route).toBeVisible();
  await route.click();
};

test('exact-head Trade Machine produces a retained Two-Way Trade Receipt', async ({
  page,
}, testInfo) => {
  expect(CANDIDATE).toMatch(/^[0-9a-f]{40}$/);
  expect(ARTIFACT_DIR).not.toBe('');
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  await page.addInitScript(() => {
    window.localStorage.setItem('hz.dev.tradeMachineDebug', 'true');
  });

  expect(await worldCount()).toBe(0);
  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('button', { name: /Miami Heat/i })).toBeVisible(
    {
      timeout: 30_000,
    }
  );

  const teamPicker = dialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]');
  if ((await teamPicker.count()) === 0) {
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  }
  await dialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]')
    .first()
    .selectOption('nuggets');

  await routePlayer(
    dialog,
    page,
    'Miami Heat',
    'Tobias Lund',
    'Denver Nuggets'
  );
  await routePlayer(
    dialog,
    page,
    'Denver Nuggets',
    'Obi Nwachukwu',
    'Miami Heat'
  );

  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
    'Ready to apply',
    { timeout: 20_000 }
  );
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled();

  const developmentTools = dialog.getByRole('button', {
    name: /Development Tools/i,
  });
  await expect(developmentTools).toBeVisible();
  await developmentTools.click();

  const receipt = dialog.getByTestId('section-trade-receipt');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('Trade Receipt (Debug Mode)');
  await expect(receipt).toContainText('LEGAL');
  await receipt.getByRole('button', { name: 'Show Details' }).click();

  await expect(receipt.getByText('Tobias Lund', { exact: true })).toHaveCount(
    2
  );
  await expect(receipt.getByText('Obi Nwachukwu', { exact: true })).toHaveCount(
    2
  );
  await expect(
    receipt.getByText(TWO_WAY_TRADE_MATCHING_EXPLANATION, { exact: true })
  ).toHaveCount(4);
  await expect(receipt.getByText('2W', { exact: true })).toHaveCount(4);
  expect(await worldCount()).toBe(0);

  await receipt.scrollIntoViewIfNeeded();
  const screenshotPath = path.join(ARTIFACT_DIR, 'trade-receipt-1280x720.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const proof = {
    candidate: CANDIDATE,
    route: MIA_URL,
    viewport: page.viewportSize(),
    fixtures: {
      sourceTeam: 'MIA',
      sourcePlayer: 'mia_tobias_lund',
      destinationTeam: 'DEN',
      destinationPlayer: 'den_obi_nwachukwu',
    },
    assertions: {
      readiness: 'Ready to apply',
      receiptVerdict: 'LEGAL',
      twoWayExplanationCount: 4,
      durableWorldWrites: 0,
    },
  };
  const proofPath = path.join(ARTIFACT_DIR, 'proof.json');
  fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  await testInfo.attach('exact-candidate-proof', {
    body: Buffer.from(JSON.stringify(proof, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('trade-receipt-1280x720', {
    path: screenshotPath,
    contentType: 'image/png',
  });
});
