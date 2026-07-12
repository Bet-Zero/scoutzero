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
const GM_DASHBOARD_BOS_URL = '/gm/BOS';
const GM_DASHBOARD_MIA_OWN_FA_URL = '/gm/MIA?season=2027';
const REVIEW_MODE_FREE_AGENT_NAME = 'Review Offer Sheet Guard';
const REVIEW_MODE_FREE_AGENT_ID = 'review_offer_sheet_guard';
const REVIEW_MIA_OWN_FA_NAME = 'Grant Holloway';
const REVIEW_MIA_OWN_FA_ID = 'mia_grant_holloway';
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
        deadCap?: Array<Record<string, unknown>>;
        entitlementIds?: string[];
        capHolds?: Array<Record<string, unknown>>;
        offerSheets?: Array<Record<string, unknown>>;
        players?: Array<Record<string, unknown>>;
        roster?: Array<string | Record<string, unknown>>;
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

const getTeamPlayerRecords = (
  teamDocument: Record<string, unknown> | undefined
) =>
  (Array.isArray(teamDocument?.players) ? teamDocument.players : []).filter(
    (player): player is Record<string, unknown> =>
      Boolean(player) && typeof player === 'object' && !Array.isArray(player)
  );

const findTeamPlayerRecord = (
  teamDocument: Record<string, unknown> | undefined,
  playerId: string
) =>
  getTeamPlayerRecords(teamDocument).find((player) => {
    const bio =
      player.bio && typeof player.bio === 'object'
        ? (player.bio as Record<string, unknown>)
        : null;
    const candidate =
      player.id || player.playerId || player.player_id || bio?.playerId;
    return candidate === playerId;
  });

const hasCapHoldForPlayer = (
  teamDocument: Record<string, unknown> | undefined,
  playerId: string
) =>
  (Array.isArray(teamDocument?.capHolds) ? teamDocument.capHolds : []).some(
    (hold) => hold?.playerId === playerId
  );

const contractHasSeasonSalary = (
  player: Record<string, unknown> | undefined,
  season: string,
  expectedSalary: number
) => {
  const contract =
    player && typeof player.contract === 'object' && player.contract
      ? (player.contract as Record<string, unknown>)
      : null;
  const rows = Array.isArray(contract?.salariesByYear)
    ? (contract.salariesByYear as Array<Record<string, unknown>>)
    : [];

  return rows.some(
    (row) =>
      row?.season === season &&
      Number(row.salary ?? row.capHit ?? 0) === expectedSalary
  );
};

const parseMoneyMillions = (label: string) => {
  const match = label.replace(/,/g, '').match(/(-?\$?[\d.]+)\s*([KMB])?/i);
  if (!match) return Number.NaN;
  const value = Number(match[1].replace('$', ''));
  const suffix = (match[2] || 'M').toUpperCase();
  if (suffix === 'B') return value * 1000;
  if (suffix === 'K') return value / 1000;
  return value;
};

const readCockpitTotalCapMillions = async (page: Page) =>
  parseMoneyMillions(
    (await page.getByTestId('cockpit-status-total-cap-value').textContent()) ||
      ''
  );

const ownFaDecisionRow = (page: Page): Locator =>
  page
    .getByTestId('cap-sheet-full-fa-decision-row')
    .filter({ hasText: REVIEW_MIA_OWN_FA_NAME });

const signedOwnFaPlayerRow = (page: Page): Locator =>
  page.locator('[data-cap-fit-row]').filter({
    has: page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: REVIEW_MIA_OWN_FA_NAME }),
  });

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

const seedWorldOfferSheetHomeTeamRights = async (
  worldId: string,
  teamCode: string,
  teamName: string,
  playerId: string
) => {
  const db = getReviewAdminDb();
  const teamRef = db.doc(`architect_worlds/${worldId}/teams/${teamCode}`);
  const existingTeam =
    ((await getWorldTeamDocument(worldId, teamCode)) as
      | Record<string, unknown>
      | undefined) || (await buildHydratedWorldTeamSnapshot(teamCode, teamName));
  const existingCapHolds = Array.isArray(existingTeam.capHolds)
    ? existingTeam.capHolds.filter((hold) => hold?.playerId !== playerId)
    : [];
  const capHolds = [
    ...existingCapHolds,
    {
      playerId,
      playerName: REVIEW_MODE_FREE_AGENT_NAME,
      amount: 2_000_000,
      season: '2025-26',
      type: 'RFA Rights',
      active: true,
      isSigned: false,
      reason: 'Review-mode RFA offer-sheet home-team rights',
    },
  ];

  await teamRef.set(
    {
      ...existingTeam,
      capHolds,
    },
    { merge: false }
  );
};

const addTradeTeam = async (page: Page, teamName: string) => {
  const teamValue = REVIEW_TRADE_TEAM_SELECT_VALUES[teamName] || teamName;
  const tradeDialog = page.getByRole('dialog', { name: /Trade Machine/i });

  await expect(
    tradeDialog.getByRole('button', { name: /Los Angeles Lakers/i })
  ).toBeVisible({ timeout: 20000 });

  const teamPickers = tradeDialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]');

  if ((await teamPickers.count()) === 0) {
    const addTeamButton = tradeDialog.getByRole('button', {
      name: /Add Team|Add 2nd Team|Add 3rd Team/i,
    });
    await expect(addTeamButton).toBeVisible();
    await addTeamButton.click();
  }

  const teamPicker = tradeDialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]')
    .first();
  await expect(teamPicker).toBeVisible();
  await teamPicker.selectOption(teamValue);
};

const routeTradePlayer = async (
  page: Page,
  sourceTeamName: string,
  playerName: string,
  destinationTeamName: string
) => {
  // Scope to the Trade Machine dialog so the background Roster tab (which also
  // renders the same player names) can't create ambiguous matches.
  const tradeDialog = page.getByRole('dialog', { name: /Trade Machine/i });

  const teamCard = tradeDialog
    .locator('div')
    .filter({
      has: page.getByRole('button', {
        name: new RegExp(escapeRegExp(sourceTeamName), 'i'),
      }),
    })
    .filter({
      // Trade card tab labels were abbreviated (Players → "Plyr (N)"); accept
      // either so the helper survives both label generations.
      has: page.getByRole('button', { name: /(?:Plyr|Players) \(\d+\)/i }),
    })
    .first();

  await expect(teamCard).toBeVisible();

  // The trade card renders two layouts depending on column width: a wide one
  // where the player has a headshot (alt text) and a compact one where the name
  // is a single text node. Anchor on whichever is present, then act on that
  // row's menu button — the first button following the anchor in document order
  // (the "•••" menu; its glyph is icon-based, so match by position not text).
  const playerAnchor = teamCard
    .getByAltText(playerName, { exact: true })
    .or(teamCard.getByText(playerName, { exact: true }));
  const tradeMenuButton = playerAnchor.locator('xpath=following::button[1]');

  await expect(tradeMenuButton).toBeVisible();
  await tradeMenuButton.click();

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

  // The Trade Machine auto-includes the current team (LAL) as teams[0], so only
  // the second team needs adding — re-adding LAL here would create a duplicate
  // card and a malformed 3-slot trade.
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

  // BZE-247: the neutral recency pill reads "Last checked" (never "Validated",
  // which half-read as success on blocked deals).
  await expect(page.getByTestId('validation-state-header')).toContainText(
    /Last checked/i
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
  // The Trade Machine overlay (full-screen, z-50) covers the cockpit exit link
  // and would intercept the click, so close it first if a flow left it open.
  const tradeOverlay = page.getByTestId('trade-overlay');
  if (await isVisible(tradeOverlay, 1000)) {
    await page
      .getByRole('button', { name: /Close Trade Machine/i })
      .click()
      .catch(() => undefined);
    await expect(tradeOverlay)
      .toBeHidden({ timeout: 5000 })
      .catch(() => undefined);
  }
  // Leave the cockpit to the league view and return — exercises SPA route
  // re-entry (and active-world rehydration) without a hard reload. The legacy
  // "Player Profiles" link was removed in the cockpit refactor.
  const leagueLink = page.getByRole('link', {
    name: /Exit cockpit to league view/i,
  });
  await expect(leagueLink).toBeVisible();
  await leagueLink.click();
  await expect(page).toHaveURL(/\/gm$/);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  // Returning closes the Trade Machine, so the room query param resets; assert
  // the dashboard path rather than the exact starting URL.
  const dashboardPath = new URL(startingUrl).pathname;
  await expect(page).toHaveURL(
    new RegExp(`${escapeRegExp(dashboardPath)}(?:\\?|$)`)
  );
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
  // Cockpit nav rail renders sections as role="tab" with aria-label=section
  // name (NavRail.tsx). The label text is opacity-0 when the rail is collapsed,
  // but the accessible name (aria-label) is always present, so a role/name query
  // resolves regardless of rail expansion state.
  const tab = page.getByRole('tab', {
    name: new RegExp(`^${label}$`, 'i'),
  });
  await expect(tab).toBeVisible();
  await tab.click();
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

// Cockpit refactor: world selection + world-time controls moved behind the
// WorldMenu popover (cockpit/WorldMenu.tsx). The legacy #world-selector,
// "+ New" world creation, and world-date controls still exist, but only render
// inside the popover, which must be opened via its trigger first. These helpers
// open/close that popover idempotently so the world-backed checklist rows work
// against the cockpit UI.
const openWorldMenu = async (page: Page) => {
  const popover = page.getByTestId('cockpit-world-menu-popover');
  const trigger = page.getByTestId('cockpit-world-menu-trigger');
  if (!(await isVisible(trigger, 5000))) {
    return null;
  }
  // The cockpit re-mounts the TopBar after world creation/selection, which
  // resets the popover's open state — so a single click does not reliably
  // stick. Keep nudging the trigger until the popover is actually open.
  await expect
    .poll(
      async () => {
        if (await isVisible(popover, 400)) {
          return true;
        }
        await trigger.click({ timeout: 2000 }).catch(() => undefined);
        return await isVisible(popover, 800);
      },
      {
        timeout: 15000,
        message: 'world menu popover should open and stay open',
      }
    )
    .toBe(true);
  return popover;
};

// Open the world menu and wait for a specific control inside it, re-opening if a
// re-mount transiently closes the popover before the control is asserted.
const openWorldMenuFor = async (page: Page, inner: Locator) => {
  await expect
    .poll(
      async () => {
        if (await isVisible(inner, 500)) {
          return true;
        }
        await openWorldMenu(page);
        return await isVisible(inner, 1000);
      },
      {
        timeout: 20000,
        message: 'world menu control should become visible',
      }
    )
    .toBe(true);
};

const closeWorldMenu = async (page: Page) => {
  const popover = page.getByTestId('cockpit-world-menu-popover');
  if (await isVisible(popover, 300)) {
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden({ timeout: 3000 }).catch(() => undefined);
  }
};

const readActiveWorldId = async (page: Page) => {
  // Prefer UI-free sources first so we don't churn the popover on every poll.
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

  const bodyWorldId = await readWorldIdFromBodyText(page);
  if (bodyWorldId) {
    return bodyWorldId;
  }

  // Fall back to the selector itself (inside the world-menu popover).
  const popover = await openWorldMenu(page);
  if (popover) {
    const selectedWorldId = await page
      .locator('#world-selector')
      .inputValue()
      .catch(() => '');
    if (selectedWorldId) {
      return selectedWorldId;
    }
  }

  return '';
};

// TEST-003 / Option C: worlds are owner-scoped — listUserWorlds() filters
// `where('createdBy', '==', userId)` (worldManager.core.ts), and review mode
// signs in anonymously with a *fresh uid per browser context* (useAuth.ts +
// no Playwright storageState). So a boot-time static seed is invisible to the
// test user. Instead of driving the slow/flaky UI create-world flow, we read
// THIS session's live anon uid and admin-write a world doc owned by it, then
// select it — deterministic, fast, and without touching app/auth behavior.
const REVIEW_WORLD_SEASON = '2026-27';
// Start of the 2026-27 league year. Seeding an authoritative world date makes
// the world genuinely "ready" — the +1 Day control stays disabled until a world
// has an asOfDate (WorldTimeControls.hasAuthoritativeDate), and the loader does
// not derive one from the season.
const REVIEW_WORLD_AS_OF_DATE = '2026-07-01';

const generateReviewWorldId = () =>
  `world_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

// Read the current anonymous user's uid from Firebase Auth's IndexedDB
// persistence (db `firebaseLocalStorageDb`, store `firebaseLocalStorage`) — the
// same store the SDK restores the session from across reloads, so the uid is
// stable within a context. Returns '' if unavailable.
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

// Admin-write a world metadata doc owned by `userId`. Shape mirrors createWorld
// (worldManager.core.ts) so the WorldSelector lists it — `isArchived: false`
// keeps it in the active list, and `lastModifiedAt` preserves normal local
// sorting. The app treats it as a real world. (createWorld writes metadata only;
// team subdocs are seeded separately by tests that need a roster, as before.)
const seedReviewWorld = async (
  userId: string,
  worldName: string
): Promise<string> => {
  const worldId = generateReviewWorldId();
  const now = admin.firestore.Timestamp.now();
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}`)
    .set({
      worldId,
      worldName,
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

// Persist the active-world selection exactly the way the app does
// (writePersistedActiveWorldId → localStorage `architect.activeWorldId.<uid>`),
// then reload so useArchitectState restores it via a single-doc get. This is
// still the deterministic e2e setup: WorldSelector list queries are covered by
// Firestore rules tests, while this helper focuses reload restoration on the
// same storage key the app writes after a user selects a world.
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

  // World mode is reflected by the cockpit chip leaving "Sandbox" once
  // useArchitectState has restored the world into state.
  const worldMenuTrigger = page.getByTestId('cockpit-world-menu-trigger');
  await expect(worldMenuTrigger).toBeVisible({ timeout: 20000 });
  await expect
    .poll(
      async () => ((await worldMenuTrigger.textContent()) || '').includes('Sandbox'),
      {
        timeout: 20000,
        message: `cockpit should leave Sandbox after restoring seeded world ${worldId}`,
      }
    )
    .toBe(false);
};

const ensureWorldSelected = async (page: Page, testInfo: TestInfo) => {
  const worldSelector = page.locator('#world-selector');
  const signInHint = page.getByText(/Sign in to manage worlds/i);

  await openWorldMenu(page);

  await expect
    .poll(
      async () => {
        await openWorldMenu(page);
        return {
          hasWorldSelector: await isVisible(worldSelector, 1000),
          showingSignInHint: await isVisible(signInHint, 1000),
        };
      },
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

  // Reuse an already-active world if one is restored (the dropdown can't be
  // trusted here — it never lists worlds — so consult the active-world state).
  const existingActiveWorldId = await readActiveWorldId(page);
  if (existingActiveWorldId) {
    await closeWorldMenu(page);
    return existingActiveWorldId;
  }

  // No world is active yet. Admin-seed one owned by this session's anon user,
  // then activate it via the app's own localStorage rehydration path — instead
  // of the slow, flaky UI create-world flow (see TEST-003).
  const userId = await readReviewUserId(page);
  expect(
    userId,
    'anonymous review uid should be readable from auth persistence before seeding a world'
  ).not.toBe('');

  const worldName = `Audit World ${Date.now()}`;
  const newWorldId = await seedReviewWorld(userId, worldName);
  await closeWorldMenu(page);

  await activateSeededWorld(page, userId, newWorldId);

  addAuditNote(
    testInfo,
    `World-backed review automation seeded and activated world ${newWorldId}, owned by the session anon user, instead of running the flaky UI create-world flow.`
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

  await openWorldMenu(page);
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
  await closeWorldMenu(page);

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

  test('D-MQ-001: Header chrome is correct for the surface (engineer mode badge shown in dev, suppressed on owner-facing review) and the emulator warning is honest', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    // The GM Dashboard header must render its identity chrome on every surface.
    const dashboardHeading = page.getByRole('heading', {
      name: /GM Dashboard/i,
    });
    await expect(dashboardHeading).toBeVisible();

    // Surface-aware mode chrome. The engineer environment ModePill (the
    // EMULATOR/PROD badge) is deliberately suppressed on owner-facing review
    // surfaces (BZE-239; ARCHITECT_VISUAL_STANDARD §10) so review-build chrome
    // never leaks to a GM. On engineer dev / production it stays present and
    // honest. Detect the surface by the pill wrapper and assert the right
    // promise for each — never assert a badge the owner-facing build must hide.
    const modePill = page.getByTestId('cockpit-mode-pill');
    const modeBadge = page.getByTestId('firebase-target-mode-badge');
    if (await isVisible(modePill, 5000)) {
      await expect(modeBadge).toBeVisible();
      await expect(modeBadge).toContainText(/EMULATOR|PROD/i);
    } else {
      await expect(modePill).toHaveCount(0);
      await expect(modeBadge).toHaveCount(0);
      addAuditNote(
        testInfo,
        'Owner-facing review surface: the engineer ModePill (EMULATOR/PROD badge) is correctly suppressed so review-build chrome never reaches a GM (BZE-239 / Visual Standard §10).'
      );
    }

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

    // World-time controls live inside the world-menu popover (cockpit refactor).
    const dateInput = page.getByTestId('world-date-input');
    await openWorldMenuFor(page, dateInput);
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

  test('D-MQ-003B: An in-progress trade draft survives leaving the Trade Machine and returning (W9)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    // W9 lifecycle (BZE-248): a staged-but-unapplied trade must NOT be silently
    // discarded by leaving the room. In the current cockpit the Trade Machine is
    // a full-viewport overlay whose subtree is kept mounted (visibility toggled),
    // so the draft survives close/reopen, and the shell labels the in-progress
    // draft honestly (nav-rail "Draft in progress" dot + activity-rail
    // "Trade in progress / Not applied to plan yet" card). This pins that
    // behavior at the whole-app level so it cannot silently regress.
    await ensureTeamDataLoaded(page, testInfo);
    await ensureWorldSelected(page, testInfo);

    // --- Stage a two-team draft (no validate/apply — an unapplied draft) ---
    await openDashboardTab(page, 'Trade Machine');
    await expect(
      page.getByRole('heading', { name: /^Trade Machine$/i })
    ).toBeVisible();

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

    const tradeDialog = page.getByRole('dialog', { name: /Trade Machine/i });
    await expect(
      tradeDialog.getByRole('button', { name: /Boston Celtics/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Validate Trade$/i })
    ).toBeVisible();
    await captureEvidence(page, testInfo, 'D-MQ-003B-01-draft-staged');

    // --- Leave the Trade Machine: close the overlay, then visit another room ---
    await page.getByRole('button', { name: /Close Trade Machine/i }).click();
    const overlay = page.getByTestId('trade-overlay');
    await expect(overlay).toHaveAttribute('data-open', 'false');

    // Honest labeling while the draft sits unapplied and out of view: the nav
    // rail flags the Trade Machine as having a draft, and the activity rail
    // surfaces the in-progress draft — as the labeled "Active Work" card
    // ("Trade in progress / Not applied to plan yet") when expanded, or the
    // in-progress dot when collapsed. Either way the draft is never silently
    // gone.
    await expect(page.getByTestId('trade-draft-indicator')).toBeVisible();
    await expect(
      page
        .getByTestId('cockpit-activity-rail-trade-draft')
        .or(page.getByTestId('cockpit-activity-rail-dot-in-progress'))
        .first()
    ).toBeVisible();
    await captureEvidence(page, testInfo, 'D-MQ-003B-02-draft-flagged-away');

    // Now the overlay is hidden, the nav rail is interactable — visit Roster.
    await openDashboardTab(page, 'Roster');
    await expect(overlay).toHaveAttribute('data-open', 'false');

    // --- Return to the Trade Machine: the draft is exactly where we left it ---
    await openDashboardTab(page, 'Trade Machine');
    await expect(overlay).toHaveAttribute('data-open', 'true');

    // The second team the user added and the routed pieces are still staged —
    // the room does NOT come back at "Setup required" with the draft discarded.
    await expect(
      tradeDialog.getByRole('button', { name: /Boston Celtics/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Validate Trade$/i })
    ).toBeVisible();
    await expect(
      tradeDialog
        .getByAltText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name, { exact: true })
        .or(tradeDialog.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name, { exact: true }))
        .first()
    ).toBeVisible();

    addAuditNote(
      testInfo,
      'W9 (BZE-248): staged a two-team Lakers/Celtics draft, closed the Trade Machine overlay, visited the Roster room, and reopened the Trade Machine — the added Celtics team and the routed pieces survive intact (no "Setup required" reset). While away, the nav-rail "Draft in progress" indicator and the activity-rail in-progress dot honestly flag the unapplied draft. Reload persistence of unapplied drafts is out of scope per the W9 contract.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-003B-03-draft-restored');
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

  test('D-MQ-004B: Standard waiver persists original-season dead cap', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    await openDashboardTab(page, 'Full Cap Table');

    const reavesRow = page
      .locator('div')
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(
            `^${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}$`,
            'i'
          ),
        }),
      })
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(
            `More actions for ${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}`,
            'i'
          ),
        }),
      })
      .first();

    await expect(reavesRow).toBeVisible();
    await reavesRow.hover();
    await reavesRow
      .getByRole('button', {
        name: new RegExp(
          `More actions for ${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}`,
          'i'
        ),
      })
      .click();

    const waiveLauncher = page.getByTestId('cap-sheet-full-player-row-action-waive');
    await expect(waiveLauncher).toHaveText(/^Waive$/);
    await expect(waiveLauncher).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    await expect(
      page.getByTestId('cap-sheet-full-player-row-action-stretch')
    ).toHaveText(/^Waive & Stretch$/);
    await expect(
      page.getByTestId('cap-sheet-full-player-row-action-stretch')
    ).toHaveAttribute('data-action-exposure-classification', 'V1 supported');
    await waiveLauncher.click();
    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).toBeVisible();
    await expect(page.getByTestId('contract-action-waive')).toBeChecked();
    await expect(page.getByText(/^Waive Player$/i).first()).toBeVisible();
    await expect(page.getByText(/Waive Player \(Preview\)/i)).toHaveCount(0);
    await expect(page.getByText(/^Waive & Stretch$/i).first()).toBeVisible();
    await expect(page.getByText(/Waive & Stretch \(Preview\)/i)).toHaveCount(0);
    const actionContext = page.getByTestId('contract-modal-action-context');
    await expect(actionContext).toContainText('Team Plan action');
    await expect(actionContext).toContainText('Waive Player');
    await expect(actionContext).toContainText('Editing terms');
    await expect(actionContext).toContainText(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
    );
    await expect(actionContext).toContainText(REVIEW_WORLD_SEASON);

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeVisible();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await confirmActionButton.click();

    await expect(
      page.getByRole('heading', { name: /^Available Actions$/i })
    ).not.toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Waiver saved/i,
      { timeout: 20000 }
    );
    await expect(
      page.getByText(/Roster count changed 14 -> 13/i).first()
    ).toBeVisible();
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_TRADE_LAL_OUTGOING_PLAYER.name })
    ).toHaveCount(0, { timeout: 20000 });
    const deadMoneyToggle = page.getByTestId('cap-sheet-full-dead-money-toggle');
    await expect(deadMoneyToggle).toBeVisible();
    await deadMoneyToggle.click();
    await expect(
      page.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name).first()
    ).toBeVisible();

    await expect
      .poll(
        async () => {
          const persistedTeam = await getWorldTeamDocument(worldId, 'LAL');
          const rosterEntries = Array.isArray(persistedTeam?.roster)
            ? persistedTeam.roster
            : [];
          const playerEntries = Array.isArray(persistedTeam?.players)
            ? persistedTeam.players
            : [];
          const hasAustinReaves = [...rosterEntries, ...playerEntries].some(
            (entry) => {
              if (typeof entry === 'string') {
                return entry === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id;
              }
              const playerId =
                entry.id || entry.playerId || entry.player_id || null;
              return playerId === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id;
            }
          );
          const deadCapEntry = (persistedTeam?.deadCap || []).find(
            (entry) =>
              entry.playerId === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id ||
              entry.player_id === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
          );
          const rawAmountByYear = deadCapEntry?.amountByYear;
          const amountByYear = Array.isArray(rawAmountByYear)
            ? Object.fromEntries(
                rawAmountByYear.map((row) => {
                  const amountRow = row as Record<string, unknown>;
                  return [
                    String(amountRow.season),
                    Number(amountRow.amount || 0),
                  ];
                })
              )
            : rawAmountByYear || null;

          return {
            hasAustinReaves,
            amountByYear,
          };
        },
        {
          timeout: 15000,
          message:
            'standard waiver should remove Austin Reaves and preserve dead cap by original seasons',
        }
      )
      .toEqual({
        hasAustinReaves: false,
        amountByYear: {
          '2025-26': 14_000_000,
          '2026-27': 15_000_000,
          '2027-28': 16_000_000,
        },
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds
              : [];
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : {};
            const mutationMetadata =
              event.mutationMetadata &&
              typeof event.mutationMetadata === 'object'
                ? (event.mutationMetadata as Record<string, unknown>)
                : {};
            return (
              event.mutationType === 'waivePlayer' &&
              playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id) &&
              metadata.stretched !== true &&
              mutationMetadata.stretched !== true
            );
          });
        },
        {
          timeout: 20000,
          message: 'standard waiver should persist one non-stretch waivePlayer event',
        }
      )
      .toBe(true);

    await openDashboardTab(page, 'Roster');
    const rosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(rosterWorkbench).toBeVisible();
    const truthPanel = rosterWorkbench.getByTestId(
      'architect-roster-truth-panel'
    );
    await expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '13');
    await expect(truthPanel).toHaveAttribute('data-roster-standard-count', '13');
    await expect(
      rosterWorkbench.getByAltText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)
    ).toHaveCount(0);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/Waive Player/i).first()).toBeVisible();
    await expect(page.getByText(/waivePlayer/i).first()).toBeVisible();

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
    await expect(page.getByTestId('comparison-roster-additions')).toContainText(
      /None detected/i
    );
    // BZE-218: Compare prints owner-facing display names, not raw player ids.
    await expect(page.getByTestId('comparison-roster-removals')).toContainText(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_TRADE_LAL_OUTGOING_PLAYER.name })
    ).toHaveCount(0, { timeout: 20000 });
    const reloadedDeadMoneyToggle = page.getByTestId(
      'cap-sheet-full-dead-money-toggle'
    );
    await expect(reloadedDeadMoneyToggle).toBeVisible();
    await reloadedDeadMoneyToggle.click();
    await expect(
      page.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name).first()
    ).toBeVisible();

    await openDashboardTab(page, 'Roster');
    const reloadedRosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(
      reloadedRosterWorkbench.getByAltText(
        REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
      )
    ).toHaveCount(0);

    addAuditNote(
      testInfo,
      'This proves the V1 Standard Waive path in browser review mode: Full Cap Table row overflow launches Waive, the shared modal commits a non-stretch waiver, the receipt/count state updates, Austin Reaves leaves active roster surfaces, dead money remains visible in Full Cap Table by original guaranteed seasons, Team History and Compare read the committed waivePlayer event, and reload preserves the saved-world state.'
    );

    await captureEvidence(page, testInfo, 'D-MQ-004B-standard-waiver-v1');
  });

  test('D-MQ-004C: Waive & Stretch persists stretched dead cap from Full Cap Table row overflow', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    await openDashboardTab(page, 'Full Cap Table');

    const reavesRow = page
      .locator('div')
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(
            `^${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}$`,
            'i'
          ),
        }),
      })
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(
            `More actions for ${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}`,
            'i'
          ),
        }),
      })
      .first();

    await expect(reavesRow).toBeVisible();
    await reavesRow.hover();
    await reavesRow
      .getByRole('button', {
        name: new RegExp(
          `More actions for ${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}`,
          'i'
        ),
      })
      .click();

    const stretchLauncher = page.getByTestId(
      'cap-sheet-full-player-row-action-stretch'
    );
    await expect(stretchLauncher).toHaveText(/^Waive & Stretch$/);
    await expect(stretchLauncher).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    await stretchLauncher.click();

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(modal.getByTestId('contract-action-waive-stretch')).toBeChecked();
    await expect(modal.getByText(/^Waive & Stretch$/i).first()).toBeVisible();
    await expect(modal.getByText(/Waive & Stretch \(Preview\)/i)).toHaveCount(0);

    const actionContext = modal.getByTestId('contract-modal-action-context');
    await expect(actionContext).toContainText('Team Plan action');
    await expect(actionContext).toContainText('Waive & Stretch');
    await expect(actionContext).toContainText('Editing terms');
    await expect(actionContext).toContainText(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
    );
    await expect(actionContext).toContainText(REVIEW_WORLD_SEASON);

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeVisible();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await confirmActionButton.click();

    await expect(modal).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Waive-and-stretch saved/i,
      { timeout: 20000 }
    );
    await expect(
      page.getByText(/Roster count changed 14 -> 13/i).first()
    ).toBeVisible();
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_TRADE_LAL_OUTGOING_PLAYER.name })
    ).toHaveCount(0, { timeout: 20000 });

    const deadMoneyToggle = page.getByTestId('cap-sheet-full-dead-money-toggle');
    await expect(deadMoneyToggle).toBeVisible();
    await deadMoneyToggle.click();
    await expect(
      page.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name).first()
    ).toBeVisible();

    await expect
      .poll(
        async () => {
          const persistedTeam = await getWorldTeamDocument(worldId, 'LAL');
          const rosterEntries = Array.isArray(persistedTeam?.roster)
            ? persistedTeam.roster
            : [];
          const playerEntries = Array.isArray(persistedTeam?.players)
            ? persistedTeam.players
            : [];
          const hasAustinReaves = [...rosterEntries, ...playerEntries].some(
            (entry) => {
              if (typeof entry === 'string') {
                return entry === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id;
              }
              const playerId =
                entry.id || entry.playerId || entry.player_id || null;
              return playerId === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id;
            }
          );
          const deadCapEntry = (persistedTeam?.deadCap || []).find(
            (entry) =>
              entry.playerId === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id ||
              entry.player_id === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
          );
          const amountByYear = Array.isArray(deadCapEntry?.amountByYear)
            ? Object.fromEntries(
                deadCapEntry.amountByYear.map((row) => {
                  const amountRow = row as Record<string, unknown>;
                  return [
                    String(amountRow.season),
                    {
                      amount: Number(amountRow.amount || 0),
                      isStretched: amountRow.isStretched === true,
                    },
                  ];
                })
              )
            : null;

          return {
            hasAustinReaves,
            amountByYear,
            notes: deadCapEntry?.notes || null,
          };
        },
        {
          timeout: 15000,
          message:
            'waive-and-stretch should remove Austin Reaves and spread dead cap across three seasons',
        }
      )
      // Source-verified re-baseline for the current 2026-27 seeded world (was
      // authored against a 2025-26 world). Austin Reaves' guaranteed salary is
      // 2025-26 $14M / 2026-27 $15M / 2027-28 $16M (review_seed/basePlayers/
      // austin_reaves.json). Waiving in a 2026-27 world:
      //   - allocateStandardWaiverDeadCapBySeason drops the past 2025-26 row
      //     (seasonEndYear 2026 < current 2027), leaving $15M + $16M = $31M.
      //   - computeWaiveResult stretches $31M over stretchYears=3 starting at
      //     seasonId 2026-27: floor(31M/3)=10,333,333, remainder 1 → year 0
      //     gets +1 (mutationPipeline.compute.signings.playerOps.ts:110-133).
      // Product behavior is correct; only the pre-roll seasons/amounts drifted.
      .toEqual({
        hasAustinReaves: false,
        amountByYear: {
          '2026-27': { amount: 10_333_334, isStretched: true },
          '2027-28': { amount: 10_333_333, isStretched: true },
          '2028-29': { amount: 10_333_333, isStretched: true },
        },
        notes: 'Stretched over 3 years',
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds
              : [];
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : {};
            const mutationMetadata =
              event.mutationMetadata &&
              typeof event.mutationMetadata === 'object'
                ? (event.mutationMetadata as Record<string, unknown>)
                : {};
            return (
              event.mutationType === 'waivePlayer' &&
              playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id) &&
              (metadata.stretched === true ||
                mutationMetadata.stretched === true) &&
              (metadata.stretchYears === 3 ||
                mutationMetadata.stretchYears === 3)
            );
          });
        },
        {
          timeout: 20000,
          message:
            'waive-and-stretch should persist one stretched waivePlayer event',
        }
      )
      .toBe(true);

    await openDashboardTab(page, 'Roster');
    const rosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(rosterWorkbench).toBeVisible();
    await expect(
      rosterWorkbench.getByAltText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)
    ).toHaveCount(0);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/Waive Player/i).first()).toBeVisible();
    await expect(page.getByText(/stretch/i).first()).toBeVisible();

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
    await expect(page.getByTestId('comparison-roster-removals')).toContainText(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_TRADE_LAL_OUTGOING_PLAYER.name })
    ).toHaveCount(0, { timeout: 20000 });
    const reloadedDeadMoneyToggle = page.getByTestId(
      'cap-sheet-full-dead-money-toggle'
    );
    await expect(reloadedDeadMoneyToggle).toBeVisible();
    await reloadedDeadMoneyToggle.click();
    await expect(
      page.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name).first()
    ).toBeVisible();

    addAuditNote(
      testInfo,
      'This proves the V1 Waive & Stretch path in browser review mode: Full Cap Table row overflow launches Waive & Stretch, the shared modal commits a stretched waiver, the receipt/count state updates, Austin Reaves leaves active roster surfaces, dead money is spread across three seasons in Full Cap Table, Team History and Compare read the committed stretched waivePlayer event, and reload preserves the saved-world state.'
    );

    await captureEvidence(page, testInfo, 'D-MQ-004C-waive-stretch-v1');
  });

  test('D-MQ-004D: Buyout persists reduced dead cap from Full Cap Table row overflow', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    await openDashboardTab(page, 'Full Cap Table');

    const reavesRow = page
      .locator('div')
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(
            `^${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}$`,
            'i'
          ),
        }),
      })
      .filter({
        has: page.getByRole('button', {
          name: new RegExp(
            `More actions for ${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}`,
            'i'
          ),
        }),
      })
      .first();

    await expect(reavesRow).toBeVisible();
    await reavesRow.hover();
    await reavesRow
      .getByRole('button', {
        name: new RegExp(
          `More actions for ${escapeRegExp(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)}`,
          'i'
        ),
      })
      .click();

    const buyoutLauncher = page.getByTestId(
      'cap-sheet-full-player-row-action-buyout'
    );
    await expect(buyoutLauncher).toHaveText(/^Buyout$/);
    await expect(buyoutLauncher).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    await buyoutLauncher.click();

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(modal.getByTestId('contract-action-buyout')).toBeChecked();
    await expect(modal.getByText(/^Buyout Contract$/i).first()).toBeVisible();
    await expect(modal.getByText(/Buyout Contract \(Preview\)/i)).toHaveCount(0);

    const actionContext = modal.getByTestId('contract-modal-action-context');
    await expect(actionContext).toContainText('Team Plan action');
    await expect(actionContext).toContainText('Buyout Contract');
    await expect(actionContext).toContainText('Editing terms');
    await expect(actionContext).toContainText(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
    );
    await expect(actionContext).toContainText(REVIEW_WORLD_SEASON);

    await modal.getByLabel(/buyout amount/i).fill('5000000');

    const confirmActionButton = page.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeVisible();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await confirmActionButton.click();

    await expect(modal).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Buyout saved/i,
      { timeout: 20000 }
    );
    await expect(
      page.getByText(/Roster count changed 14 -> 13/i).first()
    ).toBeVisible();
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_TRADE_LAL_OUTGOING_PLAYER.name })
    ).toHaveCount(0, { timeout: 20000 });

    const deadMoneyToggle = page.getByTestId('cap-sheet-full-dead-money-toggle');
    await expect(deadMoneyToggle).toBeVisible();
    await deadMoneyToggle.click();
    await expect(
      page.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name).first()
    ).toBeVisible();

    await expect
      .poll(
        async () => {
          const persistedTeam = await getWorldTeamDocument(worldId, 'LAL');
          const rosterEntries = Array.isArray(persistedTeam?.roster)
            ? persistedTeam.roster
            : [];
          const playerEntries = Array.isArray(persistedTeam?.players)
            ? persistedTeam.players
            : [];
          const hasAustinReaves = [...rosterEntries, ...playerEntries].some(
            (entry) => {
              if (typeof entry === 'string') {
                return entry === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id;
              }
              const playerId =
                entry.id || entry.playerId || entry.player_id || null;
              return playerId === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id;
            }
          );
          const deadCapEntry = (persistedTeam?.deadCap || []).find(
            (entry) =>
              entry.playerId === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id ||
              entry.player_id === REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
          );
          const amountByYear = Array.isArray(deadCapEntry?.amountByYear)
            ? Object.fromEntries(
                deadCapEntry.amountByYear.map((row) => {
                  const amountRow = row as Record<string, unknown>;
                  return [
                    String(amountRow.season),
                    Number(amountRow.amount || 0),
                  ];
                })
              )
            : null;

          return {
            hasAustinReaves,
            amountByYear,
            notes: deadCapEntry?.notes || null,
          };
        },
        {
          timeout: 15000,
          message:
            'buyout should remove Austin Reaves and persist dead cap after the buyout reduction',
        }
      )
      // Source-verified re-baseline for the 2026-27 seeded world. Reaves'
      // guaranteed remaining from the current season = $15M (2026-27) + $16M
      // (2027-28) = $31M (the past 2025-26 $14M row is excluded). A $5,000,000
      // buyout reduces the dead cap to $31M - $5M = $26M, persisted as a single
      // lump in the current season 2026-27 for a non-stretch buyout
      // (mutationPipeline.compute.signings.playerOps.ts:100-156). Product is
      // correct; the prior {2025-26: $40M} was the 2025-26-world value.
      .toEqual({
        hasAustinReaves: false,
        amountByYear: {
          '2026-27': 26_000_000,
        },
        notes: 'Buyout reduction: $5,000,000',
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds
              : [];
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : {};
            const mutationMetadata =
              event.mutationMetadata &&
              typeof event.mutationMetadata === 'object'
                ? (event.mutationMetadata as Record<string, unknown>)
                : {};
            return (
              event.mutationType === 'waivePlayer' &&
              playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id) &&
              (metadata.buyout === true || mutationMetadata.buyout === true) &&
              (metadata.buyoutAmount === 5_000_000 ||
                mutationMetadata.buyoutAmount === 5_000_000) &&
              // Same 2026-27 re-baseline as the dead-cap poll above: post-buyout
              // dead cap is $31M remaining - $5M buyout = $26M (was $40M in the
              // 2025-26-authored world). The event metadata carries the same
              // computed deadCapAmount confirmed persisted above.
              (metadata.deadCapAmount === 26_000_000 ||
                mutationMetadata.deadCapAmount === 26_000_000)
            );
          });
        },
        {
          timeout: 20000,
          message:
            'buyout should persist one waivePlayer event with buyout metadata',
        }
      )
      .toBe(true);

    await openDashboardTab(page, 'Roster');
    const rosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(rosterWorkbench).toBeVisible();
    await expect(
      rosterWorkbench.getByAltText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name)
    ).toHaveCount(0);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/buyout/i).first()).toBeVisible();

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
    await expect(page.getByTestId('comparison-roster-removals')).toContainText(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_TRADE_LAL_OUTGOING_PLAYER.name })
    ).toHaveCount(0, { timeout: 20000 });
    const reloadedDeadMoneyToggle = page.getByTestId(
      'cap-sheet-full-dead-money-toggle'
    );
    await expect(reloadedDeadMoneyToggle).toBeVisible();
    await reloadedDeadMoneyToggle.click();
    await expect(
      page.getByText(REVIEW_TRADE_LAL_OUTGOING_PLAYER.name).first()
    ).toBeVisible();

    addAuditNote(
      testInfo,
      'This proves the V1 Buyout path in browser review mode: Full Cap Table row overflow launches Buyout, the shared modal commits a buyout-backed waivePlayer action, the receipt/count state updates, Austin Reaves leaves active roster surfaces, dead money reflects remaining guaranteed salary minus the entered buyout reduction, Team History and Compare read the committed buyout event, and reload preserves the saved-world state.'
    );

    await captureEvidence(page, testInfo, 'D-MQ-004D-buyout-v1');
  });

  test('D-MQ-005: Canonical V1 free-agent signing persists receipt, history, compare, and reload', async ({
    page,
  }, testInfo) => {
    await page.goto(GM_DASHBOARD_BOS_URL, {
      waitUntil: 'domcontentloaded',
    });
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    const beforeBaseTeamDocument = await getBaseTeamDocument('BOS');
    const beforeRosterIds = getTeamPlayerIds(beforeBaseTeamDocument);
    expect(beforeRosterIds).not.toContain(REVIEW_MODE_FREE_AGENT_ID);

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
    const signFreeAgentRadio = page.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
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
    // Source-verified re-baseline for the 2026-27 seeded world (confirmed
    // against the signFreeAgent event's before/after BOS cap totals:
    // capSpace $16,125,607 -> $12,683,370). The default offer's first-year
    // salary is $4,800,000, but signing fills one of BOS's empty roster slots,
    // so the incomplete-roster charge drops by one slot at the 2026-27 rookie
    // minimum ($1,357,763). Net cap-space change = $4,800,000 - $1,357,763 =
    // $3,442,237. The prior -$3,635,655 used the 2025-26 rookie min
    // ($1,164,345); the product's cap accounting is correct, only the seed's
    // rookie-minimum incomplete-roster charge changed.
    await expect(
      page.getByText(/Cap space changed -\$3,442,237/i).first()
    ).toBeVisible();

    const persistedTeamDocument = await getWorldTeamDocument(worldId, 'BOS');
    expect(getTeamPlayerIds(persistedTeamDocument)).toContain(
      REVIEW_MODE_FREE_AGENT_ID
    );

    const persistedEvents = await getWorldEventDocuments(worldId);
    const signingEvent = persistedEvents.find(
      (event) => event.mutationType === 'signFreeAgent'
    );
    expect(signingEvent).toBeTruthy();

    await openDashboardTab(page, 'Roster');
    await expect(page.locator('body')).toContainText(
      /Review\s*Offer\s+Sheet/i
    );

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
      REVIEW_MODE_FREE_AGENT_NAME
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Roster');
    await expect(page.locator('body')).toContainText(
      /Review\s*Offer\s+Sheet/i
    );
    const persistedTeamDocumentAfterReload = await getWorldTeamDocument(
      worldId,
      'BOS'
    );
    expect(getTeamPlayerIds(persistedTeamDocumentAfterReload)).toContain(
      REVIEW_MODE_FREE_AGENT_ID
    );

    addAuditNote(
      testInfo,
      'Canonical V1 acceptance path: BOS saved-world Free Agency signs Review Offer Sheet Guard through the standard Sign Free Agent action, validation gates Confirm Action until the action is selected, the receipt reports roster/cap deltas, Team History shows the committed signFreeAgent event, Compare shows the same committed event with roster/cap deltas, and reload rehydrates the signed player from the saved world.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005-v1-signing-acceptance');
  });

  test('D-MQ-005B: RFA offer sheet stores pending state from the Free Agency row', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await topUpWorldTeamRosterMinimum(worldId, 'BOS', 'Boston Celtics');
    await seedWorldOfferSheetHomeTeamRights(
      worldId,
      'BOS',
      'Boston Celtics',
      REVIEW_MODE_FREE_AGENT_ID
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    await openDashboardTab(page, 'Free Agency');

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

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    const signFreeAgentRadio = modal.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
    await signFreeAgentRadio.check();
    const offerSheetCheckbox = modal.getByLabel(/^Offer Sheet$/i);
    await expect(offerSheetCheckbox).toBeVisible();
    await offerSheetCheckbox.check();

    const confirmActionButton = modal.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeEnabled({ timeout: 20000 });
    await confirmActionButton.click();

    await expect(modal).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Offer sheet stored/i,
      { timeout: 20000 }
    );
    const receiptPanel = page.getByTestId('cockpit-activity-rail-receipts');
    await expect(receiptPanel).toContainText(/Offer sheet stored/i);
    await expect(receiptPanel).toContainText(/LAL/i);
    await expect(receiptPanel).toContainText(/BOS/i);
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '14 / 15'
    );

    await expect
      .poll(
        async () => {
          const [offeringTeam, homeTeam] = await Promise.all([
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldTeamDocument(worldId, 'BOS'),
          ]);
          const outgoingOfferSheet = (offeringTeam?.offerSheets || []).find(
            (offerSheet) =>
              offerSheet.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              offerSheet.offeringTeamCode === 'LAL' &&
              offerSheet.homeTeamCode === 'BOS'
          );
          const incomingOfferSheet = (homeTeam?.incomingOfferSheets || []).find(
            (offerSheet) =>
              offerSheet.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              offerSheet.offeringTeamCode === 'LAL' &&
              offerSheet.homeTeamCode === 'BOS'
          );

          return {
            outgoingStatus: outgoingOfferSheet?.status || null,
            incomingStatus: incomingOfferSheet?.status || null,
            outgoingYears: outgoingOfferSheet?.contractYears || null,
            incomingYears: incomingOfferSheet?.contractYears || null,
          };
        },
        {
          timeout: 20000,
          message:
            'offer sheet should persist as mirrored pending state on offering and home teams',
        }
      )
      .toEqual({
        outgoingStatus: 'PENDING_MATCH',
        incomingStatus: 'PENDING_MATCH',
        outgoingYears: 4,
        incomingYears: 4,
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : {};
            return (
              event.mutationType === 'storeOfferSheet' &&
              metadata.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              metadata.teamCode === 'LAL'
            );
          });
        },
        {
          timeout: 20000,
          message: 'offer sheet should persist one storeOfferSheet event',
        }
      )
      .toBe(true);

    await openDashboardTab(page, 'Roster');
    const rosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(rosterWorkbench).toBeVisible();
    await expect(
      rosterWorkbench.getByAltText(REVIEW_MODE_FREE_AGENT_NAME)
    ).toHaveCount(0);

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/Offer sheet stored/i).first()).toBeVisible();
    await expect(page.getByText(/storeOfferSheet/i).first()).toBeVisible();

    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /1\s+committed event/i,
      { timeout: 20000 }
    );
    await expect(page.getByTestId('comparison-changed-teams')).toContainText(
      /2\s+teams changed/i
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Free Agency');
    await expect(page.getByText(/My Offer Sheets/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(REVIEW_MODE_FREE_AGENT_NAME).first()).toBeVisible();
    await expect(page.getByText(/Waiting for home team/i)).toBeVisible();

    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '14 / 15'
    );
    await expect(
      page
        .getByTestId('cap-sheet-full-player-row-button')
        .filter({ hasText: REVIEW_MODE_FREE_AGENT_NAME })
    ).toHaveCount(0);

    addAuditNote(
      testInfo,
      'This proves the RFA offer-sheet initiation path in browser review mode: LAL saved-world Free Agency row exposes Offer Sheet only for the RFA fixture, stores a pending offer sheet against BOS home-team truth, publishes an honest pending receipt, records History and Compare evidence, keeps LAL roster/cap surfaces unchanged until lifecycle resolution, and reloads the mirrored pending state.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005B-rfa-offer-sheet');
  });

  test('D-MQ-005D: Home-team Decline resolves an incoming offer sheet — player + cap move to the offering team', async ({
    page,
  }, testInfo) => {
    // This proof spans two dashboards (store on LAL, resolve on BOS) plus a
    // reload-parity pass, so it needs more than the default per-test budget.
    test.setTimeout(150_000);
    // BZE-191 acceptance gate: an incoming offer sheet is resolved with a single
    // one-click Decline on the HOME team dashboard. The player and cap must
    // actually move to the offering team, the sheet must disappear from both
    // teams, a declineOfferSheet world event must persist, and reload parity
    // must hold. (Match keeps the player on the home team — covered by the unit
    // suite; this proof exercises the higher-risk Decline movement.)
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await topUpWorldTeamRosterMinimum(worldId, 'BOS', 'Boston Celtics');
    await seedWorldOfferSheetHomeTeamRights(
      worldId,
      'BOS',
      'Boston Celtics',
      REVIEW_MODE_FREE_AGENT_ID
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    // --- Store a pending LAL → BOS offer sheet via the offering-team (LAL) UI,
    // mirroring D-MQ-005B so the pending state has the exact committed shape the
    // resolution flow must consume. ---
    await openDashboardTab(page, 'Free Agency');

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

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    const signFreeAgentRadio = modal.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
    await signFreeAgentRadio.check();
    const offerSheetCheckbox = modal.getByLabel(/^Offer Sheet$/i);
    await expect(offerSheetCheckbox).toBeVisible();
    await offerSheetCheckbox.check();

    const confirmActionButton = modal.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeEnabled({ timeout: 20000 });
    await confirmActionButton.click();

    await expect(modal).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Offer sheet stored/i,
      { timeout: 20000 }
    );

    await expect
      .poll(
        async () => {
          const [offeringTeam, homeTeam] = await Promise.all([
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldTeamDocument(worldId, 'BOS'),
          ]);
          const outgoing = (offeringTeam?.offerSheets || []).find(
            (sheet) =>
              sheet.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              sheet.offeringTeamCode === 'LAL' &&
              sheet.homeTeamCode === 'BOS'
          );
          const incoming = (homeTeam?.incomingOfferSheets || []).find(
            (sheet) =>
              sheet.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              sheet.offeringTeamCode === 'LAL' &&
              sheet.homeTeamCode === 'BOS'
          );
          return {
            outgoingStatus: outgoing?.status || null,
            incomingStatus: incoming?.status || null,
          };
        },
        {
          timeout: 20000,
          message:
            'offer sheet should persist as mirrored PENDING_MATCH state before resolution',
        }
      )
      .toEqual({
        outgoingStatus: 'PENDING_MATCH',
        incomingStatus: 'PENDING_MATCH',
      });

    // --- Switch to the HOME team (BOS) dashboard and Decline the incoming
    // offer sheet with one click. ---
    await page.goto(GM_DASHBOARD_BOS_URL, { waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Free Agency');

    const incomingOfferSheetsSection = page
      .locator('div')
      .filter({
        has: page.getByRole('heading', { name: /Incoming Offer Sheets/i }),
      })
      .first();
    await expect(incomingOfferSheetsSection).toBeVisible({ timeout: 20000 });
    await expect(
      incomingOfferSheetsSection.getByText(REVIEW_MODE_FREE_AGENT_NAME).first()
    ).toBeVisible();

    const declineButton = incomingOfferSheetsSection.getByRole('button', {
      name: /^Decline$/i,
    });
    await expect(declineButton).toBeEnabled({ timeout: 20000 });
    await declineButton.click();

    // --- Acceptance assertions: the player + cap moved to LAL, the sheet is
    // gone from both teams, the world event persisted. ---
    await expect
      .poll(
        async () => {
          const [offeringTeam, homeTeam] = await Promise.all([
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldTeamDocument(worldId, 'BOS'),
          ]);
          const offeringPlayer = getTeamPlayerRecords(
            offeringTeam as Record<string, unknown> | undefined
          ).find((player) => {
            const bio =
              player.bio && typeof player.bio === 'object'
                ? (player.bio as Record<string, unknown>)
                : {};
            return (
              player.playerId === REVIEW_MODE_FREE_AGENT_ID ||
              player.player_id === REVIEW_MODE_FREE_AGENT_ID ||
              player.id === REVIEW_MODE_FREE_AGENT_ID ||
              bio.playerId === REVIEW_MODE_FREE_AGENT_ID
            );
          });
          const offeringContract =
            offeringPlayer && typeof offeringPlayer.contract === 'object'
              ? (offeringPlayer.contract as Record<string, unknown>)
              : null;
          return {
            offeringHasPlayer: Boolean(offeringPlayer),
            offeringPlayerTeam: String(offeringPlayer?.teamCode || ''),
            offeringSignedUsing: String(offeringContract?.signedUsing || ''),
            offeringRosterHasPlayer: getTeamPlayerIds(
              offeringTeam as Record<string, unknown> | undefined
            ).includes(REVIEW_MODE_FREE_AGENT_ID),
            offeringSheetCount: (offeringTeam?.offerSheets || []).filter(
              (sheet) => sheet.playerId === REVIEW_MODE_FREE_AGENT_ID
            ).length,
            homeIncomingCount: (homeTeam?.incomingOfferSheets || []).filter(
              (sheet) => sheet.playerId === REVIEW_MODE_FREE_AGENT_ID
            ).length,
            homeRosterHasPlayer: getTeamPlayerIds(
              homeTeam as Record<string, unknown> | undefined
            ).includes(REVIEW_MODE_FREE_AGENT_ID),
          };
        },
        {
          timeout: 25000,
          message:
            'declining the offer sheet should move the player + cap to LAL and clear the sheet from both teams',
        }
      )
      .toEqual({
        offeringHasPlayer: true,
        offeringPlayerTeam: 'LAL',
        offeringSignedUsing: 'Offer Sheet',
        offeringRosterHasPlayer: true,
        offeringSheetCount: 0,
        homeIncomingCount: 0,
        homeRosterHasPlayer: false,
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : {};
            return (
              event.mutationType === 'declineOfferSheet' &&
              metadata.playerId === REVIEW_MODE_FREE_AGENT_ID
            );
          });
        },
        {
          timeout: 20000,
          message: 'decline should persist one declineOfferSheet world event',
        }
      )
      .toBe(true);

    // --- Reload parity: the resolved state survives a fresh load. ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Free Agency');
    await expect(
      page.getByRole('heading', { name: /Incoming Offer Sheets/i })
    ).toHaveCount(0, { timeout: 20000 });

    const [reloadedOfferingTeam, reloadedHomeTeam] = await Promise.all([
      getWorldTeamDocument(worldId, 'LAL'),
      getWorldTeamDocument(worldId, 'BOS'),
    ]);
    expect(
      getTeamPlayerIds(reloadedOfferingTeam as Record<string, unknown> | undefined)
    ).toContain(REVIEW_MODE_FREE_AGENT_ID);
    expect(
      getTeamPlayerIds(reloadedHomeTeam as Record<string, unknown> | undefined)
    ).not.toContain(REVIEW_MODE_FREE_AGENT_ID);
    expect(
      (reloadedOfferingTeam?.offerSheets || []).filter(
        (sheet) => sheet.playerId === REVIEW_MODE_FREE_AGENT_ID
      )
    ).toHaveLength(0);

    addAuditNote(
      testInfo,
      'This proves BZE-191 offer-sheet resolution in browser review mode: a pending LAL → BOS offer sheet is resolved with a single one-click Decline on the BOS (home) dashboard; the player and cap move to LAL with an Offer Sheet contract, the sheet disappears from both teams, a declineOfferSheet world event persists, and the resolved state survives reload.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005D-offer-sheet-decline');
  });

  test('D-MQ-005E: Home-team Match resolves an incoming offer sheet while the world date is within the 48h window', async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    // BZE-196 acceptance gate: the stored sheet must carry a world-time
    // createdAt so the home-team Match button is still legal in the review
    // world. Match keeps the player on BOS, clears the mirrored sheet, persists
    // a matchOfferSheet event, and survives reload.
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await topUpWorldTeamRosterMinimum(worldId, 'BOS', 'Boston Celtics');
    await seedWorldOfferSheetHomeTeamRights(
      worldId,
      'BOS',
      'Boston Celtics',
      REVIEW_MODE_FREE_AGENT_ID
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    // --- Store a pending LAL → BOS offer sheet via the offering-team UI. ---
    await openDashboardTab(page, 'Free Agency');

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

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    const signFreeAgentRadio = modal.getByRole('radio', {
      name: /Sign Free Agent/i,
    });
    await expect(signFreeAgentRadio).toBeVisible();
    await signFreeAgentRadio.check();
    const offerSheetCheckbox = modal.getByLabel(/^Offer Sheet$/i);
    await expect(offerSheetCheckbox).toBeVisible();
    await offerSheetCheckbox.check();

    const confirmActionButton = modal.getByRole('button', {
      name: /^Confirm Action$/i,
    });
    await expect(confirmActionButton).toBeEnabled({ timeout: 20000 });
    await confirmActionButton.click();

    await expect(modal).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Offer sheet stored/i,
      { timeout: 20000 }
    );

    await expect
      .poll(
        async () => {
          const [offeringTeam, homeTeam] = await Promise.all([
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldTeamDocument(worldId, 'BOS'),
          ]);
          const outgoing = (offeringTeam?.offerSheets || []).find(
            (sheet) =>
              sheet.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              sheet.offeringTeamCode === 'LAL' &&
              sheet.homeTeamCode === 'BOS'
          );
          const incoming = (homeTeam?.incomingOfferSheets || []).find(
            (sheet) =>
              sheet.playerId === REVIEW_MODE_FREE_AGENT_ID &&
              sheet.offeringTeamCode === 'LAL' &&
              sheet.homeTeamCode === 'BOS'
          );
          return {
            outgoingStatus: outgoing?.status || null,
            incomingStatus: incoming?.status || null,
            outgoingCreatedDate:
              typeof outgoing?.createdAt === 'string'
                ? outgoing.createdAt.slice(0, 10)
                : null,
            incomingCreatedDate:
              typeof incoming?.createdAt === 'string'
                ? incoming.createdAt.slice(0, 10)
                : null,
          };
        },
        {
          timeout: 20000,
          message:
            'offer sheet should persist as mirrored PENDING_MATCH state stamped in world-time before match',
        }
      )
      .toEqual({
        outgoingStatus: 'PENDING_MATCH',
        incomingStatus: 'PENDING_MATCH',
        outgoingCreatedDate: REVIEW_WORLD_AS_OF_DATE,
        incomingCreatedDate: REVIEW_WORLD_AS_OF_DATE,
      });

    // --- Switch to the HOME team (BOS) dashboard and Match the incoming sheet. ---
    await page.goto(GM_DASHBOARD_BOS_URL, { waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Free Agency');

    const incomingOfferSheetsSection = page
      .locator('div')
      .filter({
        has: page.getByRole('heading', { name: /Incoming Offer Sheets/i }),
      })
      .first();
    await expect(incomingOfferSheetsSection).toBeVisible({ timeout: 20000 });
    await expect(
      incomingOfferSheetsSection.getByText(REVIEW_MODE_FREE_AGENT_NAME).first()
    ).toBeVisible();

    const matchButton = incomingOfferSheetsSection.getByRole('button', {
      name: /^Match$/i,
    });
    await expect(matchButton).toBeEnabled({ timeout: 20000 });
    await matchButton.click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Offer sheet matched/i,
      { timeout: 20000 }
    );

    await expect
      .poll(
        async () => {
          const [offeringTeam, homeTeam] = await Promise.all([
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldTeamDocument(worldId, 'BOS'),
          ]);
          const homePlayer = getTeamPlayerRecords(
            homeTeam as Record<string, unknown> | undefined
          ).find((player) => {
            const bio =
              player.bio && typeof player.bio === 'object'
                ? (player.bio as Record<string, unknown>)
                : {};
            return (
              player.playerId === REVIEW_MODE_FREE_AGENT_ID ||
              player.player_id === REVIEW_MODE_FREE_AGENT_ID ||
              player.id === REVIEW_MODE_FREE_AGENT_ID ||
              bio.playerId === REVIEW_MODE_FREE_AGENT_ID
            );
          });
          const homeContract =
            homePlayer && typeof homePlayer.contract === 'object'
              ? (homePlayer.contract as Record<string, unknown>)
              : null;
          return {
            homeHasPlayer: Boolean(homePlayer),
            homePlayerTeam: String(homePlayer?.teamCode || ''),
            homeSignedUsing: String(homeContract?.signedUsing || ''),
            homeRosterHasPlayer: getTeamPlayerIds(
              homeTeam as Record<string, unknown> | undefined
            ).includes(REVIEW_MODE_FREE_AGENT_ID),
            offeringRosterHasPlayer: getTeamPlayerIds(
              offeringTeam as Record<string, unknown> | undefined
            ).includes(REVIEW_MODE_FREE_AGENT_ID),
            offeringSheetCount: (offeringTeam?.offerSheets || []).filter(
              (sheet) => sheet.playerId === REVIEW_MODE_FREE_AGENT_ID
            ).length,
            homeIncomingCount: (homeTeam?.incomingOfferSheets || []).filter(
              (sheet) => sheet.playerId === REVIEW_MODE_FREE_AGENT_ID
            ).length,
          };
        },
        {
          timeout: 25000,
          message:
            'matching the offer sheet should keep the player on BOS and clear the sheet from both teams',
        }
      )
      .toEqual({
        homeHasPlayer: true,
        homePlayerTeam: 'BOS',
        homeSignedUsing: 'Match',
        homeRosterHasPlayer: true,
        offeringRosterHasPlayer: false,
        offeringSheetCount: 0,
        homeIncomingCount: 0,
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : {};
            return (
              event.mutationType === 'matchOfferSheet' &&
              metadata.playerId === REVIEW_MODE_FREE_AGENT_ID
            );
          });
        },
        {
          timeout: 20000,
          message: 'match should persist one matchOfferSheet world event',
        }
      )
      .toBe(true);

    // --- Reload parity: the matched state survives a fresh load. ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Free Agency');
    await expect(
      page.getByRole('heading', { name: /Incoming Offer Sheets/i })
    ).toHaveCount(0, { timeout: 20000 });

    const [reloadedOfferingTeam, reloadedHomeTeam] = await Promise.all([
      getWorldTeamDocument(worldId, 'LAL'),
      getWorldTeamDocument(worldId, 'BOS'),
    ]);
    expect(
      getTeamPlayerIds(reloadedHomeTeam as Record<string, unknown> | undefined)
    ).toContain(REVIEW_MODE_FREE_AGENT_ID);
    expect(
      getTeamPlayerIds(
        reloadedOfferingTeam as Record<string, unknown> | undefined
      )
    ).not.toContain(REVIEW_MODE_FREE_AGENT_ID);
    expect(
      (reloadedOfferingTeam?.offerSheets || []).filter(
        (sheet) => sheet.playerId === REVIEW_MODE_FREE_AGENT_ID
      )
    ).toHaveLength(0);

    addAuditNote(
      testInfo,
      'This proves BZE-196/BZE-191 Match in browser review mode: a pending LAL → BOS offer sheet is stamped with the review world date, resolved with one-click Match on BOS while still inside the 48-hour window, keeps the player and cap on BOS with a Match contract, clears the sheet from both teams, persists a matchOfferSheet event, and survives reload.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005E-offer-sheet-match');
  });

  test('D-MQ-005A: Canonical V1 saved-world own-FA Re-sign persists FCT, Roster, history, compare, and reload', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);

    await page.goto(GM_DASHBOARD_MIA_OWN_FA_URL, {
      waitUntil: 'domcontentloaded',
    });
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'MIA', 'MIAMI HEAT');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Full Cap Table');

    const fullCapRegion = page
      .getByRole('region', { name: /Full Cap Table/i })
      .first();
    await expect(fullCapRegion).toBeVisible({ timeout: 20000 });

    const faRow = ownFaDecisionRow(page);
    await expect(faRow).toBeVisible({ timeout: 20000 });
    await expect(
      faRow.getByTestId('cap-sheet-full-fa-resign-cell').first()
    ).toContainText('$15,000,000');
    await expect(signedOwnFaPlayerRow(page)).toHaveCount(0);
    // Source-verified re-baseline (BZE-241 two-way separation): the status strip
    // reads "{standard} / 15 · {two-way} / 3". Before re-signing, MIA is 12
    // standard + 1 two-way (mia_tobias_lund, $597K); Grant Holloway is still a
    // $15M own-FA cap hold, not a rostered player. Was "13 / 15" (pre-BZE-241,
    // the single two-way was folded into the standard count).
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '12 / 15 · 1 / 3'
    );

    const beforeTotalCap = await readCockpitTotalCapMillions(page);
    expect(Number.isFinite(beforeTotalCap)).toBe(true);
    const beforePersistedTeam = await getWorldTeamDocument(worldId, 'MIA');
    expect(getTeamPlayerIds(beforePersistedTeam)).toContain(
      REVIEW_MIA_OWN_FA_ID
    );
    expect(hasCapHoldForPlayer(beforePersistedTeam, REVIEW_MIA_OWN_FA_ID)).toBe(
      true
    );
    expect(
      contractHasSeasonSalary(
        findTeamPlayerRecord(beforePersistedTeam, REVIEW_MIA_OWN_FA_ID),
        '2026-27',
        12_000_000
      )
    ).toBe(false);

    addAuditNote(
      testInfo,
      `BZE-111 entry proof: ${GM_DASHBOARD_MIA_OWN_FA_URL} restored saved world ${worldId}, showed MIA 2026-27, and preserved Grant Holloway as the Full Cap Table own-FA Re-sign row after reload before any move.`
    );
    await captureEvidence(page, testInfo, 'D-MQ-005A-before-own-fa-resign');

    await faRow.getByTestId('cap-sheet-full-fa-resign-cell').first().click();

    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(
      modal.getByTestId('contract-modal-action-context')
    ).toContainText(REVIEW_MIA_OWN_FA_NAME);
    await expect(
      modal.getByTestId('contract-modal-action-context')
    ).toContainText(/2026-27/i);
    await modal.getByTestId('contract-action-resign').check();
    await expect(modal.getByTestId('contract-action-resign')).toBeChecked();
    await expect(
      modal.locator('input[inputmode="decimal"]').first()
    ).toHaveValue('$12,000,000');

    const confirmButton = modal.getByTestId(
      'edit-contract-confirm-action-button'
    );
    await expect(confirmButton).toBeEnabled({ timeout: 20000 });
    await confirmButton.click();
    await expect(modal).toHaveCount(0, { timeout: 20000 });

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Free agent signed/i,
      { timeout: 20000 }
    );
    await expect(page.getByText(/Cap space changed/i).first()).toBeVisible();

    await expect(ownFaDecisionRow(page)).toHaveCount(0, { timeout: 20000 });
    const signedRow = signedOwnFaPlayerRow(page);
    await expect(signedRow).toHaveCount(1, { timeout: 20000 });
    await expect(signedRow).toContainText('$12,000,000');
    await expect
      .poll(async () => readCockpitTotalCapMillions(page), {
        message:
          "FCT total should fall after replacing Grant Holloway's $15M cap hold with a $12M signed contract",
      })
      .toBeLessThan(beforeTotalCap);
    // Source-verified re-baseline: re-signing Grant Holloway (from a $15M cap
    // hold to a $12M signed Standard contract, Full Bird) adds him to the
    // standard roster, so the strip advances to 13 standard + 1 two-way. Was
    // "14 / 15" (pre-BZE-241 two-way folding).
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15 · 1 / 3'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005A-after-own-fa-resign-fct');

    await openDashboardTab(page, 'Roster');
    const rosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(rosterWorkbench).toBeVisible();
    const truthPanel = rosterWorkbench.getByTestId(
      'architect-roster-truth-panel'
    );
    await expect(truthPanel).toHaveAttribute('data-roster-active-year', '2027');
    await expect(truthPanel).toHaveAttribute(
      'data-roster-displayed-count',
      '14'
    );
    await expect(
      rosterWorkbench.getByAltText(REVIEW_MIA_OWN_FA_NAME)
    ).toHaveCount(1);
    await captureEvidence(
      page,
      testInfo,
      'D-MQ-005A-after-own-fa-resign-roster'
    );

    await expect
      .poll(
        async () => {
          const persistedTeam = await getWorldTeamDocument(worldId, 'MIA');
          const grantRecordCount = getTeamPlayerRecords(persistedTeam).filter(
            (player) =>
              player.id === REVIEW_MIA_OWN_FA_ID ||
              player.playerId === REVIEW_MIA_OWN_FA_ID ||
              player.player_id === REVIEW_MIA_OWN_FA_ID
          ).length;
          return {
            hasGrant: getTeamPlayerIds(persistedTeam).includes(
              REVIEW_MIA_OWN_FA_ID
            ),
            hasGrantHold: hasCapHoldForPlayer(
              persistedTeam,
              REVIEW_MIA_OWN_FA_ID
            ),
            hasSignedSalary: contractHasSeasonSalary(
              findTeamPlayerRecord(persistedTeam, REVIEW_MIA_OWN_FA_ID),
              '2026-27',
              12_000_000
            ),
            grantRecordCount,
          };
        },
        {
          timeout: 20000,
          message:
            'saved-world MIA team should contain one signed Grant Holloway contract and no ghost cap hold',
        }
      )
      .toEqual({
        hasGrant: true,
        hasGrantHold: false,
        hasSignedSalary: true,
        grantRecordCount: 1,
      });

    await expect
      .poll(
        async () => {
          const persistedEvents = await getWorldEventDocuments(worldId);
          return persistedEvents.some((event) => {
            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds
              : [];
            return (
              event.mutationType === 'signFreeAgent' &&
              playerIds.includes(REVIEW_MIA_OWN_FA_ID)
            );
          });
        },
        {
          timeout: 20000,
          message: 'own-FA Re-sign should persist a signFreeAgent event',
        }
      )
      .toBe(true);

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
    // BZE-218: an own-FA re-sign lands under Compare Additions — the re-signed
    // player joins the rostered set from a cap hold (roster went 12 -> 13
    // standard). Was "None detected" (a pre-BZE-218 assumption that re-signs
    // were contract-only, not roster additions). Removals/changed stay none.
    await expect(page.getByTestId('comparison-roster-additions')).toContainText(
      REVIEW_MIA_OWN_FA_NAME
    );
    await expect(page.getByTestId('comparison-roster-removals')).toContainText(
      /None detected/i
    );
    await expect(page.getByTestId('comparison-roster-changed')).toContainText(
      /None detected/i
    );
    await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Full Cap Table');
    await expect(ownFaDecisionRow(page)).toHaveCount(0, { timeout: 20000 });
    await expect(signedOwnFaPlayerRow(page)).toHaveCount(1, {
      timeout: 20000,
    });
    // Reload preserves the post-resign roster: 13 standard + 1 two-way (was
    // "14 / 15" pre-BZE-241 two-way folding).
    await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
      '13 / 15 · 1 / 3'
    );
    await openDashboardTab(page, 'Roster');
    const reloadedRosterWorkbench = page
      .getByTestId('cockpit-workbench')
      .and(page.locator('[data-active-tab="roster"]'));
    await expect(
      reloadedRosterWorkbench.getByAltText(REVIEW_MIA_OWN_FA_NAME)
    ).toHaveCount(1);

    addAuditNote(
      testInfo,
      'BZE-112 canonical move proof: MIA saved-world Full Cap Table Re-sign converts Grant Holloway from a $15M own-FA cap hold into one $12M signed roster contract, removes the ghost hold, updates cockpit/FCT/Roster, records signFreeAgent history plus Compare cap-delta evidence, and survives reload in the same saved world.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005A-after-reload');
  });

  test('D-MQ-005C: Sign-and-trade from the Full Cap Table own-FA row persists, hard-caps the receiver, and rehydrates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(240000);

    // BZE-190: start the sign-and-trade on the own free agent's Full Cap Table
    // decision row (MIA's Grant Holloway), assemble + rule-check it in the Trade
    // Machine (Holloway out on a new contract, Austin Reaves back), apply, and
    // verify the saved world: the new contract lands on LAL, MIA's cap hold is
    // gone, Reaves moves to MIA, LAL is hard-capped at the first apron, an
    // executeTrade event is recorded, and the re-entered dashboard rehydrates.
    await page.goto(GM_DASHBOARD_MIA_OWN_FA_URL, {
      waitUntil: 'domcontentloaded',
    });
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'MIA', 'Miami Heat');
    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    const beforeMia = await getWorldTeamDocument(worldId, 'MIA');
    const beforeLal = await getWorldTeamDocument(worldId, 'LAL');
    const beforeEvents = await getWorldEventDocuments(worldId);
    expect(hasCapHoldForPlayer(beforeMia, REVIEW_MIA_OWN_FA_ID)).toBe(true);
    expect(getTeamPlayerIds(beforeLal)).toContain(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
    );

    // --- Entry: Full Cap Table own-FA decision row → Sign & Trade ---
    await openDashboardTab(page, 'Full Cap Table');
    const faRow = page
      .getByTestId('cap-sheet-full-fa-decision-row')
      .filter({ hasText: REVIEW_MIA_OWN_FA_NAME });
    await expect(faRow).toBeVisible({ timeout: 20000 });
    await faRow.hover();
    const signAndTradeButton = faRow.getByTestId(
      'cap-sheet-full-fa-sign-and-trade-button'
    );
    await expect(signAndTradeButton).toBeVisible();
    await signAndTradeButton.click();

    // --- The Trade Machine opens with the free agent parked as a pending piece ---
    const tradeDialog = page.getByRole('dialog', { name: /Trade Machine/i });
    await expect(tradeDialog).toBeVisible({ timeout: 20000 });
    await expect(
      tradeDialog.getByTestId('pending-sign-and-trade')
    ).toBeVisible({ timeout: 20000 });
    await expect(
      tradeDialog.getByTestId('pending-sign-and-trade-player')
    ).toContainText(REVIEW_MIA_OWN_FA_NAME);

    // --- Add the receiving team (LAL) so it can be the trade destination ---
    // Wait for the source team (MIA) to auto-load as slot 0 first, otherwise the
    // picker would land in the still-empty source slot and overwrite it with LAL.
    await expect(
      tradeDialog.getByRole('button', { name: /Miami Heat/i })
    ).toBeVisible({ timeout: 20000 });
    const existingTeamPickers = tradeDialog
      .locator('label', { hasText: /^Select Team$/i })
      .locator('xpath=following-sibling::select[1]');
    if ((await existingTeamPickers.count()) === 0) {
      await tradeDialog
        .getByRole('button', { name: /Add Team|Add 2nd Team/i })
        .click();
    }
    const teamPicker = tradeDialog
      .locator('label', { hasText: /^Select Team$/i })
      .locator('xpath=following-sibling::select[1]')
      .first();
    await expect(teamPicker).toBeVisible();
    await teamPicker.selectOption('lakers');

    // --- Set the new contract + destination on the pending sign-and-trade ---
    await tradeDialog
      .getByRole('button', { name: /Set contract & destination/i })
      .click();
    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });

    // Destination team (Headless UI listbox) → Los Angeles Lakers.
    await modal.locator('button[aria-haspopup="listbox"]').first().click();
    await page
      .getByRole('option', { name: /Los Angeles Lakers/i })
      .click();

    // 3-year sign-and-trade contract, first year $15M to match Reaves.
    const yearsSelect = modal
      .locator('select')
      .filter({ has: page.getByRole('option', { name: '3yr' }) })
      .first();
    await yearsSelect.selectOption('3');
    const firstYearSalary = modal.locator('input[inputmode="decimal"]').first();
    await firstYearSalary.fill('15000000');

    const confirmContractButton = modal.getByTestId(
      'edit-contract-confirm-action-button'
    );
    await expect(confirmContractButton).toBeEnabled({ timeout: 20000 });
    await confirmContractButton.click();
    await expect(modal).toHaveCount(0, { timeout: 20000 });

    // The pending prompt clears; Holloway is now a staged S&T outgoing piece.
    await expect(
      tradeDialog.getByTestId('pending-sign-and-trade')
    ).toHaveCount(0);

    // --- Match salary back: Austin Reaves (LAL) → Miami Heat ---
    await routeTradePlayer(
      page,
      'Los Angeles Lakers',
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name,
      'Miami Heat'
    );

    // --- Validate + apply ---
    const validateTradeButton = tradeDialog.getByRole('button', {
      name: /^Validate Trade$/i,
    });
    await expect(validateTradeButton).toBeVisible();
    await validateTradeButton.click();
    // BZE-247: neutral recency pill wording ("Last checked", not "Validated").
    await expect(page.getByTestId('validation-state-header')).toContainText(
      /Last checked/i,
      { timeout: 20000 }
    );

    const applyTradeButton = tradeDialog.getByRole('button', {
      name: /^Apply Trade$/i,
    });
    await expect
      .poll(async () => applyTradeButton.isEnabled(), {
        timeout: 20000,
        message: 'sign-and-trade should validate as legal before apply',
      })
      .toBe(true);

    const previewCloseButton = page.locator('button[title="Close"]').first();
    if (await isVisible(previewCloseButton, 2000)) {
      await previewCloseButton.click();
    }
    await applyTradeButton.click();

    // --- Persistence proof: saved-world team docs + executeTrade event ---
    await expect
      .poll(
        async () => {
          const [miaDocument, lalDocument, worldEvents] = await Promise.all([
            getWorldTeamDocument(worldId, 'MIA'),
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldEventDocuments(worldId),
          ]);
          const tradeEvent = worldEvents.find((event) => {
            if (event.mutationType !== 'executeTrade') return false;
            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds.map((id) => String(id))
              : [];
            return (
              playerIds.includes(REVIEW_MIA_OWN_FA_ID) &&
              playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id)
            );
          });
          return {
            lalHasHolloway: getTeamPlayerIds(lalDocument).includes(
              REVIEW_MIA_OWN_FA_ID
            ),
            miaHasReaves: getTeamPlayerIds(miaDocument).includes(
              REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
            ),
            miaHoldCleared: !hasCapHoldForPlayer(
              miaDocument,
              REVIEW_MIA_OWN_FA_ID
            ),
            lalHardCapped: Boolean(
              (lalDocument as { totals?: { isHardCapped?: boolean } })?.totals
                ?.isHardCapped
            ),
            sawTradeEvent: Boolean(tradeEvent),
          };
        },
        {
          timeout: 20000,
          message:
            'sign-and-trade apply should persist the new contract on LAL, clear the MIA cap hold, move Reaves to MIA, hard-cap LAL, and record an executeTrade event',
        }
      )
      .toMatchObject({
        lalHasHolloway: true,
        miaHasReaves: true,
        miaHoldCleared: true,
        lalHardCapped: true,
        sawTradeEvent: true,
      });

    const afterLal = await getWorldTeamDocument(worldId, 'LAL');
    const hollowayOnLal = findTeamPlayerRecord(afterLal, REVIEW_MIA_OWN_FA_ID);
    expect(hollowayOnLal).toBeTruthy();
    expect(
      (hollowayOnLal as { contract?: { contractType?: string } } | null)
        ?.contract?.contractType
    ).toMatch(/sign\s*&?\s*trade/i);
    const afterEvents = await getWorldEventDocuments(worldId);
    expect(afterEvents.length).toBeGreaterThan(beforeEvents.length);

    // --- Reload / re-entry rehydrates the persisted world ---
    await reenterDashboardViaAppNavigation(page);
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/executeTrade/i).first()).toBeVisible();

    addAuditNote(
      testInfo,
      'BZE-190 sign-and-trade proof: MIA saved-world Full Cap Table own-FA row launches Grant Holloway into the Trade Machine as a pending sign-and-trade piece, a 3-year $15M new contract + Austin Reaves return validates and applies, the saved world persists the new contract on LAL, removes the MIA cap hold, moves Reaves to MIA, hard-caps LAL at the first apron, records an executeTrade event, and the re-entered dashboard rehydrates with the committed trade in Team History.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005C-sign-and-trade-proof');
  });

  test('D-MQ-005F: Sign-and-trade STARTS from the Free Agency room, then persists and hard-caps the receiver', async ({
    page,
  }, testInfo) => {
    test.setTimeout(240000);

    // BZE-249: the sign-and-trade workflow starts from the Free Agency room's
    // "Your Free Agents" panel (contract W8), then assembles + rule-checks in the
    // Trade Machine exactly like the Full Cap Table entry (D-MQ-005C). This test
    // proves the NEW entry point launches the identical, fully-applying flow:
    // MIA's Grant Holloway out on a new LAL contract, Austin Reaves back, apply,
    // persist, hard-cap LAL, and rehydrate.
    await page.goto(GM_DASHBOARD_MIA_OWN_FA_URL, {
      waitUntil: 'domcontentloaded',
    });
    await ensureTeamDataLoaded(page, testInfo);
    const worldId = await ensureWorldSelected(page, testInfo);

    await topUpWorldTeamRosterMinimum(worldId, 'MIA', 'Miami Heat');
    await topUpWorldTeamRosterMinimum(worldId, 'LAL', 'Los Angeles Lakers');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);

    const beforeMia = await getWorldTeamDocument(worldId, 'MIA');
    const beforeLal = await getWorldTeamDocument(worldId, 'LAL');
    const beforeEvents = await getWorldEventDocuments(worldId);
    expect(hasCapHoldForPlayer(beforeMia, REVIEW_MIA_OWN_FA_ID)).toBe(true);
    expect(getTeamPlayerIds(beforeLal)).toContain(
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
    );

    // --- Entry: Free Agency room → "Your Free Agents" panel → Sign & Trade ---
    await openDashboardTab(page, 'Free Agency');
    const ownFaPanel = page.getByTestId('own-free-agents-panel');
    await expect(ownFaPanel).toBeVisible({ timeout: 20000 });
    const ownFaRow = page
      .getByTestId('own-free-agent-row')
      .filter({ hasText: REVIEW_MIA_OWN_FA_NAME });
    await expect(ownFaRow).toBeVisible({ timeout: 20000 });
    // Parity: the Free Agency panel surfaces the same own free agent the Full
    // Cap Table shows as an FA decision row.
    await ownFaRow
      .getByTestId('own-free-agent-sign-and-trade-button')
      .click();

    // --- The Trade Machine opens with the free agent parked as a pending piece ---
    const tradeDialog = page.getByRole('dialog', { name: /Trade Machine/i });
    await expect(tradeDialog).toBeVisible({ timeout: 20000 });
    await expect(
      tradeDialog.getByTestId('pending-sign-and-trade')
    ).toBeVisible({ timeout: 20000 });
    await expect(
      tradeDialog.getByTestId('pending-sign-and-trade-player')
    ).toContainText(REVIEW_MIA_OWN_FA_NAME);

    // --- Add the receiving team (LAL) so it can be the trade destination ---
    await expect(
      tradeDialog.getByRole('button', { name: /Miami Heat/i })
    ).toBeVisible({ timeout: 20000 });
    const existingTeamPickers = tradeDialog
      .locator('label', { hasText: /^Select Team$/i })
      .locator('xpath=following-sibling::select[1]');
    if ((await existingTeamPickers.count()) === 0) {
      await tradeDialog
        .getByRole('button', { name: /Add Team|Add 2nd Team/i })
        .click();
    }
    const teamPicker = tradeDialog
      .locator('label', { hasText: /^Select Team$/i })
      .locator('xpath=following-sibling::select[1]')
      .first();
    await expect(teamPicker).toBeVisible();
    await teamPicker.selectOption('lakers');

    // --- Set the new contract + destination on the pending sign-and-trade ---
    await tradeDialog
      .getByRole('button', { name: /Set contract & destination/i })
      .click();
    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });

    await modal.locator('button[aria-haspopup="listbox"]').first().click();
    await page.getByRole('option', { name: /Los Angeles Lakers/i }).click();

    const yearsSelect = modal
      .locator('select')
      .filter({ has: page.getByRole('option', { name: '3yr' }) })
      .first();
    await yearsSelect.selectOption('3');
    const firstYearSalary = modal.locator('input[inputmode="decimal"]').first();
    await firstYearSalary.fill('15000000');

    const confirmContractButton = modal.getByTestId(
      'edit-contract-confirm-action-button'
    );
    await expect(confirmContractButton).toBeEnabled({ timeout: 20000 });
    await confirmContractButton.click();
    await expect(modal).toHaveCount(0, { timeout: 20000 });

    await expect(
      tradeDialog.getByTestId('pending-sign-and-trade')
    ).toHaveCount(0);

    // --- Match salary back: Austin Reaves (LAL) → Miami Heat ---
    await routeTradePlayer(
      page,
      'Los Angeles Lakers',
      REVIEW_TRADE_LAL_OUTGOING_PLAYER.name,
      'Miami Heat'
    );

    // --- Validate + apply ---
    const validateTradeButton = tradeDialog.getByRole('button', {
      name: /^Validate Trade$/i,
    });
    await expect(validateTradeButton).toBeVisible();
    await validateTradeButton.click();
    await expect(page.getByTestId('validation-state-header')).toContainText(
      /Last checked/i,
      { timeout: 20000 }
    );

    const applyTradeButton = tradeDialog.getByRole('button', {
      name: /^Apply Trade$/i,
    });
    await expect
      .poll(async () => applyTradeButton.isEnabled(), {
        timeout: 20000,
        message: 'sign-and-trade should validate as legal before apply',
      })
      .toBe(true);

    const previewCloseButton = page.locator('button[title="Close"]').first();
    if (await isVisible(previewCloseButton, 2000)) {
      await previewCloseButton.click();
    }
    await applyTradeButton.click();

    // --- Persistence + hard-cap proof (identical to D-MQ-005C) ---
    await expect
      .poll(
        async () => {
          const [miaDocument, lalDocument, worldEvents] = await Promise.all([
            getWorldTeamDocument(worldId, 'MIA'),
            getWorldTeamDocument(worldId, 'LAL'),
            getWorldEventDocuments(worldId),
          ]);
          const tradeEvent = worldEvents.find((event) => {
            if (event.mutationType !== 'executeTrade') return false;
            const playerIds = Array.isArray(event.playerIds)
              ? event.playerIds.map((id) => String(id))
              : [];
            return (
              playerIds.includes(REVIEW_MIA_OWN_FA_ID) &&
              playerIds.includes(REVIEW_TRADE_LAL_OUTGOING_PLAYER.id)
            );
          });
          return {
            lalHasHolloway: getTeamPlayerIds(lalDocument).includes(
              REVIEW_MIA_OWN_FA_ID
            ),
            miaHasReaves: getTeamPlayerIds(miaDocument).includes(
              REVIEW_TRADE_LAL_OUTGOING_PLAYER.id
            ),
            miaHoldCleared: !hasCapHoldForPlayer(
              miaDocument,
              REVIEW_MIA_OWN_FA_ID
            ),
            lalHardCapped: Boolean(
              (lalDocument as { totals?: { isHardCapped?: boolean } })?.totals
                ?.isHardCapped
            ),
            sawTradeEvent: Boolean(tradeEvent),
          };
        },
        {
          timeout: 20000,
          message:
            'Free Agency-launched sign-and-trade should persist the new contract on LAL, clear the MIA cap hold, move Reaves to MIA, hard-cap LAL, and record an executeTrade event',
        }
      )
      .toMatchObject({
        lalHasHolloway: true,
        miaHasReaves: true,
        miaHoldCleared: true,
        lalHardCapped: true,
        sawTradeEvent: true,
      });

    const afterEvents = await getWorldEventDocuments(worldId);
    expect(afterEvents.length).toBeGreaterThan(beforeEvents.length);

    // --- Reload / re-entry rehydrates the persisted world ---
    await reenterDashboardViaAppNavigation(page);
    await ensureTeamDataLoaded(page, testInfo);
    await ensureSpecificWorldSelected(page, worldId, testInfo);
    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/executeTrade/i).first()).toBeVisible();

    addAuditNote(
      testInfo,
      'BZE-249 Free Agency sign-and-trade start point: the MIA saved-world Free Agency room "Your Free Agents" panel launches Grant Holloway into the Trade Machine as a pending sign-and-trade piece; a 3-year $15M new contract + Austin Reaves return validates and applies; the saved world persists the new contract on LAL, removes the MIA cap hold, moves Reaves to MIA, hard-caps LAL at the first apron, records an executeTrade event, and the re-entered dashboard rehydrates the committed trade in Team History.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-005F-fa-sign-and-trade-proof');
  });

  test('D-MQ-006: Offseason room is excluded from V1 navigation', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    // BZE-250 (owner-decided exclusion): V1 does not ship the nonfunctional
    // Offseason preview as a navigable room. It must not appear as a nav tab,
    // and its `?room=offseason` deep link falls back to the home surface rather
    // than rendering the parked preview room. Season advance (the supported W11
    // mechanism) moved to the top-bar World menu; the room + code stay parked.
    await expect(page.getByRole('tab', { name: /^Offseason$/i })).toHaveCount(0);

    const deepLink = `${GM_DASHBOARD_URL}${GM_DASHBOARD_URL.includes('?') ? '&' : '?'}room=offseason`;
    await page.goto(deepLink, { waitUntil: 'domcontentloaded' });
    await ensureTeamDataLoaded(page, testInfo);

    // The deep link resolves to the home surface — not the preview room.
    await expect(page.getByTestId('offseason-preview-banner')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Offseason$/i })).toHaveCount(0);

    addAuditNote(
      testInfo,
      'BZE-250: the Offseason preview room is absent from V1 navigation — no Offseason nav tab, and a ?room=offseason deep link falls back to the Full Cap Table home surface (no preview banner). The room + its code are parked for post-V1; season advance moved to the World menu.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-006-offseason-excluded');
  });

  test('D-MQ-007: Season Advance modal opens with world-aware gating', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    await ensureWorldSelected(page, testInfo);

    // BZE-250: season advance opens from the top-bar World menu, not a room.
    const advanceSeasonButton = page.getByTestId('cockpit-season-advance-open');
    await openWorldMenuFor(page, advanceSeasonButton);
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
    // The owner-facing history banner shows GM copy ("This saved season") and
    // never a raw world id (BZE-209 boundary / banned internal vocabulary). The
    // world scope stays verifiable through the data attribute the banner carries.
    await expect(
      page.getByTestId('team-history-world-banner')
    ).toHaveAttribute('data-history-world-id', worldId);

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

  // BZE-251: entitlement/pick authoring is hidden from owner-facing V1 builds.
  // D-MQ-009 exercises the admin authoring path, so it is declared only when the
  // flag is opted in (VITE_FEATURE_ENTITLEMENT_AUTHORING=true); otherwise it is
  // skipped at declaration time so its beforeEach dashboard load is skipped too.
  // D-MQ-009B (below) covers the default flag-off owner-facing build.
  const entitlementAuthoringEnabled =
    process.env.VITE_FEATURE_ENTITLEMENT_AUTHORING === 'true';
  const authoringOnlyTest = entitlementAuthoringEnabled ? test : test.skip;
  const authoringOffOnlyTest = entitlementAuthoringEnabled ? test.skip : test;

  authoringOnlyTest('D-MQ-009: Entitlement authoring saves world data and blocks conflicting claims', async ({
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

  // BZE-251 (owner-decided exclusion): in the owner-facing V1 build the Trade
  // Machine must NOT surface admin authoring affordances — no "+ New Entitlement"
  // create control and no pick "Modify" edit control. Trading existing
  // picks/entitlements stays fully in scope; only the authoring controls are
  // hidden. Declared for the default flag-off build; skipped when authoring is
  // opted in (that path is D-MQ-009).
  authoringOffOnlyTest('D-MQ-009B: The normal Trade Machine shows no entitlement/pick authoring controls', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    await ensureWorldSelected(page, testInfo);

    await openDashboardTab(page, 'Trade Machine');
    await expect(
      page.getByRole('heading', { name: /^Trade Machine$/i })
    ).toBeVisible();

    // Open the primary team's Picks tab — where authoring controls would live.
    const picksTabButton = page
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .first();
    await expect(picksTabButton).toBeVisible();
    await picksTabButton.click();

    // No admin authoring: neither the create ("+ New Entitlement") nor the pick
    // edit ("Modify") control is present.
    await expect(
      page.getByRole('button', { name: /New Entitlement/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Modify$/i })
    ).toHaveCount(0);

    addAuditNote(
      testInfo,
      'BZE-251: the owner-facing Trade Machine (entitlement authoring flag off) exposes no admin authoring affordances — no "+ New Entitlement" create control and no pick "Modify" edit control on the Picks tab. Trading existing picks/entitlements remains available; only authoring is hidden. The admin authoring path itself stays proven by D-MQ-009 under VITE_FEATURE_ENTITLEMENT_AUTHORING=true.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-009B-no-authoring-controls');
  });

  test('D-MQ-010: Base-write deny evidence remains paired with rules proof', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    // Dashboard-loaded sanity check. The engineer mode badge is suppressed on
    // owner-facing review surfaces (BZE-239), so anchor on the header heading
    // rather than the badge before exercising the Cap Sheet handoff.
    await expect(
      page.getByRole('heading', { name: /GM Dashboard/i })
    ).toBeVisible();
    await openDashboardTab(page, 'Cap Sheet');
    await expect(page.getByTestId('tab-cap-sheet')).toBeVisible();

    addAuditNote(
      testInfo,
      'UI coverage here is intentionally limited. Firestore base-write denial remains authoritatively proven by npm run test:rules and ARCHITECT_AUDIT_V3_VQ_E2_RULES_RUNTIME_PROOF.md.'
    );
    await captureEvidence(page, testInfo, 'D-MQ-010-base-write-handoff');
  });
});

// SBX-001: the Sandbox (no world) Offseason and Compare screens used to
// dead-end at "select a world" with no in-screen path. They now surface the
// shared world create/select control inline so users can act without hunting
// for the top-bar World menu.
test.describe('SBX-001: Sandbox world-gated screens offer inline world create/select', () => {
  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await gotoDashboard(page);
  });

  test('Sandbox season advance offers the World-menu world create/select path', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);

    // BZE-250: season advance moved into the top-bar World menu. A Sandbox user
    // (no world) opens the World menu and finds both the disabled Season Advance
    // entry (with its reason) and the shared world create/select control, so the
    // world-gated flow is never a dead end.
    const popover = page.getByTestId('cockpit-world-menu-popover');
    await openWorldMenuFor(page, popover.getByTestId('cockpit-season-advance-section'));
    await expect(
      popover.getByTestId('cockpit-season-advance-section')
    ).toContainText(/Select a world to unlock season advance/i);
    // The inline control is the shared WorldSelector: it exposes "+ New" to
    // create a world and the #world-selector dropdown to pick an existing one.
    await expect(
      popover.getByRole('button', { name: /^\+ New$/i })
    ).toBeVisible({ timeout: 25000 });
    await expect(popover.locator('#world-selector')).toBeVisible();
    await captureEvidence(page, testInfo, 'SBX-001-worldmenu-world-picker');
  });

  test('Compare sandbox state surfaces an inline world create/select control', async ({
    page,
  }, testInfo) => {
    await ensureTeamDataLoaded(page, testInfo);
    await openDashboardTab(page, 'Compare');

    const picker = page.getByTestId('comparison-sandbox-world-picker');
    await expect(picker).toBeVisible({ timeout: 25000 });
    await expect(
      picker.getByRole('button', { name: /^\+ New$/i })
    ).toBeVisible({ timeout: 25000 });
    await expect(picker.locator('#world-selector')).toBeVisible();
    await captureEvidence(page, testInfo, 'SBX-001-compare-inline-world-picker');
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
    // The Full Cap Table surface was renamed away from "Future Cap Sheet" to the
    // multi-year "Cap Table" region; assert that stable content region instead.
    await expect(
      page.getByRole('region', { name: /Full Cap Table/i }).first()
    ).toBeVisible();
    await captureEvidence(page, testInfo, 'smoke-full-cap-table');
  });
});
