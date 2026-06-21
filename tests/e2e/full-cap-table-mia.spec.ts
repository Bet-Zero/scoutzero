/**
 * E2E browser probe for the MIA Full Cap Table review fixture (BZE-85 / BZE-87).
 *
 * BZE-85 added the MIA review coverage fixture (`scripts/emu/review_seed/`) and a
 * deterministic data-level coverage probe
 * (`tests/architect/reviewSeedFullCapTable.coverage.test.ts`), but it could not
 * prove the fixture renders in the browser — its report flagged that a headed
 * walkthrough through `npm run architect:review:up` was not meaningful in that
 * environment.
 *
 * This spec closes that gap. It boots the review harness (emulators + seed +
 * dev server) via the Playwright `webServer` config — enabled with
 * `PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true` — signs in anonymously against the auth
 * emulator like every other review-mode test, and verifies the BZE-85 cap/table
 * states are actually visible at `/gm/MIA` (Full Cap Table is the default landing
 * room). It is review-mode scoped: it does not change fixture data, app auth, or
 * any Full Cap Table component code.
 *
 * The fixture loads through the base-team path (`loadTeamCapSheet` →
 * `hydrateBaseTeam`), which surfaces roster, cap holds, dead money, exceptions,
 * and apron posture without requiring a saved world — so the probe runs in the
 * sandbox/base state.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/full-cap-table-mia.spec.ts
 */

import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

const MIA_DASHBOARD_URL = '/gm/MIA';

// Roster ids in the fixture: 13 active rows + 1 own-FA cap hold (Grant Holloway,
// rendered as a separate decision row, not a roster row).
const MIA_ACTIVE_ROSTER_MIN = 13;

const MIA_ROSTER_NAMES = ['Marcus Vance', 'Theo Bennett', 'Andre Cole'];
const MIA_CAP_HOLD_NAME = 'Grant Holloway';
const MIA_DEAD_MONEY_NAME = 'Jordan Baxter';

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const captureEvidence = async (page: Page, testInfo: TestInfo, label: string) => {
  await page.screenshot({
    path: testInfo.outputPath(`${label}.png`),
    fullPage: true,
  });
};

// Navigate to /gm/MIA and wait until the dashboard leaves the loading state and
// the seeded MIA team has rendered. If the route reports "No team data" the
// review seed did not load MIA — fail loudly rather than silently pass, because
// the whole point of this probe is that the MIA fixture is present.
const gotoMiaDashboard = async (page: Page) => {
  await page.goto(MIA_DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

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
          'GM Dashboard should leave the loading state and reach a terminal MIA dashboard state',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'MIA review fixture should be seeded; "No team data" means architect:review:up did not seed architect_baseTeams/MIA'
  ).toBe(false);

  // Full Cap Table is the default landing room, but click the tab to be explicit
  // and resilient to any restored room state.
  if (await isVisible(fullCapTab, 2000)) {
    await fullCapTab.click();
  }
};

test.describe('FCT-MIA: Full Cap Table MIA review fixture is browser-verifiable', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await gotoMiaDashboard(page);
  });

  test('FCT-MIA-001: fuller roster, cap hold, dead money, exceptions, and apron posture render at /gm/MIA', async ({
    page,
  }, testInfo) => {
    // --- Full Cap Table surface renders ---
    const fullCapRegion = page
      .getByRole('region', { name: /Full Cap Table/i })
      .first();
    await expect(fullCapRegion).toBeVisible({ timeout: 20000 });

    // --- Fuller roster (13 active roster rows in the fixture) ---
    const rosterRows = page.getByTestId('cap-sheet-full-player-row-button');
    await expect
      .poll(async () => await rosterRows.count(), {
        timeout: 20000,
        message: `MIA fixture should render at least ${MIA_ACTIVE_ROSTER_MIN} active roster rows`,
      })
      .toBeGreaterThanOrEqual(MIA_ACTIVE_ROSTER_MIN);

    for (const name of MIA_ROSTER_NAMES) {
      await expect(
        page.getByText(name, { exact: true }).first()
      ).toBeVisible();
    }

    // --- Player Option (Theo Bennett 2028-29) + Team Option (Andre Cole 2027-28)
    // render as color-coded option cells in the future-season columns. They carry
    // a manage tooltip rather than literal "PO"/"TO" text, so anchor on the
    // title attribute. ---
    await expect(
      page.locator('[title="Click to manage Player Option"]').first()
    ).toBeVisible();
    await expect(
      page.locator('[title="Click to manage Team Option"]').first()
    ).toBeVisible();

    // --- Own free agent on the roster. In base/sandbox review mode the live
    // own-FA (Grant Holloway) renders as a roster row, not as the inline
    // renounce-able resign/absolve decision row — that inline row is home-base
    // own-FA enrichment that is not surfaced without the own-FA pipeline (see the
    // documented limitation in the BZE-87 report / README). Its non-active cap
    // hold is still verifiable via the Cap Holds drawer below. ---
    await expect(
      page.getByRole('button', {
        name: new RegExp(`More actions for ${MIA_CAP_HOLD_NAME}`, 'i'),
      })
    ).toBeVisible();

    // --- The detail panel only renders a toggle for a category when the fixture
    // actually carries that data, so the toggles themselves prove coverage:
    // dead money (stretched Jordan Baxter waiver), the legacy cap hold parked in
    // the holds drawer, and the carried exceptions (Taxpayer MLE + TPE). ---
    const deadMoneyToggle = page.getByTestId('cap-sheet-full-dead-money-toggle');
    await expect(deadMoneyToggle).toBeVisible();
    const capHoldsToggle = page.getByTestId('cap-sheet-full-cap-holds-toggle');
    await expect(capHoldsToggle).toBeVisible();
    const exceptionsToggle = page.getByTestId(
      'cap-sheet-full-exceptions-toggle'
    );
    await expect(exceptionsToggle).toBeVisible();

    // Expand dead money and confirm the multi-season stretched waiver row.
    await deadMoneyToggle.click();
    await expect(page.getByText(MIA_DEAD_MONEY_NAME).first()).toBeVisible();

    // Expand the cap-holds drawer and confirm the legacy/non-active hold.
    await capHoldsToggle.click();
    await expect(page.getByText(/Legacy Hold/i).first()).toBeVisible();

    // Expand exceptions and confirm the carried MLE readout.
    await exceptionsToggle.click();
    await expect(
      page.getByTestId('cap-sheet-full-exceptions-readout')
    ).toContainText(/MLE/i);

    // --- Apron posture: real salaries place MIA over the tax and into the first
    // apron band. The shared cap-posture strip exposes the apron tiles. ---
    await expect(
      page.getByTestId('cockpit-status-apron1').first()
    ).toBeVisible();

    await captureEvidence(page, testInfo, 'FCT-MIA-001-full-cap-table');
  });
});
