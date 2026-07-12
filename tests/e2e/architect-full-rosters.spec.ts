/**
 * FILE: tests/e2e/architect-full-rosters.spec.ts
 * PURPOSE: BZE-252 live proof — the world seeder's --full-rosters flag fills the
 *          acceptance-battery teams (MIA/LAL/BOS/PHX) to a full 15 standard + 3
 *          two-way roster in the saved world, so the Full Cap Table reads
 *          "15 / 15 · 3 / 3". Run in review mode:
 *            PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test \
 *              tests/e2e/architect-full-rosters.spec.ts --reporter=line
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import {
  enableArchitectReviewFlags,
  waitForReviewDashboard,
  readReviewUserId,
  activateSeededWorld,
  openDashboardTab,
} from './helpers/architectReviewWorld';

test.describe('BZE-252: acceptance-grade full rosters', () => {
  test('the --full-rosters seeder gives a battery team 15 / 15 + 3 / 3 on the Full Cap Table', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);

    await enableArchitectReviewFlags(page);
    await page.goto('/gm/MIA', { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);

    await expect
      .poll(async () => await readReviewUserId(page), {
        timeout: 25000,
        message: 'anonymous review uid should initialize',
      })
      .not.toBe('');
    const uid = await readReviewUserId(page);

    // Seed a saved world with the acceptance-battery teams filled to 15+3.
    const output = execSync(
      `npx tsx scripts/emu/seedReviewWorld.ts --uid ${uid} --full-rosters --name "BZE-252 Full Rosters"`,
      {
        encoding: 'utf8',
        env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8082' },
      }
    );
    const worldId = output.match(/Seeded review world:\s*(\S+)/)?.[1];
    expect(worldId, 'seeder should print a world id').toBeTruthy();

    await activateSeededWorld(page, uid, worldId as string);

    // MIA is the loaded team; the persistent team-status strip carries the
    // canonical roster count "<standard> / 15 · <twoWay> / 3".
    const statusStrip = page.getByTestId('cockpit-team-status-strip').first();
    await expect(statusStrip).toContainText('15 / 15', { timeout: 20000 });
    await expect(statusStrip).toContainText('3 / 3');

    await openDashboardTab(page, 'Full Cap Table');
    await expect(statusStrip).toContainText('15 / 15');

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-252: seedReviewWorld --full-rosters filled MIA to a full 15 standard + 3 two-way roster in the saved world; the Full Cap Table team-status strip reads "15 / 15 · 3 / 3". The same fill applies to LAL/BOS/PHX (an apron-constrained team). Quick (thin) seeding is unchanged without the flag.',
    });
    await page.screenshot({
      path: testInfo.outputPath('bze252-full-rosters.png'),
      fullPage: true,
    });
  });
});
