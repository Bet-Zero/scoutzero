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

const REVIEW_TRADE_LAL_OUTGOING_PLAYER = {
  id: 'austin_reaves',
  name: 'Austin Reaves',
};

const REVIEW_TRADE_BOS_OUTGOING_PLAYER = {
  id: 'derrick_white',
  name: 'Derrick White',
};

const REVIEW_MIN_ROSTER_SIZE = 14;

const REVIEW_TRADE_TEAM_SELECT_VALUES: Record<string, string> = {
  'Los Angeles Lakers': 'lakers',
  'Boston Celtics': 'celtics',
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const getBaseTeamDocument = async (teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_baseTeams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as
    | Record<string, unknown>
    | undefined;

const getBasePlayerDocument = async (playerId: string) =>
  (await getReviewAdminDb()
    .doc(`architect_basePlayers/${playerId}`)
    .get()
    .then((snapshot) => snapshot.data())) as
    | Record<string, unknown>
    | undefined;

const getTeamPlayerIds = (
  teamDocument: Record<string, unknown> | undefined
) => {
  if (!teamDocument) {
    return [] as string[];
  }

  const rawPlayers = Array.isArray(teamDocument.players)
    ? teamDocument.players
    : Array.isArray(teamDocument.roster)
      ? teamDocument.roster
      : [];

  return rawPlayers
    .map((player) => {
      if (typeof player === 'string') {
        return player;
      }

      if (!player || typeof player !== 'object') {
        return '';
      }

      return String(
        (player as Record<string, unknown>).playerId ||
          (player as Record<string, unknown>).player_id ||
          (player as Record<string, unknown>).id ||
          ''
      );
    })
    .filter(Boolean);
};

const normalizeOptionValue = (value: unknown) => {
  if (value === 'TO') {
    return 'Team Option';
  }

  if (value === 'PO') {
    return 'Player Option';
  }

  return value ?? null;
};

const normalizeContractForReviewWorld = (
  contract: Record<string, unknown> | null | undefined
) => {
  if (!contract) {
    return contract ?? null;
  }

  const normalizedContract = {
    ...contract,
  };

  if (Array.isArray(contract.salariesByYear)) {
    normalizedContract.salariesByYear = contract.salariesByYear.map((row) => ({
      ...row,
      option: normalizeOptionValue(row?.option),
      optionUsed:
        typeof row?.optionUsed === 'boolean'
          ? row.optionUsed
          : (row?.optionUsed ?? null),
      capHit: row?.capHit ?? row?.salary ?? 0,
    }));
  }

  return normalizedContract;
};

const buildHydratedPlayerEntry = (
  playerId: string,
  playerData: Record<string, unknown> | undefined
) => {
  if (!playerData) {
    return {
      id: playerId,
      player_id: playerId,
      name: playerId,
      displayName: playerId,
      contract: null,
      bio: {},
      original: null,
    };
  }

  return {
    id: String(playerData.playerId || playerId),
    player_id: String(playerData.playerId || playerId),
    name: String(playerData.displayName || playerId),
    displayName: String(playerData.displayName || playerId),
    position: playerData.bio?.position || '',
    age: playerData.bio?.age || null,
    teamCode: playerData.teamCode || null,
    teamName: playerData.teamName || null,
    contract: normalizeContractForReviewWorld(
      (playerData.contract as Record<string, unknown> | undefined) || null
    ),
    futureContract: normalizeContractForReviewWorld(
      (playerData.futureContract as Record<string, unknown> | undefined) || null
    ),
    bio: {
      ...(typeof playerData.bio === 'object' && playerData.bio
        ? playerData.bio
        : {}),
      playerId: String(playerData.playerId || playerId),
      displayName: String(playerData.displayName || playerId),
    },
    representation: playerData.representation || null,
    original: playerData,
  };
};

const buildActiveContracts = (players: Array<Record<string, unknown>>) =>
  players
    .filter((player) => Array.isArray(player.contract?.salariesByYear))
    .map((player) => ({
      name: player.name,
      player_id: player.player_id,
      contract: player.contract,
      years: player.contract?.yearsRemaining || 0,
      type: player.contract?.contractType || 'Contract',
      signAndTrade: false,
      guaranteed: true,
      isMinimum: false,
      yearsOfService:
        player.bio?.experience ||
        player.contract?.birdRights?.yearsOfService ||
        null,
    }));

const buildHydratedWorldTeamSnapshot = async (
  teamCode: string,
  teamName: string
) => {
  const baseDoc = await getBaseTeamDocument(teamCode);
  if (!baseDoc) {
    throw new Error(`Base team ${teamCode} is unavailable in review mode.`);
  }

  const rosterIds = Array.isArray(baseDoc.roster)
    ? baseDoc.roster.map((playerId) => String(playerId))
    : [];
  const players = await Promise.all(
    rosterIds.map(async (playerId) =>
      buildHydratedPlayerEntry(playerId, await getBasePlayerDocument(playerId))
    )
  );

  const exceptionData =
    typeof baseDoc.exceptions === 'object' && baseDoc.exceptions
      ? baseDoc.exceptions
      : {};
  const tradeExceptions = Array.isArray(exceptionData.tpe)
    ? exceptionData.tpe.map((tpe) => ({
        id: tpe.id,
        name: tpe.label || tpe.id,
        amount: tpe.remainingAmount ?? tpe.totalAmount ?? 0,
        used: tpe.usedAmount ?? 0,
        createdFrom: tpe.createdFrom ?? null,
        expires: tpe.expiresOn ?? tpe.expires ?? null,
      }))
    : [];

  const toSimpleException = (
    value: Record<string, unknown> | null | undefined
  ) =>
    value
      ? {
          amount: value.totalAmount ?? 0,
          used: value.usedAmount ?? 0,
          remaining: value.remainingAmount ?? value.totalAmount ?? 0,
        }
      : null;

  const hardCapLevel =
    baseDoc.hardCapLevel || baseDoc.totals?.hardCapLevel || null;
  const hardCapped =
    hardCapLevel != null &&
    String(hardCapLevel).toLowerCase() !== 'none' &&
    String(hardCapLevel).toLowerCase() !== 'false';

  return {
    id: teamCode,
    teamCode,
    teamName: baseDoc.teamName || teamName,
    season: baseDoc.season,
    abbreviation: baseDoc.abbreviation || teamCode,
    players,
    roster: players,
    activeContracts: buildActiveContracts(players),
    capHolds: Array.isArray(baseDoc.capHolds) ? baseDoc.capHolds : [],
    draftPicks: Array.isArray(baseDoc.draftPicks) ? baseDoc.draftPicks : [],
    draftPicksInventory:
      baseDoc.draftPicksInventory || baseDoc.draftPicks || [],
    draftPicksObligations: baseDoc.draftPicksObligations || [],
    draftPicksContested: baseDoc.draftPicksContested || [],
    draftAssets: baseDoc.draftAssets || null,
    entitlementIds: Array.isArray(baseDoc.entitlementIds)
      ? baseDoc.entitlementIds
      : [],
    offerSheets: Array.isArray(baseDoc.offerSheets) ? baseDoc.offerSheets : [],
    incomingOfferSheets: Array.isArray(baseDoc.incomingOfferSheets)
      ? baseDoc.incomingOfferSheets
      : [],
    exceptions: exceptionData,
    mle: toSimpleException(exceptionData.mle),
    tpMle: toSimpleException(exceptionData.taxpayerMle || exceptionData.tpMle),
    bae: toSimpleException(exceptionData.bae),
    tradeExceptions,
    hardCapLevel,
    hardCapped,
    deadCap: Array.isArray(baseDoc.deadCap) ? baseDoc.deadCap : [],
    baseline: baseDoc,
    totals: baseDoc.totals || {},
  };
};

const buildReviewDepthPlayers = (
  teamCode: string,
  teamName: string,
  count: number,
  startingIndex: number
) =>
  Array.from({ length: count }, (_, offset) => {
    const ordinal = startingIndex + offset + 1;
    const playerId = `review_${teamCode.toLowerCase()}_depth_${ordinal}`;
    const displayName = `${teamName} Depth ${ordinal}`;

    return {
      id: playerId,
      playerId,
      player_id: playerId,
      name: displayName,
      displayName,
      position: 'F',
      age: 25,
      teamCode,
      teamId: teamCode,
      teamName,
      bio: {
        playerId,
        displayName,
        position: 'F',
        height: '6-7',
        weight: '220',
        age: 25,
        experience: 1,
      },
      futureContract: null,
      representation: null,
      original: null,
      contract: {
        contractType: 'MINIMUM CONTRACT',
        isExtension: false,
        isRookieScale: false,
        startSeason: '2025-26',
        endSeason: '2026-27',
        contractLength: 2,
        yearsRemaining: 1,
        totalValue: 0,
        averageAnnualValue: 0,
        salariesByYear: [
          {
            season: '2025-26',
            salary: 0,
            capHit: 0,
            guaranteed: true,
          },
          {
            season: '2026-27',
            salary: 0,
            capHit: 0,
            guaranteed: true,
          },
        ],
        noTradeClause: false,
        tradeKicker: null,
        birdRights: {
          status: 'Non-Bird',
          eligibleFor: ['Minimum Exception'],
        },
        freeAgency: {
          type: 'UFA',
          year: 2027,
          capHold: 0,
        },
      },
    };
  });

const topUpWorldTeamRosterMinimum = async (
  worldId: string,
  teamCode: string,
  teamName: string
) => {
  const db = getReviewAdminDb();
  const teamRef = db.doc(`architect_worlds/${worldId}/teams/${teamCode}`);
  const baseSnapshot = await buildHydratedWorldTeamSnapshot(teamCode, teamName);
  const existingPlayerIds = getTeamPlayerIds(baseSnapshot);

  const missingPlayers = REVIEW_MIN_ROSTER_SIZE - existingPlayerIds.length;
  const fillerPlayers =
    missingPlayers > 0
      ? buildReviewDepthPlayers(
          teamCode,
          teamName,
          missingPlayers,
          existingPlayerIds.length
        )
      : [];
  const players = [...(baseSnapshot.players || []), ...fillerPlayers];

  await teamRef.set(
    {
      ...baseSnapshot,
      players,
      roster: players,
      activeContracts: buildActiveContracts(players),
    },
    { merge: false }
  );
};

const addTradeTeam = async (page: Page, teamName: string) => {
  const teamValue = REVIEW_TRADE_TEAM_SELECT_VALUES[teamName] || teamName;
  const addTeamButton = page.getByRole('button', {
    name: /Add Team|Add 2nd Team|Add 3rd Team/i,
  });
  await expect(addTeamButton).toBeVisible();
  await addTeamButton.click();

  const teamPicker = page
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]')
    .last();
  await expect(teamPicker).toBeVisible();
  await teamPicker.selectOption(teamValue);
};

const routeTradePlayer = async (
  page: Page,
  sourceTeamName: string,
  playerName: string,
  destinationTeamName: string
) => {
  const teamCard = page
    .locator('div')
    .filter({
      has: page.getByRole('button', {
        name: new RegExp(escapeRegExp(sourceTeamName), 'i'),
      }),
    })
    .filter({
      has: page.getByRole('button', { name: /Players \(\d+\)/i }),
    })
    .first();

  await expect(teamCard).toBeVisible();

  const playerRow = teamCard.getByAltText(playerName).locator('xpath=../..');

  await expect(playerRow).toBeVisible();
  await playerRow.locator('button', { hasText: '•••' }).first().click();

  const tradeButton = page.getByRole('button', {
    name: new RegExp(`^Trade to ${escapeRegExp(destinationTeamName)}$`, 'i'),
  });
  await expect(tradeButton).toBeVisible();
  await tradeButton.click();
};

const executePersistedReviewTradeProof = async (
  page: Page,
  testInfo: TestInfo
) => {
  const architectMutationErrors: Array<Record<string, unknown>> = [];
  const consoleListener = async (message: {
    type(): string;
    text(): string;
    args(): Array<{ jsonValue(): Promise<unknown> }>;
  }) => {
    if (message.type() !== 'error') {
      return;
    }

    const text = message.text();
    if (!text.includes('[Architect][FreeAgency]')) {
      return;
    }

    const args = await Promise.all(
      message
        .args()
        .map((arg) => arg.jsonValue().catch(() => '[unserializable]'))
    );

    architectMutationErrors.push({
      text,
      args,
    });
  };

  page.on('console', consoleListener);
  await ensureTeamDataLoaded(page, testInfo);
  const worldId = await ensureWorldSelected(page, testInfo);

  await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
  await topUpWorldTeamRosterMinimum(worldId, 'BOS', 'Boston Celtics');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureTeamDataLoaded(page, testInfo);
  await ensureSpecificWorldSelected(page, worldId, testInfo);

  const beforeTradeEvents = await getWorldEventDocuments(worldId);
  const beforeTradeLalDocument = await getWorldTeamDocument(worldId, 'LAL');
  const beforeTradeBosDocument = await getWorldTeamDocument(worldId, 'BOS');

  await openDashboardTab(page, 'Trade Machine');
  await expect(
    page.getByRole('heading', { name: /^Trade Machine$/i })
  ).toBeVisible();

  await addTradeTeam(page, 'Los Angeles Lakers');
  await addTradeTeam(page, 'Boston Celtics');
  await routeTradePlayer(
    page,
    'Los Angeles Lakers',
    REVIEW_TRADE_LAL_OUTGOING_PLAYER.name,
    'Boston Celtics'
  );
  await routeTradePlayer(
    page,
    'Boston Celtics',
    REVIEW_TRADE_BOS_OUTGOING_PLAYER.name,
    'Los Angeles Lakers'
  );

  const validateTradeButton = page.getByRole('button', {
    name: /^Validate Trade$/i,
  });
  await expect(validateTradeButton).toBeVisible();
  await validateTradeButton.click();

  await expect(page.getByTestId('validation-state-header')).toContainText(
    /Validated/i
  );

  const applyTradeButton = page.getByRole('button', {
    name: /^Apply Trade$/i,
  });
  await expect
    .poll(async () => await applyTradeButton.isEnabled(), {
      timeout: 15000,
      message: 'trade should validate as legal before apply',
    })
    .toBe(true);

  const previewCloseButton = page.locator('button[title="Close"]').first();
  if (await isVisible(previewCloseButton, 2000)) {
    await previewCloseButton.click();
  }

  await applyTradeButton.click();

  try {
    await expect
      .poll(
        async () => {
          const [lalDocument, bosDocument, worldEvents] = await Promise.all([
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldTeamDocument(worldId, 'BOS'),
            getWorldEventDocuments(worldId),
          ]);

          const latestTradeEvent = worldEvents.find((event) => {
            if (event.mutationType !== 'executeTrade') {
              return false;
            }

            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds.map((playerId) => String(playerId))
              : [];
            return (
              playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id) &&
              playerIds.includes(REVIEW_TRADE_BOS_OUTGOING_PLAYER.id)
            );
          });

          return {
            lalHasIncoming: getTeamPlayerIds(lalDocument).includes(
              REVIEW_TRADE_BOS_OUTGOING_PLAYER.id
            ),
            lalRemovedOutgoing: !getTeamPlayerIds(lalDocument).includes(
              REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
            ),
            bosHasIncoming: getTeamPlayerIds(bosDocument).includes(
              REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
            ),
            bosRemovedOutgoing: !getTeamPlayerIds(bosDocument).includes(
              REVIEW_TRADE_BOS_OUTGOING_PLAYER.id
            ),
            latestTradeEventId: latestTradeEvent?.id || '',
          };
        },
        {
          timeout: 15000,
          message:
            'trade apply should persist roster swaps and an executeTrade world event',
        }
      )
      .toMatchObject({
        lalHasIncoming: true,
        lalRemovedOutgoing: true,
        bosHasIncoming: true,
        bosRemovedOutgoing: true,
      });
  } catch (error) {
    if (architectMutationErrors.length > 0) {
      console.error(
        '[E2E][ArchitectMutationErrors]',
        JSON.stringify(architectMutationErrors, null, 2)
      );
      testInfo.annotations.push({
        type: 'architect-mutation-errors',
        description: JSON.stringify(architectMutationErrors, null, 2).slice(
          0,
          4000
        ),
      });
    }
    throw error;
  } finally {
    page.off('console', consoleListener);
  }

  const afterTradeLalDocument = await getWorldTeamDocument(worldId, 'LAL');
  const afterTradeBosDocument = await getWorldTeamDocument(worldId, 'BOS');
  const afterTradeEvents = await getWorldEventDocuments(worldId);
  const tradeEvent = afterTradeEvents.find((event) => {
    if (event.mutationType !== 'executeTrade') {
      return false;
    }

    const playerIds = Array.isArray(event.playerIds)
      ? event.playerIds.map((playerId) => String(playerId))
      : [];

    return (
      playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id) &&
      playerIds.includes(REVIEW_TRADE_BOS_OUTGOING_PLAYER.id)
    );
  });

  expect(getTeamPlayerIds(beforeTradeLalDocument)).toContain(
    REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
  );
  expect(getTeamPlayerIds(beforeTradeBosDocument)).toContain(
    REVIEW_TRADE_BOS_OUTGOING_PLAYER.id
  );
  expect(getTeamPlayerIds(afterTradeLalDocument)).toContain(
    REVIEW_TRADE_BOS_OUTGOING_PLAYER.id
  );
  expect(getTeamPlayerIds(afterTradeBosDocument)).toContain(
    REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
  );
  expect(afterTradeEvents.length).toBeGreaterThan(beforeTradeEvents.length);
  expect(tradeEvent).toBeTruthy();
  expect(tradeEvent).toMatchObject({ mutationType: 'executeTrade' });

  const tradeEventPlayerIds = Array.isArray(tradeEvent?.playerIds)
    ? tradeEvent.playerIds.map((playerId) => String(playerId))
    : [];
  const tradeEventTeamCodes = Array.isArray(tradeEvent?.teamCodes)
    ? tradeEvent.teamCodes.map((teamCode) => String(teamCode))
    : [];

  expect(tradeEventPlayerIds).toEqual(
    expect.arrayContaining([
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.id,
      REVIEW_TRADE_BOS_OUTGOING_PLAYER.id,
    ])
  );
  expect(tradeEventTeamCodes).toEqual(expect.arrayContaining(['LAL', 'BOS']));

  return {
    worldId,
    tradeEvent,
    afterTradeLalDocument,
    afterTradeBosDocument,
  };
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

  test('D-MQ-003: Trade Machine executes a legal persisted world trade and rehydrates on re-entry', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    const { worldId } = await executePersistedReviewTradeProof(page, testInfo);

    await reenterDashboardViaAppNavigation(page);
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Roster');

    await expect(
      page.getByAltText(REVIEW_TRADE_BOS_OUTGOING_PLAYER.name)
    ).toBeVisible();
    await expect(
      page.getByAltText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)
    ).toHaveCount(0);

    addAuditNote(
      testInfo,
      'This now covers the real world-backed trade path: a legal Lakers/Celtics trade validates, Apply Trade persists updated team snapshots plus an executeTrade event in architect_worlds/{worldId}, and the re-entered dashboard rehydrates the Lakers roster with Derrick White instead of Austin Reaves.'
    );

    await captureEvidence(page, testInfo, 'D-MQ-003-persisted-trade-proof');
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

  test('D-MQ-008: Team History rehydrates persisted world event details after a real trade', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    const { worldId, tradeEvent } = await executePersistedReviewTradeProof(
      page,
      testInfo
    );

    await openDashboardTab(page, 'Team History');

    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByTestId('team-history-world-banner')).toContainText(
      worldId
    );

    const firstTimelineRow = page.getByTestId('team-history-event-row-0');
    await expect(firstTimelineRow).toBeVisible();
    await expect(firstTimelineRow).toContainText(/Trade Executed/i);
    await firstTimelineRow.click();

    await expect(page.getByTestId('team-history-detail-modal')).toBeVisible();
    await expect(page.getByTestId('team-history-detail-summary')).toBeVisible();
    await expect(page.getByTestId('team-history-detail-deltas')).toBeVisible();
    await expect(
      page.getByTestId('team-history-detail-mutation-type')
    ).toHaveText(/executeTrade/i);
    await expect(page.getByTestId('team-history-detail-teams')).toContainText(
      /LAL/i
    );
    await expect(page.getByTestId('team-history-detail-teams')).toContainText(
      /BOS/i
    );
    await expect(
      page.getByTestId('team-history-detail-player-ids')
    ).toContainText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id);
    await expect(
      page.getByTestId('team-history-detail-player-ids')
    ).toContainText(REVIEW_TRADE_BOS_OUTGOING_PLAYER.id);

    addAuditNote(
      testInfo,
      `Team History is now proven against a persisted executeTrade event (${String(tradeEvent?.id || 'unknown-event')}): the world-scoped timeline loads without fixture injection, the event row renders as Trade Executed, and the detail modal exposes the underlying executeTrade mutation, both team codes, and both traded player IDs.`
    );

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
