/**
 * BZE-100: Roster / Full Cap Table player-state parity probe.
 *
 * The trusted FCT baseline for MIA 2026-27 shows Grant Holloway as an own-FA
 * decision row, not a normal roster row. Roster must agree by excluding him
 * from normal roster cards while keeping active roster players visible.
 */

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

const MIA_OWN_FA_URL = '/gm/MIA?season=2027';
const OWN_FA_NAME = 'Grant Holloway';

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const gotoMiaOwnFaSeason = async (page: Page) => {
  await page.goto(MIA_OWN_FA_URL, { waitUntil: 'domcontentloaded' });

  const fullCapTab = page.getByTestId('tab-full-cap-table');
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasFullCapTab = await isVisible(fullCapTab, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        return !stillLoading && (hasFullCapTab || hasNoTeamData);
      },
      {
        timeout: 60000,
        message:
          'GM Dashboard should leave loading and expose the seeded MIA FCT tab',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'MIA review fixture should be seeded before checking Roster/FCT parity'
  ).toBe(false);

  await fullCapTab.click();
};

const ownFaDecisionRow = (page: Page): Locator =>
  page
    .getByTestId('cap-sheet-full-fa-decision-row')
    .filter({ hasText: OWN_FA_NAME });

const captureEvidence = async (page: Page, testInfo: TestInfo, label: string) => {
  await page.screenshot({
    path: testInfo.outputPath(`${label}.png`),
    fullPage: true,
  });
};

test.describe('ARCH-ROSTER-FCT: Roster agrees with FCT player state', () => {
  test('ARCH-ROSTER-FCT-001: own FA is not a normal Roster card in the FCT own-FA season', async ({
    page,
  }, testInfo) => {
    await gotoMiaOwnFaSeason(page);

    await expect(ownFaDecisionRow(page)).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole('button', {
        name: new RegExp(`More actions for ${OWN_FA_NAME}`, 'i'),
      })
    ).toHaveCount(0);
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: 'Marcus Vance' })
    ).toBeVisible();

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
    await expect(rosterWorkbench.getByAltText('Marcus Vance')).toHaveCount(1);
    await expect(rosterWorkbench.getByAltText('Tobias Lund')).toHaveCount(1);

    await captureEvidence(page, testInfo, 'ARCH-ROSTER-FCT-001-mia-own-fa');
  });
});
