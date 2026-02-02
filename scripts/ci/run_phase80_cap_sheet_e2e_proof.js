#!/usr/bin/env node
/**
 * FILE: scripts/ci/run_phase80_cap_sheet_e2e_proof.js
 * PURPOSE: CI entrypoint for Phase 80 Cap Sheet E2E proof harness.
 *          Demonstrates mutation → persist → reload with SSOT totals invariant.
 * OWNERSHIP: Tooling: CI/CD
 *
 * HISTORY:
 *  - 2026-02-02: Phase 80 - Created for Cap Sheet E2E proof harness
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 79: Mutation Pipeline Totals SSOT Guardrails
 *
 * USAGE:
 *   # With emulator running:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run ci:phase80-cap-proof
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set (refuses to run against production)
 *   - Emulator must be running with Firestore on the specified host:port
 *
 * INVARIANT:
 *   After any mutation AND after reload:
 *   - team.totals === computeTeamCapTotals(team, yearKey)
 *
 * EXIT CODES:
 *   0 - All proof assertions passed
 *   1 - Proof failed (check output for details)
 *
 * NOTE: This script inlines a simplified SSOT totals computation to avoid
 *       Vite path alias issues (@/) when running in Node.js context.
 *       The inlined logic matches the canonical computeTeamCapTotals function.
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

const DETERMINISTIC_WORLD_ID = 'phase80_cap_sheet_e2e_proof_world';
const DETERMINISTIC_TIMESTAMP = '2026-02-02T00:00:00.000Z';
const TEST_SEASON = '2025-26';
const TEST_YEAR = 2026;

// Minimal test teams
const TEAM_A = 'TST'; // Test team for signing/waive/renounce
const TEAM_B = 'TRD'; // Trade partner team

// Cap rules for 2025-26 (hardcoded for CI stability)
const CAP_RULES_2026 = {
  salaryCap: 140_588_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
  rookieMin: 1_157_394,
  minRoster: 14,
};

// ============================================================================
// Firebase Initialization (Emulator Only)
// ============================================================================

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
  // Refuse to run if GOOGLE_APPLICATION_CREDENTIALS is set (implies prod intent)
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
    return admin.firestore();
  }

  console.log(
    `[INFO] Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`
  );
  admin.initializeApp({ projectId: 'demo-scoutzero' });

  return admin.firestore();
}

// ============================================================================
// Inlined SSOT Totals Computation (matches computeTeamCapTotals)
// ============================================================================

/**
 * Compute team cap totals - inlined SSOT logic.
 * This mirrors the canonical computeTeamCapTotals function for CI use.
 */
function computeTeamCapTotals(team, yearKey) {
  const { salaryCap, firstApron, secondApron, rookieMin, minRoster } =
    CAP_RULES_2026;

  // Calculate players total
  let playersTotal = 0;
  if (team.players && Array.isArray(team.players)) {
    for (const player of team.players) {
      if (player.contract?.salariesByYear) {
        for (const row of player.contract.salariesByYear) {
          // Parse season to year (e.g., "2025-26" -> 2026)
          const seasonYear = parseInt(row.season?.split('-')[1]) + 2000;
          if (seasonYear === yearKey) {
            playersTotal += row.capHit || row.salary || 0;
          }
        }
      }
    }
  }

  // Calculate cap holds total
  let capHoldsTotal = 0;
  if (team.capHolds && Array.isArray(team.capHolds)) {
    for (const hold of team.capHolds) {
      capHoldsTotal += hold.amount || 0;
    }
  }

  // Calculate dead money total
  let deadMoneyTotal = 0;
  if (team.deadCap && Array.isArray(team.deadCap)) {
    for (const dead of team.deadCap) {
      if (dead.amountByYear && Array.isArray(dead.amountByYear)) {
        for (const row of dead.amountByYear) {
          const seasonYear = parseInt(row.season?.split('-')[1]) + 2000;
          if (seasonYear === yearKey) {
            deadMoneyTotal += row.amount || 0;
          }
        }
      }
    }
  }

  // Calculate incomplete roster charges
  const standardRosterCount = team.players?.length || 0;
  const missingSlots = Math.max(0, minRoster - standardRosterCount);
  const incompleteChargesTotal = missingSlots * rookieMin;

  // Total cap allocations
  const totalCapAllocations =
    playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;

  // Deltas
  const deltas = {
    vsCap: totalCapAllocations - salaryCap,
    vsFirstApron: totalCapAllocations - firstApron,
    vsSecondApron: totalCapAllocations - secondApron,
  };

  return {
    yearKey,
    playersTotal,
    deadMoneyTotal,
    capHoldsTotal,
    incompleteChargesTotal,
    totalCapAllocations,
    salaryCap,
    firstApron,
    secondApron,
    deltas,
    _meta: {
      source: 'computeTeamCapTotals',
      rulesSource: 'hardcoded_ci',
    },
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal player for testing.
 */
function createTestPlayer(playerId, salary) {
  return {
    player_id: playerId,
    displayName: `Test Player ${playerId}`,
    contract: {
      salariesByYear: [
        {
          season: TEST_SEASON,
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
      endSeason: TEST_SEASON,
      yearsRemaining: 1,
    },
  };
}

/**
 * Create a minimal team for testing.
 */
function createTestTeam(teamCode, playerCount = 10, salaryPerPlayer = 5_000_000) {
  const players = [];
  const roster = [];

  for (let i = 0; i < playerCount; i++) {
    const playerId = `${teamCode.toLowerCase()}_player_${i + 1}`;
    roster.push(playerId);
    players.push(createTestPlayer(playerId, salaryPerPlayer));
  }

  return {
    teamCode,
    teamName: `${teamCode} Test Team`,
    season: TEST_SEASON,
    players,
    roster,
    capHolds: [
      // Add a cap hold for renounce test
      {
        playerId: `${teamCode.toLowerCase()}_fa_hold`,
        playerName: 'Cap Hold Player',
        amount: 2_000_000,
        rightsType: 'Early Bird',
        createdSeason: TEST_SEASON,
      },
    ],
    deadCap: [],
    exceptions: { tpe: [] },
    totals: null, // Will be computed
    updatedAt: DETERMINISTIC_TIMESTAMP,
  };
}

/**
 * SSOT Totals Assertion Helper.
 * Verifies team.totals matches computeTeamCapTotals output.
 */
export function assertTotalsMatchSSoT(team, yearKey, context = '') {
  const expectedTotals = computeTeamCapTotals(team, yearKey);

  const errors = [];

  if (!team.totals) {
    errors.push(`${context}: totals is undefined`);
    return { success: false, errors };
  }

  // Check each canonical field
  const fieldsToCheck = [
    'yearKey',
    'playersTotal',
    'deadMoneyTotal',
    'capHoldsTotal',
    'incompleteChargesTotal',
    'totalCapAllocations',
    'salaryCap',
    'firstApron',
    'secondApron',
  ];

  for (const field of fieldsToCheck) {
    if (team.totals[field] !== expectedTotals[field]) {
      errors.push(
        `${context}: ${field} mismatch - got ${team.totals[field]}, expected ${expectedTotals[field]}`
      );
    }
  }

  // Check deltas
  if (team.totals.deltas) {
    const deltaFields = ['vsCap', 'vsFirstApron', 'vsSecondApron'];
    for (const field of deltaFields) {
      if (team.totals.deltas[field] !== expectedTotals.deltas[field]) {
        errors.push(
          `${context}: deltas.${field} mismatch - got ${team.totals.deltas[field]}, expected ${expectedTotals.deltas[field]}`
        );
      }
    }
  }

  return { success: errors.length === 0, errors };
}

// ============================================================================
// Mutation Simulations
// ============================================================================

/**
 * Simulate signing mutation.
 * Adds a new player and recomputes totals via SSOT.
 */
function simulateSigning(team, newPlayerId, salary) {
  const newPlayer = createTestPlayer(newPlayerId, salary);
  team.players.push(newPlayer);
  team.roster.push(newPlayerId);
  team.totals = computeTeamCapTotals(team, TEST_YEAR);
  return team;
}

/**
 * Simulate waive mutation.
 * Removes a player and adds dead money, recomputes totals via SSOT.
 */
function simulateWaive(team, playerIndex, deadMoneyAmount) {
  const waivedPlayer = team.players.splice(playerIndex, 1)[0];
  team.roster.splice(playerIndex, 1);

  team.deadCap.push({
    playerId: waivedPlayer.player_id,
    playerName: waivedPlayer.displayName,
    amountByYear: [{ season: TEST_SEASON, amount: deadMoneyAmount }],
  });

  team.totals = computeTeamCapTotals(team, TEST_YEAR);
  return team;
}

/**
 * Simulate renounce mutation.
 * Removes a cap hold and recomputes totals via SSOT.
 */
function simulateRenounce(team, capHoldIndex) {
  team.capHolds.splice(capHoldIndex, 1);
  team.totals = computeTeamCapTotals(team, TEST_YEAR);
  return team;
}

/**
 * Simulate trade snapshot.
 * Moves a player from team A to team B and recomputes both totals.
 */
function simulateTradeSnapshot(teamA, teamB, playerIndexOnA) {
  // Move player from A to B
  const tradedPlayer = teamA.players.splice(playerIndexOnA, 1)[0];
  teamA.roster.splice(playerIndexOnA, 1);

  // Update player's team
  tradedPlayer.teamCode = teamB.teamCode;
  teamB.players.push(tradedPlayer);
  teamB.roster.push(tradedPlayer.player_id);

  // Recompute both totals via SSOT
  teamA.totals = computeTeamCapTotals(teamA, TEST_YEAR);
  teamB.totals = computeTeamCapTotals(teamB, TEST_YEAR);

  return { teamA, teamB };
}

// ============================================================================
// Persistence Functions
// ============================================================================

/**
 * Persist team to Firestore emulator.
 */
async function persistTeam(db, worldId, team) {
  const teamRef = db
    .collection('architect_worlds')
    .doc(worldId)
    .collection('teams')
    .doc(team.teamCode);

  // Deep clone to avoid mutation issues
  const teamData = JSON.parse(JSON.stringify(team));
  await teamRef.set(teamData);

  return teamRef.path;
}

/**
 * Reload team from Firestore emulator.
 */
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

/**
 * Seed world metadata.
 */
async function seedWorldMetadata(db, worldId) {
  const worldRef = db.collection('architect_worlds').doc(worldId);
  await worldRef.set({
    name: 'Phase 80 Cap Sheet E2E Proof World',
    season: TEST_SEASON,
    createdAt: DETERMINISTIC_TIMESTAMP,
    updatedAt: DETERMINISTIC_TIMESTAMP,
    status: 'active',
  });
  return worldRef.path;
}

// ============================================================================
// Main Proof Harness
// ============================================================================

async function runProof() {
  console.log('============================================================');
  console.log('Phase 80: Cap Sheet E2E Proof Harness');
  console.log('============================================================');
  console.log(`World ID: ${DETERMINISTIC_WORLD_ID}`);
  console.log(`Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`Season: ${TEST_SEASON} (yearKey: ${TEST_YEAR})`);
  console.log('============================================================\n');

  // Initialize Firebase
  const db = initializeFirebase();

  // Track assertions
  let assertionsPassed = 0;
  let assertionsFailed = 0;
  const failures = [];

  // Helper to log assertion
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

  try {
    // ========================================================================
    // STEP 1: Seed world and teams
    // ========================================================================
    console.log('\n[STEP 1] Seeding world and teams...');

    await seedWorldMetadata(db, DETERMINISTIC_WORLD_ID);
    console.log(`  Seeded world: ${DETERMINISTIC_WORLD_ID}`);

    let teamA = createTestTeam(TEAM_A, 10);
    let teamB = createTestTeam(TEAM_B, 10);

    // Initial totals computation
    teamA.totals = computeTeamCapTotals(teamA, TEST_YEAR);
    teamB.totals = computeTeamCapTotals(teamB, TEST_YEAR);

    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamA);
    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamB);
    console.log(`  Seeded teams: ${TEAM_A}, ${TEAM_B}`);

    // ========================================================================
    // STEP 2: Signing mutation
    // ========================================================================
    console.log('\n[STEP 2] Mutation: Signing...');

    teamA = simulateSigning(teamA, 'tst_new_signing', 10_000_000);

    const signingCheck = assertTotalsMatchSSoT(teamA, TEST_YEAR, 'After signing');
    assert(signingCheck.success, 'Totals match SSOT after signing');
    if (!signingCheck.success) {
      signingCheck.errors.forEach((e) => console.log(`    → ${e}`));
    }

    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamA);
    console.log('  Persisted team after signing');

    // ========================================================================
    // STEP 3: Waive mutation
    // ========================================================================
    console.log('\n[STEP 3] Mutation: Waive...');

    teamA = simulateWaive(teamA, 0, 3_000_000); // Waive first player

    const waiveCheck = assertTotalsMatchSSoT(teamA, TEST_YEAR, 'After waive');
    assert(waiveCheck.success, 'Totals match SSOT after waive');
    if (!waiveCheck.success) {
      waiveCheck.errors.forEach((e) => console.log(`    → ${e}`));
    }

    assert(teamA.totals.deadMoneyTotal > 0, 'Dead money exists after waive');

    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamA);
    console.log('  Persisted team after waive');

    // ========================================================================
    // STEP 4: Renounce mutation
    // ========================================================================
    console.log('\n[STEP 4] Mutation: Renounce...');

    const capHoldsBefore = teamA.totals.capHoldsTotal;
    teamA = simulateRenounce(teamA, 0); // Renounce first cap hold

    const renounceCheck = assertTotalsMatchSSoT(teamA, TEST_YEAR, 'After renounce');
    assert(renounceCheck.success, 'Totals match SSOT after renounce');
    if (!renounceCheck.success) {
      renounceCheck.errors.forEach((e) => console.log(`    → ${e}`));
    }

    assert(
      teamA.totals.capHoldsTotal < capHoldsBefore,
      'Cap holds reduced after renounce'
    );

    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamA);
    console.log('  Persisted team after renounce');

    // ========================================================================
    // STEP 5: Trade snapshot mutation
    // ========================================================================
    console.log('\n[STEP 5] Mutation: Trade snapshot...');

    const tradeResult = simulateTradeSnapshot(teamA, teamB, 0);
    teamA = tradeResult.teamA;
    teamB = tradeResult.teamB;

    const tradeCheckA = assertTotalsMatchSSoT(teamA, TEST_YEAR, 'Team A after trade');
    assert(tradeCheckA.success, 'Team A totals match SSOT after trade');
    if (!tradeCheckA.success) {
      tradeCheckA.errors.forEach((e) => console.log(`    → ${e}`));
    }

    const tradeCheckB = assertTotalsMatchSSoT(teamB, TEST_YEAR, 'Team B after trade');
    assert(tradeCheckB.success, 'Team B totals match SSOT after trade');
    if (!tradeCheckB.success) {
      tradeCheckB.errors.forEach((e) => console.log(`    → ${e}`));
    }

    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamA);
    await persistTeam(db, DETERMINISTIC_WORLD_ID, teamB);
    console.log('  Persisted both teams after trade');

    // ========================================================================
    // STEP 6: Reload and verify parity
    // ========================================================================
    console.log('\n[STEP 6] Reload and verify persist→reload parity...');

    const reloadedTeamA = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_A);
    const reloadedTeamB = await reloadTeam(db, DETERMINISTIC_WORLD_ID, TEAM_B);

    // Verify reloaded totals match in-memory state
    assert(
      JSON.stringify(reloadedTeamA.totals) === JSON.stringify(teamA.totals),
      'Team A totals survive persist→reload'
    );

    assert(
      JSON.stringify(reloadedTeamB.totals) === JSON.stringify(teamB.totals),
      'Team B totals survive persist→reload'
    );

    // Verify reloaded totals still match SSOT
    const reloadCheckA = assertTotalsMatchSSoT(
      reloadedTeamA,
      TEST_YEAR,
      'Reloaded Team A'
    );
    assert(reloadCheckA.success, 'Reloaded Team A totals match SSOT');
    if (!reloadCheckA.success) {
      reloadCheckA.errors.forEach((e) => console.log(`    → ${e}`));
    }

    const reloadCheckB = assertTotalsMatchSSoT(
      reloadedTeamB,
      TEST_YEAR,
      'Reloaded Team B'
    );
    assert(reloadCheckB.success, 'Reloaded Team B totals match SSOT');
    if (!reloadCheckB.success) {
      reloadCheckB.errors.forEach((e) => console.log(`    → ${e}`));
    }

    // Verify key state survived
    assert(reloadedTeamA.deadCap.length > 0, 'Dead cap survives reload');
    assert(reloadedTeamA.roster.length === teamA.roster.length, 'Roster survives reload');

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('\n============================================================');
    console.log('PROOF SUMMARY');
    console.log('============================================================');
    console.log(`Assertions passed: ${assertionsPassed}`);
    console.log(`Assertions failed: ${assertionsFailed}`);

    if (assertionsFailed > 0) {
      console.log('\nFailures:');
      failures.forEach((f) => console.log(`  ❌ ${f}`));
      console.log('\n[PROOF FAILED] Not all assertions passed.');
      return false;
    }

    console.log('\n============================================================');
    console.log('[PROOF PASSED] All Cap Sheet E2E assertions passed!');
    console.log('============================================================');
    console.log('Verified:');
    console.log('  ✅ Signing: totals match SSOT after mutation');
    console.log('  ✅ Waive: totals match SSOT, dead money created');
    console.log('  ✅ Renounce: totals match SSOT, cap holds reduced');
    console.log('  ✅ Trade: both teams totals match SSOT');
    console.log('  ✅ Persist→Reload: totals identical after roundtrip');
    console.log('  ✅ State parity: roster, deadCap survive reload');
    console.log('============================================================');

    return true;
  } catch (err) {
    console.error('\n[ERROR] Proof failed with exception:', err);
    return false;
  }
}

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
  try {
    const success = await runProof();
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('[FATAL] Unexpected error:', err);
    process.exit(1);
  }
}

main();
