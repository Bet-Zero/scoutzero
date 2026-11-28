import { expect, test } from '@playwright/test';
import {
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  readReviewUserId,
} from './helpers/architectReviewWorld';

test.skip(
  process.env.SCOUTZERO_CURRENT_SEASON_PROOF !== 'true',
  'Uses the private current-season starting packages in local review mode.'
);

test.use({ viewport: { width: 1280, height: 720 } });

test('BZE-354 guards the saved world date and reloads an allowed advance', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/gm/CHI?season=2027');
  await expect.poll(() => readReviewUserId(page), { timeout: 30_000 }).not.toBe('');
  const uid = await readReviewUserId(page);
  const worldMenu = page.getByTestId('cockpit-world-menu-trigger');
  await worldMenu.click();
  await page.getByTitle('Create new world', { exact: true }).click();
  await page.getByLabel('World Name', { exact: true }).fill('Saved date boundary');
  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByTestId('cockpit-activity-rail-identity')).toContainText(
    'SIMULATION', { timeout: 60_000 }
  );
  const worldId = await page.evaluate(
    (uid) => localStorage.getItem(`architect.activeWorldId.${uid}`)!, uid
  );
  const savedWorld = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const before = (await savedWorld.get()).data();
  const teamBefore = await getWorldTeamDocument(worldId, 'CHI');
  const eventsBefore = await getWorldEventDocuments(worldId);
  expect(before?.currentSeason).toBe('2026-27');
  expect(before?.asOfDate).toBe('2026-11-14');

  const date = page.getByTestId('world-date-input');
  const alert = page.getByTestId('world-time-controls').getByRole('alert');
  if (!(await date.isVisible())) await worldMenu.click();
  await date.fill('2026-11-13');
  await expect(alert).toContainText('cannot move backward');
  await expect(date).toHaveValue('2026-11-14');
  expect((await savedWorld.get()).data()).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('date-boundary-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await date.fill('2027-07-01');
  await expect(alert).toContainText('requires a season transition');
  await expect(date).toHaveValue('2026-11-14');
  expect((await savedWorld.get()).data()).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('date-boundary-phone.png') });

  await page.getByTestId('advance-day-button').click();
  await expect(date).toHaveValue('2026-11-15');
  await page.reload();
  await expect(page.getByTestId('cockpit-activity-rail-identity')).toContainText('SIMULATION');
  if (!(await date.isVisible())) await worldMenu.click();
  await expect(date).toHaveValue('2026-11-15');
  expect((await savedWorld.get()).data()).toMatchObject({
    asOfDate: '2026-11-15', currentSeason: '2026-27',
  });
  expect(await getWorldTeamDocument(worldId, 'CHI')).toEqual(teamBefore);
  expect(await getWorldEventDocuments(worldId)).toEqual(eventsBefore);
});
