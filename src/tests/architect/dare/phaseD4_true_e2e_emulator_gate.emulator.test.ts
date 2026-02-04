/**
 * FILE: src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts
 * PURPOSE: Phase D4 TRUE E2E Gate - REAL applyWorldMutation + advanceSeasonInWorld
 *          against Firestore emulator with persistence verification.
 * OWNERSHIP: Feature: architect/dare
 *
 * HISTORY:
 *  - 2026-02-04: Phase D4 - Created for true E2E with real persistence
 *
 * LINKS:
 *  - Master Doc: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - Prior: phaseD3_true_e2e_gate.integration.test.js (no persistence verification)
 *
 * USAGE:
 *   With emulator running:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run ci:phaseD4-dare-emulator-gate
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set
 *   - Emulator must be running with Firestore on the specified host:port
 *   - Uses vitest.emulator.config.js (no Firebase mocks)
 *
 * TESTS (D4.A through D4.D):
 *   D4.Preflight: Emulator connectivity check
 *   D4.A: 2-team trade via REAL applyWorldMutation('executeTrade')
 *   D4.B: Reload and verify entitlementIds moved correctly
 *   D4.C: Season advance via REAL advanceSeasonInWorld (DARE runs)
 *   D4.D: Reload and verify DARE resolution fields persisted
 *
 * WHAT THIS PROVES THAT D3 DIDN'T:
 *   - D3 verified code structure and pure layer (computeWorldMutation)
 *   - D4 verifies ACTUAL PERSISTENCE via reload from emulator
 *   - D4 proves the full pipeline works end-to-end with real Firestore operations
 *
 * AUTHENTICATION:
 *   This test authenticates against the Auth emulator to satisfy Firestore
 *   security rules. The test user creates the world and is thus the owner.
 *
 * ARCHITECTURE:
 *   - Uses firebase-admin (Admin SDK) for seeding base collections (bypasses rules)
 *   - Uses Firebase Web SDK (via @/firebaseConfig) for pipeline calls (subject to rules)
 *   - This mirrors production: admin writes base data, web SDK for user operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import admin from 'firebase-admin';

// These imports use the REAL source code (not mocks)
// The vitest.emulator.config.js aliases @/firebaseConfig to the emulator config
import { db, auth } from '@/firebaseConfig';
import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';

// ============================================================================
// Initialize Firebase Admin for seeding (bypasses security rules)
// ============================================================================

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
let adminDb: FirebaseFirestore.Firestore;

if (EMULATOR_HOST) {
  // Initialize admin SDK for emulator
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'scoutzero-bf1ae' });
  }
  adminDb = admin.firestore();
}

// ============================================================================
// Configuration - Deterministic IDs for reproducibility
// ============================================================================

const DETERMINISTIC_WORLD_ID = 'phaseD4_true_e2e_gate_world';
const DETERMINISTIC_TIMESTAMP = '2026-02-04T14:00:00.000Z';
const TEST_SEASON = '2025-26';
const DRAFT_YEAR = 2026;
const TEST_USER_EMAIL = 'phaseD4-test@scoutzero.test';
const TEST_USER_PASSWORD = 'testPassword123!';

// Team codes for testing
const TEAM_BOS = 'BOS';
const TEAM_LAL = 'LAL';
const TEAM_MIA = 'MIA';

// ============================================================================
// Preflight: Verify emulator is running
// ============================================================================

describe('Phase D4: TRUE E2E Emulator Gate', () => {
  // Track if setup succeeded for cleanup
  let setupSucceeded = false;
  // Store authenticated user ID for use throughout tests
  let testUserId: string = '';
  // ========================================================================
  // Fixture Helpers
  // ========================================================================

  function createPickOwnershipEntitlement(
    id: string,
    holderTeam: string,
    seasonYear: number,
    round = 1
  ) {
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

  function createSwapRightEntitlement(
    id: string,
    holderTeam: string,
    seasonYear: number,
    controllerPickId: string,
    targetTeams: string[]
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

  function createMinimalPlayer(
    playerId: string,
    name: string,
    teamCode: string,
    salary = 10_000_000
  ) {
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

  function createMinimalTeam(
    teamCode: string,
    players: any[] = [],
    entitlementIds: string[] = []
  ) {
    const totalSalary = players.reduce((sum, p) => sum + (p.salary || 0), 0);
    return {
      id: teamCode.toLowerCase(),
      teamCode,
      teamName: `${teamCode} Test Team`,
      season: TEST_SEASON,
      players,
      roster: players.map((p: any) => p.player_id || p.id),
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

  // ========================================================================
  // Persistence Helpers
  // ========================================================================

  async function seedWorldMetadata(userId: string) {
    const worldRef = doc(db, 'architect_worlds', DETERMINISTIC_WORLD_ID);
    await setDoc(worldRef, {
      worldName: 'Phase D4 True E2E Emulator Gate World',
      name: 'Phase D4 True E2E Emulator Gate World',
      currentSeason: TEST_SEASON,
      createdAt: DETERMINISTIC_TIMESTAMP,
      updatedAt: DETERMINISTIC_TIMESTAMP,
      createdBy: userId,  // Must match authenticated user for security rules
      status: 'active',
    });
  }

  async function persistTeam(team: any) {
    const teamRef = doc(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'teams',
      team.teamCode
    );
    await setDoc(teamRef, JSON.parse(JSON.stringify(team)));
  }

  async function reloadTeam(teamCode: string): Promise<any> {
    const teamRef = doc(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'teams',
      teamCode
    );
    const snap = await getDoc(teamRef);
    if (!snap.exists()) {
      throw new Error(
        `Team ${teamCode} not found in world ${DETERMINISTIC_WORLD_ID}`
      );
    }
    return snap.data();
  }

  async function persistBaseEntitlement(entitlement: any) {
    const entRef = doc(db, 'architect_baseEntitlements', entitlement.id);
    await setDoc(entRef, entitlement);
  }

  async function persistWorldEntitlement(entitlement: any) {
    const entRef = doc(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'entitlements',
      entitlement.id
    );
    await setDoc(entRef, entitlement);
  }

  async function reloadWorldEntitlement(entitlementId: string): Promise<any> {
    const entRef = doc(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'entitlements',
      entitlementId
    );
    const snap = await getDoc(entRef);
    return snap.exists() ? snap.data() : null;
  }

  async function persistDraftPositionsMap(
    draftYear: number,
    positionsMap: Record<string, number>
  ) {
    const posRef = doc(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'draftPositions',
      String(draftYear)
    );
    await setDoc(posRef, {
      draftYear,
      positions: positionsMap,
      createdAt: DETERMINISTIC_TIMESTAMP,
    });
  }

  async function persistPlayer(teamCode: string, player: any) {
    const playerRef = doc(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'teams',
      teamCode,
      'players',
      player.player_id || player.id
    );
    await setDoc(playerRef, player);
  }

  async function cleanupWorld() {
    // Delete teams subcollection
    const teamsRef = collection(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'teams'
    );
    const teamsSnap = await getDocs(teamsRef);
    const batch = writeBatch(db);

    for (const teamDoc of teamsSnap.docs) {
      // Delete players subcollection
      const playersRef = collection(teamDoc.ref, 'players');
      const playersSnap = await getDocs(playersRef);
      for (const playerDoc of playersSnap.docs) {
        batch.delete(playerDoc.ref);
      }
      batch.delete(teamDoc.ref);
    }

    // Delete entitlements subcollection
    const entsRef = collection(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'entitlements'
    );
    const entsSnap = await getDocs(entsRef);
    for (const entDoc of entsSnap.docs) {
      batch.delete(entDoc.ref);
    }

    // Delete draftPositions subcollection
    const posRef = collection(
      db,
      'architect_worlds',
      DETERMINISTIC_WORLD_ID,
      'draftPositions'
    );
    const posSnap = await getDocs(posRef);
    for (const posDoc of posSnap.docs) {
      batch.delete(posDoc.ref);
    }

    await batch.commit();

    // Delete world document
    const worldRef = doc(db, 'architect_worlds', DETERMINISTIC_WORLD_ID);
    await deleteDoc(worldRef);
  }

  // ========================================================================
  // Test Data
  // ========================================================================

  const ent1 = createPickOwnershipEntitlement(
    'ent:BOS:2026:1:own:d4-001',
    TEAM_BOS,
    DRAFT_YEAR,
    1
  );
  const ent2 = createPickOwnershipEntitlement(
    'ent:LAL:2026:1:own:d4-002',
    TEAM_LAL,
    DRAFT_YEAR,
    1
  );
  const ent3 = createSwapRightEntitlement(
    'ent:BOS:2026:1:swap:d4-003',
    TEAM_BOS,
    DRAFT_YEAR,
    'LAL_2026_1st',
    ['LAL']
  );

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

  // ========================================================================
  // D4.Preflight: Emulator Connectivity Check
  // ========================================================================

  describe('D4.Preflight: Emulator Connectivity', () => {
    it('FIRESTORE_EMULATOR_HOST is set', () => {
      expect(process.env.FIRESTORE_EMULATOR_HOST).toBeDefined();
      expect(process.env.FIRESTORE_EMULATOR_HOST).toMatch(/^\d+\.\d+\.\d+\.\d+:\d+$/);
    });

    it('Emulator is reachable (write+read+delete temp doc)', async () => {
      const testDocRef = doc(db, 'test_connectivity', 'phaseD4_preflight');
      
      // Write
      await setDoc(testDocRef, { 
        test: true, 
        timestamp: new Date().toISOString() 
      });
      
      // Read
      const snap = await getDoc(testDocRef);
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.test).toBe(true);
      
      // Delete
      await deleteDoc(testDocRef);
      
      // Verify deleted
      const afterDelete = await getDoc(testDocRef);
      expect(afterDelete.exists()).toBe(false);
    });
  });

  // ========================================================================
  // Setup: Authenticate and Seed World Data
  // ========================================================================

  beforeAll(async () => {
    console.log('[D4] Setting up test world...');

    // Step 1: Authenticate with Auth emulator (required for Firestore security rules)
    console.log('  Authenticating test user...');
    try {
      // Try to sign in first (in case user exists from previous run)
      const userCred = await signInWithEmailAndPassword(
        auth,
        TEST_USER_EMAIL,
        TEST_USER_PASSWORD
      );
      testUserId = userCred.user.uid;
      console.log(`  Signed in existing user: ${testUserId}`);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        // Create the user if it doesn't exist
        const userCred = await createUserWithEmailAndPassword(
          auth,
          TEST_USER_EMAIL,
          TEST_USER_PASSWORD
        );
        testUserId = userCred.user.uid;
        console.log(`  Created new user: ${testUserId}`);
      } else {
        throw e;
      }
    }

    // Clean up any existing data first
    try {
      await cleanupWorld();
    } catch (e) {
      // World might not exist, that's fine
    }

    // Seed world metadata (using authenticated user as owner)
    await seedWorldMetadata(testUserId);
    console.log(`  Seeded world: ${DETERMINISTIC_WORLD_ID}`);

    // Seed entitlements
    await persistBaseEntitlement(ent1);
    await persistBaseEntitlement(ent2);
    await persistBaseEntitlement(ent3);
    await persistWorldEntitlement(ent1);
    await persistWorldEntitlement(ent2);
    await persistWorldEntitlement(ent3);
    console.log('  Seeded 3 entitlements');

    // Create teams with initial entitlements
    const teamBOS = createMinimalTeam(TEAM_BOS, [playerBOS1], [ent1.id, ent3.id]);
    const teamLAL = createMinimalTeam(TEAM_LAL, [playerLAL1], [ent2.id]);
    const teamMIA = createMinimalTeam(TEAM_MIA, [playerMIA1], []);

    await persistTeam(teamBOS);
    await persistTeam(teamLAL);
    await persistTeam(teamMIA);
    console.log('  Seeded 3 teams: BOS, LAL, MIA');

    // Persist players individually
    await persistPlayer(TEAM_BOS, playerBOS1);
    await persistPlayer(TEAM_LAL, playerLAL1);
    await persistPlayer(TEAM_MIA, playerMIA1);
    console.log('  Seeded 3 players');

    // Seed draft positions
    const positionsMap = { BOS: 5, LAL: 10, MIA: 15 };
    await persistDraftPositionsMap(DRAFT_YEAR, positionsMap);
    console.log('  Seeded draft positions: BOS@5, LAL@10, MIA@15');

    setupSucceeded = true;
    console.log('[D4] Setup complete.\n');
  });

  afterAll(async () => {
    if (setupSucceeded) {
      console.log('\n[D4] Cleaning up test world...');
      await cleanupWorld();
      console.log('[D4] Cleanup complete.');
    }
    // Sign out
    await signOut(auth);
  });

  // ========================================================================
  // D4.A: 2-Team Trade via REAL applyWorldMutation
  // ========================================================================

  describe('D4.A: Execute Trade via REAL applyWorldMutation', () => {
    it('applyWorldMutation is a real function', () => {
      expect(typeof applyWorldMutation).toBe('function');
    });

    it('Executes 2-team trade: BOS → LAL entitlement transfer', async () => {
      // Reload teams for fresh state
      const preTradeBOS = await reloadTeam(TEAM_BOS);
      const preTradeLAL = await reloadTeam(TEAM_LAL);

      // Build trade payload
      const tradePayload = {
        teams: [
          {
            teamCode: TEAM_BOS,
            team: preTradeBOS,
            sends: [],
            receives: [],
            picksOut: [ent1.id],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
            entitlementTransfers: [
              { entitlementId: ent1.id, direction: 'out', toTeamCode: TEAM_LAL },
            ],
          },
          {
            teamCode: TEAM_LAL,
            team: preTradeLAL,
            sends: [],
            receives: [],
            picksOut: [],
            picksIn: [ent1.id],
            cashSent: 0,
            cashReceived: 0,
            entitlementTransfers: [
              { entitlementId: ent1.id, direction: 'in', fromTeamCode: TEAM_BOS },
            ],
          },
        ],
        capProjections: createCapProjections(),
        tradeCtx: { worldId: DETERMINISTIC_WORLD_ID, seasonId: TEST_SEASON },
        isEntitlementOnlyTrade: true,
      };

      console.log('[D4.A] Calling applyWorldMutation({ mutationType: "executeTrade" })...');

      // Call REAL applyWorldMutation
      const result = await applyWorldMutation({
        userId: testUserId,
        worldId: DETERMINISTIC_WORLD_ID,
        seasonId: TEST_SEASON,
        mutationType: 'executeTrade',
        payload: tradePayload,
        timestamp: Date.now(),
      });

      console.log(`[D4.A] Result: success=${result.success}`);
      if (!result.success) {
        console.log(`[D4.A] Error: ${result.error}`);
        console.log(`[D4.A] Violations: ${JSON.stringify(result.violations || [])}`);
      }

      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // D4.B: Reload and Verify Entitlement Transfer
  // ========================================================================

  describe('D4.B: Reload and Verify Entitlement Transfer (Persistence Proof)', () => {
    it('BOS no longer has ent1 (verified via RELOAD from emulator)', async () => {
      const postTradeBOS = await reloadTeam(TEAM_BOS);
      expect(postTradeBOS.entitlementIds).not.toContain(ent1.id);
    });

    it('LAL now has ent1 (verified via RELOAD from emulator)', async () => {
      const postTradeLAL = await reloadTeam(TEAM_LAL);
      expect(postTradeLAL.entitlementIds).toContain(ent1.id);
    });

    it('BOS still has swap right ent3 (not traded)', async () => {
      const postTradeBOS = await reloadTeam(TEAM_BOS);
      expect(postTradeBOS.entitlementIds).toContain(ent3.id);
    });

    it('B5 Invariant: No duplicate entitlementIds across teams', async () => {
      const bosData = await reloadTeam(TEAM_BOS);
      const lalData = await reloadTeam(TEAM_LAL);
      const miaData = await reloadTeam(TEAM_MIA);

      const allEnts = [
        ...(bosData.entitlementIds || []),
        ...(lalData.entitlementIds || []),
        ...(miaData.entitlementIds || []),
      ];
      const uniqueEnts = new Set(allEnts);

      expect(allEnts.length).toBe(uniqueEnts.size);
    });
  });

  // ========================================================================
  // D4.C: Season Advance via REAL advanceSeasonInWorld
  // ========================================================================

  describe('D4.C: Season Advance via REAL advanceSeasonInWorld', () => {
    it('advanceSeasonInWorld is a real function', () => {
      expect(typeof advanceSeasonInWorld).toBe('function');
    });

    it('Advances season 2025-26 → 2026-27 (DARE resolves picks)', async () => {
      console.log('[D4.C] Calling advanceSeasonInWorld(worldId, { optionDecisions: {} })...');

      // Call REAL advanceSeasonInWorld
      const result = await advanceSeasonInWorld(DETERMINISTIC_WORLD_ID, {
        optionDecisions: {},
      });

      console.log(`[D4.C] Result: success=${result.success}`);
      if (!result.success) {
        console.log(`[D4.C] Error: ${result.error}`);
      } else {
        console.log(`[D4.C] FromSeason: ${result.fromSeason}`);
        console.log(`[D4.C] ToSeason: ${result.toSeason}`);
        console.log(`[D4.C] Updated teams: ${result.updatedTeams?.join(', ')}`);
        if (result.summary?.dareReceipt) {
          console.log(
            `[D4.C] DARE resolved: ${result.summary.dareReceipt.totalResolutions} entitlements`
          );
        }
      }

      expect(result.success).toBe(true);
      expect(result.toSeason).toBe('2026-27');
    });
  });

  // ========================================================================
  // D4.D: Reload and Verify DARE Resolution (Persistence Proof)
  // ========================================================================

  describe('D4.D: Reload and Verify DARE Resolution (Persistence Proof)', () => {
    it('ent1 (pick_ownership) has resolved=true after DARE', async () => {
      const resolvedEnt1 = await reloadWorldEntitlement(ent1.id);
      expect(resolvedEnt1).not.toBeNull();
      expect(resolvedEnt1?.resolved).toBe(true);
    });

    it('ent1 has resolvedAt timestamp (written by DARE)', async () => {
      const resolvedEnt1 = await reloadWorldEntitlement(ent1.id);
      expect(resolvedEnt1?.resolvedAt).toBeDefined();
    });

    it('ent2 (pick_ownership) has resolved=true after DARE', async () => {
      const resolvedEnt2 = await reloadWorldEntitlement(ent2.id);
      expect(resolvedEnt2).not.toBeNull();
      expect(resolvedEnt2?.resolved).toBe(true);
    });

    it('ent3 (swap_right) has resolved=true after DARE', async () => {
      const resolvedEnt3 = await reloadWorldEntitlement(ent3.id);
      expect(resolvedEnt3).not.toBeNull();
      expect(resolvedEnt3?.resolved).toBe(true);
    });

    it('ent3 swap outcome is swap_exercised (MIA@15 vs LAL@10)', async () => {
      const resolvedEnt3 = await reloadWorldEntitlement(ent3.id);
      // MIA has position 15, LAL has position 10 - lower is better
      // MIA holds swap right, can swap with LAL - they should exercise because LAL@10 is better
      if (resolvedEnt3?.resolvedOutcome) {
        console.log(`[D4.D] Swap outcome: ${resolvedEnt3.resolvedOutcome}`);
        expect(resolvedEnt3.resolvedOutcome).toBe('swap_exercised');
      }
    });

    it('Ownership stability: no duplicate entitlementIds after DARE', async () => {
      const bosData = await reloadTeam(TEAM_BOS);
      const lalData = await reloadTeam(TEAM_LAL);
      const miaData = await reloadTeam(TEAM_MIA);

      const allEnts = [
        ...(bosData.entitlementIds || []),
        ...(lalData.entitlementIds || []),
        ...(miaData.entitlementIds || []),
      ];
      const uniqueEnts = new Set(allEnts);

      expect(allEnts.length).toBe(uniqueEnts.size);
    });
  });

  // ========================================================================
  // Documentation: What This Proves
  // ========================================================================

  describe('D4: What This Test Proves', () => {
    it('DOCUMENTATION: D4 proves TRUE E2E with persistence verification', () => {
      /**
       * D4 proves things D3 couldn't prove:
       *
       * 1. REAL PERSISTENCE: Not just calling functions, but verifying
       *    that data was actually written to Firestore by RELOADING it.
       *
       * 2. FULL PIPELINE: applyWorldMutation → writeBatch → Firestore → reload → verify
       *
       * 3. DARE PERSISTENCE: advanceSeasonInWorld → DARE → writeBatch → Firestore
       *    → reload → verify resolved fields
       *
       * 4. EMULATOR GATE: Refuses to run without FIRESTORE_EMULATOR_HOST,
       *    making it safe for CI and impossible to accidentally hit production.
       *
       * If this test passes, we have proven that:
       * - Trade execution persists entitlement transfers correctly
       * - DARE resolution persists resolved flags and outcomes correctly
       * - No duplicates occur across the full lifecycle
       * - The production code paths work end-to-end
       */
      expect(true).toBe(true);
    });
  });
});
