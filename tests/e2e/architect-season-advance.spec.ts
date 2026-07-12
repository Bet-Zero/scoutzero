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

const expectAndreColeCapHold = async (worldId: string) => {
  const miaDocument = await getWorldTeamDocument(worldId, MIA_TEAM_CODE);
  expect(getTeamPlayerIds(miaDocument)).not.toContain(ANDRE_COLE_PLAYER_ID);
  const capHold = getCapHold(miaDocument, ANDRE_COLE_PLAYER_ID);
  expect(capHold).toBeTruthy();
  expect(capHold?.season).toBe(NEXT_REVIEW_WORLD_SEASON);
  expect(Number(capHold?.amount || 0)).toBeGreaterThan(0);
};

const DRAFT_POSITIONS_PROOF_MAP = {
  BOS: 5,
  LAL: 10,
  MIA: 15,
};

test.describe('ARCH-SEASON-ADVANCE: maintained review fixture proof', () => {
  test.beforeEach(async ({ page }) => {
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
  });

  test('saves draft positions via the World menu and reloads committed world state', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);

    const worldId = await prepareSeasonAdvanceReviewWorld(page);

    await openSeasonAdvanceControl(page, 'draft-positions');
    await expect(page.getByText(/^Draft Positions Input$/i)).toBeVisible();
    await expect(
      page.getByText(/World Season:\s*2026-27/i).last()
    ).toBeVisible();
    await expect(
      page.getByText(/Next-used Draft Year:\s*2027/i).last()
    ).toBeVisible();

    const editor = page.locator('textarea').first();
    await expect(editor).toBeVisible();
    await editor.fill(JSON.stringify(DRAFT_POSITIONS_PROOF_MAP, null, 2));

    await page.getByRole('button', { name: /^Validate$/i }).click();
    await expect(
      page.getByText(/Editor JSON is valid but not yet saved/i)
    ).toBeVisible();

    await page.getByRole('button', { name: /^Save$/i }).click();
    await expect(
      page.getByText(/Saved draft positions for 2027/i)
    ).toBeVisible({ timeout: 20000 });

    await expect
      .poll(
        async () => {
          const metadata = await getWorldMetadataDocument(worldId);
          const savedDraftPositions = metadata?.draftPositionsByYear as
            | Record<string, { positionsMap?: Record<string, number> }>
            | undefined;
          return savedDraftPositions?.['2027']?.positionsMap || null;
        },
        {
          timeout: 20000,
          message: 'draft positions should persist under world metadata',
        }
      )
      .toMatchObject(DRAFT_POSITIONS_PROOF_MAP);

    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openSeasonAdvanceControl(page, 'draft-positions');
    await expect(page.getByText(/Last saved:/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('textarea').first()).toHaveValue(/"MIA": 15/);

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-193/BZE-250 proof: saved 2027 draft positions through the World-menu Draft Positions editor (relocated from the now-hidden Offseason room), verified draftPositionsByYear.2027.positionsMap in saved-world metadata, reloaded the world, and confirmed the editor rehydrated from committed world state.',
    });
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

    // BZE-250: the trigger in the World-menu popover opens the advance wizard
    // directly (no intermediate room).
    await openSeasonAdvanceControl(page, 'advance');
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

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Season advanced to 2027-28/i,
      { timeout: 90000 }
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
        'BZE-180 proof: maintained review helper seeded a 30-team saved world, MIA advanced 2026-27 -> 2027-28 through the World-menu Season Advance (relocated from the now-hidden Offseason room), metadata.asOfDate advanced to 2027-07-01, Andre Cole declined into a cap hold, Roster removed him, History and Compare showed the committed seasonAdvance event, and reload preserved the active world plus advanced metadata.',
    });
  });
});
