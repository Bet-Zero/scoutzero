/**
 * E2E browser probe for the Full Cap Table inline own-FA decision row (BZE-89).
 *
 * BZE-85 added the MIA review coverage fixture and BZE-87 proved its roster /
 * options / dead money / cap-holds drawer / exceptions / apron states render in
 * a real browser at `/gm/MIA`. BZE-87's report flagged ONE remaining gap: the
 * inline renounce-able own-FA decision row (`cap-sheet-full-fa-decision-row`)
 * was not exercised, and it was assumed to need the world/home-base own-FA
 * pipeline.
 *
 * That assumption was wrong. The inline own-FA decision row is fully supported
 * in base/sandbox review mode — it just renders under the fixture's own season
 * (2026-27, `?season=2027`), not the app's default landing season (2025-26 as of
 * mid-2026). Under 2026-27 the own free agent's contract has expired (his last
 * salary slice is end-year 2026), so he drops off the roster rows and his UFA
 * cap hold resolves to `placement: 'main'` and renders as the inline
 * resign/absolve row. No saved world, no production change.
 *
 * Route/team/season/world setup:
 *   - Route:  /gm/MIA?season=2027   (Full Cap Table is the default room)
 *   - Team:   MIA (BZE-85 review fixture)
 *   - Season: 2026-27 (end-year 2027)
 *   - World:  none — base/sandbox hydration (loadTeamCapSheet -> hydrateBaseTeam)
 *
 * Own free agent under test: Grant Holloway (Bird/UFA, freeAgency.year 2026,
 * $15M cap hold).
 *
 * Absolve/re-sign are safe to exercise here: in base/sandbox mode the mutation
 * is applied `local-only` (in-memory) and is never persisted, so each test that
 * reloads /gm/MIA?season=2027 starts from the seed again — no state leaks.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/full-cap-table-own-fa.spec.ts
 */

import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

// 2026-27 is the fixture's own season; `?season=` is honored ahead of any saved
// season, so this deterministically lands on the season where the own FA's
// contract has expired and his hold becomes the inline decision row.
const MIA_OWN_FA_URL = '/gm/MIA?season=2027';

const OWN_FA_NAME = 'Grant Holloway';

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const captureEvidence = async (page: Page, testInfo: TestInfo, label: string) => {
  await page.screenshot({
    path: testInfo.outputPath(`${label}.png`),
    fullPage: true,
  });
};

const parseMoneyMillions = (label: string) => {
  const match = label.replace(/,/g, '').match(/(-?\$?[\d.]+)\s*([KMB])?/i);
  if (!match) return Number.NaN;
  const value = Number(match[1].replace('$', ''));
  const suffix = (match[2] || 'M').toUpperCase();
  if (suffix === 'B') return value * 1000;
  if (suffix === 'K') return value / 1000;
  return value;
};

const readCockpitTotalCapMillions = async (page: Page) =>
  parseMoneyMillions(
    (await page.getByTestId('cockpit-status-total-cap-value').textContent()) ||
      ''
  );

// Wait until the dashboard leaves the loading state and the seeded MIA team has
// rendered. Fail loudly on "No team data" because the fixture must be present.
const waitForMiaOwnFaDashboard = async (page: Page) => {
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

  if (await isVisible(fullCapTab, 2000)) {
    await fullCapTab.click();
  }
};

// Navigate to /gm/MIA?season=2027 and wait for the fixture dashboard.
const gotoMiaOwnFaSeason = async (page: Page) => {
  await page.goto(MIA_OWN_FA_URL, { waitUntil: 'domcontentloaded' });
  await waitForMiaOwnFaDashboard(page);
};

// The own-FA decision row that carries Grant Holloway. There is exactly one
// `main`-placement own FA in the fixture, but scope to the row that contains his
// name so the probe stays meaningful if the fixture grows.
const ownFaDecisionRow = (page: Page): Locator =>
  page
    .getByTestId('cap-sheet-full-fa-decision-row')
    .filter({ hasText: OWN_FA_NAME });

const signedOwnFaPlayerRow = (page: Page): Locator =>
  page.locator('[data-cap-fit-row]').filter({
    has: page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: OWN_FA_NAME }),
  });

const assertRosterParityAfterAbsolve = async (page: Page) => {
  await page.getByTestId('tab-roster').click();
  const rosterWorkbench = page
    .getByTestId('cockpit-workbench')
    .and(page.locator('[data-active-tab="roster"]'));

  await expect(rosterWorkbench).toBeVisible();
  const truthPanel = rosterWorkbench.getByTestId('architect-roster-truth-panel');
  await expect(truthPanel).toHaveAttribute('data-roster-active-year', '2027');
  await expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '13');
  await expect(truthPanel).toHaveAttribute('data-roster-standard-count', '12');
  await expect(truthPanel).toHaveAttribute('data-roster-two-way-count', '1');
  await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
    '13 / 15'
  );
  await expect(page.getByTestId('cockpit-team-posture-summary')).toContainText(
    '13 / 15 roster spots shown'
  );

  await expect(rosterWorkbench.getByAltText(OWN_FA_NAME)).toHaveCount(0);
  await expect(
    rosterWorkbench.getByRole('button', {
      name: new RegExp(`More actions for ${OWN_FA_NAME}`, 'i'),
    })
  ).toHaveCount(0);
  await expect(rosterWorkbench.getByAltText('Marcus Vance')).toHaveCount(1);
  await expect(rosterWorkbench.getByAltText('Tobias Lund')).toHaveCount(1);
};

const assertRosterParityAfterResign = async (page: Page) => {
  await page.getByTestId('tab-roster').click();
  const rosterWorkbench = page
    .getByTestId('cockpit-workbench')
    .and(page.locator('[data-active-tab="roster"]'));

  await expect(rosterWorkbench).toBeVisible();
  const truthPanel = rosterWorkbench.getByTestId('architect-roster-truth-panel');
  await expect(truthPanel).toHaveAttribute('data-roster-active-year', '2027');
  await expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '14');
  await expect(truthPanel).toHaveAttribute('data-roster-standard-count', '13');
  await expect(truthPanel).toHaveAttribute('data-roster-two-way-count', '1');
  await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
    '14 / 15'
  );
  await expect(page.getByTestId('cockpit-team-posture-summary')).toContainText(
    '14 / 15 roster spots shown'
  );

  await expect(rosterWorkbench.getByAltText(OWN_FA_NAME)).toHaveCount(1);
  await expect(
    rosterWorkbench.getByRole('button', {
      name: new RegExp(`More actions for ${OWN_FA_NAME}`, 'i'),
    })
  ).toHaveCount(1);
  await expect(rosterWorkbench.getByAltText('Marcus Vance')).toHaveCount(1);
  await expect(rosterWorkbench.getByAltText('Tobias Lund')).toHaveCount(1);
};

test.describe('FCT-OWNFA: Full Cap Table inline own-FA decision row is browser-verifiable', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await gotoMiaOwnFaSeason(page);
  });

  test('FCT-OWNFA-001: own free agent surfaces as the inline resign/absolve decision row', async ({
    page,
  }, testInfo) => {
    // --- Full Cap Table surface renders for the 2026-27 season ---
    const fullCapRegion = page
      .getByRole('region', { name: /Full Cap Table/i })
      .first();
    await expect(fullCapRegion).toBeVisible({ timeout: 20000 });

    // --- The own free agent is surfaced as the inline decision row, NOT as a
    // roster row. Under 2026-27 his contract has expired, so he leaves the
    // roster list and his UFA cap hold renders as the renounce-able row. ---
    const faRow = ownFaDecisionRow(page);
    await expect(faRow).toBeVisible({ timeout: 20000 });
    await expect(faRow).toContainText(OWN_FA_NAME);

    // He must NOT also appear as a normal roster row (no roster "More actions"
    // menu for him this season) — that would mean the dedup/placement split
    // regressed and we'd be double-counting the own FA.
    await expect(
      page.getByRole('button', {
        name: new RegExp(`More actions for ${OWN_FA_NAME}`, 'i'),
      })
    ).toHaveCount(0);

    // --- Resign affordance: the row exposes a clickable re-sign cell in the
    // free-agency season column, tagged with the player's Bird rights. ---
    const resignCell = faRow.getByTestId('cap-sheet-full-fa-resign-cell');
    await expect(resignCell.first()).toBeVisible();
    await expect(
      faRow.getByTestId('fa-bird-rights').first()
    ).toBeVisible();

    // --- Absolve affordance: the renounce button is present in the row's
    // hover overlay. Hover the row to reveal it, then assert it is actionable. ---
    await faRow.hover();
    const absolveButton = faRow.getByTestId('cap-sheet-full-fa-absolve-button');
    await expect(absolveButton).toBeVisible();
    await expect(absolveButton).toBeEnabled();

    await captureEvidence(page, testInfo, 'FCT-OWNFA-001-decision-row');
  });

  test('FCT-OWNFA-002: Absolve clears the own-FA cap hold and preserves FCT/Roster parity', async ({
    page,
  }, testInfo) => {
    // Renounce pops a window.confirm; accept it. In base/sandbox mode the
    // mutation is local-only (never persisted), so this does not leak into other
    // tests — the next reload re-reads the seeded hold.
    page.on('dialog', (dialog) => {
      void dialog.accept();
    });

    const faRow = ownFaDecisionRow(page);
    await expect(faRow).toBeVisible({ timeout: 20000 });
    await expect(
      faRow.getByTestId('cap-sheet-full-fa-resign-cell').first()
    ).toContainText('$15,000,000');
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );

    const beforeTotalCap = await readCockpitTotalCapMillions(page);
    expect(Number.isFinite(beforeTotalCap)).toBe(true);

    await faRow.hover();
    const absolveButton = faRow.getByTestId('cap-sheet-full-fa-absolve-button');
    await expect(absolveButton).toBeVisible();
    await absolveButton.click();

    // After absolving, the own FA's cap hold is cleared, so the inline decision
    // row for him is gone from the table.
    await expect(ownFaDecisionRow(page)).toHaveCount(0, { timeout: 20000 });
    await expect
      .poll(async () => readCockpitTotalCapMillions(page))
      .toBeLessThan(beforeTotalCap);

    const afterTotalCap = await readCockpitTotalCapMillions(page);
    expect(beforeTotalCap - afterTotalCap).toBeCloseTo(15, 0);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );

    await captureEvidence(page, testInfo, 'FCT-OWNFA-002-after-absolve');
    await assertRosterParityAfterAbsolve(page);
    await captureEvidence(
      page,
      testInfo,
      'FCT-OWNFA-002-after-absolve-roster-parity'
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaOwnFaDashboard(page);
    await expect(ownFaDecisionRow(page)).toBeVisible({ timeout: 20000 });
    expect(await readCockpitTotalCapMillions(page)).toBeCloseTo(
      beforeTotalCap,
      0
    );
  });

  test('FCT-OWNFA-003: own-FA re-sign cell launches the free-agent contract action modal safely', async ({
    page,
  }, testInfo) => {
    const faRow = ownFaDecisionRow(page);
    await expect(faRow).toBeVisible({ timeout: 20000 });

    const resignCell = faRow.getByTestId('cap-sheet-full-fa-resign-cell');
    await expect(resignCell.first()).toBeVisible();
    await resignCell.first().click();

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    const actionContext = modal.getByTestId('contract-modal-action-context');
    await expect(actionContext).toContainText(OWN_FA_NAME);
    await expect(actionContext).toContainText(/2026-27/i);
    await expect(modal.getByText(/Re-sign Player/i)).toBeVisible();
    await expect(modal.getByText(/Renounce Rights/i)).toBeVisible();
    await expect(
      modal.getByTestId('edit-contract-confirm-action-button')
    ).toBeDisabled();

    await modal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(modal).toHaveCount(0);
    await expect(ownFaDecisionRow(page)).toBeVisible();

    await captureEvidence(page, testInfo, 'FCT-OWNFA-003-resign-cell-modal');
  });

  test('FCT-OWNFA-004: Re-sign converts the own-FA cap hold into a roster contract across FCT/Roster/cockpit', async ({
    page,
  }, testInfo) => {
    const faRow = ownFaDecisionRow(page);
    await expect(faRow).toBeVisible({ timeout: 20000 });
    await expect(
      faRow.getByTestId('cap-sheet-full-fa-resign-cell').first()
    ).toContainText('$15,000,000');
    await expect(signedOwnFaPlayerRow(page)).toHaveCount(0);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );

    const beforeTotalCap = await readCockpitTotalCapMillions(page);
    expect(Number.isFinite(beforeTotalCap)).toBe(true);
    await captureEvidence(page, testInfo, 'FCT-OWNFA-004-before-resign');

    await faRow.getByTestId('cap-sheet-full-fa-resign-cell').first().click();

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await modal.getByTestId('contract-action-resign').check();
    await expect(modal.getByTestId('contract-action-resign')).toBeChecked();
    await expect(
      modal.locator('input[inputmode="decimal"]').first()
    ).toHaveValue('$12,000,000');

    const confirmButton = modal.getByTestId(
      'edit-contract-confirm-action-button'
    );
    await expect(confirmButton).toBeEnabled({ timeout: 20000 });
    await captureEvidence(page, testInfo, 'FCT-OWNFA-004-modal-ready');
    await confirmButton.click();

    await expect(modal).toHaveCount(0, { timeout: 20000 });

    await expect(ownFaDecisionRow(page)).toHaveCount(0, { timeout: 20000 });
    const signedRow = signedOwnFaPlayerRow(page);
    await expect(signedRow).toHaveCount(1, { timeout: 20000 });
    await expect(signedRow).toContainText('$12,000,000');
    await expect(
      page
        .getByTestId('cap-sheet-full-fa-decision-row')
        .filter({ hasText: OWN_FA_NAME })
    ).toHaveCount(0);

    await expect
      .poll(async () => readCockpitTotalCapMillions(page), {
        message:
          'The trusted Full Cap Table total should update after replacing the $15M hold with a signed contract',
      })
      .toBeLessThan(beforeTotalCap);

    const afterTotalCap = await readCockpitTotalCapMillions(page);
    expect(beforeTotalCap - afterTotalCap).toBeGreaterThan(0);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '14 / 15'
    );

    await captureEvidence(page, testInfo, 'FCT-OWNFA-004-after-resign-fct');
    await assertRosterParityAfterResign(page);
    await captureEvidence(page, testInfo, 'FCT-OWNFA-004-after-resign-roster');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaOwnFaDashboard(page);
    await expect(ownFaDecisionRow(page)).toBeVisible({ timeout: 20000 });
    await expect(signedOwnFaPlayerRow(page)).toHaveCount(0);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    expect(await readCockpitTotalCapMillions(page)).toBeCloseTo(
      beforeTotalCap,
      0
    );
  });
});
