/**
 * Focused browser proof for the maintained Season Advance review fixture.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-season-advance.spec.ts --reporter=line --workers=1
 */

import { test, expect, type Page } from '@playwright/test';
import {
  ALL_TEAM_CODES,
  ANDRE_COLE_PLAYER_ID,
  ANDRE_COLE_PLAYER_NAME,
  MIA_SEASON_ADVANCE_URL,
  MIA_TEAM_CODE,
  NEXT_REVIEW_WORLD_SEASON,
  QUENTIN_DIAZ_PLAYER_ID,
  QUENTIN_DIAZ_PLAYER_NAME,
  REVIEW_WORLD_AS_OF_DATE,
  REVIEW_WORLD_SEASON,
  enableArchitectReviewFlags,
  getCapHold,
  getTeamPlayerIds,
  getWorldEventDocuments,
  getWorldMetadataDocument,
  getWorldTeamCodes,
  getWorldTeamDocument,
  openDashboardTab,
  prepareSeasonAdvanceReviewWorld,
  readActiveWorldId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

const chooseSeasonAdvanceOption = async (
  page: Page,
  playerId: string,
  playerName: string,
  decision: 'Exercise' | 'Decline'
) => {
  await expect(page.getByText(new RegExp(playerName, 'i')).first()).toBeVisible();
  const choiceIndex = decision === 'Exercise' ? 0 : 1;
  await page
    .locator(`input[type="radio"][name="option-${playerId}"]`)
    .nth(choiceIndex)
    .check();
};

const expectAndreColeCapHold = async (worldId: string) => {
  const miaDocument = await getWorldTeamDocument(worldId, MIA_TEAM_CODE);
  expect(getTeamPlayerIds(miaDocument)).not.toContain(ANDRE_COLE_PLAYER_ID);
  const capHold = getCapHold(miaDocument, ANDRE_COLE_PLAYER_ID);
  expect(capHold).toBeTruthy();
  expect(capHold?.season).toBe(NEXT_REVIEW_WORLD_SEASON);
  expect(Number(capHold?.amount || 0)).toBeGreaterThan(0);
};

test.describe('ARCH-SEASON-ADVANCE: maintained review fixture proof', () => {
  test.beforeEach(async ({ page }) => {
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
  });

  test('MIA advances season, preserves Andre Cole decline evidence, and reloads', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);

    const worldId = await prepareSeasonAdvanceReviewWorld(page);

    const seededTeamCodes = await getWorldTeamCodes(worldId);
    expect(seededTeamCodes).toEqual([...ALL_TEAM_CODES].sort());

    const startingMetadata = await getWorldMetadataDocument(worldId);
    expect(startingMetadata?.currentSeason).toBe(REVIEW_WORLD_SEASON);
    expect(startingMetadata?.asOfDate).toBe(REVIEW_WORLD_AS_OF_DATE);

    const startingMiaDocument = await getWorldTeamDocument(
      worldId,
      MIA_TEAM_CODE
    );
    expect(getTeamPlayerIds(startingMiaDocument)).toContain(
      ANDRE_COLE_PLAYER_ID
    );

    await openDashboardTab(page, 'Offseason');
    await page.getByRole('button', { name: /^Advance Season$/i }).click();
    await expect(
      page.getByRole('heading', { name: /^Advance Season$/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Next$/i }).click();
    await expect(
      page.getByRole('heading', {
        name: new RegExp(`Option Decisions for ${NEXT_REVIEW_WORLD_SEASON}`, 'i'),
      })
    ).toBeVisible();
    await chooseSeasonAdvanceOption(
      page,
      ANDRE_COLE_PLAYER_ID,
      ANDRE_COLE_PLAYER_NAME,
      'Decline'
    );
    await chooseSeasonAdvanceOption(
      page,
      QUENTIN_DIAZ_PLAYER_ID,
      QUENTIN_DIAZ_PLAYER_NAME,
      'Exercise'
    );

    await page.getByRole('button', { name: /^Next$/i }).click();
    await expect(
      page.getByRole('heading', { name: /^Confirm Season Advance$/i })
    ).toBeVisible();
    const declineSummary = page
      .locator('div')
      .filter({ has: page.getByText(/Options to Decline/i) })
      .filter({ has: page.getByText(ANDRE_COLE_PLAYER_NAME) })
      .first();
    await expect(declineSummary).toBeVisible();

    await page
      .getByRole('button', { name: /^Advance Season$/i })
      .last()
      .click();

    await expect(
      page.getByText(/Season Advanced Successfully/i)
    ).toBeVisible({ timeout: 90000 });
    await page.getByRole('button', { name: /^Done$/i }).click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Season advanced to 2027-28/i,
      { timeout: 20000 }
    );

    await expect
      .poll(
        async () => {
          const metadata = await getWorldMetadataDocument(worldId);
          return metadata?.currentSeason || '';
        },
        {
          timeout: 20000,
          message: 'world metadata should advance to 2027-28',
        }
      )
      .toBe(NEXT_REVIEW_WORLD_SEASON);

    const advancedMetadata = await getWorldMetadataDocument(worldId);
    expect(advancedMetadata?.asOfDate).toBe(REVIEW_WORLD_AS_OF_DATE);
    await expectAndreColeCapHold(worldId);

    const seasonAdvanceEvents = (await getWorldEventDocuments(worldId)).filter(
      (event) => event.mutationType === 'seasonAdvance'
    );
    expect(seasonAdvanceEvents).toHaveLength(1);
    expect(seasonAdvanceEvents[0]?.teamCodes).toHaveLength(
      ALL_TEAM_CODES.length
    );

    await openDashboardTab(page, 'Full Cap Table');
    await page.getByTestId('cap-sheet-full-cap-holds-toggle').click();
    await expect(page.getByText(ANDRE_COLE_PLAYER_NAME).first()).toBeVisible();

    await openDashboardTab(page, 'Roster');
    const rosterRegion = page.getByRole('region', { name: /^Roster$/i });
    await expect(
      rosterRegion.getByRole('button', { name: /Andre Cole/i })
    ).toHaveCount(0);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByTestId('team-history-world-banner')).toContainText(
      worldId
    );
    const firstTimelineRow = page.getByTestId('team-history-event-row-0');
    await expect(firstTimelineRow).toContainText(/Season Advance/i);
    await firstTimelineRow.click();
    await expect(page.getByTestId('team-history-detail-modal')).toBeVisible();
    await expect(
      page.getByTestId('team-history-detail-mutation-type')
    ).toHaveText(/seasonAdvance/i);
    await page.getByTestId('team-history-detail-close').click();

    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /1\s+committed event/i,
      { timeout: 20000 }
    );
    await expect(page.getByTestId('comparison-changed-teams')).toContainText(
      /30\s+teams changed/i
    );
    await expect(
      page.getByTestId('comparison-multi-season-warning')
    ).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await expect
      .poll(async () => await readActiveWorldId(page), {
        timeout: 15000,
        message: `world ${worldId} should remain active after reload`,
      })
      .toBe(worldId);

    await openDashboardTab(page, 'Roster');
    const reloadedRosterRegion = page.getByRole('region', { name: /^Roster$/i });
    await expect(
      reloadedRosterRegion.getByRole('button', { name: /Andre Cole/i })
    ).toHaveCount(0);

    await openDashboardTab(page, 'Full Cap Table');
    await page.getByTestId('cap-sheet-full-cap-holds-toggle').click();
    await expect(page.getByText(ANDRE_COLE_PLAYER_NAME).first()).toBeVisible();
    await expectAndreColeCapHold(worldId);

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-178 proof: maintained review helper seeded a 30-team saved world, MIA advanced 2026-27 -> 2027-28 through the supported Offseason UI, Andre Cole declined into a cap hold, Roster removed him, History and Compare showed the committed seasonAdvance event, and reload preserved the active world. asOfDate intentionally remained 2026-07-01.',
    });
  });
});
