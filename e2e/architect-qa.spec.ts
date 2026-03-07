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

const getWorldTeamDocument = async (worldId: string, teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as
    | {
        entitlementIds?: string[];
        offerSheets?: Array<Record<string, unknown>>;
      }
    | undefined;

const getWorldEntitlementDocuments = async (worldId: string) =>
  (await getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/entitlements`)
    .get()
    .then((snapshot) =>
      snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Record<string, unknown>),
      }))
    )) as Array<Record<string, unknown> & { id: string }>;

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
  const dashboardHeading = page.getByRole('heading', { name: /GM Dashboard/i });
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const hasModeBadge = await isVisible(modeBadge, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        const hasDashboardHeading = await isVisible(dashboardHeading, 1000);
        const stillLoading = await isVisible(loadingDashboard, 1000);

        return (
          !stillLoading &&
          (hasModeBadge || hasNoTeamData || hasDashboardHeading)
        );
      },
      {
        timeout: 30000,
        message:
          'GM Dashboard should leave the loading state and render a terminal dashboard state',
      }
    )
    .toBe(true);

  if (await isVisible(modeBadge, 15000)) {
    return;
  }

  if (await isVisible(noTeamData, 5000)) {
    return;
  }

  await expect(dashboardHeading).toBeVisible();
};

const reenterDashboardViaAppNavigation = async (page: Page) => {
  const startingUrl = page.url();
  const profilesLink = page.getByRole('link', { name: /^Player Profiles$/i });
  await expect(profilesLink).toBeVisible();
  await profilesLink.click();
  await expect(page).toHaveURL(/\/profiles$/);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(startingUrl);
  return page;
};

const ensureTeamDataLoaded = async (page: Page, testInfo: TestInfo) => {
  const noTeamData = page.getByText(/^No team data$/i);
  const modeBadge = page.getByTestId('firebase-target-mode-badge');
  const dashboardHeading = page.getByRole('heading', { name: /GM Dashboard/i });
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        const hasModeBadge = await isVisible(modeBadge, 1000);
        const hasDashboardHeading = await isVisible(dashboardHeading, 1000);
        const stillLoading = await isVisible(loadingDashboard, 1000);

        return {
          hasNoTeamData,
          isReady:
            !stillLoading &&
            (hasNoTeamData || hasModeBadge || hasDashboardHeading),
        };
      },
      {
        timeout: 30000,
        message:
          'GM Dashboard should finish loading before the test checks for team data',
      }
    )
    .toMatchObject({ isReady: true });

  if (await isVisible(noTeamData, 1000)) {
    addAuditNote(
      testInfo,
      'The /gm/LAL route is unseeded in the current server session. Re-run with PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true or a seeded local review session for full checklist coverage.'
    );
    test.skip(
      'No team data loaded at /gm/LAL. Use Architect review mode or a seeded local session.'
    );
  }

  if (!(await isVisible(modeBadge, 2000))) {
    addAuditNote(
      testInfo,
      'Mode badge was not visible when team data finished loading; continuing because the dashboard itself is interactive in this session.'
    );
  }
};

const openDashboardTab = async (page: Page, label: string) => {
  const tabButton = page.getByRole('button', {
    name: new RegExp(`^${label}$`, 'i'),
  });
  await expect(tabButton).toBeVisible();
  await tabButton.click();
};

const openWizardEditorTab = async (modal: Locator, label: string) => {
  const editorTab = modal
    .getByRole('button', {
      name: new RegExp(`^${label}(\\s+\\d+)?$`, 'i'),
    })
    .first();
  await expect(editorTab).toBeVisible();
  await editorTab.click({ force: true });
};

const readWorldIdFromBodyText = async (page: Page) =>
  page
    .evaluate(() => document.body?.innerText || '')
    .then((text) => {
      const match = text.match(/World:\s+([^\s|]+)/);
      return match?.[1] === 'base-mode' ? '' : match?.[1] || '';
    })
    .catch(() => '');

const readActiveWorldId = async (page: Page) => {
  const worldSelector = page.locator('#world-selector');
  const selectedWorldId = await worldSelector.inputValue().catch(() => '');
  if (selectedWorldId) {
    return selectedWorldId;
  }

  const storedWorldId = await page
    .evaluate(() => {
      const storageKey = Object.keys(window.localStorage).find((key) =>
        key.startsWith('architect.activeWorldId.')
      );

      return storageKey ? window.localStorage.getItem(storageKey) || '' : '';
    })
    .catch(() => '');
  if (storedWorldId) {
    return storedWorldId;
  }

  const debugSummary = await page
    .locator('text=/World:\s+/')
    .first()
    .textContent()
    .catch(() => '');
  const debugWorldId = debugSummary?.match(/World:\s+([^\s|]+)/)?.[1] || '';
  if (debugWorldId && debugWorldId !== 'base-mode') {
    return debugWorldId;
  }

  const bodyWorldId = await readWorldIdFromBodyText(page);

  if (bodyWorldId) {
    return bodyWorldId;
  }

  return '';
};

const ensureWorldSelected = async (page: Page, testInfo: TestInfo) => {
  const worldSelector = page.locator('#world-selector');
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

  let createdWorldId = '';
  await expect
    .poll(
      async () => {
        const matchingWorld = (
          await getReviewAdminDb().collection('architect_worlds').get()
        ).docs
          .map((docSnapshot) => docSnapshot.data() as Record<string, unknown>)
          .find((world) => world.worldName === worldName);

        createdWorldId =
          typeof matchingWorld?.worldId === 'string'
            ? matchingWorld.worldId
            : '';
        return createdWorldId !== '';
      },
      {
        timeout: 15000,
        message:
          'newly created world should persist to the emulator after creation',
      }
    )
    .toBe(true);

  await page.waitForTimeout(500);

  const newWorldId = (await readActiveWorldId(page)) || createdWorldId;
  expect(newWorldId).not.toBe('');
  addAuditNote(
    testInfo,
    `World-backed review automation activated a newly created world (${newWorldId}) for this checklist row.`
  );
  return newWorldId;
};

const ensureSpecificWorldSelected = async (
  page: Page,
  worldId: string,
  testInfo: TestInfo
) => {
  await expect
    .poll(async () => await readActiveWorldId(page), {
      timeout: 10000,
      message: `world ${worldId} should remain active or rehydrate automatically after route re-entry`,
    })
    .toBe(worldId)
    .catch(() => undefined);

  const activeWorldId = await readActiveWorldId(page);
  if (activeWorldId === worldId) {
    return worldId;
  }

  const worldSelector = page.locator('#world-selector');
  await expect(worldSelector).toBeVisible();

  await expect
    .poll(
      async () =>
        await worldSelector.evaluate((element, expectedWorldId) => {
          const select = element as HTMLSelectElement;
          return Array.from(select.options).some(
            (option) => option.value === expectedWorldId
          );
        }, worldId),
      {
        timeout: 15000,
        message: `world selector should load option ${worldId} before re-selection`,
      }
    )
    .toBe(true);

  await worldSelector.selectOption(worldId);

  await expect
    .poll(async () => await readActiveWorldId(page), {
      timeout: 15000,
      message: `world ${worldId} should rehydrate as the active selection after reload`,
    })
    .toBe(worldId);

  addAuditNote(
    testInfo,
    `Reload required explicit re-selection of world ${worldId} before persisted-state verification continued.`
  );

  return worldId;
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

  test('D-MQ-005: Free agent offer sheet persists and rehydrates after route re-entry', async ({
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
    await offerSheetToggle.click({ force: true });
    await expect(offerSheetToggle).toBeChecked();

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

    const persistedTeamDocument = await getWorldTeamDocument(worldId, 'ATL');
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

    await reenterDashboardViaAppNavigation(page);
    await ensureTeamDataLoaded(page, testInfo);
    await openDashboardTab(page, 'Free Agency');

    const rehydratedPendingOfferSheetsCard = page
      .locator('div')
      .filter({
        has: page.getByRole('heading', { name: /^My Pending Offer Sheets$/i }),
      })
      .first();
    await expect(rehydratedPendingOfferSheetsCard).toBeVisible();
    await expect(rehydratedPendingOfferSheetsCard).toContainText(
      REVIEW_MODE_FREE_AGENT_NAME
    );
    await expect(rehydratedPendingOfferSheetsCard).toContainText(
      /PENDING MATCH/i
    );

    const persistedTeamDocumentAfterReload = await getWorldTeamDocument(
      worldId,
      'ATL'
    );
    const persistedOfferSheetAfterReload =
      persistedTeamDocumentAfterReload.offerSheets?.find(
        (offerSheet) => offerSheet.playerId === 'review_offer_sheet_guard'
      );

    expect(persistedOfferSheetAfterReload).toMatchObject({
      playerId: 'review_offer_sheet_guard',
      status: 'PENDING_MATCH',
      offeringTeamCode: 'ATL',
    });

    addAuditNote(
      testInfo,
      'This covers the real review-mode offer-sheet save path end to end: modal submit succeeds, the pending offer-sheet row renders, the saved ATL world document contains the persisted offer sheet in the Firestore emulator, and the same pending state rehydrates correctly after dashboard route re-entry.'
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

  test('D-MQ-009: Entitlement authoring saves world data and blocks conflicting claims', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await openDashboardTab(page, 'Trade Machine');

    const beforeTeamDocument = await getWorldTeamDocument(worldId, 'LAL');
    const beforeEntitlementIds = Array.isArray(
      beforeTeamDocument?.entitlementIds
    )
      ? [...beforeTeamDocument.entitlementIds]
      : [];
    const beforeWorldEntitlements = await getWorldEntitlementDocuments(worldId);

    const newEntitlementButton = page
      .getByRole('button', { name: /^New Entitlement$/i })
      .first();

    const picksTabButton = page
      .getByRole('button', {
        name: /^(Picks|Pck)( \(\d+\))?$/i,
      })
      .first();

    if (!(await isVisible(newEntitlementButton, 2000))) {
      const teamPicker = page
        .locator('label', { hasText: /^Select Team$/i })
        .locator('xpath=following-sibling::select[1]')
        .first();

      if (!(await isVisible(teamPicker, 2000))) {
        const addTeamButton = page.getByRole('button', { name: /^Add Team$/i });
        if (await isVisible(addTeamButton, 2000)) {
          await addTeamButton.click();
        }
      }

      await expect(teamPicker).toBeVisible();
      await teamPicker.selectOption('lakers');
    }

    await expect(picksTabButton).toBeVisible();
    await picksTabButton.click();
    await expect(newEntitlementButton).toBeVisible();
    await newEntitlementButton.click();

    const modal = page.getByTestId('pick-right-wizard-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('view-toggle-advanced').click();

    await page.locator('#entitlement-holderTeam').fill('LAL');
    await page.locator('#entitlement-seasonYear').fill('2031');
    await page.locator('#entitlement-round').selectOption('1');
    await page.locator('#entitlement-kind').selectOption('swap_right');
    await page
      .locator('#entitlement-description')
      .fill('Review-mode swap authoring proof');
    await openWizardEditorTab(modal, 'Swap');
    await page.locator('#entitlement-swapType').selectOption('best_of');
    await page.locator('#entitlement-swapControllerPickId').fill('LAL_2031_R1');
    await page
      .locator('#entitlement-swapTargetDefinition')
      .fill('BOS own 2031 1st round pick');

    const applyButton = modal.getByTestId('wizard-apply');
    await expect(applyButton).toBeEnabled();
    await applyButton.click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    let createdEntitlementId = '';
    await expect
      .poll(
        async () => {
          const worldEntitlements = await getWorldEntitlementDocuments(worldId);
          const createdDocument = worldEntitlements.find(
            (entitlement) =>
              entitlement.kind === 'swap_right' &&
              entitlement.swapControllerPickId === 'LAL_2031_R1' &&
              entitlement.swapTargetDefinition === 'BOS own 2031 1st round pick'
          );
          createdEntitlementId =
            typeof createdDocument?.id === 'string' ? createdDocument.id : '';
          return createdEntitlementId;
        },
        {
          timeout: 15000,
          message:
            'newly authored entitlement should persist to the world collection',
        }
      )
      .not.toBe('');

    const afterCreateTeamDocument = await getWorldTeamDocument(worldId, 'LAL');
    const afterCreateEntitlementIds = Array.isArray(
      afterCreateTeamDocument?.entitlementIds
    )
      ? [...afterCreateTeamDocument.entitlementIds]
      : [];
    expect(afterCreateEntitlementIds).toContain(createdEntitlementId);

    const createdEntitlement = (
      await getWorldEntitlementDocuments(worldId)
    ).find((entitlement) => entitlement.id === createdEntitlementId);
    expect(createdEntitlement).toMatchObject({
      holderTeam: 'LAL',
      seasonYear: 2031,
      round: 1,
      kind: 'swap_right',
      swapControllerPickId: 'LAL_2031_R1',
      swapTargetDefinition: 'BOS own 2031 1st round pick',
    });

    await reenterDashboardViaAppNavigation(page);
    await ensureTeamDataLoaded(page, testInfo);
    await openDashboardTab(page, 'Trade Machine');

    const afterReloadTeamDocument = await getWorldTeamDocument(worldId, 'LAL');
    const afterReloadEntitlementIds = Array.isArray(
      afterReloadTeamDocument?.entitlementIds
    )
      ? [...afterReloadTeamDocument.entitlementIds]
      : [];
    expect(afterReloadEntitlementIds).toContain(createdEntitlementId);

    const afterReloadCreatedEntitlement = (
      await getWorldEntitlementDocuments(worldId)
    ).find((entitlement) => entitlement.id === createdEntitlementId);
    expect(afterReloadCreatedEntitlement).toMatchObject({
      holderTeam: 'LAL',
      seasonYear: 2031,
      round: 1,
      kind: 'swap_right',
      swapControllerPickId: 'LAL_2031_R1',
      swapTargetDefinition: 'BOS own 2031 1st round pick',
    });

    const newEntitlementButtonAfterReload = page
      .getByRole('button', { name: /^New Entitlement$/i })
      .first();
    const picksTabButtonAfterReload = page
      .getByRole('button', {
        name: /^(Picks|Pck)( \(\d+\))?$/i,
      })
      .first();

    if (!(await isVisible(newEntitlementButtonAfterReload, 2000))) {
      const teamPicker = page
        .locator('label', { hasText: /^Select Team$/i })
        .locator('xpath=following-sibling::select[1]')
        .first();
      if (!(await isVisible(teamPicker, 2000))) {
        const addTeamButton = page.getByRole('button', { name: /^Add Team$/i });
        if (await isVisible(addTeamButton, 2000)) {
          await addTeamButton.click();
        }
      }
      if (await isVisible(teamPicker, 2000)) {
        await teamPicker.selectOption('lakers');
      }
    }

    await expect(picksTabButtonAfterReload).toBeVisible();
    await picksTabButtonAfterReload.click();
    await expect(newEntitlementButtonAfterReload).toBeVisible();

    await newEntitlementButtonAfterReload.click();
    const reloadedModal = page.getByTestId('pick-right-wizard-modal');
    await expect(reloadedModal).toBeVisible();
    await reloadedModal.getByTestId('view-toggle-advanced').click();

    await page.locator('#entitlement-holderTeam').fill('LAL');
    await page.locator('#entitlement-seasonYear').fill('2027');
    await page.locator('#entitlement-round').selectOption('1');
    await page.locator('#entitlement-kind').selectOption('swap_right');
    await page
      .locator('#entitlement-description')
      .fill('Intentional conflict against existing swap controller');
    await openWizardEditorTab(reloadedModal, 'Swap');
    await page.locator('#entitlement-swapType').selectOption('worst_of');
    await page.locator('#entitlement-swapControllerPickId').fill('LAL_2031_R1');
    await page
      .locator('#entitlement-swapTargetDefinition')
      .fill('ATL own 2031 1st round pick');

    const conflictingApplyButton = reloadedModal.getByTestId('wizard-apply');
    await expect(conflictingApplyButton).toBeEnabled();
    await conflictingApplyButton.click();

    await expect(reloadedModal).toBeVisible();
    await expect(
      page.getByText(/Duplicate swap controller for LAL_2031_R1/i).first()
    ).toBeVisible();

    const afterConflictTeamDocument = await getWorldTeamDocument(
      worldId,
      'LAL'
    );
    const afterConflictEntitlementIds = Array.isArray(
      afterConflictTeamDocument?.entitlementIds
    )
      ? [...afterConflictTeamDocument.entitlementIds]
      : [];
    expect(afterConflictEntitlementIds).toEqual(afterCreateEntitlementIds);

    const afterConflictWorldEntitlements =
      await getWorldEntitlementDocuments(worldId);
    expect(afterConflictWorldEntitlements).toHaveLength(
      beforeWorldEntitlements.length + 1
    );
    expect(
      afterConflictWorldEntitlements.filter(
        (entitlement) =>
          entitlement.kind === 'swap_right' &&
          entitlement.swapControllerPickId === 'LAL_2031_R1'
      )
    ).toHaveLength(1);

    addAuditNote(
      testInfo,
      'This proves the real world-scoped entitlement authoring path end to end: Trade Machine opens the unified wizard, a new swap entitlement persists into architect_worlds/{worldId}/entitlements and attaches to LAL, the saved state survives reload and re-entry, and a conflicting swap-controller claim is then blocked fail-closed before any additional world write occurs.'
    );
    await captureEvidence(
      page,
      testInfo,
      'D-MQ-009-entitlement-authoring-proof'
    );

    const closeButton = reloadedModal.getByTestId('wizard-close');
    await closeButton.click();
    await expect(reloadedModal).not.toBeVisible();

    expect(beforeEntitlementIds.length + 1).toBe(
      afterCreateEntitlementIds.length
    );
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
