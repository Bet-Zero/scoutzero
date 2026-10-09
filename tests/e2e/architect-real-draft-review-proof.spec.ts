import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readReviewUserId } from './helpers/architectReviewWorld';
import {
  REAL_DRAFT_WORLD,
  seedRealDraftReviewWorld,
  savedRealDraftState,
  type RealDraftBrowserCase,
} from './helpers/realDraftReviewWorld';
import { loadRealDraftReview } from '@/features/architect/utils/draftPickRealReview';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'on' });
test.setTimeout(200000);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ||
  '/tmp/scoutzero-real-draft-diagnostic';
const scenarioPath = process.env.SCOUTZERO_DRAFT_REVIEW_CASES;
const releasePath = process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE;

async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  const panel = page.getByTestId('real-draft-review');
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(proofDir, `${name}-1280x720.png`),
    fullPage: false,
  });
}
async function open(page: Page, team: string) {
  await page.goto(`/gm/${team}?season=2027`);
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByTestId(`trade-team-card-${team}`)).toBeVisible({
    timeout: 30000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('nuggets');
  await expect(dialog.getByTestId('trade-team-card-DEN')).toBeVisible();
  const card = dialog.getByTestId(`trade-team-card-${team}`);
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  return { dialog, card };
}
async function route(page: Page, card: Locator, year: number, cancel = false) {
  const label = card.getByText(`${year} - Round 1`, { exact: true });
  const row = label.locator(
    'xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'
  );
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', {
      name: cancel ? /^Cancel Trade$/ : /^Trade to Denver Nuggets$/,
    })
    .click();
}

test('real retained picks render scoped results without writes or stale review', async ({
  page,
}) => {
  test.skip(
    !scenarioPath || !releasePath,
    'Private retained package and scenario file are required; synthetic runs do not certify this path.'
  );
  const text = fs.readFileSync(releasePath!, 'utf8');
  await loadRealDraftReview(text); // The product's installed pin must accept the actual bytes.
  const cases: { asOfDate: string; cases: RealDraftBrowserCase[] } = JSON.parse(
    fs.readFileSync(scenarioPath!, 'utf8')
  );
  expect(cases.cases.map((c) => c.name).sort()).toEqual([
    'alias',
    'apron',
    'future',
    'supported',
    'wrong-holder',
  ]);
  await page.goto('/gm/MIA?season=2027');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2027');
    },
    { uid, worldId: REAL_DRAFT_WORLD }
  );
  const results = [];
  for (const scenario of cases.cases) {
    await seedRealDraftReviewWorld(uid, scenario, cases.asOfDate);
    const before = await savedRealDraftState();
    const { card } = await open(page, scenario.team);
    await route(page, card, scenario.entitlement.seasonYear);
    const panel = page.getByTestId('real-draft-review');
    for (const expected of scenario.expected)
      await expect(panel).toContainText(expected);
    await expect(panel).toContainText('Apply unavailable');
    await capture(page, scenario.name);
    expect(await savedRealDraftState()).toEqual(before);
    results.push({
      name: scenario.name,
      id: scenario.entitlement.id,
      expected: scenario.expected,
      noWrites: true,
    });
    if (scenario.name === 'supported') {
      const reload = await open(page, scenario.team);
      await expect(panel).toHaveCount(0);
      await route(page, reload.card, scenario.entitlement.seasonYear);
      await expect(panel).toContainText('Supported for this team');
      await capture(page, 'reload');
      await route(page, reload.card, scenario.entitlement.seasonYear, true);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/architect/draft-review', async (request) => {
        await held;
        await request.continue().catch(() => {});
      });
      await route(page, reload.card, scenario.entitlement.seasonYear);
      await expect(panel).toContainText('Reading retained pick evidence');
      await capture(page, 'loading');
      await route(page, reload.card, scenario.entitlement.seasonYear, true);
      release();
      await page.unrouteAll({ behavior: 'wait' });
      await expect(panel).toHaveCount(0);
      expect(await savedRealDraftState()).toEqual(before);
      await seedRealDraftReviewWorld(uid, scenario, '2026-07-01');
      const laterBefore = await savedRealDraftState();
      const later = await open(page, scenario.team);
      await route(page, later.card, scenario.entitlement.seasonYear);
      await expect(panel).toContainText('does not establish this world’s date');
      await expect(panel).not.toContainText('Supported for this team');
      await capture(page, 'date-mismatch');
      expect(await savedRealDraftState()).toEqual(laterBefore);
      await route(page, later.card, scenario.entitlement.seasonYear, true);
      await page.route('**/api/architect/draft-review', (request) =>
        request.fulfill({ status: 503 })
      );
      await route(page, later.card, scenario.entitlement.seasonYear);
      await expect(panel).toContainText('retained pick review is unavailable');
      await capture(page, 'unavailable');
      await page.unrouteAll();
    }
  }
  fs.writeFileSync(
    path.join(proofDir, 'proof.json'),
    JSON.stringify(
      {
        candidate:
          process.env.SCOUTZERO_PROOF_CANDIDATE || 'unfrozen-diagnostic',
        packageSha256: createHash('sha256').update(text).digest('hex'),
        viewport: { width: 1280, height: 720 },
        scope: 'Real retained evidence; emulator presentation world; read-only',
        results,
        reload: true,
        staleSelectionRemoved: true,
        effectiveDateMismatch: true,
        unavailable: true,
      },
      null,
      2
    )
  );
});
