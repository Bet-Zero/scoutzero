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

  test('FCT-MIA-002: row name and option cells launch the contract modal without committing changes', async ({
    page,
  }, testInfo) => {
    const marcusRowButton = page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: 'Marcus Vance' })
      .first();
    await expect(marcusRowButton).toBeVisible({ timeout: 20000 });

    await marcusRowButton.click();
    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
      /Marcus Vance/i
    );
    await expect(modal.getByText(/Choose contract action/i)).toBeVisible();
    await modal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(modal).toHaveCount(0);

    const playerOptionCell = page
      .locator('[title="Click to manage Player Option"]')
      .first();
    await expect(playerOptionCell).toBeVisible();
    await playerOptionCell.click();
    await expect(modal).toBeVisible({ timeout: 20000 });
    const actionContext = modal.getByTestId('contract-modal-action-context');
    await expect(actionContext).toContainText(/2028-29/i);
    await expect(modal.getByText(/Accept Option/i)).toBeVisible();
    await expect(modal.getByText(/Decline Option/i)).toBeVisible();
    await expect(modal.getByText(/Sign New Contract/i)).toBeVisible();
    await expect(
      modal.getByTestId('edit-contract-confirm-action-button')
    ).toBeDisabled();
    await modal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(modal).toHaveCount(0);

    await captureEvidence(page, testInfo, 'FCT-MIA-002-contract-launches');
  });

  test('FCT-MIA-003: row overflow menu exposes FCT actions and launches Extend safely', async ({
    page,
  }, testInfo) => {
    const playerRowButton = page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: 'Marcus Vance' })
      .first();
    await expect(playerRowButton).toBeVisible({ timeout: 20000 });
    await playerRowButton.hover();

    const moreActions = page.getByRole('button', {
      name: /More actions for Marcus Vance/i,
    });
    await expect(moreActions).toBeVisible();
    await moreActions.click();

    const overflowMenu = page.getByTestId(
      'cap-sheet-full-player-row-overflow-menu'
    );
    await expect(overflowMenu).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Pin$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Trade$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^View on Roster$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^View on Cap Sheet$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Find in History$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Compare impact$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Guide next move$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByTestId('cap-sheet-full-player-row-action-extend')
    ).toBeVisible();
    await expect(
      overflowMenu.getByTestId('cap-sheet-full-player-row-action-waive')
    ).toBeVisible();
    await expect(
      overflowMenu.getByTestId('cap-sheet-full-player-row-action-stretch')
    ).toBeVisible();

    await overflowMenu
      .getByTestId('cap-sheet-full-player-row-action-extend')
      .click();

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
      /Extend Contract/i
    );
    await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
      /Marcus Vance/i
    );
    await expect(playerRowButton).toBeVisible();
    await modal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(modal).toHaveCount(0);

    await captureEvidence(page, testInfo, 'FCT-MIA-003-row-overflow-extend');
  });

  test('FCT-MIA-004: FCT toolbar modals open with seeded data and close without saving', async ({
    page,
  }, testInfo) => {
    const fullCapRegion = page
      .getByRole('region', { name: /Full Cap Table/i })
      .first();
    await expect(fullCapRegion).toBeVisible({ timeout: 20000 });

    await page.getByTestId('cap-sheet-full-manage-dead-money-button').click();
    const deadMoneyModal = page.getByTestId('manage-dead-money-modal');
    await expect(deadMoneyModal).toBeVisible({ timeout: 20000 });
    await expect(deadMoneyModal).toContainText(/Manage Dead Money/i);
    await expect(deadMoneyModal.locator('input').first()).toHaveValue(
      MIA_DEAD_MONEY_NAME
    );
    await expect(
      deadMoneyModal.getByRole('button', { name: /Save Changes/i })
    ).toBeVisible();
    await deadMoneyModal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(deadMoneyModal).toHaveCount(0);
    await expect(fullCapRegion).toBeVisible();

    await page.getByTestId('cap-sheet-full-manage-exceptions-button').click();
    const exceptionsModal = page.getByTestId('manage-exceptions-modal');
    await expect(exceptionsModal).toBeVisible({ timeout: 20000 });
    await expect(exceptionsModal).toContainText(/Manage Exceptions/i);
    await expect(exceptionsModal).toContainText(/Taxpayer MLE/i);
    await expect(
      exceptionsModal.getByRole('button', { name: /Save Changes/i })
    ).toBeVisible();
    await exceptionsModal.getByRole('button', { name: /^Close$/i }).click();
    await expect(exceptionsModal).toHaveCount(0);
    await expect(fullCapRegion).toBeVisible();

    await captureEvidence(page, testInfo, 'FCT-MIA-004-toolbar-modals');
  });

  test('FCT-MIA-005: Sign Free Agent modal searches and closes without launching a signing', async ({
    page,
  }, testInfo) => {
    const fullCapRegion = page
      .getByRole('region', { name: /Full Cap Table/i })
      .first();
    await expect(fullCapRegion).toBeVisible({ timeout: 20000 });

    await page.getByTestId('cap-sheet-full-sign-free-agent-button').click();
    const modal = page.getByTestId('full-cap-free-agent-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(modal).toContainText(/Sign Free Agent/i);
    await expect(modal).toContainText(/MIA/i);
    await expect(modal).toContainText(/Generated \/ Current Pool/i);

    const loading = modal.getByTestId('full-cap-free-agent-modal-loading');
    await expect
      .poll(
        async () => !(await loading.isVisible().catch(() => false)),
        {
          timeout: 20000,
          message: 'Free-agent modal should leave its loading state',
        }
      )
      .toBe(true);

    const pool = modal.getByTestId('full-cap-free-agent-modal-pool');
    const empty = modal.getByTestId('full-cap-free-agent-modal-empty');
    await expect
      .poll(
        async () =>
          (await pool.isVisible().catch(() => false)) ||
          (await empty.isVisible().catch(() => false)),
        {
          timeout: 20000,
          message: 'Free-agent modal should show either a pool or an empty state',
        }
      )
      .toBe(true);

    if (await pool.isVisible().catch(() => false)) {
      const search = modal.getByPlaceholder('Search pool');
      await expect(search).toBeVisible();
      await search.fill('definitely-no-such-fct-player');
      await expect(modal.getByText(/No matches/i)).toBeVisible();
      await search.fill('');
      const firstEntry = pool.getByRole('button').first();
      const firstEntryName = (
        await firstEntry.locator('p').first().innerText()
      ).trim();
      await firstEntry.click();
      const signingActions = modal.getByLabel('Free-agent signing actions');
      await expect(signingActions.getByText(/^Selected$/i)).toBeVisible();
      await expect(
        signingActions.getByText(firstEntryName, { exact: true })
      ).toBeVisible();
      await expect(
        modal.getByRole('button', { name: /^Start Signing$/i })
      ).toBeEnabled();
    } else {
      await expect(modal).toContainText(/No free agents in this pool/i);
      await expect(
        modal.getByRole('button', { name: /^Start Signing$/i })
      ).toBeDisabled();
    }

    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(fullCapRegion).toBeVisible();

    await captureEvidence(page, testInfo, 'FCT-MIA-005-sign-fa-modal');
  });

  test('FCT-MIA-006: bottom detail popover opens one panel at a time and retoggles closed', async ({
    page,
  }, testInfo) => {
    const legendToggle = page.getByTestId('cap-sheet-full-legend-toggle');
    await expect(legendToggle).toHaveAttribute('aria-expanded', 'false');
    await legendToggle.click();
    await expect(legendToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('cap-sheet-full-legend')).toBeVisible();
    await legendToggle.click();
    await expect(legendToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('cap-sheet-full-legend')).toHaveCount(0);

    const deadMoneyToggle = page.getByTestId('cap-sheet-full-dead-money-toggle');
    const capHoldsToggle = page.getByTestId('cap-sheet-full-cap-holds-toggle');
    const exceptionsToggle = page.getByTestId(
      'cap-sheet-full-exceptions-toggle'
    );

    await deadMoneyToggle.click();
    await expect(deadMoneyToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(MIA_DEAD_MONEY_NAME).first()).toBeVisible();

    await capHoldsToggle.click();
    await expect(deadMoneyToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(capHoldsToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/Legacy Hold/i).first()).toBeVisible();

    await exceptionsToggle.click();
    await expect(capHoldsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(exceptionsToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByTestId('cap-sheet-full-exceptions-readout')
    ).toContainText(/MLE/i);

    await exceptionsToggle.click();
    await expect(exceptionsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(
      page.getByTestId('cap-sheet-full-exceptions-readout')
    ).toHaveCount(0);

    await captureEvidence(page, testInfo, 'FCT-MIA-006-detail-popover');
  });
});
