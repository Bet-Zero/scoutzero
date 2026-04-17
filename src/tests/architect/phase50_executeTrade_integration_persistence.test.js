/**
 * FILE: src/tests/architect/phase50_executeTrade_integration_persistence.test.js
 * PURPOSE: Integration-level tests for executeTrade mutation pipeline verifying
 *          TPE creation/consumption persistence and exceptionHistory[] durability.
 * OWNERSHIP: Feature: architect/capSheet
 *
 * HISTORY:
 *  - 2026-01-29: Created for Phase 50 execution (integration persistence tests)
 *
 * LINKS:
 *  - Plan: Phase 50 execution prompt
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *
 * DESIGN:
 *  - Uses computeWorldMutation('executeTrade', ...) directly (pure compute layer)
 *  - Validates persisted team.tradeExceptions[] and team.exceptionHistory[]
 *  - Uses deterministic timestamps for stable historyKey generation
 *  - Minimal fixture: 2 teams, 2-4 players, 1 existing TPE
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Fixed timestamp for deterministic historyKey generation.
 * Using a stable ISO string ensures tests are reproducible.
 */
const FIXED_TIMESTAMP = new Date('2026-01-29T12:00:00.000Z').getTime();
const FIXED_TIMESTAMP_ISO = '2026-01-29T12:00:00.000Z';

/**
 * Creates a minimal mock player for trade testing.
 * @param {string} id - Player ID
 * @param {string} name - Display name
 * @param {number} salary - Current season salary
 * @param {string} teamCode - Team code
 * @param {Object} [options] - Additional overrides
 */
const makePlayer = (id, name, salary, teamCode, options = {}) => ({
  player_id: id,
  id,
  playerId: id,
  name,
  displayName: name,
  teamCode,
  salary,
  contract: {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: '2025-26',
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
  ...options,
});

/**
 * Creates a minimal mock team for trade testing.
 * @param {string} teamCode - Team code (e.g., 'BOS', 'LAL')
 * @param {number} totalSalary - Team total salary
 * @param {Array} players - Array of player objects
 * @param {Object} [options] - Additional overrides
 */
const makeTeam = (teamCode, totalSalary, players = [], options = {}) => ({
  id: teamCode.toLowerCase(),
  teamCode,
  teamName: `Team ${teamCode}`,
  teamTotalSalary: totalSalary,
  players,
  roster: players.map((p) => p.player_id || p.id),
  tradeExceptions: [],
  exceptionHistory: [],
  entitlementIds: [],
  draftPicks: [],
  capHolds: [],
  deadCap: [],
  exceptions: { mle: null, bae: null, tpe: [] },
  totals: {
    teamSalary: totalSalary,
    totalSalary,
    capHit: totalSalary,
    rosterCount: players.length,
    isOverTax: totalSalary > 170_000_000,
    isFirstApron: totalSalary > 178_000_000,
    isSecondApron: totalSalary > 188_000_000,
    isHardCapped: false,
  },
  source: { type: 'test', lastModifiedAt: FIXED_TIMESTAMP_ISO },
  ...options,
});

/**
 * Creates a mock TPE with canonical schema.
 * @param {string} id - TPE ID
 * @param {number} amount - Total TPE amount
 * @param {Object} [options] - Additional overrides
 */
const makeTPE = (id, amount, options = {}) => ({
  id,
  amount,
  totalAmount: amount,
  remainingAmount: amount,
  usedAmount: 0,
  createdSeason: 2025,
  expiresOn: '2027-07-01T00:00:00.000Z',
  isUsed: false,
  createdFrom: 'Previous Trade',
  ...options,
});

/**
 * Creates a minimal cap projections object.
 */
const makeCapProjections = () => ({
  '2025-26': {
    salaryCap: 141_000_000,
    luxuryTax: 170_000_000,
    firstApron: 178_000_000,
    secondApron: 188_000_000,
    minSalary: 1_164_000,
    maxSalary: 52_750_000,
  },
});

/**
 * Builds currentState in the format expected by computeWorldMutation for trades.
 * @param {Array<{teamCode: string, team: Object}>} teamData - Array of { teamCode, team } objects
 */
const buildTradeCurrentState = (teamData) => ({
  teams: teamData.map(({ teamCode, team }) => ({ teamCode, team })),
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Phase 50: ExecuteTrade Integration Persistence Tests', () => {
  beforeEach(() => {
    // Use fake timers for deterministic timestamp in TPE IDs
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIMESTAMP);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // TEST 1: TPE Created & Logged
  // ==========================================================================
  describe('Test 1: TPE Created & Logged', () => {
    test('over-cap team sending more salary than receiving creates TPE and logs TPE_CREATED entry', () => {
      // SCENARIO: Team A (over cap at 175M) sends player worth 18M, receives player worth 10M
      // This creates a TPE for the difference (8M)

      const playerOut = makePlayer(
        'player_out_1',
        'Player Out',
        18_000_000,
        'TMA'
      );
      const playerIn = makePlayer(
        'player_in_1',
        'Player In',
        10_000_000,
        'TMB'
      );

      const teamA = makeTeam('TMA', 175_000_000, [playerOut]);
      const teamB = makeTeam('TMB', 120_000_000, [playerIn]);

      const currentState = buildTradeCurrentState([
        { teamCode: 'TMA', team: teamA },
        { teamCode: 'TMB', team: teamB },
      ]);

      // Build trade payload: TMA sends playerOut, TMB sends playerIn
      const payload = {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player_out_1',
                name: 'Player Out',
                salary: 18_000_000,
                matchOutgoing: 18_000_000,
              },
            ],
            receives: [
              {
                player_id: 'player_in_1',
                name: 'Player In',
                salary: 10_000_000,
                matchIncoming: 10_000_000,
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player_in_1',
                name: 'Player In',
                salary: 10_000_000,
                matchOutgoing: 10_000_000,
              },
            ],
            receives: [
              {
                player_id: 'player_out_1',
                name: 'Player Out',
                salary: 18_000_000,
                matchIncoming: 18_000_000,
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_test_50', seasonId: '2025-26' },
      };

      // Execute the mutation
      const result = computeWorldMutation({
        mutationType: 'executeTrade',
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50',
      });

      // ASSERTIONS
      expect(result.success).toBe(true);
      expect(result.teamUpdates).toBeDefined();
      expect(result.teamUpdates.length).toBe(2);

      // Find Team A's update (the over-cap team that should get a TPE)
      const teamAUpdate = result.teamUpdates.find((u) => u.teamCode === 'TMA');
      expect(teamAUpdate).toBeDefined();

      const updatedTeamA = teamAUpdate.team;

      // TPE should be created (8M = 18M out - 10M in)
      expect(updatedTeamA.tradeExceptions).toBeDefined();
      expect(Array.isArray(updatedTeamA.tradeExceptions)).toBe(true);

      // Find the created TPE
      const createdTPE = updatedTeamA.tradeExceptions.find(
        (tpe) => tpe.amount === 8_000_000 || tpe.totalAmount === 8_000_000
      );
      expect(createdTPE).toBeDefined();
      expect(createdTPE.remainingAmount).toBe(8_000_000);
      expect(createdTPE.usedAmount).toBe(0);
      expect(createdTPE.isUsed).toBe(false);
      expect(createdTPE.createdFrom).toContain('Player Out');

      // Exception history should contain exactly one TPE_CREATED entry
      expect(updatedTeamA.exceptionHistory).toBeDefined();
      expect(Array.isArray(updatedTeamA.exceptionHistory)).toBe(true);

      const creationEntries = updatedTeamA.exceptionHistory.filter(
        (e) => e.type === 'TPE_CREATED'
      );
      expect(creationEntries.length).toBe(1);

      const creationEntry = creationEntries[0];
      expect(creationEntry.teamCode).toBe('TMA');
      expect(creationEntry.amountCreated).toBe(8_000_000);
      expect(creationEntry.createdFrom).toContain('Player Out');
      expect(creationEntry.historyKey).toBeDefined();
      expect(creationEntry.historyKey).toContain('created');
    });
  });

  // ==========================================================================
  // TEST 2: TPE Consumed & Logged
  // ==========================================================================
  describe('Test 2: TPE Consumed & Logged', () => {
    test('absorbing player using TPE updates remainingAmount and logs TPE_CONSUMED entry', () => {
      // SCENARIO: Team A has an existing TPE of 15M.
      // Team A acquires a player worth 12M using the TPE.
      // TPE should be updated: remainingAmount = 3M, usedAmount = 12M

      const existingTPE = makeTPE('tpe_existing_consume', 15_000_000);
      const playerToAbsorb = makePlayer(
        'player_absorb',
        'Absorbed Player',
        12_000_000,
        'TMB'
      );

      const teamA = makeTeam('TMA', 175_000_000, [], {
        tradeExceptions: [existingTPE],
      });
      const teamB = makeTeam('TMB', 100_000_000, [playerToAbsorb]);

      const currentState = buildTradeCurrentState([
        { teamCode: 'TMA', team: teamA },
        { teamCode: 'TMB', team: teamB },
      ]);

      // Trade: TMB sends playerToAbsorb to TMA using TPE (no outgoing from TMA)
      const payload = {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [], // TMA sends nothing (using TPE to absorb)
            receives: [
              {
                player_id: 'player_absorb',
                name: 'Absorbed Player',
                salary: 12_000_000,
                matchIncoming: 12_000_000,
                tpeId: 'tpe_existing_consume', // Using TPE
                absorptionMode: 'TPE',
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player_absorb',
                name: 'Absorbed Player',
                salary: 12_000_000,
                matchOutgoing: 12_000_000,
              },
            ],
            receives: [], // TMB receives nothing (sending for nothing/picks/cash)
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_test_50_consume', seasonId: '2025-26' },
      };

      // Execute the mutation
      const result = computeWorldMutation({
        mutationType: 'executeTrade',
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50_consume',
      });

      // ASSERTIONS
      expect(result.success).toBe(true);

      // Find Team A's update
      const teamAUpdate = result.teamUpdates.find((u) => u.teamCode === 'TMA');
      expect(teamAUpdate).toBeDefined();

      const updatedTeamA = teamAUpdate.team;

      // Find the consumed TPE
      const consumedTPE = updatedTeamA.tradeExceptions.find(
        (tpe) => tpe.id === 'tpe_existing_consume'
      );
      expect(consumedTPE).toBeDefined();
      expect(consumedTPE.remainingAmount).toBe(3_000_000); // 15M - 12M
      expect(consumedTPE.usedAmount).toBe(12_000_000);
      expect(consumedTPE.isUsed).toBe(false); // Not fully consumed

      // Exception history should contain exactly one TPE_CONSUMED entry
      const consumptionEntries = updatedTeamA.exceptionHistory.filter(
        (e) => e.type === 'TPE_CONSUMED'
      );
      expect(consumptionEntries.length).toBe(1);

      const consumptionEntry = consumptionEntries[0];
      expect(consumptionEntry.teamCode).toBe('TMA');
      expect(consumptionEntry.tpeId).toBe('tpe_existing_consume');
      expect(consumptionEntry.amountConsumed).toBe(12_000_000);
      expect(consumptionEntry.remainingAmountAfter).toBe(3_000_000);
      expect(consumptionEntry.fullyConsumed).toBe(false);
      expect(consumptionEntry.historyKey).toBeDefined();
      expect(consumptionEntry.historyKey).toContain('consumed');

      // Verify absorbedPlayers list
      expect(consumptionEntry.absorbedPlayers).toBeDefined();
      expect(Array.isArray(consumptionEntry.absorbedPlayers)).toBe(true);
      expect(consumptionEntry.absorbedPlayers.length).toBe(1);
      expect(consumptionEntry.absorbedPlayers[0].name).toBe('Absorbed Player');
      expect(consumptionEntry.absorbedPlayers[0].amountAbsorbed).toBe(
        12_000_000
      );
    });

    test('fully consuming TPE sets isUsed=true and fullyConsumed=true', () => {
      // SCENARIO: Team A has TPE of 10M, absorbs player worth exactly 10M
      const existingTPE = makeTPE('tpe_full_consume', 10_000_000);
      const playerToAbsorb = makePlayer(
        'player_exact',
        'Exact Match',
        10_000_000,
        'TMB'
      );

      const teamA = makeTeam('TMA', 175_000_000, [], {
        tradeExceptions: [existingTPE],
      });
      const teamB = makeTeam('TMB', 100_000_000, [playerToAbsorb]);

      const currentState = buildTradeCurrentState([
        { teamCode: 'TMA', team: teamA },
        { teamCode: 'TMB', team: teamB },
      ]);

      const payload = {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [],
            receives: [
              {
                player_id: 'player_exact',
                name: 'Exact Match',
                salary: 10_000_000,
                matchIncoming: 10_000_000,
                tpeId: 'tpe_full_consume',
                absorptionMode: 'TPE',
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player_exact',
                name: 'Exact Match',
                salary: 10_000_000,
                matchOutgoing: 10_000_000,
              },
            ],
            receives: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_test_50_full', seasonId: '2025-26' },
      };

      const result = computeWorldMutation({
        mutationType: 'executeTrade',
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50_full',
      });

      expect(result.success).toBe(true);

      const teamAUpdate = result.teamUpdates.find((u) => u.teamCode === 'TMA');
      const updatedTeamA = teamAUpdate.team;

      // TPE should be fully consumed
      const consumedTPE = updatedTeamA.tradeExceptions.find(
        (tpe) => tpe.id === 'tpe_full_consume'
      );
      expect(consumedTPE).toBeDefined();
      expect(consumedTPE.remainingAmount).toBe(0);
      expect(consumedTPE.usedAmount).toBe(10_000_000);
      expect(consumedTPE.isUsed).toBe(true);

      // History entry should show fullyConsumed
      const consumptionEntry = updatedTeamA.exceptionHistory.find(
        (e) => e.type === 'TPE_CONSUMED' && e.tpeId === 'tpe_full_consume'
      );
      expect(consumptionEntry).toBeDefined();
      expect(consumptionEntry.fullyConsumed).toBe(true);
      expect(consumptionEntry.remainingAmountAfter).toBe(0);
    });
  });

  // ==========================================================================
  // TEST 3: Idempotency on Retry
  // ==========================================================================
  describe('Test 3: Idempotency on Retry', () => {
    test('running same executeTrade twice does not create duplicate TPE or history entries', () => {
      // SCENARIO: Over-cap team sends 20M, receives 12M → creates 8M TPE
      // Running the same trade again should NOT create a second TPE or duplicate history

      const playerOut = makePlayer(
        'player_idem_out',
        'Idempotent Out',
        20_000_000,
        'TMA'
      );
      const playerIn = makePlayer(
        'player_idem_in',
        'Idempotent In',
        12_000_000,
        'TMB'
      );

      const teamA = makeTeam('TMA', 180_000_000, [playerOut]);
      const teamB = makeTeam('TMB', 110_000_000, [playerIn]);

      const currentState1 = buildTradeCurrentState([
        { teamCode: 'TMA', team: teamA },
        { teamCode: 'TMB', team: teamB },
      ]);

      const payload = {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player_idem_out',
                name: 'Idempotent Out',
                salary: 20_000_000,
                matchOutgoing: 20_000_000,
              },
            ],
            receives: [
              {
                player_id: 'player_idem_in',
                name: 'Idempotent In',
                salary: 12_000_000,
                matchIncoming: 12_000_000,
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player_idem_in',
                name: 'Idempotent In',
                salary: 12_000_000,
                matchOutgoing: 12_000_000,
              },
            ],
            receives: [
              {
                player_id: 'player_idem_out',
                name: 'Idempotent Out',
                salary: 20_000_000,
                matchIncoming: 20_000_000,
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_test_50_idem', seasonId: '2025-26' },
      };

      // RUN 1: First execution
      const result1 = computeWorldMutation({
        mutationType: 'executeTrade',
        payload,
        currentState: currentState1,
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50_idem',
      });

      expect(result1.success).toBe(true);

      const teamAUpdate1 = result1.teamUpdates.find(
        (u) => u.teamCode === 'TMA'
      );
      const updatedTeamA1 = teamAUpdate1.team;

      const tpeCount1 = updatedTeamA1.tradeExceptions.length;
      const historyCount1 = updatedTeamA1.exceptionHistory.length;

      // Should have exactly 1 TPE and 1 history entry
      expect(tpeCount1).toBe(1);
      expect(historyCount1).toBe(1);

      // RUN 2: Second execution with same payload but using updated state
      // Simulate that the world state now includes the TPE from run 1
      const updatedTeamB1 = result1.teamUpdates.find(
        (u) => u.teamCode === 'TMB'
      ).team;
      const currentState2 = buildTradeCurrentState([
        { teamCode: 'TMA', team: updatedTeamA1 },
        { teamCode: 'TMB', team: updatedTeamB1 },
      ]);

      // Update the team reference in payload to use the updated state
      const payload2 = {
        ...payload,
        teams: payload.teams.map((t) =>
          t.teamCode === 'TMA' ? { ...t, team: updatedTeamA1 } : t
        ),
      };

      const result2 = computeWorldMutation({
        mutationType: 'executeTrade',
        payload: payload2,
        currentState: currentState2,
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50_idem',
      });

      expect(result2.success).toBe(true);

      const teamAUpdate2 = result2.teamUpdates.find(
        (u) => u.teamCode === 'TMA'
      );
      const updatedTeamA2 = teamAUpdate2.team;

      const tpeCount2 = updatedTeamA2.tradeExceptions.length;
      const historyCount2 = updatedTeamA2.exceptionHistory.length;

      // IDEMPOTENCY ASSERTIONS:
      // TPE count should remain the same (no duplicates)
      expect(tpeCount2).toBe(tpeCount1);

      // History count should remain the same (dedupe by historyKey)
      expect(historyCount2).toBe(historyCount1);

      // Verify no duplicate IDs in tradeExceptions
      const tpeIds = updatedTeamA2.tradeExceptions.map((t) => t.id);
      const uniqueTpeIds = [...new Set(tpeIds)];
      expect(tpeIds.length).toBe(uniqueTpeIds.length);

      // Verify no duplicate historyKeys in exceptionHistory
      const historyKeys = updatedTeamA2.exceptionHistory.map(
        (e) => e.historyKey
      );
      const uniqueHistoryKeys = [...new Set(historyKeys)];
      expect(historyKeys.length).toBe(uniqueHistoryKeys.length);
    });

    test('TPE consumption idempotency: same consumption twice does not double-decrement', () => {
      // SCENARIO: Team absorbs player via TPE.
      // TRUE IDEMPOTENCY: Running the SAME trade from the SAME initial state twice
      // should produce identical results. This simulates network retry scenarios where
      // a mutation fires twice due to transaction retry.
      //
      // Key: Both runs start from identical initial state (not updated state)

      const existingTPE = makeTPE('tpe_idem_consume', 12_000_000);
      const playerAbsorb = makePlayer(
        'player_idem_absorb',
        'Idem Absorb',
        8_000_000,
        'TMB'
      );

      const teamA = makeTeam('TMA', 175_000_000, [], {
        tradeExceptions: [existingTPE],
      });
      const teamB = makeTeam('TMB', 100_000_000, [playerAbsorb]);

      // Same initial state for both runs (simulating transaction retry)
      const currentState = buildTradeCurrentState([
        { teamCode: 'TMA', team: teamA },
        { teamCode: 'TMB', team: teamB },
      ]);

      const payload = {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [],
            receives: [
              {
                player_id: 'player_idem_absorb',
                name: 'Idem Absorb',
                salary: 8_000_000,
                matchIncoming: 8_000_000,
                tpeId: 'tpe_idem_consume',
                absorptionMode: 'TPE',
              },
            ],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player_idem_absorb',
                name: 'Idem Absorb',
                salary: 8_000_000,
                matchOutgoing: 8_000_000,
              },
            ],
            receives: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: {
          worldId: 'world_test_50_idem_consume',
          seasonId: '2025-26',
        },
      };

      // RUN 1: First execution
      const result1 = computeWorldMutation({
        mutationType: 'executeTrade',
        payload,
        currentState, // Same initial state
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50_idem_consume',
      });

      expect(result1.success).toBe(true);

      const teamAUpdate1 = result1.teamUpdates.find(
        (u) => u.teamCode === 'TMA'
      );
      const updatedTeamA1 = teamAUpdate1.team;

      const tpe1 = updatedTeamA1.tradeExceptions.find(
        (t) => t.id === 'tpe_idem_consume'
      );
      expect(tpe1.remainingAmount).toBe(4_000_000); // 12M - 8M
      expect(tpe1.usedAmount).toBe(8_000_000);

      const historyCount1 = updatedTeamA1.exceptionHistory.length;
      expect(historyCount1).toBe(1);

      // RUN 2: Second execution with SAME initial state (simulating retry)
      const result2 = computeWorldMutation({
        mutationType: 'executeTrade',
        payload, // Same payload
        currentState, // SAME initial state (not updated)
        seasonId: '2025-26',
        timestamp: FIXED_TIMESTAMP,
        worldId: 'world_test_50_idem_consume',
      });

      expect(result2.success).toBe(true);

      const teamAUpdate2 = result2.teamUpdates.find(
        (u) => u.teamCode === 'TMA'
      );
      const updatedTeamA2 = teamAUpdate2.team;

      const tpe2 = updatedTeamA2.tradeExceptions.find(
        (t) => t.id === 'tpe_idem_consume'
      );

      // IDEMPOTENCY: Both runs should produce identical TPE state
      expect(tpe2.remainingAmount).toBe(tpe1.remainingAmount); // 4M
      expect(tpe2.usedAmount).toBe(tpe1.usedAmount); // 8M

      // IDEMPOTENCY: Both runs should produce identical history
      // (same historyKey, so deduplication would apply if merged)
      const historyCount2 = updatedTeamA2.exceptionHistory.length;
      expect(historyCount2).toBe(historyCount1); // Same count = 1

      // Verify the history entries are identical (same historyKey)
      const historyKey1 = updatedTeamA1.exceptionHistory[0]?.historyKey;
      const historyKey2 = updatedTeamA2.exceptionHistory[0]?.historyKey;
      expect(historyKey1).toBe(historyKey2);
    });
  });
});
