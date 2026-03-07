/**
 * E2E Tests for Architect GM Dashboard.
 *
 * These tests convert the manual D-MQ checklist into a stronger automation
 * baseline by using the dashboard's real selectors and existing DEV fixture
 * toggles. They are intentionally honest about coverage gaps: a few items
 * still require a seeded world or deeper transaction fixtures for full
 * end-to-end closure.
 */

import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import admin from 'firebase-admin';

const GM_DASHBOARD_URL = '/gm/LAL';
const GM_DASHBOARD_CAP_ROOM_URL = '/gm/ATL';
const REVIEW_MODE_FREE_AGENT_NAME = 'Review Offer Sheet Guard';
const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
const DEV_LOCAL_STORAGE_FLAGS = {
  'hz.dev.capSheetFixtures': 'true',
  'hz.dev.offseasonPreview': 'true',
  'hz.dev.teamHistoryFixtures': 'true',
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const getReviewAdminDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_EMULATOR_HOST;

  const app =
    admin.apps.find(
      (existingApp) => existingApp.name === 'playwright-review'
    ) ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      'playwright-review'
    );

  return app.firestore();
};

const addAuditNote = (testInfo: TestInfo, description: string) => {
  testInfo.annotations.push({ type: 'audit-note', description });
};

const captureEvidence = async (
  page: Page,
  testInfo: TestInfo,
  label: string
) => {
  await page.screenshot({
    path: testInfo.outputPath(`${slugify(label)}.png`),
    fullPage: true,
  });
};

const enableDevAuditFlags = async (page: Page) => {
  await page.addInitScript((flags) => {
    Object.entries(flags).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  }, DEV_LOCAL_STORAGE_FLAGS);
};

const gotoDashboard = async (page: Page) => {
  await page.goto(GM_DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

  const modeBadge = page.getByTestId('firebase-target-mode-badge');
  const noTeamData = page.getByText(/^No team data$/i);

  if (await isVisible(modeBadge, 15000)) {
    return;
  }

  if (await isVisible(noTeamData, 5000)) {
    return;
  }

  await expect(
    page.getByRole('heading', { name: /GM Dashboard/i })
  ).toBeVisible();
};

const ensureTeamDataLoaded = async (page: Page, testInfo: TestInfo) => {
  const noTeamData = page.getByText(/^No team data$/i);
  if (await isVisible(noTeamData, 3000)) {
    addAuditNote(
      testInfo,
      'The /gm/LAL route is unseeded in the current server session. Re-run with PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true or a seeded local review session for full checklist coverage.'
    );
    test.skip(
      'No team data loaded at /gm/LAL. Use Architect review mode or a seeded local session.'
    );
  }

  await expect(page.getByTestId('firebase-target-mode-badge')).toBeVisible();
};

const openDashboardTab = async (page: Page, label: string) => {
  const tabButton = page.getByRole('button', {
    name: new RegExp(`^${label}$`, 'i'),
  });
  await expect(tabButton).toBeVisible();
  await tabButton.click();
};

const readActiveWorldId = async (page: Page) => {
  const worldSelector = page.locator('#world-selector');
  const selectedWorldId = await worldSelector.inputValue().catch(() => '');
  if (selectedWorldId) {
    return selectedWorldId;
  }

  const debugSummary = await page
    .getByText(/^World:/)
    .first()
    .textContent()
    .catch(() => '');
  const debugWorldId = debugSummary?.match(/World:\s+([^\s|]+)/)?.[1] || '';

  return debugWorldId === 'base-mode' ? '' : debugWorldId;
};

const ensureWorldSelected = async (page: Page, testInfo: TestInfo) => {
  const worldSelector = page.locator('#world-selector');
  const worldActionsButton = page.getByRole('button', {
    name: /^World actions$/i,
  });
  const signInHint = page.getByText(/Sign in to manage worlds/i);

  await expect
    .poll(
      async () => ({
        hasWorldSelector: await isVisible(worldSelector, 1000),
        showingSignInHint: await isVisible(signInHint, 1000),
      }),
      {
        timeout: 25000,
        message:
          'world controls should appear after anonymous auth finishes initializing',
      }
    )
    .toMatchObject({ hasWorldSelector: true });

  if (!(await isVisible(worldSelector, 1000))) {
    addAuditNote(
      testInfo,
      'World selector did not render in time, so world-backed automation remains unavailable in this session.'
    );
    test.skip('World selector is unavailable in the current session.');
  }

  const selectedValue = await worldSelector.inputValue();
  if (selectedValue) {
    return selectedValue;
  }

  const createWorldButton = page.getByRole('button', { name: /^\+ New$/i });
  await expect(createWorldButton).toBeVisible();
  await createWorldButton.click();

  const worldName = `Audit World ${Date.now()}`;
  const nameInput = page.locator('#create-world-name');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(worldName);

  const createButton = page.getByRole('button', { name: /^Create$/i });
  await expect(createButton).toBeVisible();
  await createButton.click();

  await expect
    .poll(async () => await readActiveWorldId(page), {
      timeout: 15000,
      message: 'newly created world should become active after creation',
    })
    .not.toBe('');

  await expect(worldActionsButton).toBeVisible();

  const newWorldId = await readActiveWorldId(page);
  addAuditNote(
    testInfo,
    `World-backed review automation activated a newly created world (${newWorldId}) for this checklist row.`
  );
  return newWorldId;
};

test.describe('D-MQ: Architect Manual QA Checklist', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await gotoDashboard(page);
  });

  test('D-MQ-001: Header mode badge and emulator warning display correctly', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    const modeBadge = page.getByTestId('firebase-target-mode-badge');
    await expect(modeBadge).toBeVisible();
    await expect(modeBadge).toContainText(/EMULATOR|PROD/i);

    const warningBanner = page.getByTestId('firebase-emulator-warning-banner');
    if (await isVisible(warningBanner)) {
      await expect(warningBanner).toContainText(/emulator/i);
    } else {
      addAuditNote(
        testInfo,
        'No emulator warning banner was rendered; emulator detection appears healthy.'
      );
    }

    const worldSelector = page.locator('#world-selector');
    if (await isVisible(worldSelector, 5000)) {
      await expect(worldSelector).toBeVisible();
    } else {
      addAuditNote(
        testInfo,
        'World selector not rendered in this session, likely because no authenticated user is present.'
      );
    }

    await captureEvidence(page, testInfo, 'D-MQ-001-mode-badge');
  });

  test('D-MQ-002: World date +1 Day updates correctly', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    await ensureWorldSelected(page, testInfo);

    const dateInput = page.getByTestId('world-date-input');
    await expect(dateInput).toBeVisible();

    const dateBefore = await dateInput.inputValue();
    const advanceButton = page.getByTestId('advance-day-button');
    await expect(advanceButton).toBeVisible();
    await advanceButton.click();

    await expect
      .poll(async () => await dateInput.inputValue(), {
        message: 'world date should advance after clicking +1 Day',
      })
      .not.toBe(dateBefore);

    const dateAfter = await dateInput.inputValue();
    const before = new Date(dateBefore);
    const after = new Date(dateAfter);
    const diffDays = Math.round(
      (after.getTime() - before.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(1);
    await captureEvidence(page, testInfo, 'D-MQ-002-date-advance');
  });

  test('D-MQ-003: Trade Machine exposes validation and apply surfaces', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await openDashboardTab(page, 'Trade Machine');

    await expect(
      page.getByRole('heading', { name: /^Trade Machine$/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Validate Trade$/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeVisible();
    await expect(page.getByTestId('validation-state-header')).toBeVisible();
    await expect(page.getByTestId('not-validated-callout')).toBeVisible();

    const addTeamButton = page.getByRole('button', {
      name: /Add Team|Add 2nd Team|Add 3rd Team/i,
    });
    if (await isVisible(addTeamButton)) {
      await expect(addTeamButton).toBeVisible();
    } else {
      addAuditNote(
        testInfo,
        'No add-team control was visible in this session; legal trade execution still needs a seeded transaction fixture for full closure.'
      );
    }

    await captureEvidence(page, testInfo, 'D-MQ-003-trade-machine-readiness');
  });

  test('D-MQ-004: Invalid trade path is fail-closed before apply', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await openDashboardTab(page, 'Trade Machine');

    const applyTradeButton = page.getByRole('button', {
      name: /^Apply Trade$/i,
    });

    await expect(page.getByText(/Validation:/i)).toBeVisible();
    await expect(page.getByText(/^Not validated$/i)).toBeVisible();
    await expect(applyTradeButton).toBeDisabled();
    await captureEvidence(page, testInfo, 'D-MQ-004-invalid-trade-gating');
  });

  test('D-MQ-005: Free agent entry flow opens from the pool', async ({
    page,
  }, testInfo) => {
    await page.goto(GM_DASHBOARD_CAP_ROOM_URL, {
      waitUntil: 'domcontentloaded',
    });
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await openDashboardTab(page, 'Free Agency');

    await expect(
      page.getByRole('heading', { name: /^Free Agent Pool$/i })
    ).toBeVisible();

    const reviewFreeAgentRow = page.locator('li').filter({
      has: page.getByText(new RegExp(`^${REVIEW_MODE_FREE_AGENT_NAME}$`, 'i')),
    });
    await expect(reviewFreeAgentRow).toBeVisible({ timeout: 15000 });

    const menuButton = reviewFreeAgentRow
      .locator('button')
      .filter({ hasText: '•••' })
      .first();

    await menuButton.scrollIntoViewIfNeeded();
    await menuButton.click();
    const signAction = page.getByRole('button', { name: /^Sign Free Agent$/i });
    await expect(signAction).toBeVisible();
    await signAction.click();

    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).toBeVisible();
    const contractPreviewHeading = page.getByRole('heading', {
      name: /^New Contract Preview$/i,
    });

    const signFreeAgentRadio = page.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
    await signFreeAgentRadio.check();

    const offerSheetToggle = page.getByLabel(/^Offer Sheet$/i);
    await expect(offerSheetToggle).toBeVisible();
    await offerSheetToggle.check();

    await contractPreviewHeading
      .locator('xpath=following::select[3]')
      .selectOption({ label: '1yr' });

    const firstYearSalaryInput = contractPreviewHeading.locator(
      'xpath=following::input[2]'
    );
    await firstYearSalaryInput.fill('2490000');
    await firstYearSalaryInput.press('Tab');

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeVisible();
    await confirmActionButton.click();

    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).not.toBeVisible({ timeout: 15000 });

    const pendingOfferSheetsCard = page
      .locator('div')
      .filter({
        has: page.getByRole('heading', { name: /^My Pending Offer Sheets$/i }),
      })
      .first();
    await expect(pendingOfferSheetsCard).toBeVisible();
    await expect(pendingOfferSheetsCard).toContainText(
      REVIEW_MODE_FREE_AGENT_NAME
    );
    await expect(pendingOfferSheetsCard).toContainText(/PENDING MATCH/i);
    await expect(pendingOfferSheetsCard).toContainText(
      /Waiting for home team/i
    );

    const persistedTeamDocument = (await getReviewAdminDb()
      .doc(`architect_worlds/${worldId}/teams/ATL`)
      .get()
      .then((snapshot) => snapshot.data())) as
      | {
          offerSheets?: Array<Record<string, unknown>>;
        }
      | undefined;
    const persistedOfferSheet = persistedTeamDocument.offerSheets?.find(
      (offerSheet) => offerSheet.playerId === 'review_offer_sheet_guard'
    );

    expect(persistedOfferSheet).toBeTruthy();
    expect(persistedOfferSheet).toMatchObject({
      playerId: 'review_offer_sheet_guard',
      playerName: REVIEW_MODE_FREE_AGENT_NAME,
      offeringTeamCode: 'ATL',
      homeTeamCode: 'BOS',
      status: 'PENDING_MATCH',
    });
    expect(Number(persistedOfferSheet?.totalValue || 0)).toBeGreaterThan(0);

    addAuditNote(
      testInfo,
      'This covers the real review-mode offer-sheet save path: modal submit succeeds, the pending offer-sheet row renders, and the saved ATL team world document contains the persisted offer sheet in the Firestore emulator.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005-free-agency-entry');
  });

  test('D-MQ-006: Offseason preview shows non-persisting banner', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await openDashboardTab(page, 'Offseason');

    if (await isVisible(page.getByText(/World Season Advancement/i), 2000)) {
      addAuditNote(
        testInfo,
        'World season advancement controls are visible because a world is selected in this session.'
      );
    } else {
      addAuditNote(
        testInfo,
        'Offseason preview is available in base mode, but season advancement controls remain hidden until a world is selected.'
      );
    }

    const previewBanner = page.getByTestId('offseason-preview-banner');
    await expect(previewBanner).toBeVisible();
    await expect(previewBanner).toContainText(/Preview only/i);
    await expect(previewBanner).toContainText(/does not persist/i);

    await captureEvidence(page, testInfo, 'D-MQ-006-offseason-preview');
  });

  test('D-MQ-007: Season Advance modal opens with world-aware gating', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    await ensureWorldSelected(page, testInfo);

    await openDashboardTab(page, 'Offseason');

    const advanceSeasonButton = page.getByRole('button', {
      name: /^Advance Season$/i,
    });
    await expect(advanceSeasonButton).toBeVisible();
    await advanceSeasonButton.click();

    await expect(
      page.getByRole('heading', { name: /^Advance Season$/i })
    ).toBeVisible();

    const noWorldWarning = page.getByText(/No world selected/i);
    if (await isVisible(noWorldWarning)) {
      addAuditNote(
        testInfo,
        'Season advance modal opened, but persistence remains blocked until a world is selected.'
      );
      await expect(noWorldWarning).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible();
    }

    await captureEvidence(page, testInfo, 'D-MQ-007-season-advance-modal');

    const closeButton = page.locator('button', { hasText: '×' }).last();
    if (await isVisible(closeButton)) {
      await closeButton.click();
    }
  });

  test('D-MQ-008: Team History displays deterministic fixture details', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await openDashboardTab(page, 'Team History');

    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();

    const injectFixturesButton = page.getByTestId(
      'team-history-inject-fixtures-button'
    );
    if (await isVisible(injectFixturesButton, 5000)) {
      await injectFixturesButton.click();
    }

    const firstTimelineRow = page.getByTestId('team-history-event-row-0');
    await expect(firstTimelineRow).toBeVisible();
    await firstTimelineRow.click();

    await expect(page.getByTestId('team-history-detail-modal')).toBeVisible();
    await expect(page.getByTestId('team-history-detail-summary')).toBeVisible();
    await expect(page.getByTestId('team-history-detail-deltas')).toBeVisible();

    await captureEvidence(page, testInfo, 'D-MQ-008-team-history-detail');
  });

  test('D-MQ-009: Entitlement exception editor opens from the cap sheet', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await openDashboardTab(page, 'Cap Sheet');

    const injectFixturesButton = page.getByTestId(
      'cap-sheet-inject-fixtures-button'
    );
    if (await isVisible(injectFixturesButton, 3000)) {
      await injectFixturesButton.click();
    }

    const manageExceptionsButton = page.getByTestId(
      'cap-sheet-manage-exceptions-button'
    );
    await expect(manageExceptionsButton).toBeVisible();
    await manageExceptionsButton.click();

    const modal = page.getByTestId('manage-exceptions-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Exception Management/i)).toBeVisible();

    addAuditNote(
      testInfo,
      'This proves the entitlement exception editor entry path. Atomic attach and duplicate-identity conflict handling still need a seeded save-path scenario for full closure.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-009-manage-exceptions-modal');

    const closeButton = modal.locator('button', { hasText: '×' });
    if (await isVisible(closeButton)) {
      await closeButton.click();
    }
  });

  test('D-MQ-010: Base-write deny evidence remains paired with rules proof', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await expect(page.getByTestId('firebase-target-mode-badge')).toBeVisible();
    await openDashboardTab(page, 'Cap Sheet');
    await expect(page.getByTestId('tab-cap-sheet')).toBeVisible();

    addAuditNote(
      testInfo,
      'UI coverage here is intentionally limited. Firestore base-write denial remains authoritatively proven by npm run test:rules and ARCHITECT_AUDIT_V3_VQ_E2_RULES_RUNTIME_PROOF.md.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-010-base-write-handoff');
  });
});

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await gotoDashboard(page);
  });

  test('GM Dashboard loads successfully', async ({ page }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await expect(page).toHaveTitle(/ScoutZero|HoopZero/i);
    await captureEvidence(page, testInfo, 'smoke-gm-dashboard');
  });

  test('Cap Sheet tab is accessible', async ({ page }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await openDashboardTab(page, 'Cap Sheet');
    await expect(page.getByTestId('tab-cap-sheet')).toBeVisible();
    await expect(page.getByText(/Cap Sheet/i).first()).toBeVisible();
    await captureEvidence(page, testInfo, 'smoke-cap-sheet');
  });

  test('Full Cap Table tab is accessible', async ({ page }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    await page.getByTestId('tab-full-cap-table').click();
    await expect(page.getByTestId('tab-full-cap-table')).toBeVisible();
    await expect(page.getByText(/Future Cap Sheet/i).first()).toBeVisible();
    await captureEvidence(page, testInfo, 'smoke-full-cap-table');
  });
});
