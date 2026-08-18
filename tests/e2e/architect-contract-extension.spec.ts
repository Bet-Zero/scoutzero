/**
 * Focused browser proof for the Full Cap Table Contract Extension V1 path.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-contract-extension.spec.ts --reporter=line --workers=1
 */

import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import admin from 'firebase-admin';

const MIA_URL = '/gm/MIA?season=2029';
const TEAM_CODE = 'MIA';
const PLAYER_NAME = 'Marcus Vance';
const PLAYER_ID = 'mia_marcus_vance';
const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
const REVIEW_WORLD_SEASON = '2028-29';
const REVIEW_WORLD_AS_OF_DATE = '2028-07-15';
const DEV_LOCAL_STORAGE_FLAGS = {
  'hz.dev.capSheetFixtures': 'true',
  'hz.dev.offseasonPreview': 'true',
  'hz.dev.teamHistoryFixtures': 'true',
};

type RecordLike = Record<string, unknown>;

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const getReviewAdminDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_EMULATOR_HOST;

  const app =
    admin.apps.find(
      (existingApp) => existingApp.name === 'contract-extension-proof'
    ) ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      'contract-extension-proof'
    );

  return app.firestore();
};

const getWorldTeamDocument = async (worldId: string, teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

const getWorldEventDocuments = async (worldId: string) =>
  (await getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/events`)
    .get()
    .then((snapshot) =>
      snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as RecordLike),
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
    )) as Array<RecordLike & { id: string }>;

const getExtensionEvent = async (worldId: string) => {
  const events = await getWorldEventDocuments(worldId);

  return events.find((event) => {
    const eventText = JSON.stringify(event);
    return event.mutationType === 'extendPlayer' && eventText.includes(PLAYER_ID);
  });
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

const seedReviewWorld = async (userId: string) => {
  const worldId = `world_contract_extension_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const now = admin.firestore.Timestamp.now();
  await getReviewAdminDb().doc(`architect_worlds/${worldId}`).set({
    worldId,
    worldName: `Contract Extension Proof ${Date.now()}`,
    description: '',
    createdBy: userId,
    createdAt: now,
    lastModifiedAt: now,
    currentSeason: REVIEW_WORLD_SEASON,
    baselineSeason: REVIEW_WORLD_SEASON,
    asOfDate: REVIEW_WORLD_AS_OF_DATE,
    parentWorldId: null,
    branchedFrom: null,
    childWorlds: [],
    modifiedTeams: [],
    actionCount: 0,
    tags: [],
    isArchived: false,
    isFavorite: false,
    contractBaselineVersion: 2,
    contractSourceRelease: {
      releaseId: 'bze-282-browser-empty-release',
      releaseVersion: 1,
      releaseDigest: `sha256:${'8'.repeat(64)}`,
    },
    contractBaselineEffectiveAt: '2028-07-15T12:00:00-04:00',
    contractBaselineSalaryCapYear: 2029,
    contractBaselineCoverage: {
      total: 0,
      complete: 0,
      needsInput: 0,
    },
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      totalRenounces: 0,
      teamsInvolved: 0,
    },
  });
  return worldId;
};

const waitForMiaDashboard = async (page: Page) => {
  const fullCapTab = page.getByRole('tab', { name: /^Full Cap Table$/i });
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
        message: 'MIA review dashboard should reach an interactive state',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'MIA review fixture should be seeded before extension proof'
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
  await waitForMiaDashboard(page);

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

const ensureWorldSelected = async (page: Page) => {
  await expect
    .poll(async () => await readReviewUserId(page), {
      timeout: 25000,
      message: 'anonymous review uid should initialize',
    })
    .not.toBe('');

  const userId = await readReviewUserId(page);
  const worldId = await seedReviewWorld(userId);
  await activateSeededWorld(page, userId, worldId);
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

const extensionPlayerRow = (page: Page): Locator =>
  page.locator('[data-cap-fit-row]').filter({
    has: page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: PLAYER_NAME }),
  });

const openContractExtensionModal = async (page: Page) => {
  await openDashboardTab(page, 'Full Cap Table');

  const row = extensionPlayerRow(page).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText(PLAYER_NAME);
  await row.getByTestId('cap-sheet-full-player-row-button').hover();

  await page
    .getByRole('button', {
      name: new RegExp(`More actions for ${PLAYER_NAME}`, 'i'),
    })
    .click();

  const overflowMenu = page.getByTestId(
    'cap-sheet-full-player-row-overflow-menu'
  );
  await expect(overflowMenu).toBeVisible();

  const extendAction = overflowMenu.getByTestId(
    'cap-sheet-full-player-row-action-extend'
  );
  await expect(extendAction).toBeVisible();
  await expect(extendAction).toHaveText(/^Extend$/i);
  await expect(extendAction).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await extendAction.click();

  const modal = page.getByTestId('edit-contract-modal');
  await expect(modal).toBeVisible({ timeout: 20000 });
  await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
    /Extension Needs Input/i
  );
  await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
    PLAYER_NAME
  );
  await expect(
    modal.getByText(/^Extension Needs Input$/i).first()
  ).toBeVisible();
  await expect(modal.getByText(/Extend Contract \(Preview\)/i)).toHaveCount(0);
  await expect(modal.getByText(/Sign & Trade/i)).toHaveCount(0);
  await expect(page.getByLabel(/^Offer Sheet$/i)).toHaveCount(0);

  return modal;
};

test.describe('ARCH-CONTRACT-EXTENSION: Full Cap saved-world proof', () => {
  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
  });

  test('MIA Full Cap row fails closed without governed extension evidence and reloads unchanged', async ({
    page,
  }, testInfo: TestInfo) => {
    const worldId = await ensureWorldSelected(page);
    const teamBefore = await getWorldTeamDocument(worldId, TEAM_CODE);
    const eventsBefore = await getWorldEventDocuments(worldId);

    const modal = await openContractExtensionModal(page);
    const extendRadio = modal.getByTestId('contract-action-extend');
    await expect(extendRadio).toBeChecked();
    await expect(extendRadio).toBeDisabled();
    await expect(modal.getByText(/Needs governed input/i).first()).toBeVisible();
    await expect(
      modal.getByText(/No pinned governed Contract matches this player/i).first()
    ).toBeVisible();
    await expect(
      modal.getByTestId('edit-contract-confirm-action-button')
    ).toBeDisabled();
    await expect(
      modal.getByTestId('edit-contract-confirm-action-button')
    ).toHaveText(/Authoritative Preflight Pending/i);
    await expect(modal.getByText(/Advanced: Override Validation/i)).toHaveCount(
      0
    );

    expect(await getExtensionEvent(worldId)).toBeUndefined();
    expect(await getWorldTeamDocument(worldId, TEAM_CODE)).toEqual(teamBefore);
    expect(await getWorldEventDocuments(worldId)).toEqual(eventsBefore);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    const reloadedModal = await openContractExtensionModal(page);
    await expect(
      reloadedModal.getByTestId('edit-contract-confirm-action-button')
    ).toBeDisabled();
    await expect(
      reloadedModal.getByText(/Needs governed input/i).first()
    ).toBeVisible();
    expect(await getExtensionEvent(worldId)).toBeUndefined();
    expect(await getWorldTeamDocument(worldId, TEAM_CODE)).toEqual(teamBefore);
    expect(await getWorldEventDocuments(worldId)).toEqual(eventsBefore);

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'MIA saved-world Full Cap Table extension fails closed when the pinned baseline lacks authenticated contract and league evidence; the action cannot be overridden, creates no event or team write, and remains blocked after reload.',
    });
  });
});
