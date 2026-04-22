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
import {
  computeWorldMutation,
  findUpdatedTeamSnapshot,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationResult,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type TpeCreationHistoryEntryLike = {
  type: 'TPE_CREATED';
  teamCode: string;
  amountCreated: number;
  createdFrom: string;
  historyKey: string;
};

type TpeConsumptionHistoryEntryLike = {
  type: 'TPE_CONSUMED';
  teamCode: string;
  tpeId: string;
  amountConsumed: number;
  remainingAmountAfter: number;
  fullyConsumed: boolean;
  historyKey: string;
  absorbedPlayers: Array<{
    name?: string;
    amountAbsorbed?: number;
  }>;
};

type TestTradePlayer = {
  player_id: string;
  id: string;
  playerId: string;
  name: string;
  displayName: string;
  teamCode: string;
  salary: number;
  contract: NonNullable<ArchitectMutationPlayerRecord['contract']>;
  bio: NonNullable<ArchitectMutationPlayerRecord['bio']>;
};

type TestTradeTeam = ArchitectMutationTeamRecord & {
  teamCode: string;
  teamName: string;
  players: TestTradePlayer[];
  roster: string[];
  tradeExceptions: NonNullable<ArchitectMutationTeamRecord['tradeExceptions']>;
  exceptionHistory: unknown[];
  entitlementIds: string[];
  draftPicks: NonNullable<ArchitectMutationTeamRecord['draftPicks']>;
  capHolds: NonNullable<ArchitectMutationTeamRecord['capHolds']>;
  deadCap: NonNullable<ArchitectMutationTeamRecord['deadCap']>;
  exceptions: NonNullable<ArchitectMutationTeamRecord['exceptions']>;
  totals: NonNullable<ArchitectMutationTeamRecord['totals']>;
  source: NonNullable<ArchitectMutationTeamRecord['source']>;
};

type TradeCurrentStateTeam =
  | TestTradeTeam
  | NonNullable<ReturnType<typeof findUpdatedTeamSnapshot>>;

type TradeCurrentState = {
  teams: Array<{ teamCode: string; team: TradeCurrentStateTeam }>;
};

type TradeHistoryEntry = Record<string, unknown>;
type TestTradeException = NonNullable<
  ArchitectMutationTeamRecord['tradeExceptions']
>[number];

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTpeCreationHistoryEntry(
  value: unknown
): value is TpeCreationHistoryEntryLike {
  return (
    isRecord(value) &&
    value.type === 'TPE_CREATED' &&
    typeof value.teamCode === 'string' &&
    typeof value.amountCreated === 'number' &&
    typeof value.createdFrom === 'string' &&
    typeof value.historyKey === 'string'
  );
}

function isTpeConsumptionHistoryEntry(
  value: unknown
): value is TpeConsumptionHistoryEntryLike {
  return (
    isRecord(value) &&
    value.type === 'TPE_CONSUMED' &&
    typeof value.teamCode === 'string' &&
    typeof value.tpeId === 'string' &&
    typeof value.amountConsumed === 'number' &&
    typeof value.remainingAmountAfter === 'number' &&
    typeof value.fullyConsumed === 'boolean' &&
    typeof value.historyKey === 'string' &&
    Array.isArray(value.absorbedPlayers)
  );
}

function getUpdatedTeam(
  result: ArchitectMutationResult,
  teamCode: string
): NonNullable<ReturnType<typeof findUpdatedTeamSnapshot>> {
  return requireValue(
    findUpdatedTeamSnapshot(result.teamUpdates, teamCode),
    `Expected updated team for ${teamCode}`
  );
}

function getTradeExceptions(
  team: Pick<ArchitectMutationTeamRecord, 'tradeExceptions'>,
  teamCode: string
): NonNullable<ArchitectMutationTeamRecord['tradeExceptions']> {
  expect(
    Array.isArray(team.tradeExceptions),
    `Expected tradeExceptions for ${teamCode}`
  ).toBe(true);

  return team.tradeExceptions ?? [];
}

function getExceptionHistory(
  team: Pick<ArchitectMutationTeamRecord, 'exceptionHistory'>,
  teamCode: string
): TradeHistoryEntry[] {
  expect(
    Array.isArray(team.exceptionHistory),
    `Expected exceptionHistory for ${teamCode}`
  ).toBe(true);

  return (team.exceptionHistory ?? []).filter(isRecord);
}

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
const makePlayer = (
  id: string,
  name: string,
  salary: number,
  teamCode: string,
  options: Partial<TestTradePlayer> = {}
): TestTradePlayer => ({
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
const makeTeam = (
  teamCode: string,
  totalSalary: number,
  players: TestTradePlayer[] = [],
  options: Partial<TestTradeTeam> = {}
): TestTradeTeam => ({
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
const makeTPE = (
  id: string,
  amount: number,
  options: Partial<TestTradeException> = {}
): TestTradeException => ({
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
const buildTradeCurrentState = (
  teamData: Array<{ teamCode: string; team: TradeCurrentStateTeam }>
): TradeCurrentState => ({
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
      const teamUpdates = result.teamUpdates ?? [];
      expect(teamUpdates).toHaveLength(2);

      // Find Team A's update (the over-cap team that should get a TPE)
      const updatedTeamA = getUpdatedTeam(result, 'TMA');
      const tradeExceptions = getTradeExceptions(updatedTeamA, 'TMA');

      // TPE should be created (8M = 18M out - 10M in)
      // Find the created TPE
      const createdTPE = requireValue(
        tradeExceptions.find(
        (tpe) => tpe.amount === 8_000_000 || tpe.totalAmount === 8_000_000
        ),
        'Expected created TPE for Team A'
      );
      expect(createdTPE.remainingAmount).toBe(8_000_000);
      expect(createdTPE.usedAmount).toBe(0);
      expect(createdTPE.isUsed).toBe(false);
      expect(createdTPE.createdFrom).toContain('Player Out');

      // Exception history should contain exactly one TPE_CREATED entry
      const creationEntries = getExceptionHistory(updatedTeamA, 'TMA').filter(
        isTpeCreationHistoryEntry
      );
      expect(creationEntries.length).toBe(1);

      const creationEntry = requireValue(
        creationEntries[0],
        'Expected a TPE_CREATED history entry'
      );
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
      const updatedTeamA = getUpdatedTeam(result, 'TMA');
      const tradeExceptions = getTradeExceptions(updatedTeamA, 'TMA');

      // Find the consumed TPE
      const consumedTPE = requireValue(
        tradeExceptions.find((tpe) => tpe.id === 'tpe_existing_consume'),
        'Expected consumed TPE'
      );
      expect(consumedTPE.remainingAmount).toBe(3_000_000); // 15M - 12M
      expect(consumedTPE.usedAmount).toBe(12_000_000);
      expect(consumedTPE.isUsed).toBe(false); // Not fully consumed

      // Exception history should contain exactly one TPE_CONSUMED entry
      const consumptionEntries = getExceptionHistory(updatedTeamA, 'TMA').filter(
        isTpeConsumptionHistoryEntry
      );
      expect(consumptionEntries.length).toBe(1);

      const consumptionEntry = requireValue(
        consumptionEntries[0],
        'Expected a TPE_CONSUMED history entry'
      );
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
      const absorbedPlayer = requireValue(
        consumptionEntry.absorbedPlayers[0],
        'Expected absorbed player history entry'
      );
      expect(absorbedPlayer.name).toBe('Absorbed Player');
      expect(absorbedPlayer.amountAbsorbed).toBe(
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

      const updatedTeamA = getUpdatedTeam(result, 'TMA');
      const tradeExceptions = getTradeExceptions(updatedTeamA, 'TMA');

      // TPE should be fully consumed
      const consumedTPE = requireValue(
        tradeExceptions.find((tpe) => tpe.id === 'tpe_full_consume'),
        'Expected fully consumed TPE'
      );
      expect(consumedTPE.remainingAmount).toBe(0);
      expect(consumedTPE.usedAmount).toBe(10_000_000);
      expect(consumedTPE.isUsed).toBe(true);

      // History entry should show fullyConsumed
      const consumptionEntry = requireValue(
        getExceptionHistory(updatedTeamA, 'TMA').find(
          (entry): entry is TpeConsumptionHistoryEntryLike =>
            isTpeConsumptionHistoryEntry(entry) &&
            entry.tpeId === 'tpe_full_consume'
        ),
        'Expected TPE_CONSUMED entry for fully consumed TPE'
      );
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

      const updatedTeamA1 = getUpdatedTeam(result1, 'TMA');
      const tradeExceptions1 = getTradeExceptions(updatedTeamA1, 'TMA');
      const exceptionHistory1 = getExceptionHistory(updatedTeamA1, 'TMA');

      const tpeCount1 = tradeExceptions1.length;
      const historyCount1 = exceptionHistory1.length;

      // Should have exactly 1 TPE and 1 history entry
      expect(tpeCount1).toBe(1);
      expect(historyCount1).toBe(1);

      // RUN 2: Second execution with same payload but using updated state
      // Simulate that the world state now includes the TPE from run 1
      const updatedTeamB1 = getUpdatedTeam(result1, 'TMB');
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

      const updatedTeamA2 = getUpdatedTeam(result2, 'TMA');
      const tradeExceptions2 = getTradeExceptions(updatedTeamA2, 'TMA');
      const exceptionHistory2 = getExceptionHistory(updatedTeamA2, 'TMA');

      const tpeCount2 = tradeExceptions2.length;
      const historyCount2 = exceptionHistory2.length;

      // IDEMPOTENCY ASSERTIONS:
      // TPE count should remain the same (no duplicates)
      expect(tpeCount2).toBe(tpeCount1);

      // History count should remain the same (dedupe by historyKey)
      expect(historyCount2).toBe(historyCount1);

      // Verify no duplicate IDs in tradeExceptions
      const tpeIds = tradeExceptions2.map((tpe) => tpe.id);
      const uniqueTpeIds = [...new Set(tpeIds)];
      expect(tpeIds.length).toBe(uniqueTpeIds.length);

      // Verify no duplicate historyKeys in exceptionHistory
      const historyKeys = exceptionHistory2.map(
        (entry) => String(entry.historyKey ?? '')
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

      const updatedTeamA1 = getUpdatedTeam(result1, 'TMA');
      const tradeExceptions1 = getTradeExceptions(updatedTeamA1, 'TMA');
      const exceptionHistory1 = getExceptionHistory(updatedTeamA1, 'TMA');

      const tpe1 = requireValue(
        tradeExceptions1.find((tpe) => tpe.id === 'tpe_idem_consume'),
        'Expected first idempotent consumption TPE'
      );
      expect(tpe1.remainingAmount).toBe(4_000_000); // 12M - 8M
      expect(tpe1.usedAmount).toBe(8_000_000);

      const historyCount1 = exceptionHistory1.length;
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

      const updatedTeamA2 = getUpdatedTeam(result2, 'TMA');
      const tradeExceptions2 = getTradeExceptions(updatedTeamA2, 'TMA');
      const exceptionHistory2 = getExceptionHistory(updatedTeamA2, 'TMA');

      const tpe2 = requireValue(
        tradeExceptions2.find((tpe) => tpe.id === 'tpe_idem_consume'),
        'Expected second idempotent consumption TPE'
      );

      // IDEMPOTENCY: Both runs should produce identical TPE state
      expect(tpe2.remainingAmount).toBe(tpe1.remainingAmount); // 4M
      expect(tpe2.usedAmount).toBe(tpe1.usedAmount); // 8M

      // IDEMPOTENCY: Both runs should produce identical history
      // (same historyKey, so deduplication would apply if merged)
      const historyCount2 = exceptionHistory2.length;
      expect(historyCount2).toBe(historyCount1); // Same count = 1

      // Verify the history entries are identical (same historyKey)
      const historyKey1 = exceptionHistory1[0]?.historyKey;
      const historyKey2 = exceptionHistory2[0]?.historyKey;
      expect(historyKey1).toBe(historyKey2);
    });
  });
});
