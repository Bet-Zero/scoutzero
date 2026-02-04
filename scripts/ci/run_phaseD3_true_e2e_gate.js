#!/usr/bin/env node
/**
 * FILE: scripts/ci/run_phaseD3_true_e2e_gate.js
 * PURPOSE: Phase D3 TRUE E2E Gate - Calls REAL applyWorldMutation('executeTrade') and
 *          REAL advanceSeasonInWorld(). NO simulation or inline mutation allowed.
 * OWNERSHIP: Tooling: CI/CD, Feature: architect/dare
 *
 * HISTORY:
 *  - 2026-02-04: Phase D3 - Upgraded from D2 simulation to real pipeline calls
 *
 * LINKS:
 *  - Master Doc: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - Prior: run_phaseD2_true_e2e_trade_to_advance_gate.js (simulation version)
 *
 * USAGE:
 *   # With emulator running:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run ci:phaseD3-dare-gate
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set (refuses to run against production)
 *   - Emulator must be running with Firestore on the specified host:port
 *
 * TESTS (D3.A through D3.C):
 *   - D3.A: 2-team trade via REAL applyWorldMutation('executeTrade')
 *   - D3.B: 3-team routing via REAL applyWorldMutation('executeTrade')
 *   - D3.C: Season advance via REAL advanceSeasonInWorld (DARE runs)
 *
 * EXIT CODES:
 *   0 - All proof assertions passed
 *   1 - Proof failed (check output for details)
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration - Deterministic IDs for reproducibility
// ============================================================================

const DETERMINISTIC_WORLD_ID = 'phaseD3_true_e2e_gate_world';
const DETERMINISTIC_TIMESTAMP = '2026-02-04T12:00:00.000Z';
const TEST_SEASON = '2025-26';
const DRAFT_YEAR = 2026;
const TEST_USER_ID = 'test-user-phase-d3';

// Team codes for testing
const TEAM_BOS = 'BOS';
const TEAM_LAL = 'LAL';
const TEAM_MIA = 'MIA';

// ============================================================================
// Firebase Initialization (Emulator Only)
// ============================================================================

let db = null;

function initializeFirebase() {
  // CRITICAL: Refuse to run against production
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      '============================================================'
    );
    console.error('[SAFETY] FIRESTORE_EMULATOR_HOST is not set.');
    console.error('         This script ONLY runs against the emulator.');
    console.error(
      '         Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 and try again.'
    );
    console.error(
      '============================================================'
    );
    process.exit(1);
  }

  // CRITICAL: Additional production safety check
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.FIRESTORE_EMULATOR_HOST
  ) {
    console.error(
      '============================================================'
    );
    console.error('[SAFETY] GOOGLE_APPLICATION_CREDENTIALS detected.');
    console.error('         This script refuses to run against production.');
    console.error(
      '============================================================'
    );
    process.exit(1);
  }

  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  console.log(
    `[INFO] Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`
  );
  admin.initializeApp({ projectId: 'demo-scoutzero' });

  db = admin.firestore();
  return db;
}

// ============================================================================
// Fixture Helpers - Minimal Entitlement and Team Creation
// ============================================================================

/**
 * Create a pick_ownership entitlement fixture.
 */
function createPickOwnershipEntitlement(id, holderTeam, seasonYear, round = 1) {
  return {
    id,
    holderTeam,
    seasonYear,
    round,
    kind: 'pick_ownership',
    underlyingPickId: `${holderTeam}_${seasonYear}_${round === 1 ? '1st' : '2nd'}`,
    description: `${holderTeam} ${seasonYear} ${round === 1 ? '1st' : '2nd'} Round Pick`,
    underlyingStatus: 'clean',
    resolved: false,
    createdAt: DETERMINISTIC_TIMESTAMP,
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

/**
 * Create a swap_right entitlement fixture.
 */
function createSwapRightEntitlement(
  id,
  holderTeam,
  seasonYear,
  controllerPickId,
  targetTeams
) {
  return {
    id,
    holderTeam,
    seasonYear,
    round: 1,
    kind: 'swap_right',
    swapControllerPickId: controllerPickId,
    swapTargetDefinition: `Option to swap with ${targetTeams.join(', ')}`,
    swapTargetPickIds: targetTeams.map((t) => `${t}_${seasonYear}_1st`),
    swapMode: 'best_of',
    resolved: false,
    createdAt: DETERMINISTIC_TIMESTAMP,
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

/**
 * Create minimal player fixture for trades.
 */
function createMinimalPlayer(playerId, name, teamCode, salary = 10_000_000) {
  return {
    player_id: playerId,
    id: playerId,
    playerId,
    name,
    displayName: name,
    teamCode,
    salary,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: TEST_SEASON,
          salary,
          capHit: salary,
          guaranteed: true,
          guaranteedAmount: salary,
        },
      ],
      birdRights: { status: 'Full', yearsOfService: 5 },
      freeAgency: { type: 'Unrestricted', year: 2027 },
    },
    bio: { position: 'SF', age: 28, experience: 6 },
  };
}

/**
 * Create minimal team fixture.
 */
function createMinimalTeam(teamCode, players = [], entitlementIds = []) {
  const totalSalary = players.reduce((sum, p) => sum + (p.salary || 0), 0);
  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `${teamCode} Test Team`,
    season: TEST_SEASON,
    players,
    roster: players.map((p) => p.player_id || p.id),
    capHolds: [],
    deadCap: [],
    exceptions: { tpe: [] },
    tradeExceptions: [],
    exceptionHistory: [],
    entitlementIds,
    draftPicks: [],
    teamTotalSalary: totalSalary,
    totals: {
      yearKey: DRAFT_YEAR,
      teamSalary: totalSalary,
      totalSalary,
      capHit: totalSalary,
      playersTotal: totalSalary,
      deadMoneyTotal: 0,
      capHoldsTotal: 0,
      incompleteChargesTotal: 0,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      salaryCap: 140_588_000,
      luxuryTax: 170_000_000,
      firstApron: 178_132_000,
      secondApron: 188_931_000,
      isOverTax: totalSalary > 170_000_000,
      isFirstApron: totalSalary > 178_000_000,
      isSecondApron: totalSalary > 188_000_000,
      isHardCapped: false,
      deltas: {
        vsCap: 140_588_000 - totalSalary,
        vsFirstApron: 178_132_000 - totalSalary,
        vsSecondApron: 188_931_000 - totalSalary,
      },
    },
    source: { type: 'test', lastModifiedAt: DETERMINISTIC_TIMESTAMP },
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

/**
 * Create cap projections for trades.
 */
function createCapProjections() {
  return {
    '2025-26': {
      salaryCap: 140_588_000,
      luxuryTax: 170_000_000,
      firstApron: 178_132_000,
      secondApron: 188_931_000,
      minSalary: 1_164_000,
      maxSalary: 52_750_000,
    },
  };
}

// ============================================================================
// Persistence Functions
// ============================================================================

async function seedWorldMetadata(db, worldId) {
  const worldRef = db.collection('architect_worlds').doc(worldId);
  await worldRef.set({
    name: 'Phase D3 True E2E Gate World',
    currentSeason: TEST_SEASON,
    createdAt: DETERMINISTIC_TIMESTAMP,
    updatedAt: DETERMINISTIC_TIMESTAMP,
    createdBy: TEST_USER_ID,
    status: 'active',
  });
  return worldRef.path;
}

async function persistTeam(db, worldId, team) {
  const teamRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('teams')
    .doc(team.teamCode);

  const teamData = JSON.parse(JSON.stringify(team));
  await teamRef.set(teamData);
  return teamRef.path;
}

async function reloadTeam(db, worldId, teamCode) {
  const teamRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('teams')
    .doc(teamCode);

  const snap = await teamRef.get();
  if (!snap.exists) {
    throw new Error(`Team ${teamCode} not found in world ${worldId}`);
  }
  return snap.data();
}

async function persistBaseEntitlement(db, entitlement) {
  const entRef = db
    .collection('architect_baseEntitlements')
    .doc(entitlement.id);
  await entRef.set(entitlement);
  return entRef.path;
}

async function persistWorldEntitlement(db, worldId, entitlement) {
  const entRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('entitlements')
    .doc(entitlement.id);

  await entRef.set(entitlement);
  return entRef.path;
}

async function reloadWorldEntitlement(db, worldId, entitlementId) {
  const entRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('entitlements')
    .doc(entitlementId);

  const snap = await entRef.get();
  return snap.exists ? snap.data() : null;
}

async function persistDraftPositionsMap(db, worldId, draftYear, positionsMap) {
  const posRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('draftPositions')
    .doc(String(draftYear));

  await posRef.set({
    draftYear,
    positions: positionsMap,
    createdAt: DETERMINISTIC_TIMESTAMP,
  });
  return posRef.path;
}

async function persistPlayer(db, worldId, teamCode, player) {
  const playerRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('teams')
    .doc(teamCode)
    .collection('players')
    .doc(player.player_id || player.id);

  await playerRef.set(player);
  return playerRef.path;
}

// ============================================================================
// REAL ENTRYPOINT IMPORTS
// This is what makes D3 different from D2 - we call the REAL functions!
// ============================================================================

/**
 * Dynamic import of the real mutation pipeline.
 * We must use dynamic import because these rely on Vite aliases.
 */
async function importRealEntrypoints() {
  console.log('[D3] Loading REAL entrypoints...');

  // For CI script running with Node, we need to resolve the actual paths
  const mutationPipelinePath = path.resolve(
    __dirname,
    '../../src/features/architect/utils/mutationPipeline.js'
  );
  const seasonManagerPath = path.resolve(
    __dirname,
    '../../src/features/architect/utils/seasonManager.js'
  );

  const mutationPipeline = await import(mutationPipelinePath);
  const seasonManager = await import(seasonManagerPath);

  console.log(
    `[D3] ✓ Loaded applyWorldMutation from ${mutationPipelinePath.split('/').pop()}`
  );
  console.log(
    `[D3] ✓ Loaded advanceSeasonInWorld from ${seasonManagerPath.split('/').pop()}`
  );

  return {
    applyWorldMutation: mutationPipeline.applyWorldMutation,
    advanceSeasonInWorld: seasonManager.advanceSeasonInWorld,
  };
}

// ============================================================================
// REAL Trade Execution Helpers
// ============================================================================

/**
 * Build a trade payload for 2-team entitlement-only trade.
 * Uses the exact structure expected by applyWorldMutation('executeTrade').
 */
function buildEntitlementTradePayload(
  fromTeam,
  toTeam,
  entitlementId,
  worldId
) {
  // For entitlement-only trades, we need dummy players or empty sends/receives
  // The key is that entitlementIds move via the teams array
  return {
    teams: [
      {
        teamCode: fromTeam.teamCode,
        team: fromTeam,
        sends: [], // No players
        receives: [],
        picksOut: [entitlementId], // Entitlement goes out as a "pick"
        picksIn: [],
        cashSent: 0,
        cashReceived: 0,
        entitlementTransfers: [
          { entitlementId, direction: 'out', toTeamCode: toTeam.teamCode },
        ],
      },
      {
        teamCode: toTeam.teamCode,
        team: toTeam,
        sends: [],
        receives: [],
        picksOut: [],
        picksIn: [entitlementId], // Entitlement comes in
        cashSent: 0,
        cashReceived: 0,
        entitlementTransfers: [
          { entitlementId, direction: 'in', fromTeamCode: fromTeam.teamCode },
        ],
      },
    ],
    capProjections: createCapProjections(),
    tradeCtx: { worldId, seasonId: TEST_SEASON },
    isEntitlementOnlyTrade: true,
  };
}

/**
 * Build a 3-team trade payload with explicit routing.
 * Team A sends entitlement to Team C (not Team B).
 */
function build3TeamEntitlementTradePayload(
  fromTeam,
  middleTeam,
  destTeam,
  entitlementId,
  worldId
) {
  return {
    teams: [
      {
        teamCode: fromTeam.teamCode,
        team: fromTeam,
        sends: [],
        receives: [],
        picksOut: [entitlementId],
        picksIn: [],
        cashSent: 0,
        cashReceived: 0,
        entitlementTransfers: [
          { entitlementId, direction: 'out', toTeamCode: destTeam.teamCode },
        ],
      },
      {
        teamCode: middleTeam.teamCode,
        team: middleTeam,
        sends: [],
        receives: [],
        picksOut: [],
        picksIn: [],
        cashSent: 0,
        cashReceived: 0,
        entitlementTransfers: [],
      },
      {
        teamCode: destTeam.teamCode,
        team: destTeam,
        sends: [],
        receives: [],
        picksOut: [],
        picksIn: [entitlementId],
        cashSent: 0,
        cashReceived: 0,
        entitlementTransfers: [
          { entitlementId, direction: 'in', fromTeamCode: fromTeam.teamCode },
        ],
      },
    ],
    capProjections: createCapProjections(),
    tradeCtx: { worldId, seasonId: TEST_SEASON },
    isEntitlementOnlyTrade: true,
    is3TeamTrade: true,
  };
}

// ============================================================================
// Main Proof Harness
// ============================================================================

async function runProof() {
  console.log('============================================================');
  console.log('Phase D3: TRUE E2E Gate - REAL Pipeline Entrypoints');
  console.log('============================================================');
  console.log(`World ID: ${DETERMINISTIC_WORLD_ID}`);
  console.log(`Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`Season: ${TEST_SEASON} → Draft Year: ${DRAFT_YEAR}`);
  console.log('============================================================');
  console.log('KEY DIFFERENCE FROM D2:');
  console.log('  D2 used SIMULATED inline mutations');
  console.log(
    '  D3 calls REAL applyWorldMutation() and advanceSeasonInWorld()'
  );
  console.log('============================================================\n');

  const db = initializeFirebase();

  let assertionsPassed = 0;
  let assertionsFailed = 0;
  const failures = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      assertionsPassed++;
    } else {
      console.log(`  ❌ ${message}`);
      assertionsFailed++;
      failures.push(message);
    }
  }

  // Import real entrypoints
  let applyWorldMutation, advanceSeasonInWorld;
  try {
    const entrypoints = await importRealEntrypoints();
    applyWorldMutation = entrypoints.applyWorldMutation;
    advanceSeasonInWorld = entrypoints.advanceSeasonInWorld;
  } catch (importError) {
    console.error('\n[FATAL] Failed to import real entrypoints:');
    console.error(importError);
    console.error('\nThis may be due to ESM/alias resolution issues.');
    console.error('Ensure Vite aliases are configured for Node runtime.');
    process.exit(1);
  }

  try {
    // ========================================================================
    // SETUP: Seed world and initial data
    // ========================================================================
    console.log('\n[SETUP] Seeding world and initial data...');

    await seedWorldMetadata(db, DETERMINISTIC_WORLD_ID);
    console.log(`  Seeded world metadata: ${DETERMINISTIC_WORLD_ID}`);

    // Create entitlements
    const ent1 = createPickOwnershipEntitlement(
      'ent:BOS:2026:1:own:d3-001',
      TEAM_BOS,
      DRAFT_YEAR,
      1
    );
    const ent2 = createPickOwnershipEntitlement(
      'ent:LAL:2026:1:own:d3-002',
      TEAM_LAL,
      DRAFT_YEAR,
      1
    );
    const ent3 = createSwapRightEntitlement(
      'ent:BOS:2026:1:swap:d3-003',
      TEAM_BOS,
      DRAFT_YEAR,
      'LAL_2026_1st',
      ['LAL']
    );

    await persistBaseEntitlement(db, ent1);
    await persistBaseEntitlement(db, ent2);
    await persistBaseEntitlement(db, ent3);
    await persistWorldEntitlement(db, DETERMINISTIC_WORLD_ID, ent1);
    await persistWorldEntitlement(db, DETERMINISTIC_WORLD_ID, ent2);
    await persistWorldEntitlement(db, DETERMINISTIC_WORLD_ID, ent3);
    console.log('  Seeded 3 entitlements (base + world copies)');

    // Create players for valid trades
    const playerBOS1 = createMinimalPlayer(
      'player-bos-1',
      'BOS Player 1',
      TEAM_BOS,
      15_000_000
    );
    const playerLAL1 = createMinimalPlayer(
      'player-lal-1',
      'LAL Player 1',
      TEAM_LAL,
      15_000_000
    );
    const playerMIA1 = createMinimalPlayer(
      'player-mia-1',
      'MIA Player 1',
      TEAM_MIA,
      15_000_000
    );

    // Create teams with initial entitlements
    const teamBOS = createMinimalTeam(
      TEAM_BOS,
      [playerBOS1],
      [ent1.id, ent3.id]
    );
    const teamLAL = createMinimalTeam(TEAM_LAL, [playerLAL1], [ent2.id]);
    const teamMIA = createMinimalTeam(TEAM_MIA, [playerMIA1], []);

    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamBOS);
    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamLAL);
    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamMIA);
    console.log('  Seeded 3 teams: BOS, LAL, MIA');

    // Persist players individually
    await persistPlayer(db, DETERMINISTIC_WORLD_ID, TEAM_BOS, playerBOS1);
    await persistPlayer(db, DETERMINISTIC_WORLD_ID, TEAM_LAL, playerLAL1);
    await persistPlayer(db, DETERMINISTIC_WORLD_ID, TEAM_MIA, playerMIA1);
    console.log('  Seeded 3 players (one per team)');

    // Seed draft positions (needed for DARE)
    const positionsMap = { BOS: 5, LAL: 10, MIA: 15 };
    await persistDraftPositionsMap(
      db,
      DETERMINISTIC_WORLD_ID,
      DRAFT_YEAR,
      positionsMap
    );
    console.log(`  Seeded draft positions: BOS@5, LAL@10, MIA@15`);

    // ========================================================================
    // D3.A: 2-Team Trade via REAL applyWorldMutation('executeTrade')
    // ========================================================================
    console.log('\n[D3.A] 2-Team Trade via REAL applyWorldMutation...');
    console.log(`  Trading ${ent1.id} from BOS to LAL`);

    // Reload teams for fresh state
    const preTradeBOS = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_BOS);
    const preTradeLAL = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_LAL);

    // Build trade payload
    const trade2Payload = buildEntitlementTradePayload(
      preTradeBOS,
      preTradeLAL,
      ent1.id,
      DETERMINISTIC_WORLD_ID
    );

    // Call REAL applyWorldMutation
    console.log(
      '  Calling applyWorldMutation({ mutationType: "executeTrade" })...'
    );
    const trade2Result = await applyWorldMutation({
      userId: TEST_USER_ID,
      worldId: DETERMINISTIC_WORLD_ID,
      seasonId: TEST_SEASON,
      mutationType: 'executeTrade',
      payload: trade2Payload,
      timestamp: Date.now(),
    });

    console.log(`  Result: success=${trade2Result.success}`);
    if (!trade2Result.success) {
      console.log(`  Error: ${trade2Result.error}`);
      console.log(
        `  Violations: ${JSON.stringify(trade2Result.violations || [])}`
      );
    }

    // Reload and verify
    const postTrade2BOS = await reloadTeam(
      db,
      DETERMINISTIC_WORLD_ID,
      TEAM_BOS
    );
    const postTrade2LAL = await reloadTeam(
      db,
      DETERMINISTIC_WORLD_ID,
      TEAM_LAL
    );

    assert(trade2Result.success, 'D3.A: applyWorldMutation succeeded');
    assert(
      !postTrade2BOS.entitlementIds?.includes(ent1.id),
      `D3.A: BOS no longer has ${ent1.id}`
    );
    assert(
      postTrade2LAL.entitlementIds?.includes(ent1.id),
      `D3.A: LAL now has ${ent1.id}`
    );
    assert(
      postTrade2BOS.entitlementIds?.includes(ent3.id),
      `D3.A: BOS still has swap right ${ent3.id}`
    );

    // B5 Invariant: No duplicates across league
    const allEntsAfter2Team = [
      ...(postTrade2BOS.entitlementIds || []),
      ...(postTrade2LAL.entitlementIds || []),
      ...((await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_MIA))
        .entitlementIds || []),
    ];
    const uniqueEntsAfter2Team = new Set(allEntsAfter2Team);
    assert(
      allEntsAfter2Team.length === uniqueEntsAfter2Team.size,
      'D3.A: B5 Invariant - no duplicate entitlementIds across teams'
    );

    // ========================================================================
    // D3.B: 3-Team Trade with Explicit Routing via REAL applyWorldMutation
    // ========================================================================
    console.log('\n[D3.B] 3-Team Trade with Explicit Routing...');
    console.log(
      `  Trading ${ent3.id} from BOS to MIA (LAL in trade but NOT receiving)`
    );

    // Reload teams
    const preTrade3BOS = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_BOS);
    const preTrade3LAL = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_LAL);
    const preTrade3MIA = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_MIA);

    // Build 3-team trade payload
    const trade3Payload = build3TeamEntitlementTradePayload(
      preTrade3BOS,
      preTrade3LAL,
      preTrade3MIA,
      ent3.id,
      DETERMINISTIC_WORLD_ID
    );

    // Call REAL applyWorldMutation
    console.log(
      '  Calling applyWorldMutation({ mutationType: "executeTrade" })...'
    );
    const trade3Result = await applyWorldMutation({
      userId: TEST_USER_ID,
      worldId: DETERMINISTIC_WORLD_ID,
      seasonId: TEST_SEASON,
      mutationType: 'executeTrade',
      payload: trade3Payload,
      timestamp: Date.now(),
    });

    console.log(`  Result: success=${trade3Result.success}`);
    if (!trade3Result.success) {
      console.log(`  Error: ${trade3Result.error}`);
    }

    // Reload and verify
    const postTrade3BOS = await reloadTeam(
      db,
      DETERMINISTIC_WORLD_ID,
      TEAM_BOS
    );
    const postTrade3LAL = await reloadTeam(
      db,
      DETERMINISTIC_WORLD_ID,
      TEAM_LAL
    );
    const postTrade3MIA = await reloadTeam(
      db,
      DETERMINISTIC_WORLD_ID,
      TEAM_MIA
    );

    assert(trade3Result.success, 'D3.B: applyWorldMutation succeeded');
    assert(
      postTrade3MIA.entitlementIds?.includes(ent3.id),
      `D3.B: MIA (explicit dest) has ${ent3.id}`
    );
    assert(
      !postTrade3BOS.entitlementIds?.includes(ent3.id),
      `D3.B: BOS (sender) no longer has ${ent3.id}`
    );
    assert(
      !postTrade3LAL.entitlementIds?.includes(ent3.id),
      `D3.B: LAL (not routed) does NOT have ${ent3.id} - NO BROADCAST`
    );

    // B5 Invariant again
    const allEntsAfter3Team = [
      ...(postTrade3BOS.entitlementIds || []),
      ...(postTrade3LAL.entitlementIds || []),
      ...(postTrade3MIA.entitlementIds || []),
    ];
    const uniqueEntsAfter3Team = new Set(allEntsAfter3Team);
    assert(
      allEntsAfter3Team.length === uniqueEntsAfter3Team.size,
      'D3.B: B5 Invariant - no duplicate entitlementIds after 3-team trade'
    );

    // ========================================================================
    // D3.C: Season Advance via REAL advanceSeasonInWorld (DARE runs)
    // ========================================================================
    console.log('\n[D3.C] Season Advance via REAL advanceSeasonInWorld...');
    console.log(
      `  Advancing ${TEST_SEASON} → 2026-27 (DARE resolves ${DRAFT_YEAR} draft)`
    );

    // Call REAL advanceSeasonInWorld
    console.log(
      '  Calling advanceSeasonInWorld(worldId, { optionDecisions: {} })...'
    );
    const advanceResult = await advanceSeasonInWorld(DETERMINISTIC_WORLD_ID, {
      optionDecisions: {},
    });

    console.log(`  Result: success=${advanceResult.success}`);
    if (!advanceResult.success) {
      console.log(`  Error: ${advanceResult.error}`);
    } else {
      console.log(`  FromSeason: ${advanceResult.fromSeason}`);
      console.log(`  ToSeason: ${advanceResult.toSeason}`);
      console.log(`  Updated teams: ${advanceResult.updatedTeams?.join(', ')}`);
      if (advanceResult.summary?.dareReceipt) {
        console.log(
          `  DARE resolved: ${advanceResult.summary.dareReceipt.totalResolutions} entitlements`
        );
      }
    }

    assert(advanceResult.success, 'D3.C: advanceSeasonInWorld succeeded');
    assert(
      advanceResult.toSeason === '2026-27',
      `D3.C: World advanced to season 2026-27`
    );

    // Verify DARE wrote resolved fields to entitlements
    const resolvedEnt1 = await reloadWorldEntitlement(
      db,
      DETERMINISTIC_WORLD_ID,
      ent1.id
    );
    const resolvedEnt2 = await reloadWorldEntitlement(
      db,
      DETERMINISTIC_WORLD_ID,
      ent2.id
    );
    const resolvedEnt3 = await reloadWorldEntitlement(
      db,
      DETERMINISTIC_WORLD_ID,
      ent3.id
    );

    // ent1 is now on LAL (from 2-team trade) - should be resolved
    assert(
      resolvedEnt1?.resolved === true,
      `D3.C: ent1 (pick_ownership) resolved=true via DARE`
    );

    // ent2 stayed on LAL - should be resolved
    assert(
      resolvedEnt2?.resolved === true,
      `D3.C: ent2 (pick_ownership) resolved=true via DARE`
    );

    // ent3 (swap_right) is now on MIA - should be resolved
    // MIA@15 vs LAL@10 - LAL is better, so swap should be EXERCISED
    assert(
      resolvedEnt3?.resolved === true,
      `D3.C: ent3 (swap_right) resolved=true via DARE`
    );

    if (resolvedEnt3?.resolvedOutcome) {
      console.log(`  Swap outcome: ${resolvedEnt3.resolvedOutcome}`);
      assert(
        resolvedEnt3.resolvedOutcome === 'swap_exercised',
        `D3.C: ent3 swap outcome is 'swap_exercised' (MIA@15 exercised vs LAL@10)`
      );
    }

    // Verify resolved entitlements have proper timestamps
    assert(
      resolvedEnt1?.resolvedAt !== undefined,
      `D3.C: ent1 has resolvedAt timestamp (written by DARE)`
    );
    assert(
      resolvedEnt2?.resolvedAt !== undefined,
      `D3.C: ent2 has resolvedAt timestamp (written by DARE)`
    );
    assert(
      resolvedEnt3?.resolvedAt !== undefined,
      `D3.C: ent3 has resolvedAt timestamp (written by DARE)`
    );

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log(
      '\n============================================================'
    );
    console.log('Phase D3 TRUE E2E Gate Results');
    console.log('============================================================');
    console.log(`  Assertions Passed: ${assertionsPassed}`);
    console.log(`  Assertions Failed: ${assertionsFailed}`);

    if (failures.length > 0) {
      console.log('\nFailures:');
      failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    }

    console.log(
      '\n============================================================'
    );

    if (assertionsFailed > 0) {
      console.log('❌ Phase D3 TRUE E2E Gate FAILED');
      process.exit(1);
    } else {
      console.log('✅ Phase D3 TRUE E2E Gate PASSED');
      console.log('\nProven (via REAL entrypoints, not simulation):');
      console.log(
        '  - applyWorldMutation("executeTrade") persists entitlement transfers'
      );
      console.log(
        '  - 3-team routing routes to explicit destination only (no broadcast)'
      );
      console.log(
        '  - advanceSeasonInWorld runs DARE and persists resolved outcomes'
      );
      console.log(
        '  - Reloaded entitlements have resolved=true and resolvedAt timestamps'
      );
      process.exit(0);
    }
  } catch (error) {
    console.error(
      '\n============================================================'
    );
    console.error('Phase D3 TRUE E2E Gate ERROR');
    console.error(
      '============================================================'
    );
    console.error(error);
    process.exit(1);
  }
}

// Run the proof
runProof();
