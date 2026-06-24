/**
 * Focused browser proof for the Full Cap Table Team Option V1 path.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-option-decision.spec.ts --reporter=line --workers=1
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import admin from 'firebase-admin';

const MIA_URL = '/gm/MIA?season=2027';
const TEAM_CODE = 'MIA';
const PLAYER_NAME = 'Andre Cole';
const PLAYER_ID = 'mia_andre_cole';
const TEAM_OPTION_SEASON = '2027-28';
const OPTION_TARGET_YEAR = 2028;
const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
const REVIEW_WORLD_SEASON = '2026-27';
const REVIEW_WORLD_AS_OF_DATE = '2026-07-01';
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
      (existingApp) => existingApp.name === 'option-decision-proof'
    ) ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      'option-decision-proof'
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

const getPlayerIdFromEntry = (entry: unknown) => {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';

  const record = entry as RecordLike;
  return String(record.playerId || record.player_id || record.id || '');
};

const getTeamPlayerIds = (teamDocument: RecordLike | undefined) => {
  if (!teamDocument) return [] as string[];

  const rawPlayers = Array.isArray(teamDocument.players)
    ? teamDocument.players
    : Array.isArray(teamDocument.roster)
      ? teamDocument.roster
      : [];

  return rawPlayers.map(getPlayerIdFromEntry).filter(Boolean);
};

const findTeamPlayer = (
  teamDocument: RecordLike | undefined,
  playerId: string
) => {
  const players = Array.isArray(teamDocument?.players)
    ? teamDocument.players
    : [];

  return players.find((player) => getPlayerIdFromEntry(player) === playerId) as
    | RecordLike
    | undefined;
};

const getOptionSalaryRow = (
  teamDocument: RecordLike | undefined,
  playerId: string
) => {
  const player = findTeamPlayer(teamDocument, playerId);
  const contract =
    player?.contract && typeof player.contract === 'object'
      ? (player.contract as RecordLike)
      : null;
  const salaries = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];

  return salaries.find((row) => {
    if (!row || typeof row !== 'object') return false;
    const record = row as RecordLike;
    return (
      String(record.season || '') === TEAM_OPTION_SEASON ||
      Number(record.year) === OPTION_TARGET_YEAR
    );
  }) as RecordLike | undefined;
};

const getCapHold = (
  teamDocument: RecordLike | undefined,
  playerId: string
) => {
  const capHolds = Array.isArray(teamDocument?.capHolds)
    ? teamDocument.capHolds
    : [];

  return capHolds.find((hold) => {
    if (!hold || typeof hold !== 'object') return false;
    return String((hold as RecordLike).playerId || '') === playerId;
  }) as RecordLike | undefined;
};

const getOptionDecisionEvent = async (
  worldId: string,
  accepted: boolean
) => {
  const events = await getWorldEventDocuments(worldId);

  return events.find((event) => {
    const metadata =
      event.metadata && typeof event.metadata === 'object'
        ? (event.metadata as RecordLike)
        : event.mutationMetadata && typeof event.mutationMetadata === 'object'
          ? (event.mutationMetadata as RecordLike)
          : {};
    const payload =
      event.payload && typeof event.payload === 'object'
        ? (event.payload as RecordLike)
        : {};
    const eventText = JSON.stringify(event);

    return (
      event.mutationType === 'optionDecision' &&
      eventText.includes(PLAYER_ID) &&
      [metadata.accepted, payload.accepted, event.accepted].includes(accepted)
    );
  });
};

const waitForOptionDecisionEvent = async (
  worldId: string,
  accepted: boolean
) => {
  await expect
    .poll(async () => Boolean(await getOptionDecisionEvent(worldId, accepted)), {
      timeout: 20000,
      message: `optionDecision event should persist for ${PLAYER_ID}`,
    })
    .toBe(true);
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

const seedReviewWorld = async (userId: string, label: string) => {
  const worldId = `world_option_decision_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const now = admin.firestore.Timestamp.now();
  await getReviewAdminDb().doc(`architect_worlds/${worldId}`).set({
    worldId,
    worldName: `Option Decision Proof ${label}`,
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
    'MIA review fixture should be seeded before option proof'
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

const ensureWorldSelected = async (page: Page, label: string) => {
  await expect
    .poll(async () => await readReviewUserId(page), {
      timeout: 25000,
      message: 'anonymous review uid should initialize',
    })
    .not.toBe('');

  const userId = await readReviewUserId(page);
  const worldId = await seedReviewWorld(userId, label);
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

const optionDecisionRow = (page: Page): Locator =>
  page.locator('[data-cap-fit-row]').filter({
    has: page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: PLAYER_NAME }),
  });

const openTeamOptionModal = async (page: Page) => {
  await openDashboardTab(page, 'Full Cap Table');

  const row = optionDecisionRow(page).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText(PLAYER_NAME);

  const teamOptionCell = row
    .locator(
      '[title="Manage Team Option"], [title="Preview: manage Team Option"]'
    )
    .first();
  await expect(teamOptionCell).toBeVisible({ timeout: 15000 });
  await expect(teamOptionCell).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await expect(teamOptionCell).toHaveAttribute('title', 'Manage Team Option');
  await teamOptionCell.click();

  const modal = page.getByTestId('edit-contract-modal');
  await expect(modal).toBeVisible({ timeout: 20000 });
  await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
    PLAYER_NAME
  );
  await expect(modal.getByTestId('contract-modal-action-context')).toContainText(
    TEAM_OPTION_SEASON
  );
  await expect(modal.getByText(/^Accept Option$/i).first()).toBeVisible();
  await expect(modal.getByText(/^Decline Option$/i).first()).toBeVisible();
  await expect(modal.getByText(/Accept Option \(Preview\)/i)).toHaveCount(0);
  await expect(modal.getByText(/Decline Option \(Preview\)/i)).toHaveCount(0);
  await expect(
    modal.getByText(/Sign New Contract \(Preview\)/i).first()
  ).toBeVisible();

  return modal;
};

const commitOptionDecision = async (
  page: Page,
  modal: Locator,
  worldId: string,
  decision: 'Accept' | 'Decline'
) => {
  await modal
    .getByRole('radio', { name: new RegExp(`${decision} Option`, 'i') })
    .check();
  const confirmActionButton = modal.getByTestId(
    'edit-contract-confirm-action-button'
  );
  await expect(confirmActionButton).toBeEnabled();
  await confirmActionButton.click();
  await expect(modal).toHaveCount(0, { timeout: 20000 });
  await waitForOptionDecisionEvent(worldId, decision === 'Accept');
};

test.describe('ARCH-OPTION-DECISION: Full Cap Team Option saved-world proof', () => {
  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
  });

  test('MIA Full Cap Team Option accepts, persists, and reloads', async ({
    page,
  }) => {
    const worldId = await ensureWorldSelected(page, 'Accept');

    const modal = await openTeamOptionModal(page);
    await commitOptionDecision(page, modal, worldId, 'Accept');

    const persistedTeamDocument = await getWorldTeamDocument(worldId, TEAM_CODE);
    expect(getTeamPlayerIds(persistedTeamDocument)).toContain(PLAYER_ID);
    expect(getOptionSalaryRow(persistedTeamDocument, PLAYER_ID)?.optionUsed).toBe(
      true
    );

    const optionDecisionEvent = await getOptionDecisionEvent(worldId, true);
    expect(optionDecisionEvent).toBeTruthy();

    await openDashboardTab(page, 'Full Cap Table');
    await expect(optionDecisionRow(page).first()).toContainText(PLAYER_NAME);

    await openDashboardTab(page, 'Roster');
    const rosterRegion = page.getByRole('region', { name: /^Roster$/i });
    await expect(
      rosterRegion.getByRole('button', { name: /Andre Cole/i }).first()
    ).toBeVisible();

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(
      page.getByText(/Option Decision:\s*mia_andre_cole\s*\(accepted\)/i)
        .first()
    ).toBeVisible();

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
    await expect(page.getByTestId('comparison-roster-changed')).toContainText(
      PLAYER_ID
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    await openDashboardTab(page, 'Roster');
    const reloadedRosterRegion = page.getByRole('region', {
      name: /^Roster$/i,
    });
    await expect(
      reloadedRosterRegion
        .getByRole('button', { name: /Andre Cole/i })
        .first()
    ).toBeVisible();

    const persistedTeamDocumentAfterReload = await getWorldTeamDocument(
      worldId,
      TEAM_CODE
    );
    expect(
      getOptionSalaryRow(persistedTeamDocumentAfterReload, PLAYER_ID)
        ?.optionUsed
    ).toBe(true);
  });

  test('MIA Full Cap Team Option declines, persists, and reloads', async ({
    page,
  }) => {
    const worldId = await ensureWorldSelected(page, 'Decline');

    const modal = await openTeamOptionModal(page);
    await commitOptionDecision(page, modal, worldId, 'Decline');

    const persistedTeamDocument = await getWorldTeamDocument(worldId, TEAM_CODE);
    expect(getTeamPlayerIds(persistedTeamDocument)).not.toContain(PLAYER_ID);
    expect(findTeamPlayer(persistedTeamDocument, PLAYER_ID)).toBeUndefined();
    expect(getOptionSalaryRow(persistedTeamDocument, PLAYER_ID)).toBeUndefined();
    const capHold = getCapHold(persistedTeamDocument, PLAYER_ID);
    expect(capHold).toBeTruthy();
    expect(capHold?.season).toBe(TEAM_OPTION_SEASON);
    expect(Number(capHold?.amount || 0)).toBeGreaterThan(0);

    const optionDecisionEvent = await getOptionDecisionEvent(worldId, false);
    expect(optionDecisionEvent).toBeTruthy();

    await openDashboardTab(page, 'Full Cap Table');
    await expect(optionDecisionRow(page)).toHaveCount(0);
    await page.getByTestId('cap-sheet-full-cap-holds-toggle').click();
    await expect(page.getByText(PLAYER_NAME).first()).toBeVisible();

    await openDashboardTab(page, 'Roster');
    const rosterRegion = page.getByRole('region', { name: /^Roster$/i });
    await expect(
      rosterRegion.getByRole('button', { name: /Andre Cole/i })
    ).toHaveCount(0);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(
      page.getByText(/Option Decision:\s*mia_andre_cole\s*\(declined\)/i)
        .first()
    ).toBeVisible();

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
    await expect(page.getByTestId('comparison-roster-removals')).toContainText(
      PLAYER_ID
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    await openDashboardTab(page, 'Roster');
    const reloadedRosterRegion = page.getByRole('region', {
      name: /^Roster$/i,
    });
    await expect(
      reloadedRosterRegion.getByRole('button', { name: /Andre Cole/i })
    ).toHaveCount(0);

    const persistedTeamDocumentAfterReload = await getWorldTeamDocument(
      worldId,
      TEAM_CODE
    );
    expect(getTeamPlayerIds(persistedTeamDocumentAfterReload)).not.toContain(
      PLAYER_ID
    );
    expect(
      getCapHold(persistedTeamDocumentAfterReload, PLAYER_ID)
    ).toBeTruthy();
  });
});
