/**
 * Focused browser proof for the standard free-agent signing V1 path.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-standard-fa-signing.spec.ts --reporter=line --workers=1
 */

import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import admin from 'firebase-admin';

const BOS_URL = '/gm/BOS';
const TEAM_CODE = 'BOS';
const REVIEW_FREE_AGENT_NAME = 'Review Offer Sheet Guard';
const REVIEW_FREE_AGENT_ID = 'review_offer_sheet_guard';
const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
const REVIEW_WORLD_SEASON = '2026-27';
const REVIEW_WORLD_AS_OF_DATE = '2026-07-08';
const DEV_LOCAL_STORAGE_FLAGS = {
  'hz.dev.capSheetFixtures': 'true',
  'hz.dev.offseasonPreview': 'true',
  'hz.dev.teamHistoryFixtures': 'true',
};

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const getReviewAdminDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_EMULATOR_HOST;

  const app =
    admin.apps.find(
      (existingApp) => existingApp.name === 'standard-fa-proof'
    ) ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      'standard-fa-proof'
    );

  return app.firestore();
};

const getBaseTeamDocument = async (teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_baseTeams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as
    | Record<string, unknown>
    | undefined;

const getWorldTeamDocument = async (worldId: string, teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as
    | Record<string, unknown>
    | undefined;

const getWorldPlayerDocument = async (
  worldId: string,
  teamCode: string,
  playerId: string
) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`)
    .get()
    .then((snapshot) => snapshot.data())) as
    | Record<string, unknown>
    | undefined;

const getWorldEventDocuments = async (worldId: string) =>
  (await getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/events`)
    .get()
    .then((snapshot) =>
      snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Record<string, unknown>),
        }))
        .sort((left, right) => {
          const leftTimestamp = Date.parse(
            String(left.occurredAt || left.timestamp || 0)
          );
          const rightTimestamp = Date.parse(
            String(right.occurredAt || right.timestamp || 0)
          );
          return rightTimestamp - leftTimestamp;
        })
    )) as Array<Record<string, unknown> & { id: string }>;

const getTeamPlayerIds = (
  teamDocument: Record<string, unknown> | undefined
) => {
  if (!teamDocument) return [] as string[];

  const rawPlayers = Array.isArray(teamDocument.players)
    ? teamDocument.players
    : Array.isArray(teamDocument.roster)
      ? teamDocument.roster
      : [];

  return rawPlayers
    .map((player) => {
      if (typeof player === 'string') return player;
      if (!player || typeof player !== 'object') return '';

      return String(
        (player as Record<string, unknown>).playerId ||
          (player as Record<string, unknown>).player_id ||
          (player as Record<string, unknown>).id ||
          ''
      );
    })
    .filter(Boolean);
};

const readReviewUserId = async (page: Page): Promise<string> =>
  page
    .evaluate(
      () =>
        new Promise<string>((resolve) => {
          let settled = false;
          const finish = (value: string) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          const timer = setTimeout(() => finish(''), 4000);
          try {
            const request = indexedDB.open('firebaseLocalStorageDb');
            request.onerror = () => {
              clearTimeout(timer);
              finish('');
            };
            request.onsuccess = () => {
              const idb = request.result;
              try {
                const store = idb
                  .transaction('firebaseLocalStorage', 'readonly')
                  .objectStore('firebaseLocalStorage');
                const getAll = store.getAll();
                getAll.onerror = () => {
                  clearTimeout(timer);
                  finish('');
                };
                getAll.onsuccess = () => {
                  clearTimeout(timer);
                  const records = (getAll.result || []) as Array<{
                    fbase_key?: string;
                    value?: { uid?: string } | string;
                  }>;
                  const authRecord = records.find((record) =>
                    String(record.fbase_key || '').includes('authUser')
                  );
                  let value: { uid?: string } | string | undefined =
                    authRecord?.value;
                  if (typeof value === 'string') {
                    try {
                      value = JSON.parse(value) as { uid?: string };
                    } catch {
                      value = undefined;
                    }
                  }
                  finish(
                    value &&
                      typeof value === 'object' &&
                      typeof value.uid === 'string'
                      ? value.uid
                      : ''
                  );
                };
              } catch {
                clearTimeout(timer);
                finish('');
              }
            };
          } catch {
            clearTimeout(timer);
            finish('');
          }
        })
    )
    .catch(() => '');

const readActiveWorldId = async (page: Page) =>
  page
    .evaluate(() => {
      const storageKey = Object.keys(window.localStorage).find((key) =>
        key.startsWith('architect.activeWorldId.')
      );

      return storageKey ? window.localStorage.getItem(storageKey) || '' : '';
    })
    .catch(() => '');

const governedSalaryBookInputs = () => {
  const line = (
    ledger: 'apron-team-salary' | 'tax-salary',
    leafId: string,
    amount: number,
    effectiveFrom = '2026-07-01T00:00:00Z'
  ) => ({
    id: `${ledger}:${leafId}`,
    ledger,
    label: leafId,
    amount,
    effectiveFrom,
    canonLeafIds: [leafId],
    source: {
      authority: 'external-determination',
      reference: `review-fixture:${leafId}`,
    },
  });
  return {
    version: 1,
    salaryCapYear: 2027,
    incompleteRosterCharge: {
      id: 'team-salary:incomplete-roster',
      ledger: 'team-salary',
      label: 'Eleven governed incomplete-roster charges',
      amount: 11 * 1_357_763,
      effectiveFrom: '2026-07-01T00:00:00Z',
      canonLeafIds: ['CBA2-A01.1'],
      source: {
        authority: 'external-determination',
        reference: 'review-fixture:2026-27-rookie-minimum',
      },
    },
    apronAdjustments: {
      status: 'ready',
      lineItems: [
        line('apron-team-salary', 'CBA2-C07.2', 1_000_000),
        ...Array.from({ length: 8 }, (_, index) =>
          line('apron-team-salary', `CBA2-C07.${index + 3}`, 0)
        ),
        line(
          'apron-team-salary',
          'CBA2-C07.11',
          -(11 * 1_357_763)
        ),
      ],
    },
    taxSalary: {
      status: 'ready',
      lineItems: [
        line(
          'tax-salary',
          'CBA2-C08.1',
          182_000_000,
          '2026-04-12T19:00:00-04:00'
        ),
        ...Array.from({ length: 7 }, (_, index) =>
          line('tax-salary', `CBA2-C08.${index + 2}`, 0)
        ),
      ],
    },
  };
};

const seedReviewWorld = async (
  userId: string,
  asOfDate = REVIEW_WORLD_AS_OF_DATE
): Promise<string> => {
  const worldId = `world_standard_fa_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const now = admin.firestore.Timestamp.now();
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}`)
    .set({
      worldId,
      worldName: `Standard FA Proof ${Date.now()}`,
      description: '',
      createdBy: userId,
      createdAt: now,
      lastModifiedAt: now,
      currentSeason: REVIEW_WORLD_SEASON,
      baselineSeason: REVIEW_WORLD_SEASON,
      asOfDate,
      parentWorldId: null,
      branchedFrom: null,
      childWorlds: [],
      modifiedTeams: [],
      actionCount: 0,
      tags: [],
      isArchived: false,
      isFavorite: false,
      stats: {
        totalTrades: 0,
        totalSignings: 0,
        totalWaives: 0,
        totalRenounces: 0,
        teamsInvolved: 0,
      },
      contractBaselineVersion: 2,
      contractSourceRelease: {
        releaseId: 'review-contract-source-release',
        releaseVersion: 1,
        releaseDigest: `sha256:${'1'.repeat(64)}`,
      },
      contractBaselineEffectiveAt: '2026-06-05T12:19:56.526Z',
      contractBaselineSalaryCapYear: 2026,
      contractBaselineCoverage: {
        total: 0,
        complete: 0,
        needsInput: 0,
      },
    });
  return worldId;
};

const seedGovernedBosWorldTeam = async (worldId: string) => {
  const baseTeam = await getBaseTeamDocument(TEAM_CODE);
  if (!baseTeam) {
    throw new Error(`Base Team ${TEAM_CODE} is unavailable in review mode.`);
  }
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${TEAM_CODE}`)
    .set({
      ...baseTeam,
      season: REVIEW_WORLD_SEASON,
      salaryBookInputs: governedSalaryBookInputs(),
    });
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}`)
    .update({
      modifiedTeams: [TEAM_CODE],
    });
};

const waitForBosDashboard = async (page: Page) => {
  const fullCapTab = page.getByRole('tab', { name: /^Full Cap Table$/i });
  const freeAgencyTab = page.getByRole('tab', { name: /^Free Agency$/i });
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasFullCapTab = await isVisible(fullCapTab, 1000);
        const hasFreeAgencyTab = await isVisible(freeAgencyTab, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        return (
          !stillLoading && (hasFullCapTab || hasFreeAgencyTab || hasNoTeamData)
        );
      },
      {
        timeout: 60000,
        message: 'BOS review dashboard should reach an interactive state',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'BOS review fixture should be seeded before standard FA proof'
  ).toBe(false);
};

const activateSeededWorld = async (
  page: Page,
  userId: string,
  worldId: string
) => {
  await page.evaluate(
    ({ uid, wid }) => {
      window.localStorage.setItem(`architect.activeWorldId.${uid}`, wid);
    },
    { uid: userId, wid: worldId }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBosDashboard(page);

  const worldMenuTrigger = page.getByTestId('cockpit-world-menu-trigger');
  await expect(worldMenuTrigger).toBeVisible({ timeout: 20000 });
  await expect
    .poll(
      async () =>
        ((await worldMenuTrigger.textContent()) || '').includes('Sandbox'),
      {
        timeout: 20000,
        message: `cockpit should leave Sandbox after restoring ${worldId}`,
      }
    )
    .toBe(false);
};

const ensureWorldSelected = async (
  page: Page,
  asOfDate = REVIEW_WORLD_AS_OF_DATE
) => {
  await expect
    .poll(async () => await readReviewUserId(page), {
      timeout: 25000,
      message: 'anonymous review uid should initialize',
    })
    .not.toBe('');

  const userId = await readReviewUserId(page);
  const worldId = await seedReviewWorld(userId, asOfDate);
  await seedGovernedBosWorldTeam(worldId);
  await activateSeededWorld(page, userId, worldId);
  await ensureSpecificWorldSelected(page, worldId);
  return worldId;
};

const ensureSpecificWorldSelected = async (page: Page, worldId: string) => {
  await expect
    .poll(async () => await readActiveWorldId(page), {
      timeout: 10000,
      message: `world ${worldId} should remain active after reload`,
    })
    .toBe(worldId);
};

const enableDevAuditFlags = async (page: Page) => {
  await page.addInitScript((flags) => {
    Object.entries(flags).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  }, DEV_LOCAL_STORAGE_FLAGS);
};

const openDashboardTab = async (page: Page, label: string) => {
  const tab = page.getByRole('tab', {
    name: new RegExp(`^${label}$`, 'i'),
  });
  await expect(tab).toBeVisible();
  await tab.click();
};

const standardFreeAgentRow = (page: Page): Locator =>
  page.locator('li').filter({
    has: page.getByText(new RegExp(`^${REVIEW_FREE_AGENT_NAME}$`, 'i')),
  });

const openStandardFreeAgentModal = async (page: Page) => {
  await openDashboardTab(page, 'Free Agency');
  await expect(
    page.getByRole('heading', { name: /^Free Agent Pool$/i })
  ).toBeVisible();

  const freeAgentRow = standardFreeAgentRow(page);
  await expect(freeAgentRow).toBeVisible({ timeout: 15000 });

  const menuButton = freeAgentRow
    .locator('button')
    .filter({ hasText: /\u2022\u2022\u2022/ })
    .first();
  await menuButton.scrollIntoViewIfNeeded();
  await menuButton.click();

  const signAction = page.getByRole('button', {
    name: /^Sign Free Agent$/i,
  });
  await expect(signAction).toBeVisible();
  await expect(signAction).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await signAction.click();

  const modal = page.getByTestId('edit-contract-modal');
  await expect(modal).toBeVisible({ timeout: 20000 });
  return modal;
};

const openFullCapStandardFreeAgentModal = async (page: Page) => {
  await openDashboardTab(page, 'Full Cap Table');

  const launcher = page.getByTestId('cap-sheet-full-sign-free-agent-button');
  await expect(launcher).toBeVisible({ timeout: 15000 });
  await expect(launcher).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await expect(launcher).not.toContainText(/Preview/i);
  await launcher.click();

  const fullCapModal = page.getByTestId('full-cap-free-agent-modal');
  await expect(fullCapModal).toBeVisible({ timeout: 20000 });
  await expect(fullCapModal).toContainText(/V1 supported/i);
  await expect(fullCapModal.getByText(/Preview only/i)).toHaveCount(0);
  await expect(fullCapModal.getByText(/Start Preview Signing/i)).toHaveCount(0);

  await fullCapModal.getByPlaceholder('Search pool').fill('Review Offer');
  const targetRow = fullCapModal.locator('li').filter({
    hasText: REVIEW_FREE_AGENT_NAME,
  });
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  await expect(
    targetRow.getByText(REVIEW_FREE_AGENT_NAME).first()
  ).toBeVisible();

  const inlineSignButton = targetRow.getByRole('button', {
    name: new RegExp(`^Sign ${REVIEW_FREE_AGENT_NAME}$`, 'i'),
  });
  await expect(inlineSignButton).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );

  await targetRow
    .getByRole('button', {
      name: new RegExp(`^${REVIEW_FREE_AGENT_NAME}`, 'i'),
    })
    .first()
    .click();

  const startSigningButton = fullCapModal.getByRole('button', {
    name: /^Start Signing$/i,
  });
  await expect(startSigningButton).toBeEnabled();
  await expect(startSigningButton).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await startSigningButton.click();

  const contractModal = page.getByTestId('edit-contract-modal');
  await expect(contractModal).toBeVisible({ timeout: 20000 });
  return contractModal;
};

test.describe('ARCH-STANDARD-FA: saved-world signing proof', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await page.goto(BOS_URL, { waitUntil: 'domcontentloaded' });
    await waitForBosDashboard(page);
  });

  test('BOS Free Agency row signs a standard FA, persists, and reloads', async ({
    page,
  }, testInfo: TestInfo) => {
    const worldId = await ensureWorldSelected(page);

    const beforeBaseTeamDocument = await getBaseTeamDocument(TEAM_CODE);
    expect(getTeamPlayerIds(beforeBaseTeamDocument)).not.toContain(
      REVIEW_FREE_AGENT_ID
    );

    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '3 / 15'
    );

    const modal = await openStandardFreeAgentModal(page);
    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).toBeVisible();
    const signFreeAgentRadio = modal.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
    await expect(modal.getByText(/^Sign Free Agent$/i).first()).toBeVisible();
    await expect(modal.getByText(/Sign Free Agent \(Preview\)/i)).toHaveCount(
      0
    );
    await expect(page.getByLabel(/^Offer Sheet$/i)).toHaveCount(0);

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeVisible();
    await expect(confirmActionButton).toBeDisabled();
    await signFreeAgentRadio.check();
    await expect(
      page.getByRole('heading', { name: /^New Contract Preview$/i })
    ).toBeVisible();
    await expect(confirmActionButton).toBeEnabled();
    await confirmActionButton.click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Free agent signed/i,
      { timeout: 20000 }
    );
    await expect(
      page.getByText(/Roster count changed 3 -> 4/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Cap space changed -\$3,442,237/i).first()
    ).toBeVisible();
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '4 / 15'
    );

    const persistedTeamDocument = await getWorldTeamDocument(
      worldId,
      TEAM_CODE
    );
    expect(getTeamPlayerIds(persistedTeamDocument)).toContain(
      REVIEW_FREE_AGENT_ID
    );
    const persistedPlayerDocument = await getWorldPlayerDocument(
      worldId,
      TEAM_CODE,
      REVIEW_FREE_AGENT_ID
    );
    expect(
      (persistedPlayerDocument?.contract as Record<string, unknown>)
        ?.signingDate
    ).toBe(REVIEW_WORLD_AS_OF_DATE);
    const contractLedgers = persistedTeamDocument?.contractEventLedgers;
    expect(Array.isArray(contractLedgers)).toBe(true);
    expect(JSON.stringify(contractLedgers)).toContain('saved-world-signing');
    expect(JSON.stringify(contractLedgers)).toContain(REVIEW_WORLD_AS_OF_DATE);

    const salaryBooks = (
      persistedTeamDocument?.totals as Record<string, unknown> | undefined
    )?.salaryBooks as Record<string, unknown> | undefined;
    const ledgers = salaryBooks?.ledgers as
      | Record<string, Record<string, unknown>>
      | undefined;
    const bookTotals = [
      ledgers?.teamSalary?.total,
      ledgers?.apronTeamSalary?.total,
      ledgers?.taxSalary?.total,
    ];
    expect(bookTotals.every((value) => typeof value === 'number')).toBe(true);
    expect(new Set(bookTotals).size).toBe(3);

    const persistedEvents = await getWorldEventDocuments(worldId);
    const signingEvent = persistedEvents.find(
      (event) => event.mutationType === 'signFreeAgent'
    );
    expect(signingEvent).toBeTruthy();

    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.locator('body')).toContainText(/Review\s*Offer\s+Sheet/i);

    await openDashboardTab(page, 'Roster');
    await expect(page.locator('body')).toContainText(/Review\s*Offer\s+Sheet/i);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/Signed Free Agent/i).first()).toBeVisible();
    await expect(page.getByText(/signFreeAgent/i).first()).toBeVisible();

    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /1\s+committed event/i,
      { timeout: 20000 }
    );
    await expect(page.getByTestId('comparison-changed-teams')).toContainText(
      /1\s+team changed/i
    );
    await expect(page.getByTestId('comparison-changed-players')).toContainText(
      /1\s+player touched/i
    );
    // BZE-218: Compare prints owner-facing display names, not raw player ids.
    await expect(page.getByTestId('comparison-roster-additions')).toContainText(
      REVIEW_FREE_AGENT_NAME
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForBosDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    await openDashboardTab(page, 'Roster');
    await expect(page.locator('body')).toContainText(/Review\s*Offer\s+Sheet/i);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '4 / 15'
    );
    const persistedTeamDocumentAfterReload = await getWorldTeamDocument(
      worldId,
      TEAM_CODE
    );
    expect(getTeamPlayerIds(persistedTeamDocumentAfterReload)).toContain(
      REVIEW_FREE_AGENT_ID
    );
    expect(persistedTeamDocumentAfterReload?.contractEventLedgers).toEqual(
      contractLedgers
    );

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Signed Free Agent/i).first()).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('governed-signing-success-1280x720.png'),
      fullPage: false,
    });

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BOS saved-world Free Agency row signs Review Offer Sheet Guard through the standard signFreeAgent action, publishes receipt/cockpit deltas, appears in Full Cap Table and Roster, records History and Compare evidence, and reloads from the saved world.',
    });
  });

  test('BOS ordinary signing fails closed during the Moratorium with no write', async ({
    page,
  }, testInfo: TestInfo) => {
    const worldId = await ensureWorldSelected(page, '2026-07-01');
    const beforeTeam = await getWorldTeamDocument(worldId, TEAM_CODE);
    const beforeEvents = await getWorldEventDocuments(worldId);
    const beforePlayer = await getWorldPlayerDocument(
      worldId,
      TEAM_CODE,
      REVIEW_FREE_AGENT_ID
    );

    const modal = await openStandardFreeAgentModal(page);
    await modal.getByRole('radio', { name: /Sign Free Agent/i }).check();
    const confirmActionButton = modal.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeEnabled();
    await confirmActionButton.click();

    const moratoriumAlert = modal.getByRole('alert');
    await expect(moratoriumAlert).toContainText(/Moratorium/i, {
      timeout: 20000,
    });
    expect(await getWorldTeamDocument(worldId, TEAM_CODE)).toEqual(beforeTeam);
    expect(await getWorldEventDocuments(worldId)).toEqual(beforeEvents);
    expect(
      await getWorldPlayerDocument(worldId, TEAM_CODE, REVIEW_FREE_AGENT_ID)
    ).toEqual(beforePlayer);
    await moratoriumAlert.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: testInfo.outputPath('governed-signing-fail-closed-1280x720.png'),
      fullPage: false,
    });
    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BOS ordinary Veteran signing at saved-world date 2026-07-01 reports the Moratorium boundary and leaves the Team, player override, and immutable world-event collection unchanged.',
    });
  });

  test('BOS Full Cap launcher signs a standard FA, persists, and reloads', async ({
    page,
  }, testInfo: TestInfo) => {
    const worldId = await ensureWorldSelected(page);

    const beforeBaseTeamDocument = await getBaseTeamDocument(TEAM_CODE);
    expect(getTeamPlayerIds(beforeBaseTeamDocument)).not.toContain(
      REVIEW_FREE_AGENT_ID
    );

    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '3 / 15'
    );

    const modal = await openFullCapStandardFreeAgentModal(page);
    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).toBeVisible();
    const signFreeAgentRadio = modal.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
    await expect(modal.getByText(/^Sign Free Agent$/i).first()).toBeVisible();
    await expect(modal.getByText(/Sign Free Agent \(Preview\)/i)).toHaveCount(
      0
    );
    await expect(page.getByLabel(/^Offer Sheet$/i)).toHaveCount(0);

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeVisible();
    await expect(confirmActionButton).toBeDisabled();
    await signFreeAgentRadio.check();
    await expect(
      page.getByRole('heading', { name: /^New Contract Preview$/i })
    ).toBeVisible();
    await expect(confirmActionButton).toBeEnabled();
    await confirmActionButton.click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Free agent signed/i,
      { timeout: 20000 }
    );
    await expect(
      page.getByText(/Roster count changed 3 -> 4/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Cap space changed -\$3,442,237/i).first()
    ).toBeVisible();
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '4 / 15'
    );

    const persistedTeamDocument = await getWorldTeamDocument(
      worldId,
      TEAM_CODE
    );
    expect(getTeamPlayerIds(persistedTeamDocument)).toContain(
      REVIEW_FREE_AGENT_ID
    );

    const persistedEvents = await getWorldEventDocuments(worldId);
    const signingEvent = persistedEvents.find(
      (event) => event.mutationType === 'signFreeAgent'
    );
    expect(signingEvent).toBeTruthy();

    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.locator('body')).toContainText(/Review\s*Offer\s+Sheet/i);
    await expect(
      page.getByTestId('cap-sheet-full-sign-free-agent-button')
    ).toHaveAttribute('data-action-exposure-classification', 'V1 supported');

    await openDashboardTab(page, 'Roster');
    await expect(page.locator('body')).toContainText(/Review\s*Offer\s+Sheet/i);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/Signed Free Agent/i).first()).toBeVisible();
    await expect(page.getByText(/signFreeAgent/i).first()).toBeVisible();

    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /1\s+committed event/i,
      { timeout: 20000 }
    );
    await expect(page.getByTestId('comparison-changed-teams')).toContainText(
      /1\s+team changed/i
    );
    await expect(page.getByTestId('comparison-changed-players')).toContainText(
      /1\s+player touched/i
    );
    // BZE-218: Compare prints owner-facing display names, not raw player ids.
    await expect(page.getByTestId('comparison-roster-additions')).toContainText(
      REVIEW_FREE_AGENT_NAME
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForBosDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    await openDashboardTab(page, 'Roster');
    await expect(page.locator('body')).toContainText(/Review\s*Offer\s+Sheet/i);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '4 / 15'
    );
    const persistedTeamDocumentAfterReload = await getWorldTeamDocument(
      worldId,
      TEAM_CODE
    );
    expect(getTeamPlayerIds(persistedTeamDocumentAfterReload)).toContain(
      REVIEW_FREE_AGENT_ID
    );

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BOS saved-world Full Cap Table launches Sign Free Agent for Review Offer Sheet Guard, reaches the standard signFreeAgent contract modal, publishes receipt/cockpit deltas, appears in Full Cap Table and Roster, records History and Compare evidence, and reloads from the saved world.',
    });
  });
});
