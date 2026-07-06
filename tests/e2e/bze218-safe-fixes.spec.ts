/**
 * FILE: tests/e2e/bze218-safe-fixes.spec.ts
 * PURPOSE: Browser proof for the BZE-218 safe-fix batch:
 *   1. Compare prints display names (never raw player ids) and a committed
 *      waive → re-sign of the same player lands under Additions.
 *   2. Team History side panels no longer contradict the timeline: a
 *      committed waive shows in the Waived & Stretched panel (canonical
 *      team.deadCap[] ledger), and timeline copy is humanized.
 *   3. Trade Machine Picks tab resolves the review-fixture entitlements
 *      (MIA carries 2027 R1 + R2) instead of showing 0.
 *
 * RUN:
 *   npm run architect:review:up   (harness on :5173)
 *   npx playwright test tests/e2e/bze218-safe-fixes.spec.ts --reporter=line
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import admin from 'firebase-admin';

const MIA_URL = '/gm/MIA';
const PLAYER_NAME = 'Tobias Lund';
const PLAYER_ID = 'mia_tobias_lund';
const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
const REVIEW_WORLD_SEASON = '2026-27';
const REVIEW_WORLD_AS_OF_DATE = '2026-07-01';

const DEV_LOCAL_STORAGE_FLAGS = {
  'hz.dev.capSheetFixtures': 'true',
  'hz.dev.offseasonPreview': 'true',
  'hz.dev.teamHistoryFixtures': 'true',
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const getReviewAdminDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_EMULATOR_HOST;
  const app =
    admin.apps.find((existingApp) => existingApp?.name === 'bze218-review') ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      'bze218-review'
    );
  return app.firestore();
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

const seedWorldMetadata = async (userId: string): Promise<string> => {
  const worldId = `world_bze218_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const now = admin.firestore.Timestamp.now();
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}`)
    .set({
      worldId,
      worldName: `BZE-218 Proof ${Date.now()}`,
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
  const modeBadge = page.getByTestId('firebase-target-mode-badge');
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasBadge = await isVisible(modeBadge, 1000);
        const hasNoTeam = await isVisible(noTeamData, 1000);
        return !stillLoading && (hasBadge || hasNoTeam);
      },
      {
        timeout: 60000,
        message: 'MIA dashboard should reach an interactive state',
      }
    )
    .toBe(true);
  await expect(noTeamData).toHaveCount(0);
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

const openDashboardTab = async (page: Page, label: string) => {
  const tab = page.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') });
  await expect(tab).toBeVisible();
  await tab.click();
};

test.describe('BZE-218 safe fixes', () => {
  test('waive → re-sign scenario: humanized copy, reconciled panels, additions, TM picks', async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);

    // Contract-action commits use native window.confirm — auto-accept.
    page.on('dialog', (dialog) => void dialog.accept());

    await page.addInitScript((flags) => {
      Object.entries(flags).forEach(([key, value]) => {
        window.localStorage.setItem(key, value);
      });
    }, DEV_LOCAL_STORAGE_FLAGS);

    await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);

    await expect
      .poll(async () => await readReviewUserId(page), {
        timeout: 25000,
        message: 'anonymous review uid should initialize',
      })
      .not.toBe('');
    const userId = await readReviewUserId(page);
    const worldId = await seedWorldMetadata(userId);
    await activateSeededWorld(page, userId, worldId);

    // ── Step 1: waive Tobias Lund from the Full Cap Table ──
    await openDashboardTab(page, 'Full Cap Table');

    const lundRow = page
      .locator('div')
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(`^${escapeRegExp(PLAYER_NAME)}$`, 'i'),
        }),
      })
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(`More actions for ${escapeRegExp(PLAYER_NAME)}`, 'i'),
        }),
      })
      .first();
    await expect(lundRow).toBeVisible({ timeout: 20000 });
    await lundRow.hover();
    await lundRow
      .getByRole('button', {
        name: new RegExp(`More actions for ${escapeRegExp(PLAYER_NAME)}`, 'i'),
      })
      .click();

    await page.getByTestId('cap-sheet-full-player-row-action-waive').click();
    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).toBeVisible();
    await expect(page.getByTestId('contract-action-waive')).toBeChecked();
    await page.getByRole('button', { name: /^Confirm Action$/i }).click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Waiver saved/i,
      { timeout: 20000 }
    );

    // Tobias Lund is a two-way with $0 guaranteed: the waive correctly writes
    // NO deadCap ledger entry, only the committed event. Wait for the event
    // so the History panel's event back-fill has data to read.
    await expect
      .poll(
        async () => {
          const eventDocs = await getReviewAdminDb()
            .collection(`architect_worlds/${worldId}/events`)
            .get();
          return eventDocs.docs.some((docSnapshot) => {
            const data = docSnapshot.data();
            const playerIds = Array.isArray(data.playerIds)
              ? data.playerIds
              : [];
            return (
              data.mutationType === 'waivePlayer' &&
              playerIds.includes(PLAYER_ID)
            );
          });
        },
        {
          timeout: 20000,
          message: 'committed waive should persist a waivePlayer world event',
        }
      )
      .toBe(true);

    // ── Step 2: Team History — timeline copy humanized + panel reconciled ──
    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();

    const timeline = page.getByTestId('team-history-section-timeline');
    await expect(timeline.getByText(/Waive Player/i).first()).toBeVisible({
      timeout: 20000,
    });
    // Humanized copy: the display name appears; the raw id does not.
    await expect(
      timeline.getByText(new RegExp(escapeRegExp(PLAYER_NAME))).first()
    ).toBeVisible();
    await expect(
      timeline.getByText(new RegExp(escapeRegExp(PLAYER_ID)))
    ).toHaveCount(0);

    // Side panel must not contradict the committed waive (BZE-217 finding).
    const waivePanel = page.getByTestId('team-history-section-waive');
    await expect(waivePanel).not.toContainText(/No waived contracts/i);
    await expect(waivePanel).toContainText(PLAYER_NAME);

    await page.screenshot({
      path: testInfo.outputPath('bze218-team-history-after-waive.png'),
    });

    // ── Step 3: re-sign the same player from the Free Agency pool ──
    await openDashboardTab(page, 'Free Agency');
    await expect(
      page.getByRole('heading', { name: /^Free Agent Pool$/i })
    ).toBeVisible();

    // The activity rail also renders a "Tobias Lund" chip; the pool row is
    // the <li> carrying the player avatar image.
    const freeAgentRow = page
      .locator('li')
      .filter({
        has: page.getByRole('img', {
          name: new RegExp(`^${escapeRegExp(PLAYER_NAME)}$`, 'i'),
        }),
      })
      .first();
    await expect(freeAgentRow).toBeVisible({ timeout: 20000 });
    await freeAgentRow
      .locator('button')
      .filter({ hasText: /•••/ })
      .first()
      .click();
    await page.getByRole('button', { name: /^Sign Free Agent$/i }).click();

    const contractModal = page.getByTestId('edit-contract-modal');
    await expect(contractModal).toBeVisible({ timeout: 20000 });
    const signRadio = contractModal.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    if (await isVisible(signRadio, 3000)) {
      await signRadio.check();
    }

    // The default prefill re-uses the old two-way salary ($597K), which the
    // CBA validator correctly rejects as below the veteran minimum (the exact
    // guard BZE-217 observed). Sign via the Minimum mechanism at 1 year so
    // the commit is legal.
    const mechanismSelect = contractModal
      .getByRole('combobox')
      .filter({ has: page.locator('option', { hasText: /^Minimum$/ }) })
      .first();
    await mechanismSelect.selectOption({ label: 'Minimum' });
    const yearsSelect = contractModal
      .getByRole('combobox')
      .filter({ has: page.locator('option', { hasText: /^1yr$/ }) })
      .first();
    await yearsSelect.selectOption({ label: '1yr' });

    // Fill the first-year salary with the exact minimum the validator
    // enforces. minimumSalaryScales.ts has no 2026-27 scale, so
    // getMinimumForYOS falls back to the projected rookie minimum
    // ($1,241,999 = 2025-26 rookie min × cap growth) for every YOS, and the
    // MINIMUM mechanism requires the salary to equal it exactly. The stale
    // two-way prefill ($597K) is correctly blocked — the guard BZE-217 saw.
    const minimumFirstYear = 1_241_999;
    const firstYearInput = contractModal
      .locator('div')
      .filter({ hasText: /^2026-27/ })
      .locator('input')
      .first();
    await firstYearInput.fill(String(minimumFirstYear));
    await firstYearInput.blur();

    const cbaAlert = contractModal.getByRole('alert').filter({
      hasText: /below CBA minimum/i,
    });
    await expect(cbaAlert).toHaveCount(0, { timeout: 15000 });

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeEnabled({ timeout: 15000 });
    await confirmActionButton.click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Free agent signed/i,
      { timeout: 20000 }
    );

    // ── Step 4: Compare — names shown, re-signing lands under Additions ──
    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /2\s+committed events/i,
      { timeout: 20000 }
    );

    const additions = page.getByTestId('comparison-roster-additions');
    const removals = page.getByTestId('comparison-roster-removals');

    // The committed re-signing is represented as an Addition…
    await expect(additions).toContainText(PLAYER_NAME, { timeout: 20000 });
    // …not as a Removal (the player is back on the roster)…
    await expect(removals).toContainText(/None detected/i);
    // …and no raw ids leak anywhere in the roster-delta cards.
    await expect(additions).not.toContainText(PLAYER_ID);
    await expect(removals).not.toContainText(PLAYER_ID);

    await page.screenshot({
      path: testInfo.outputPath('bze218-compare-after-resign.png'),
    });

    // ── Step 5: Trade Machine — Picks tab resolves fixture entitlements ──
    await page.goto(`${MIA_URL}?room=trade`, { waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);

    const picksTab = page
      .getByRole('button', { name: /^(Picks|Pck)\s+\(\d+\)$/i })
      .first();
    await expect(picksTab).toBeVisible({ timeout: 30000 });
    await expect(picksTab).not.toHaveText(/\(0\)/, { timeout: 20000 });
    await picksTab.click();

    await page.screenshot({
      path: testInfo.outputPath('bze218-trade-machine-picks.png'),
    });
  });
});
