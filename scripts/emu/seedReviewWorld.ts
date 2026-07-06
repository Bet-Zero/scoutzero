/**
 * FILE: scripts/emu/seedReviewWorld.ts
 * PURPOSE: Seed a realistic review WORLD into the Firestore emulator so
 *          world-scoped Architect rooms (Compare, Team History, Trade Machine)
 *          can be reviewed in non-empty states (BZE-217 → promoted in BZE-218).
 * OWNERSHIP: Tooling: architect review mode workflow
 *
 * REVIEW/TEST ONLY. This script refuses to run without FIRESTORE_EMULATOR_HOST
 * and never touches production Firestore.
 *
 * USAGE:
 *   1. Start the harness:            npm run architect:review:up
 *   2. Load http://localhost:5173/gm/MIA once so the anonymous uid exists.
 *   3. Read the uid (DevTools console → indexedDB firebaseLocalStorageDb,
 *      or copy it from the localStorage key `architect.activeWorldId.<uid>`
 *      after picking any world) and run:
 *        npm run architect:review:world -- --uid <uid>
 *   4. In the browser, run the printed localStorage snippet and reload.
 *
 * WHAT IT SEEDS:
 *   - One architect_worlds/<worldId> metadata doc owned by <uid>.
 *   - 30 team snapshots under architect_worlds/<worldId>/teams/.
 *     BOS / LAL / MIA / MIN / PHX are hydrated from the architect_baseTeams +
 *     architect_basePlayers review fixtures (real names, contracts, caps),
 *     because the flattened generic rosters the e2e seeder uses for non-focus
 *     teams kill Trade Machine realism (BZE-217 finding). All other teams get
 *     generic depth rosters.
 */

import admin from 'firebase-admin';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-architect-review';
const REVIEW_WORLD_SEASON = '2026-27';
const NEXT_REVIEW_WORLD_SEASON = '2027-28';
const REVIEW_WORLD_AS_OF_DATE = '2026-07-01';
const STANDARD_ROSTER_TARGET = 15;

const HYDRATED_TEAM_CODES = ['BOS', 'LAL', 'MIA', 'MIN', 'PHX'] as const;

const ALL_TEAM_CODES = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
] as const;

type TeamCode = (typeof ALL_TEAM_CODES)[number];

const TEAM_NAMES: Record<TeamCode, string> = {
  ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets',
  CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons',
  GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies',
  MIA: 'Miami Heat', MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves',
  NOP: 'New Orleans Pelicans', NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder',
  ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs',
  TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards',
};

type RecordLike = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];

const log = (message: string) => console.log(message);

const fail = (message: string): never => {
  console.error(`\n[seed-review-world] ERROR: ${message}\n`);
  process.exit(1);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let uid = '';
  let worldName = `Review World ${new Date().toISOString().slice(0, 10)}`;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--uid') uid = String(args[i + 1] || '').trim();
    if (args[i] === '--name') worldName = String(args[i + 1] || '').trim();
  }
  if (!uid) {
    fail(
      'Missing --uid <anonymous review uid>. Load /gm/MIA once in the review ' +
        'harness browser, then pass the signed-in anonymous uid.'
    );
  }
  return { uid, worldName };
};

const getDb = () => {
  if (!EMULATOR_HOST) {
    fail(
      'FIRESTORE_EMULATOR_HOST is not set. This seeder is review/test-only ' +
        'and refuses to run against anything but the local emulator.'
    );
  }
  const app =
    admin.apps.find((existing) => existing?.name === 'seed-review-world') ||
    admin.initializeApp({ projectId: PROJECT_ID }, 'seed-review-world');
  return app.firestore();
};

const normalizeContract = (contract: RecordLike | null | undefined) => {
  if (!contract) return contract ?? null;
  return {
    ...contract,
    salariesByYear: Array.isArray(contract.salariesByYear)
      ? contract.salariesByYear.map((row) =>
          isRecord(row)
            ? {
                ...row,
                capHit: row.capHit ?? row.salary ?? 0,
                optionUsed:
                  typeof row.optionUsed === 'boolean'
                    ? row.optionUsed
                    : (row.optionUsed ?? null),
              }
            : row
        )
      : [],
  };
};

const buildDepthPlayer = (
  teamCode: TeamCode,
  teamName: string,
  ordinal: number
) => {
  const playerId = `review_${teamCode.toLowerCase()}_depth_${ordinal}`;
  const displayName = `${teamName} Review Depth ${ordinal}`;
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
      birdRights: { status: 'Non-Bird', eligibleFor: ['Minimum Exception'] },
      freeAgency: { type: 'UFA', year: 2028, capHold: 0 },
    },
  };
};

const buildHydratedPlayer = (
  playerId: string,
  playerData: RecordLike | undefined,
  teamCode: TeamCode,
  teamName: string
) => {
  if (!playerData) {
    return buildDepthPlayer(teamCode, teamName, 1);
  }
  const bio = isRecord(playerData.bio) ? playerData.bio : {};
  const contract = isRecord(playerData.contract) ? playerData.contract : null;
  const futureContract = isRecord(playerData.futureContract)
    ? playerData.futureContract
    : null;
  const resolvedPlayerId = String(playerData.playerId || playerId);
  const displayName = String(playerData.displayName || playerId);
  return {
    id: resolvedPlayerId,
    playerId: resolvedPlayerId,
    player_id: resolvedPlayerId,
    name: displayName,
    displayName,
    position: bio.position || '',
    age: bio.age || null,
    teamCode,
    teamId: teamCode,
    teamName,
    contract: normalizeContract(contract),
    futureContract: normalizeContract(futureContract),
    bio: { ...bio, playerId: resolvedPlayerId, displayName },
    representation: playerData.representation || null,
    original: playerData,
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

const buildSnapshotShell = ({
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

  return {
    id: teamCode,
    teamCode,
    teamName,
    season: REVIEW_WORLD_SEASON,
    abbreviation: baseDoc.abbreviation || teamCode,
    players,
    roster: players,
    activeContracts: buildActiveContracts(players),
    capHolds: Array.isArray(baseDoc.capHolds) ? baseDoc.capHolds : [],
    deadCap: Array.isArray(baseDoc.deadCap) ? baseDoc.deadCap : [],
    draftPicks: Array.isArray(baseDoc.draftPicks) ? baseDoc.draftPicks : [],
    draftPicksInventory: baseDoc.draftPicksInventory || baseDoc.draftPicks || [],
    draftPicksObligations: baseDoc.draftPicksObligations || [],
    draftPicksContested: baseDoc.draftPicksContested || [],
    draftAssets: baseDoc.draftAssets || null,
    // Carrying entitlementIds is what makes the Trade Machine Picks tab
    // resolve real picks in world mode (BZE-218 investigation).
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
      type: 'review-world-seeder',
      provider: 'scripts/emu/seedReviewWorld.ts',
      worldId,
      season: REVIEW_WORLD_SEASON,
    },
  };
};

const main = async () => {
  const { uid, worldName } = parseArgs();
  const db = getDb();

  log(`[seed-review-world] emulator=${EMULATOR_HOST} project=${PROJECT_ID}`);
  log(`[seed-review-world] uid=${uid}`);

  const worldId = `world_review_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const now = admin.firestore.Timestamp.now();

  await db.doc(`architect_worlds/${worldId}`).set({
    worldId,
    worldName,
    description:
      'Review-mode world seeded by scripts/emu/seedReviewWorld.ts. ' +
      'BOS/LAL/MIA/MIN/PHX carry hydrated fixture rosters.',
    createdBy: uid,
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
    tags: ['review', 'seeded'],
    isArchived: false,
    isFavorite: false,
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      totalRenounces: 0,
      teamsInvolved: ALL_TEAM_CODES.length,
    },
  });

  const hydratedSet = new Set<string>(HYDRATED_TEAM_CODES);
  const batch = db.batch();

  for (const teamCode of ALL_TEAM_CODES) {
    const teamName = TEAM_NAMES[teamCode];
    let snapshot: RecordLike;

    if (hydratedSet.has(teamCode)) {
      const baseDoc = (
        await db.doc(`architect_baseTeams/${teamCode}`).get()
      ).data() as RecordLike | undefined;
      if (!baseDoc) {
        fail(
          `Base fixture architect_baseTeams/${teamCode} is missing. Run ` +
            '`npm run architect:review:seed` (or architect:review:up) first.'
        );
      }
      const rosterIds = toStringArray(baseDoc!.roster);
      const players = await Promise.all(
        rosterIds.map(async (playerId) =>
          buildHydratedPlayer(
            playerId,
            (
              await db.doc(`architect_basePlayers/${playerId}`).get()
            ).data() as RecordLike | undefined,
            teamCode,
            teamName
          )
        )
      );
      snapshot = buildSnapshotShell({
        worldId,
        teamCode,
        teamName,
        players: players as RecordLike[],
        baseDoc,
      });
      log(
        `[seed-review-world] ${teamCode}: hydrated ${players.length} fixture players`
      );
    } else {
      const players = Array.from({ length: STANDARD_ROSTER_TARGET }, (_, i) =>
        buildDepthPlayer(teamCode, teamName, i + 1)
      ) as RecordLike[];
      snapshot = buildSnapshotShell({
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
    }

    batch.set(db.doc(`architect_worlds/${worldId}/teams/${teamCode}`), snapshot);
  }

  await batch.commit();

  log('\n───────────────────────────────────────────────────────────────');
  log(`  ✅ Seeded review world: ${worldId}`);
  log('  Activate it in the review browser (F12 console):');
  log(`    localStorage.setItem('architect.activeWorldId.${uid}', '${worldId}');`);
  log('    location.reload();');
  log('───────────────────────────────────────────────────────────────\n');
};

main().catch((error) => {
  console.error('[seed-review-world] Failed:', error);
  process.exit(1);
});
