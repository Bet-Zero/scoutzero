/**
 * E2E browser probe for the hard-cap / second-apron Full Cap Table review
 * fixtures (BZE-91).
 *
 * BZE-85 deliberately did NOT fake a real hard-cap trigger or a second-apron
 * posture on the MIA fixture (those would have contradicted MIA's carried,
 * still-usable exceptions). BZE-91 adds two focused fixtures that exercise those
 * states honestly, and this spec proves they render in a real browser on the
 * Full Cap Table's shared cockpit posture band:
 *
 *   - /gm/PHX — a team that TRIGGERED a first-apron hard cap by using its
 *     Non-Taxpayer MLE (`hardCapTriggeredBy`). The posture band shows the
 *     hard-cap lock on the 1st Apron tile with the user-facing trigger reason.
 *   - /gm/MIN — a team whose real salary is OVER the second apron. The posture
 *     band shows the 2nd Apron tile in the over-the-line (red) state, with no
 *     hard-cap lock (it is a salary-derived band, not a triggered cap).
 *
 * Both are viewed under the fixtures' own 2026-27 season (`?season=2027`), the
 * same season convention BZE-89 used for /gm/MIA, because the apron posture is
 * derived from each team's 2026-27 salaries.
 *
 * It is review-mode scoped: it does not change fixture data, app auth, or any
 * Full Cap Table / cockpit component code.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/full-cap-table-hard-cap-apron.spec.ts
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

const PHX_URL = '/gm/PHX?season=2027';
const MIN_URL = '/gm/MIN?season=2027';

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

// Navigate to a review team dashboard for its own season and wait until the GM
// Dashboard leaves the loading state and the seeded team has rendered. Fail
// loudly on "No team data" — the whole point is that the fixture is present.
const gotoDashboard = async (page: Page, url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const fullCapTab = page.getByTestId('tab-full-cap-table');
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasTab = await isVisible(fullCapTab, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        return !stillLoading && (hasTab || hasNoTeamData);
      },
      {
        timeout: 60000,
        message:
          'GM Dashboard should leave the loading state and reach a terminal dashboard state',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    `Review fixture should be seeded for ${url}; "No team data" means architect:review:up did not seed it`
  ).toBe(false);

  if (await isVisible(fullCapTab, 2000)) {
    await fullCapTab.click();
  }
};

test.describe('FCT-HARDCAP: hard-cap / second-apron posture is browser-verifiable', () => {
  test.describe.configure({ mode: 'serial' });

  test('FCT-HARDCAP-001: PHX shows a triggered first-apron hard-cap lock with its reason', async ({
    page,
  }, testInfo) => {
    await gotoDashboard(page, PHX_URL);

    // Full Cap Table surface + shared posture band render.
    await expect(
      page.getByRole('region', { name: /Full Cap Table/i }).first()
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('cockpit-status-apron1').first()).toBeVisible();

    // The hard-cap lock badge sits on the 1st Apron tile (the team triggered a
    // first-apron hard cap via its Non-Taxpayer MLE). Its presence is the
    // user-visible "hard capped" state.
    const lock = page.getByTestId('cockpit-status-hard-cap-lock').first();
    await expect(lock).toBeVisible({ timeout: 20000 });

    // Hover reveals the heading + user-facing trigger reason tooltip.
    await lock.hover();
    await expect(
      page.getByText(/Hard Capped at 1st Apron/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Non-Taxpayer MLE/i).first()
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('FCT-HARDCAP-001-phx-first-apron.png'),
      fullPage: true,
    });
  });

  test('FCT-HARDCAP-002: MIN shows an over-the-second-apron posture (no triggered hard cap)', async ({
    page,
  }, testInfo) => {
    await gotoDashboard(page, MIN_URL);

    await expect(
      page.getByRole('region', { name: /Full Cap Table/i }).first()
    ).toBeVisible({ timeout: 20000 });

    // Both apron tiles render; MIN's real salary is above the second apron, so
    // the 2nd Apron Space value is shown in the over-the-line (red) treatment.
    const apron2Value = page
      .getByTestId('cockpit-status-apron2-value')
      .first();
    await expect(apron2Value).toBeVisible({ timeout: 20000 });
    await expect(apron2Value).toHaveClass(/text-red-400/);

    // The first apron is crossed too (a second-apron team is also over the first).
    await expect(
      page.getByTestId('cockpit-status-apron1-value').first()
    ).toHaveClass(/text-red-400/);

    // Being over the second apron is a salary-derived band, NOT a triggered hard
    // cap — so there is no hard-cap lock badge on this team.
    await expect(
      page.getByTestId('cockpit-status-hard-cap-lock')
    ).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath('FCT-HARDCAP-002-min-second-apron.png'),
      fullPage: true,
    });
  });
});
