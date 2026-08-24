import { expect, type Page } from '@playwright/test';
import admin from 'firebase-admin';
import { withDerivedGovernedSalaryBooks } from '../../../src/tests/fixtures/governedSalaryBookInputs';

export const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
export const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
export const REVIEW_WORLD_SEASON = '2025-26';
export const REVIEW_WORLD_AS_OF_DATE = '2026-04-12';
export const NEXT_REVIEW_WORLD_SEASON = '2026-27';
export const NEXT_REVIEW_WORLD_AS_OF_DATE = '2026-07-01';
export const MIA_SEASON_ADVANCE_URL = '/gm/MIA?season=2026';
export const MIA_TEAM_CODE = 'MIA';
export const ANDRE_COLE_PLAYER_ID = 'mia_andre_cole';
export const ANDRE_COLE_PLAYER_NAME = 'Andre Cole';
export const QUENTIN_DIAZ_PLAYER_ID = 'mia_quentin_diaz';
export const QUENTIN_DIAZ_PLAYER_NAME = 'Quentin Diaz';

export const DEV_LOCAL_STORAGE_FLAGS = {
  'hz.dev.capSheetFixtures': 'true',
  'hz.dev.offseasonPreview': 'true',
  'hz.dev.teamHistoryFixtures': 'true',
};

export const ALL_TEAM_CODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
] as const;

type TeamCode = (typeof ALL_TEAM_CODES)[number];
export type RecordLike = Record<string, unknown>;

const TEAM_NAMES: Record<TeamCode, string> = {
  ATL: 'Atlanta Hawks',
  BOS: 'Boston Celtics',
  BKN: 'Brooklyn Nets',
  CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks',
  DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons',
  GSW: 'Golden State Warriors',
  HOU: 'Houston Rockets',
  IND: 'Indiana Pacers',
  LAC: 'LA Clippers',
  LAL: 'Los Angeles Lakers',
  MEM: 'Memphis Grizzlies',
  MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves',
  NOP: 'New Orleans Pelicans',
  NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder',
  ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers',
  PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings',
  SAS: 'San Antonio Spurs',
  TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz',
  WAS: 'Washington Wizards',
};

const REVIEW_APP_NAME = 'season-advance-review-world';
const STANDARD_ROSTER_TARGET = 15;

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];

export const getReviewAdminDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_EMULATOR_HOST;

  const app =
    admin.apps.find((existingApp) => existingApp?.name === REVIEW_APP_NAME) ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      REVIEW_APP_NAME
    );

  return app.firestore();
};

export const getBaseTeamDocument = async (teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_baseTeams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

export const getWorldMetadataDocument = async (worldId: string) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

export const getWorldTeamDocument = async (worldId: string, teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

export const getWorldTeamCodes = async (worldId: string) =>
  (
    await getReviewAdminDb()
      .collection(`architect_worlds/${worldId}/teams`)
      .get()
      .then((snapshot) => snapshot.docs.map((docSnapshot) => docSnapshot.id))
  ).sort();

export const getWorldEventDocuments = async (worldId: string) =>
  (await getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/events`)
    .get()
    .then((snapshot) =>
      snapshot.docs
        .map((docSnapshot): RecordLike & { id: string } => ({
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

export const getWorldSeasonHistoryDocument = async (
  worldId: string,
  historyId: string
) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/seasonHistory/${historyId}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

export const getWorldSeasonTransitionDocument = async (
  worldId: string,
  transitionId: string
) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/seasonTransitions/${transitionId}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

export const getPlayerIdFromEntry = (entry: unknown) => {
  if (typeof entry === 'string') return entry;
  if (!isRecord(entry)) return '';

  const bio = isRecord(entry.bio) ? entry.bio : {};
  return String(
    entry.playerId || entry.player_id || entry.id || bio.playerId || ''
  );
};

export const getTeamPlayerIds = (
  teamDocument: RecordLike | undefined
): string[] => {
  const rawPlayers = Array.isArray(teamDocument?.players)
    ? teamDocument?.players
    : Array.isArray(teamDocument?.roster)
      ? teamDocument?.roster
      : [];

  return rawPlayers.map(getPlayerIdFromEntry).filter(Boolean);
};

export const getCapHold = (
  teamDocument: RecordLike | undefined,
  playerId: string
) => {
  const capHolds = Array.isArray(teamDocument?.capHolds)
    ? teamDocument.capHolds
    : [];

  return capHolds.find((hold) => {
    if (!isRecord(hold)) return false;
    return String(hold.playerId || '') === playerId;
  }) as RecordLike | undefined;
};

const buildReviewDepthPlayer = (
  teamCode: TeamCode,
  teamName: string,
  ordinal: number,
  explicitPlayerId?: string
) => {
  const playerId =
    explicitPlayerId || `review_${teamCode.toLowerCase()}_depth_${ordinal}`;
  const displayName = explicitPlayerId
    ? `${teamName} Depth ${ordinal}`
    : `${teamName} Review Depth ${ordinal}`;

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
      startSeason: REVIEW_WORLD_SEASON,
      endSeason: NEXT_REVIEW_WORLD_SEASON,
      contractLength: 2,
      yearsRemaining: 2,
      totalValue: 4_000_000,
      averageAnnualValue: 2_000_000,
      guaranteedValue: 4_000_000,
      guaranteedYears: 2,
      salariesByYear: [
        {
          season: REVIEW_WORLD_SEASON,
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
          option: null,
        },
        {
          season: NEXT_REVIEW_WORLD_SEASON,
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
          option: null,
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
        year: 2028,
        capHold: 0,
      },
    },
  };
};

const buildActiveContracts = (players: RecordLike[]) =>
  players
    .filter((player) => isRecord(player.contract))
    .map((player) => {
      const contract = player.contract as RecordLike;

      return {
        name: player.name || player.displayName,
        player_id: player.player_id || player.playerId || player.id,
        contract,
        years: contract.yearsRemaining || 0,
        type: contract.contractType || 'Contract',
        signAndTrade: false,
        guaranteed: true,
        isMinimum: contract.contractType === 'MINIMUM CONTRACT',
        yearsOfService:
          isRecord(player.bio) && player.bio.experience
            ? player.bio.experience
            : null,
      };
    });

const toSimpleException = (value: unknown) =>
  isRecord(value)
    ? {
        amount: value.totalAmount ?? 0,
        used: value.usedAmount ?? 0,
        remaining: value.remainingAmount ?? value.totalAmount ?? 0,
      }
    : null;

const buildBaseSnapshotShell = ({
  worldId,
  teamCode,
  teamName,
  players,
  baseDoc = {},
}: {
  worldId: string;
  teamCode: TeamCode;
  teamName: string;
  players: RecordLike[];
  baseDoc?: RecordLike;
}) => {
  const exceptions = isRecord(baseDoc.exceptions) ? baseDoc.exceptions : {};
  const totals = isRecord(baseDoc.totals) ? baseDoc.totals : {};
  const tpeList = Array.isArray(exceptions.tpe) ? exceptions.tpe : [];
  const hardCapLevel = baseDoc.hardCapLevel || totals.hardCapLevel || null;

  const snapshot = {
    id: teamCode,
    teamCode,
    teamName,
    season: REVIEW_WORLD_SEASON,
    abbreviation: baseDoc.abbreviation || teamCode,
    players,
    roster: players.map((player) => player.playerId),
    activeContracts: buildActiveContracts(players),
    capHolds: Array.isArray(baseDoc.capHolds) ? baseDoc.capHolds : [],
    deadCap: Array.isArray(baseDoc.deadCap) ? baseDoc.deadCap : [],
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
    exceptions,
    mle: toSimpleException(exceptions.mle),
    tpMle: toSimpleException(exceptions.taxpayerMle || exceptions.tpMle),
    bae: toSimpleException(exceptions.bae),
    tradeExceptions: tpeList.map((tpe) =>
      isRecord(tpe)
        ? {
            id: tpe.id,
            name: tpe.label || tpe.id,
            amount: tpe.remainingAmount ?? tpe.totalAmount ?? 0,
            used: tpe.usedAmount ?? 0,
            createdFrom: tpe.createdFrom ?? null,
            expires: tpe.expiresOn ?? tpe.expires ?? null,
          }
        : tpe
    ),
    hardCapLevel: hardCapLevel || null,
    hardCapped: Boolean(hardCapLevel),
    baseline: baseDoc,
    totals,
    source: {
      type: 'review-world-season-advance-fixture',
      provider: 'playwright',
      worldId,
      season: REVIEW_WORLD_SEASON,
    },
  };
  return withDerivedGovernedSalaryBooks(snapshot, {
    salaryCapYear: 2027,
    asOfDate: '2026-07-01T00:00:00-04:00',
    apronDelta: 0,
    taxDelta: 0,
  });
};

const buildMiaSeasonAdvanceSnapshot = async (worldId: string) => {
  const baseDoc = await getBaseTeamDocument(MIA_TEAM_CODE);
  if (!baseDoc) {
    throw new Error('MIA base review fixture is missing.');
  }

  const teamName = String(baseDoc.teamName || TEAM_NAMES.MIA);
  const namedProofPlayer = (
    playerId: string,
    displayName: string,
    ordinal: number
  ) => {
    const player = buildReviewDepthPlayer(
      MIA_TEAM_CODE,
      teamName,
      ordinal,
      playerId
    );
    return {
      ...player,
      name: displayName,
      displayName,
      bio: { ...player.bio, displayName },
    };
  };
  // Keep the browser proof deterministic: all 15 contracts are guaranteed in
  // both governed seasons, so the fixture cannot manufacture an incomplete-
  // roster charge while it is proving the Season Advance transaction itself.
  const proofPlayers = [
    namedProofPlayer(ANDRE_COLE_PLAYER_ID, ANDRE_COLE_PLAYER_NAME, 1),
    namedProofPlayer(QUENTIN_DIAZ_PLAYER_ID, QUENTIN_DIAZ_PLAYER_NAME, 2),
  ];
  const supportPlayers = Array.from(
    { length: STANDARD_ROSTER_TARGET - proofPlayers.length },
    (_, index) =>
      buildReviewDepthPlayer(
        MIA_TEAM_CODE,
        teamName,
        index + proofPlayers.length + 1,
        `mia_season_advance_support_${index + 1}`
      )
  );
  const players = [...proofPlayers, ...supportPlayers] as RecordLike[];

  return buildBaseSnapshotShell({
    worldId,
    teamCode: MIA_TEAM_CODE,
    teamName,
    players,
    baseDoc,
  });
};

const buildNonFocusSeasonAdvanceSnapshot = (
  worldId: string,
  teamCode: TeamCode
) => {
  const teamName = TEAM_NAMES[teamCode];
  const players = Array.from({ length: STANDARD_ROSTER_TARGET }, (_, index) =>
    buildReviewDepthPlayer(teamCode, teamName, index + 1)
  ) as RecordLike[];

  return buildBaseSnapshotShell({
    worldId,
    teamCode,
    teamName,
    players,
    baseDoc: {
      teamCode,
      teamName,
      abbreviation: teamCode,
      season: REVIEW_WORLD_SEASON,
      roster: players.map((player) => player.playerId),
      players,
      capHolds: [],
      deadCap: [],
      draftPicks: [],
      entitlementIds: [],
      exceptions: {},
      totals: {},
    },
  });
};

const generateReviewWorldId = () =>
  `world_season_advance_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;

export const seedSeasonAdvanceReviewWorld = async (
  userId: string,
  worldName = `Season Advance Proof ${Date.now()}`
) => {
  const db = getReviewAdminDb();
  const worldId = generateReviewWorldId();
  const now = admin.firestore.Timestamp.now();

  await db.doc(`architect_worlds/${worldId}`).set({
    worldId,
    worldName,
    description:
      'Review-mode Season Advance proof world with MIA as the visible focus team.',
    createdBy: userId,
    createdAt: now,
    lastModifiedAt: now,
    currentSeason: REVIEW_WORLD_SEASON,
    baselineSeason: REVIEW_WORLD_SEASON,
    asOfDate: REVIEW_WORLD_AS_OF_DATE,
    parentWorldId: null,
    branchedFrom: null,
    childWorlds: [],
    modifiedTeams: [...ALL_TEAM_CODES],
    lastModifiedTeams: [...ALL_TEAM_CODES],
    actionCount: 0,
    tags: ['review', 'season-advance'],
    isArchived: false,
    isFavorite: false,
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      totalRenounces: 0,
      teamsInvolved: ALL_TEAM_CODES.length,
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
      total: ALL_TEAM_CODES.length * STANDARD_ROSTER_TARGET,
      complete: ALL_TEAM_CODES.length * STANDARD_ROSTER_TARGET,
      needsInput: 0,
    },
  });

  const batch = db.batch();
  for (const teamCode of ALL_TEAM_CODES) {
    const snapshot =
      teamCode === MIA_TEAM_CODE
        ? await buildMiaSeasonAdvanceSnapshot(worldId)
        : buildNonFocusSeasonAdvanceSnapshot(worldId, teamCode);
    batch.set(
      db.doc(`architect_worlds/${worldId}/teams/${teamCode}`),
      snapshot
    );
  }
  await batch.commit();

  return worldId;
};

export const readReviewUserId = async (page: Page): Promise<string> =>
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

export const readReviewIdToken = async (page: Page): Promise<string> =>
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
          const loadToken = async () => {
            const modulePath = '/src/firebaseConfig.ts';
            const firebaseModule = (await import(
              /* @vite-ignore */ modulePath
            )) as {
              auth?: {
                currentUser?: { getIdToken: () => Promise<string> } | null;
              };
            };
            const token = await firebaseModule.auth?.currentUser?.getIdToken();
            clearTimeout(timer);
            finish(token || '');
          };
          void loadToken().catch(() => {
            clearTimeout(timer);
            finish('');
          });
        })
    )
    .catch(() => '');

export const readActiveWorldId = async (page: Page) =>
  page
    .evaluate(() => {
      const storageKey = Object.keys(window.localStorage).find((key) =>
        key.startsWith('architect.activeWorldId.')
      );

      return storageKey ? window.localStorage.getItem(storageKey) || '' : '';
    })
    .catch(() => '');

export const enableArchitectReviewFlags = async (page: Page) => {
  await page.addInitScript((flags) => {
    Object.entries(flags).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  }, DEV_LOCAL_STORAGE_FLAGS);
};

export const waitForReviewDashboard = async (page: Page) => {
  const fullCapTab = page.getByRole('tab', { name: /^Full Cap Table$/i });
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await loadingDashboard
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        const hasFullCapTab = await fullCapTab
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        const hasNoTeamData = await noTeamData
          .isVisible({ timeout: 1000 })
          .catch(() => false);

        return !stillLoading && (hasFullCapTab || hasNoTeamData);
      },
      {
        timeout: 60000,
        message: 'MIA review dashboard should reach an interactive state',
      }
    )
    .toBe(true);

  await expect(noTeamData).toHaveCount(0);
};

export const activateSeededWorld = async (
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
  await waitForReviewDashboard(page);

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

export const prepareSeasonAdvanceReviewWorld = async (page: Page) => {
  await expect
    .poll(async () => await readReviewUserId(page), {
      timeout: 25000,
      message: 'anonymous review uid should initialize',
    })
    .not.toBe('');

  const userId = await readReviewUserId(page);
  const worldId = await seedSeasonAdvanceReviewWorld(userId);
  await activateSeededWorld(page, userId, worldId);
  return worldId;
};

export const openDashboardTab = async (page: Page, label: string) => {
  const tab = page.getByRole('tab', {
    name: new RegExp(`^${label}$`, 'i'),
  });
  await expect(tab).toBeVisible();
  await tab.click();
};
