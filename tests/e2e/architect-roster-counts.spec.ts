/**
 * BZE-99: Roster count/category browser probe.
 *
 * This keeps the Roster work scoped to the user-facing Roster room: the test
 * opens the seeded MIA review fixture, switches to Roster, and verifies the
 * visible count/category strip agrees with the fixture's current Roster render.
 */

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

const MIA_DASHBOARD_URL = '/gm/MIA?season=2027';

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const gotoMiaRoster = async (page: Page) => {
  await page.goto(MIA_DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

  const rosterTab = page.getByTestId('tab-roster');
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasRosterTab = await isVisible(rosterTab, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        return !stillLoading && (hasRosterTab || hasNoTeamData);
      },
      {
        timeout: 60000,
        message:
          'GM Dashboard should leave loading and expose the seeded MIA Roster tab',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'MIA review fixture should be seeded before checking Roster counts'
  ).toBe(false);

  await rosterTab.click();
  await expect(page.getByTestId('cockpit-workbench')).toHaveAttribute(
    'data-active-tab',
    'roster'
  );
};

const captureEvidence = async (page: Page, testInfo: TestInfo, label: string) => {
  await page.screenshot({
    path: testInfo.outputPath(`${label}.png`),
    fullPage: true,
  });
};

test.describe('ARCH-ROSTER: Roster counts and categories are browser-verifiable', () => {
  test('ARCH-ROSTER-COUNT-001: MIA Roster exposes displayed, standard, two-way, and unsupported states', async ({
    page,
  }, testInfo) => {
    await gotoMiaRoster(page);

    const truthPanel = page.getByTestId('architect-roster-truth-panel');
    await expect(truthPanel).toBeVisible({ timeout: 20000 });
    await expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '13');
    await expect(truthPanel).toHaveAttribute('data-roster-standard-count', '12');
    await expect(truthPanel).toHaveAttribute('data-roster-two-way-count', '1');
    await expect(truthPanel).toHaveAttribute('data-roster-active-year', '2027');
    await expect(truthPanel).toHaveAttribute(
      'data-roster-unsupported-categories',
      'fa,expired,waived,options'
    );

    await expect(page.getByTestId('roster-count-displayed')).toHaveText(
      '13 cards'
    );
    await expect(page.getByTestId('roster-count-standard')).toHaveText(
      '12 standards'
    );
    await expect(page.getByTestId('roster-count-two-way')).toHaveText(
      '1 two-way'
    );
    await expect(page.getByTestId('roster-count-sections')).toHaveText(
      '5 starters / 4 rotation / 4 bench'
    );
    await expect(page.getByTestId('roster-unsupported-categories')).toHaveText(
      'FA / expired / waived / options not surfaced'
    );

    await expect(page.getByTestId('roster-card-starter')).toHaveCount(5);
    await expect(page.getByTestId('roster-card-rotation')).toHaveCount(4);
    await expect(page.getByTestId('roster-card-bench')).toHaveCount(4);

    await captureEvidence(page, testInfo, 'ARCH-ROSTER-COUNT-001-mia-roster');
  });
});
