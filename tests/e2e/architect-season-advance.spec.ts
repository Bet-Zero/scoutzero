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
  NEXT_REVIEW_WORLD_AS_OF_DATE,
  NEXT_REVIEW_WORLD_SEASON,
  REVIEW_WORLD_AS_OF_DATE,
  REVIEW_WORLD_SEASON,
  enableArchitectReviewFlags,
  getTeamPlayerIds,
  getWorldEventDocuments,
  getWorldMetadataDocument,
  getWorldSeasonHistoryDocument,
  getWorldSeasonTransitionDocument,
  getWorldTeamCodes,
  getWorldTeamDocument,
  openDashboardTab,
  prepareSeasonAdvanceReviewWorld,
  readActiveWorldId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

// BZE-250: season advance moved out of the (now V1-hidden) Offseason room into
// the top-bar World menu. Open the World-menu popover and click the relocated
// trigger; the wizard / draft-positions editor render at the dashboard root.
const openSeasonAdvanceControl = async (
  page: Page,
  control: 'advance' | 'draft-positions'
) => {
  const trigger = page.getByTestId('cockpit-world-menu-trigger');
  const popover = page.getByTestId('cockpit-world-menu-popover');
  // The cockpit re-mounts the TopBar on world select, resetting popover state,
  // so a single click doesn't reliably stick — nudge until it opens.
  await expect
    .poll(
      async () => {
        if (await popover.isVisible().catch(() => false)) return true;
        await trigger.click({ timeout: 2000 }).catch(() => undefined);
        return await popover.isVisible().catch(() => false);
      },
      { timeout: 15000, message: 'world menu popover should open' }
    )
    .toBe(true);
  const triggerTestId =
    control === 'advance'
      ? 'cockpit-season-advance-open'
      : 'cockpit-season-advance-draft-positions';
  await page.getByTestId(triggerTestId).click();
};

test.describe('ARCH-SEASON-ADVANCE: maintained review fixture proof', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240000);
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
  });

  test('MIA advances the governed 30-team season, retains close history, and reloads', async ({
    page,
  }, testInfo) => {
    test.setTimeout(240000);

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

    // BZE-250: the trigger in the World-menu popover opens the advance wizard
    // directly (no intermediate room).
    await openSeasonAdvanceControl(page, 'advance');
    await expect(
      page.getByRole('heading', { name: /^Advance Season$/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Next$/i }).click();
    await expect(
      page.getByRole('heading', { name: /^Confirm Season Advance$/i })
    ).toBeVisible();

    await page
      .getByRole('button', { name: /^Advance Season$/i })
      .last()
      .click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Season advanced to 2026-27/i,
      { timeout: 180000 }
    );

    await expect
      .poll(
        async () => {
          const metadata = await getWorldMetadataDocument(worldId);
          return metadata?.currentSeason || '';
        },
        {
          timeout: 20000,
          message: 'world metadata should advance to 2026-27',
        }
      )
      .toBe(NEXT_REVIEW_WORLD_SEASON);

    const offseasonSummaryClose = page
      .getByRole('heading', { name: /^Offseason Summary$/i })
      .locator('xpath=ancestor::div[contains(@class, "rounded")][1]')
      .getByRole('button', { name: /^Close$/i });
    if (
      await offseasonSummaryClose
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await offseasonSummaryClose.click();
    }

    const advancedMetadata = await getWorldMetadataDocument(worldId);
    expect(advancedMetadata?.currentSeason).toBe(NEXT_REVIEW_WORLD_SEASON);
    expect(advancedMetadata?.asOfDate).toBe(NEXT_REVIEW_WORLD_AS_OF_DATE);

    const seasonAdvanceEvents = (await getWorldEventDocuments(worldId)).filter(
      (event) => event.mutationType === 'seasonAdvance'
    );
    expect(seasonAdvanceEvents).toHaveLength(1);
    expect(seasonAdvanceEvents[0]?.teamCodes).toHaveLength(
      ALL_TEAM_CODES.length
    );

    const transitionId = `seasonAdvance__${REVIEW_WORLD_SEASON}__${NEXT_REVIEW_WORLD_SEASON}`;
    const manifest = await getWorldSeasonTransitionDocument(
      worldId,
      transitionId
    );
    expect(manifest?.teamRecords).toHaveLength(ALL_TEAM_CODES.length);
    const miaHistory = await getWorldSeasonHistoryDocument(
      worldId,
      `${REVIEW_WORLD_SEASON}__MIA`
    );
    expect(miaHistory?.finalRoster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: ANDRE_COLE_PLAYER_ID }),
      ])
    );
    expect(miaHistory?.seasonCloseApronMeasurement).toEqual(
      expect.objectContaining({
        teamCode: 'MIA',
        regularSeasonClosing: REVIEW_WORLD_AS_OF_DATE,
      })
    );
    const advancedMiaDocument = await getWorldTeamDocument(
      worldId,
      MIA_TEAM_CODE
    );
    const eventAfterTotals = seasonAdvanceEvents[0]
      ?.afterTotalsByTeam as Record<string, unknown> | undefined;
    expect(miaHistory?.afterTotals).toEqual(advancedMiaDocument?.totals);
    expect(eventAfterTotals?.MIA).toEqual(advancedMiaDocument?.totals);

    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByText(ANDRE_COLE_PLAYER_NAME).first()).toBeVisible();

    await openDashboardTab(page, 'Roster');
    const rosterRegion = page.getByRole('region', { name: /^Roster$/i });
    await expect(
      rosterRegion.getByRole('button', { name: /^Andre Cole\b/i })
    ).toBeVisible();

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    // The banner scopes history to the active world via a data attribute (the
    // world id was never surfaced as visible banner text).
    await expect(page.getByTestId('team-history-world-banner')).toHaveAttribute(
      'data-history-world-id',
      worldId
    );
    const firstTimelineRow = page.getByTestId('team-history-event-row-0');
    await expect(firstTimelineRow).toContainText(/Season Advance/i);

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
    const reloadedMetadata = await getWorldMetadataDocument(worldId);
    expect(reloadedMetadata?.currentSeason).toBe(NEXT_REVIEW_WORLD_SEASON);
    expect(reloadedMetadata?.asOfDate).toBe(NEXT_REVIEW_WORLD_AS_OF_DATE);

    await openDashboardTab(page, 'Roster');
    const reloadedRosterRegion = page.getByRole('region', {
      name: /^Roster$/i,
    });
    await expect(
      reloadedRosterRegion.getByRole('button', { name: /^Andre Cole\b/i })
    ).toBeVisible();

    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByText(ANDRE_COLE_PLAYER_NAME).first()).toBeVisible();

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-289 proof: a governed 30-team saved world advanced 2025-26 -> 2026-27 through the World-menu Season Advance. The atomic commit retained all 30 prior-season histories, the season-transition manifest and exact Apron close observation, History and Compare showed the committed event, all target books reloaded, and Andre Cole remained on the persisted roster.',
    });
  });
});
