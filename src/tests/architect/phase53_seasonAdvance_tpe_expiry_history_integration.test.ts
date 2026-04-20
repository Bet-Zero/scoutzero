/**
 * FILE: src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.js
 * PURPOSE: Integration-level tests for season advance TPE expiry HISTORY logging,
 *          verifying that TPE_EXPIRED entries are emitted to team.exceptionHistory[]
 *          with correct idempotency and dual-source guardrails.
 * OWNERSHIP: Feature: architect/seasonManager
 *
 * HISTORY:
 *  - 2026-01-29: Created for Phase 53 execution (TPE expiry history logging)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 51 tests: src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js
 *
 * DESIGN:
 *  - Tests the real `processTradeExceptions()` from `tpeLifecycle.js` (pure compute layer)
 *  - Tests the history entry creation via `createTpeExpiryHistoryEntry()` and `appendExceptionHistory()`
 *  - Verifies idempotency: same historyKey prevents duplicate entries on retry
 *  - Uses deterministic dates for stable boundary calculations
 *
 * BOUNDARY SEMANTICS (DOCUMENTED IN PHASE 51):
 *  - TPE with expiresOn < boundary → EXPIRED (removed) → TPE_EXPIRED history entry created
 *  - TPE with expiresOn === boundary → ACTIVE (kept) → NO TPE_EXPIRED entry
 *  - TPE with expiresOn > boundary → ACTIVE (kept) → NO TPE_EXPIRED entry
 *  - Boundary = July 1st of the start year of toSeason (e.g., toSeason="2026-27" → boundary=2026-07-01)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processTradeExceptions,
  getTpeExpiryISO,
} from '@/features/architect/utils/tpeLifecycle';
import {
  createTpeExpiryHistoryEntry,
  buildExpiryHistoryKey,
  appendExceptionHistory,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';

type TpeFixtureOptions = {
  remainingAmount?: number;
  usedAmount?: number;
  isUsed?: boolean;
  createdFrom?: string;
} & Record<string, unknown>;

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Season transition constants for stable tests.
 * Transitioning from 2025-26 to 2026-27 means:
 *   - Boundary = July 1, 2026 (2026-07-01T00:00:00.000Z)
 */
const TO_SEASON = '2026-27';
const BOUNDARY_ISO = '2026-07-01T00:00:00.000Z';
const BEFORE_BOUNDARY_ISO = '2026-06-30T23:59:59.999Z';
const WORLD_ID = 'test-world-53';
const TIMESTAMP_ISO = '2026-01-29T12:00:00.000Z';

/**
 * Creates a TPE fixture with canonical schema.
 */
const makeTPE = (id, amount, expiresOn, options: TpeFixtureOptions = {}) => ({
  id,
  amount,
  totalAmount: amount,
  remainingAmount: options.remainingAmount ?? amount,
  usedAmount: options.usedAmount ?? 0,
  createdSeason: 2025,
  expiresOn,
  isUsed: options.isUsed ?? false,
  createdFrom: options.createdFrom ?? 'Test Trade',
  ...options,
});

/**
 * Creates a legacy TPE fixture using expiryISO instead of expiresOn.
 */
const makeLegacyTPE = (id, amount, expiryISO) => ({
  id,
  amount,
  totalAmount: amount,
  remainingAmount: amount,
  usedAmount: 0,
  createdSeason: 2025,
  expiryISO,
  isUsed: false,
  createdFrom: 'Legacy Trade',
});

/**
 * Simulates the Phase 47C dedupeById function for dual-source merging.
 */
const dedupeById = (tpes) => {
  const seen = new Map();
  for (const tpe of tpes) {
    if (!tpe.id) continue;
    const existing = seen.get(tpe.id);
    if (!existing) {
      seen.set(tpe.id, tpe);
    } else {
      const existingScore =
        (existing.remainingAmount !== undefined ? 1 : 0) +
        (existing.usedAmount !== undefined ? 1 : 0) +
        (existing.expiresOn ? 1 : 0);
      const newScore =
        (tpe.remainingAmount !== undefined ? 1 : 0) +
        (tpe.usedAmount !== undefined ? 1 : 0) +
        (tpe.expiresOn ? 1 : 0);
      if (newScore > existingScore) {
        seen.set(tpe.id, tpe);
      }
    }
  }
  return Array.from(seen.values());
};

/**
 * Simulates the complete season advance TPE expiry pipeline with history logging:
 * 1) Merge tradeExceptions[] + exceptions.tpe[] sources (dedupe by id)
 * 2) Run processTradeExceptions to filter expired/active
 * 3) Generate TPE_EXPIRED history entries for each expired TPE
 * 4) Append to exceptionHistory via appendExceptionHistory (idempotent)
 * 5) Return persisted state
 */
const simulateSeasonAdvanceTPEExpiryWithHistory = (
  team,
  toSeason,
  worldId = WORLD_ID
) => {
  const teamCode = team.teamCode;
  const timestampISO = TIMESTAMP_ISO;

  // Step 1: Gather TPEs from both sources
  const primaryTPEs = team.tradeExceptions ?? [];
  const legacyTPEs = team.exceptions?.tpe ?? [];

  // Step 2: Dedupe by ID
  const mergedTPEs = dedupeById([...primaryTPEs, ...legacyTPEs]);

  // Step 3: Run expiry processing
  const result = processTradeExceptions(mergedTPEs, toSeason);

  // Step 4: Build the updated team object
  const updatedTeam = {
    ...team,
    teamCode,
    tradeExceptions: result.activeTPEs,
    exceptionHistory: Array.isArray(team.exceptionHistory)
      ? [...team.exceptionHistory]
      : [],
  };

  // Step 5: Generate TPE_EXPIRED history entries for each expired TPE
  const historyEntries = [];
  if (result.expiredTPEs && result.expiredTPEs.length > 0) {
    for (const expiredTpe of result.expiredTPEs) {
      const expiresOn = getTpeExpiryISO(expiredTpe);
      const amountExpired =
        expiredTpe.remainingAmount ?? expiredTpe.amount ?? 0;
      const totalAmount =
        expiredTpe.totalAmount ?? expiredTpe.amount ?? amountExpired;

      const entry = createTpeExpiryHistoryEntry({
        teamCode,
        tpeId: expiredTpe.id,
        amountExpired,
        totalAmount,
        expiresOn,
        toSeason,
        createdFrom: expiredTpe.createdFrom,
        timestampISO,
        worldId,
      });

      if (entry) {
        historyEntries.push(entry);
      }
    }
  }

  // Step 6: Append to exceptionHistory (idempotent)
  if (historyEntries.length > 0) {
    appendExceptionHistory(updatedTeam, historyEntries);
  }

  return {
    persistedTradeExceptions: result.activeTPEs,
    expiredTPEs: result.expiredTPEs,
    hasChanges: result.hasChanges,
    exceptionHistory: updatedTeam.exceptionHistory,
    historyEntriesGenerated: historyEntries,
    mergedCount: mergedTPEs.length,
    dedupeApplied: primaryTPEs.length + legacyTPEs.length > mergedTPEs.length,
  };
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Phase 53: Season Advance TPE Expiry History Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // TEST 1: Expired TPE Creates TPE_EXPIRED History Entry
  // ==========================================================================
  describe('Test 1: Expired TPE Creates TPE_EXPIRED History Entry', () => {
    test('TPE expiring before boundary creates TPE_EXPIRED history entry', () => {
      const expiredTPE = makeTPE(
        'tpe_expired_1',
        5_000_000,
        BEFORE_BOUNDARY_ISO
      );
      const activeTPE = makeTPE(
        'tpe_active_1',
        10_000_000,
        '2026-08-15T00:00:00.000Z'
      );

      const team = {
        teamCode: 'BOS',
        tradeExceptions: [expiredTPE, activeTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      // TPE expiry behavior
      expect(result.hasChanges).toBe(true);
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.expiredTPEs[0].id).toBe('tpe_expired_1');

      // History entry verification
      expect(result.exceptionHistory).toHaveLength(1);
      const historyEntry = result.exceptionHistory[0];
      expect(historyEntry.type).toBe('TPE_EXPIRED');
      expect(historyEntry.teamCode).toBe('BOS');
      expect(historyEntry.tpeId).toBe('tpe_expired_1');
      expect(historyEntry.amountExpired).toBe(5_000_000);
      expect(historyEntry.expiresOn).toBe(BEFORE_BOUNDARY_ISO);
      expect(historyEntry.toSeason).toBe(TO_SEASON);
      expect(historyEntry.worldId).toBe(WORLD_ID);
      expect(historyEntry.historyKey).toBeDefined();
    });

    test('multiple expired TPEs create multiple TPE_EXPIRED history entries', () => {
      const expired1 = makeTPE(
        'tpe_exp_a',
        3_000_000,
        '2026-01-15T00:00:00.000Z'
      );
      const expired2 = makeTPE(
        'tpe_exp_b',
        7_000_000,
        '2026-05-01T00:00:00.000Z'
      );
      const active = makeTPE(
        'tpe_active_x',
        12_000_000,
        '2027-02-10T00:00:00.000Z'
      );

      const team = {
        teamCode: 'LAL',
        tradeExceptions: [expired1, expired2, active],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      expect(result.expiredTPEs).toHaveLength(2);
      expect(result.exceptionHistory).toHaveLength(2);

      const historyIds = result.exceptionHistory.map((e) => e.tpeId).sort();
      expect(historyIds).toEqual(['tpe_exp_a', 'tpe_exp_b']);

      // Verify each entry has required fields
      for (const entry of result.exceptionHistory) {
        expect(entry.type).toBe('TPE_EXPIRED');
        expect(entry.teamCode).toBe('LAL');
        expect(entry.historyKey).toBeDefined();
        expect(entry.toSeason).toBe(TO_SEASON);
      }
    });
  });

  // ==========================================================================
  // TEST 2: Boundary Condition - No History Entry for Active TPE
  // ==========================================================================
  describe('Test 2: Boundary Condition - No History Entry for Active TPE', () => {
    test('TPE expiring exactly on boundary does NOT create TPE_EXPIRED history entry', () => {
      const boundaryTPE = makeTPE('tpe_boundary', 8_000_000, BOUNDARY_ISO);

      const team = {
        teamCode: 'MIA',
        tradeExceptions: [boundaryTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      // TPE at boundary is ACTIVE (kept)
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.expiredTPEs).toHaveLength(0);

      // NO history entry for active TPE
      expect(result.exceptionHistory).toHaveLength(0);
    });

    test('TPE expiring 1ms before boundary creates TPE_EXPIRED history entry', () => {
      const justBeforeTPE = makeTPE(
        'tpe_just_before',
        4_000_000,
        BEFORE_BOUNDARY_ISO
      );

      const team = {
        teamCode: 'CHI',
        tradeExceptions: [justBeforeTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.exceptionHistory).toHaveLength(1);
      expect(result.exceptionHistory[0].tpeId).toBe('tpe_just_before');
    });
  });

  // ==========================================================================
  // TEST 3: Dual-Source - One Expiry History Entry (No Ghosts)
  // ==========================================================================
  describe('Test 3: Dual-Source - One Expiry History Entry (No Ghosts)', () => {
    test('duplicate TPE in both sources produces ONE TPE_EXPIRED entry after dedupe', () => {
      // Same TPE id exists in both tradeExceptions[] and exceptions.tpe[]
      // Should dedupe to ONE entry → ONE expiry history entry if expired

      const primaryTPE = makeTPE(
        'tpe_dupe',
        5_000_000,
        '2026-03-01T00:00:00.000Z'
      ); // Expired
      const legacyDupe = makeLegacyTPE(
        'tpe_dupe',
        5_000_000,
        '2026-03-01T00:00:00.000Z'
      ); // Same TPE

      const team = {
        teamCode: 'DEN',
        tradeExceptions: [primaryTPE],
        exceptions: { tpe: [legacyDupe] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      // Dedupe applied
      expect(result.mergedCount).toBe(1);
      expect(result.dedupeApplied).toBe(true);

      // ONE expired TPE → ONE history entry
      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.exceptionHistory).toHaveLength(1);
      expect(result.exceptionHistory[0].tpeId).toBe('tpe_dupe');
    });

    test('distinct TPEs in dual sources produce distinct history entries', () => {
      const tpe1 = makeTPE('tpe_1', 5_000_000, '2026-02-01T00:00:00.000Z'); // Expired
      const tpe2Legacy = makeLegacyTPE(
        'tpe_2',
        3_000_000,
        '2026-04-01T00:00:00.000Z'
      ); // Expired

      const team = {
        teamCode: 'GSW',
        tradeExceptions: [tpe1],
        exceptions: { tpe: [tpe2Legacy] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      // 2 unique TPEs, both expired
      expect(result.mergedCount).toBe(2);
      expect(result.expiredTPEs).toHaveLength(2);
      expect(result.exceptionHistory).toHaveLength(2);

      const historyIds = result.exceptionHistory.map((e) => e.tpeId).sort();
      expect(historyIds).toEqual(['tpe_1', 'tpe_2']);
    });
  });

  // ==========================================================================
  // TEST 4: Idempotency - No Duplicate History Entries on Retry
  // ==========================================================================
  describe('Test 4: Idempotency - No Duplicate History Entries on Retry', () => {
    test('running season advance twice produces no additional TPE_EXPIRED entries', () => {
      const expiredTPE = makeTPE(
        'tpe_idem_exp',
        4_000_000,
        '2026-05-15T00:00:00.000Z'
      );

      const initialTeam = {
        teamCode: 'MIL',
        tradeExceptions: [expiredTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      // First run
      const result1 = simulateSeasonAdvanceTPEExpiryWithHistory(
        initialTeam,
        TO_SEASON
      );

      expect(result1.expiredTPEs).toHaveLength(1);
      expect(result1.exceptionHistory).toHaveLength(1);

      // Build "persisted" team state after first run
      const teamAfterFirstRun = {
        ...initialTeam,
        tradeExceptions: result1.persistedTradeExceptions,
        exceptions: { tpe: [] },
        exceptionHistory: result1.exceptionHistory,
      };

      // Second run (on already-advanced team)
      const result2 = simulateSeasonAdvanceTPEExpiryWithHistory(
        teamAfterFirstRun,
        TO_SEASON
      );

      // No new expiry (TPE already removed)
      expect(result2.hasChanges).toBe(false);
      expect(result2.expiredTPEs).toHaveLength(0);

      // History unchanged (no new entries, no duplicates)
      expect(result2.exceptionHistory).toHaveLength(1);
      expect(result2.exceptionHistory[0].tpeId).toBe('tpe_idem_exp');
    });

    test('appendExceptionHistory dedupes by historyKey if same entry added twice', () => {
      const expiredTPE = makeTPE(
        'tpe_dupe_test',
        6_000_000,
        '2026-04-01T00:00:00.000Z'
      );

      const team = {
        teamCode: 'OKC',
        tradeExceptions: [expiredTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      // First simulation
      const result1 = simulateSeasonAdvanceTPEExpiryWithHistory(
        team,
        TO_SEASON
      );
      expect(result1.exceptionHistory).toHaveLength(1);

      // Create a team that already has the history entry
      const teamWithHistory = {
        ...team,
        tradeExceptions: [expiredTPE], // Still has TPE (simulate before actual removal)
        exceptionHistory: [...result1.exceptionHistory],
      };

      // Manually try to add the same entry again
      const duplicateEntry = createTpeExpiryHistoryEntry({
        teamCode: 'OKC',
        tpeId: 'tpe_dupe_test',
        amountExpired: 6_000_000,
        expiresOn: '2026-04-01T00:00:00.000Z',
        toSeason: TO_SEASON,
        timestampISO: TIMESTAMP_ISO,
        worldId: WORLD_ID,
      });

      appendExceptionHistory(teamWithHistory, [duplicateEntry]);

      // Should still be 1 entry (dedupe by historyKey)
      expect(teamWithHistory.exceptionHistory).toHaveLength(1);
    });
  });

  // ==========================================================================
  // TEST 5: History Key Determinism
  // ==========================================================================
  describe('Test 5: History Key Determinism', () => {
    test('same inputs produce identical history keys', () => {
      const key1 = buildExpiryHistoryKey({
        worldId: 'world-123',
        teamCode: 'BOS',
        tpeId: 'tpe-abc',
        toSeason: '2026-27',
        expiresOn: '2026-06-15T00:00:00.000Z',
        amountExpired: 5_000_000,
      });

      const key2 = buildExpiryHistoryKey({
        worldId: 'world-123',
        teamCode: 'BOS',
        tpeId: 'tpe-abc',
        toSeason: '2026-27',
        expiresOn: '2026-06-15T00:00:00.000Z',
        amountExpired: 5_000_000,
      });

      expect(key1).toBe(key2);
      expect(key1).toContain('seasonAdvance');
      expect(key1).toContain('world-123');
      expect(key1).toContain('BOS');
      expect(key1).toContain('tpe-abc');
      expect(key1).toContain('expired');
    });

    test('different inputs produce different history keys', () => {
      const key1 = buildExpiryHistoryKey({
        worldId: 'world-123',
        teamCode: 'BOS',
        tpeId: 'tpe-abc',
        toSeason: '2026-27',
        expiresOn: '2026-06-15T00:00:00.000Z',
        amountExpired: 5_000_000,
      });

      const key2 = buildExpiryHistoryKey({
        worldId: 'world-123',
        teamCode: 'LAL', // Different team
        tpeId: 'tpe-abc',
        toSeason: '2026-27',
        expiresOn: '2026-06-15T00:00:00.000Z',
        amountExpired: 5_000_000,
      });

      const key3 = buildExpiryHistoryKey({
        worldId: 'world-123',
        teamCode: 'BOS',
        tpeId: 'tpe-xyz', // Different TPE ID
        toSeason: '2026-27',
        expiresOn: '2026-06-15T00:00:00.000Z',
        amountExpired: 5_000_000,
      });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  describe('Edge Cases', () => {
    test('no expired TPEs produces empty history', () => {
      const activeTPE = makeTPE(
        'tpe_active',
        10_000_000,
        '2027-01-01T00:00:00.000Z'
      );

      const team = {
        teamCode: 'PHX',
        tradeExceptions: [activeTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      expect(result.expiredTPEs).toHaveLength(0);
      expect(result.exceptionHistory).toHaveLength(0);
    });

    test('TPE with partial consumption has correct amountExpired', () => {
      const partialTPE = makeTPE(
        'tpe_partial',
        10_000_000,
        '2026-05-01T00:00:00.000Z',
        {
          remainingAmount: 4_000_000,
          usedAmount: 6_000_000,
        }
      );

      const team = {
        teamCode: 'SAS',
        tradeExceptions: [partialTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.exceptionHistory).toHaveLength(1);

      const entry = result.exceptionHistory[0];
      expect(entry.amountExpired).toBe(4_000_000); // remainingAmount
      expect(entry.totalAmount).toBe(10_000_000);
    });

    test('exceptionHistory preserves existing entries', () => {
      const expiredTPE = makeTPE(
        'tpe_new_exp',
        3_000_000,
        '2026-03-01T00:00:00.000Z'
      );

      const existingEntry = {
        historyKey: 'existing:key:123',
        type: 'TPE_CREATED',
        teamCode: 'ATL',
        tpeId: 'tpe_old',
        timestamp: '2025-12-01T00:00:00.000Z',
      };

      const team = {
        teamCode: 'ATL',
        tradeExceptions: [expiredTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [existingEntry],
      };

      const result = simulateSeasonAdvanceTPEExpiryWithHistory(team, TO_SEASON);

      expect(result.exceptionHistory).toHaveLength(2);
      expect(result.exceptionHistory[0]).toEqual(existingEntry);
      expect(result.exceptionHistory[1].type).toBe('TPE_EXPIRED');
      expect(result.exceptionHistory[1].tpeId).toBe('tpe_new_exp');
    });

    test('worldId defaults to global when not provided', () => {
      const expiredTPE = makeTPE(
        'tpe_no_world',
        2_000_000,
        '2026-02-01T00:00:00.000Z'
      );

      const team = {
        teamCode: 'SAC',
        tradeExceptions: [expiredTPE],
        exceptions: { tpe: [] },
        exceptionHistory: [],
      };

      // Simulate without worldId (pass null to override default)
      const result = simulateSeasonAdvanceTPEExpiryWithHistory(
        team,
        TO_SEASON,
        null
      );

      expect(result.exceptionHistory).toHaveLength(1);
      // worldId should not be in entry when it's 'global' or null (per historyHelpers logic)
      expect(result.exceptionHistory[0].worldId).toBeUndefined();
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Phase 53: Helper Function Validation', () => {
  test('createTpeExpiryHistoryEntry returns null for missing required fields', () => {
    expect(createTpeExpiryHistoryEntry({})).toBeNull();
    expect(createTpeExpiryHistoryEntry({ teamCode: 'BOS' })).toBeNull();
    expect(
      createTpeExpiryHistoryEntry({ teamCode: 'BOS', tpeId: 'tpe-1' })
    ).toBeNull();
  });

  test('createTpeExpiryHistoryEntry returns valid entry with required fields', () => {
    const entry = createTpeExpiryHistoryEntry({
      teamCode: 'BOS',
      tpeId: 'tpe-1',
      amountExpired: 5_000_000,
      expiresOn: '2026-06-15T00:00:00.000Z',
      toSeason: '2026-27',
      timestampISO: '2026-01-29T12:00:00.000Z',
      worldId: 'test-world',
    });

    expect(entry).not.toBeNull();
    expect(entry.type).toBe('TPE_EXPIRED');
    expect(entry.teamCode).toBe('BOS');
    expect(entry.tpeId).toBe('tpe-1');
    expect(entry.amountExpired).toBe(5_000_000);
    expect(entry.toSeason).toBe('2026-27');
    expect(entry.historyKey).toContain('seasonAdvance');
    expect(entry.worldId).toBe('test-world');
  });

  test('buildExpiryHistoryKey follows expected format', () => {
    const key = buildExpiryHistoryKey({
      worldId: 'my-world',
      teamCode: 'LAL',
      tpeId: 'tpe-xyz',
      toSeason: '2027-28',
      expiresOn: '2027-05-01T00:00:00.000Z',
      amountExpired: 8_000_000,
    });

    // Format: seasonAdvance:{worldId}:{teamCode}:{tpeId}:expired:{signature}
    expect(key).toMatch(/^seasonAdvance:my-world:LAL:tpe-xyz:expired:/);
    expect(key).toContain('2027-28');
    expect(key).toContain('2027-05-01');
    expect(key).toContain('8000000');
  });
});
