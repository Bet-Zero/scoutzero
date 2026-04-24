/**
 * FILE: src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.js
 * PURPOSE: Integration-level tests for season advance TPE expiry flow verifying
 *          TPE lifecycle persistence and dual-source "no ghost" guardrails.
 * OWNERSHIP: Feature: architect/seasonManager
 *
 * HISTORY:
 *  - 2026-01-29: Created for Phase 51 execution (season advance TPE expiry integration)
 *
 * LINKS:
 *  - Plan: Phase 51 execution prompt
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *
 * DESIGN:
 *  - Tests the real `processTradeExceptions()` from `tpeLifecycle.js` (pure compute layer)
 *  - Simulates season advance flow with dual-source TPE data (`tradeExceptions[]` + `exceptions.tpe[]`)
 *  - Uses deterministic dates for stable boundary calculations
 *  - Minimal fixture: 1 team, 2-3 TPEs
 *
 * BOUNDARY SEMANTICS (DOCUMENTED DECISION):
 *  - TPE with expiresOn < boundary → EXPIRED (removed)
 *  - TPE with expiresOn === boundary → ACTIVE (kept)
 *  - TPE with expiresOn > boundary → ACTIVE (kept)
 *  - Boundary = July 1st of the start year of toSeason (e.g., toSeason="2026-27" → boundary=2026-07-01)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processTradeExceptions,
  getTpeExpiryISO,
  type TpeLifecycleRecord,
} from '@/features/architect/utils/tpeLifecycle';

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
const AFTER_BOUNDARY_ISO = '2026-07-01T00:00:00.001Z';

/**
 * Creates a TPE fixture with canonical schema.
 * @param {string} id - TPE ID
 * @param {number} amount - Total TPE amount
 * @param {string} expiresOn - Expiry date ISO string (canonical field)
 * @param {Object} [options] - Additional overrides (e.g., legacy expiryISO)
 */
type TpeFixture = TpeLifecycleRecord;

type TpeTeamFixture = {
  teamCode: string;
  tradeExceptions?: TpeFixture[];
  exceptions?: {
    tpe?: TpeFixture[];
  };
};

const makeTPE = (
  id: string,
  amount: number,
  expiresOn: string,
  options: TpeFixtureOptions = {}
): TpeFixture => ({
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
 * Used to test backward compatibility and migration.
 * @param {string} id - TPE ID
 * @param {number} amount - Total TPE amount
 * @param {string} expiryISO - Legacy expiry date ISO string
 */
const makeLegacyTPE = (
  id: string,
  amount: number,
  expiryISO: string
): TpeFixture => ({
  id,
  amount,
  totalAmount: amount,
  remainingAmount: amount,
  usedAmount: 0,
  createdSeason: 2025,
  // NO expiresOn - uses legacy field
  expiryISO,
  isUsed: false,
  createdFrom: 'Legacy Trade',
});

/**
 * Simulates the Phase 47C dedupeById function for dual-source merging.
 * Prefers TPEs with more canonical fields populated.
 */
const dedupeById = (tpes: TpeFixture[]): TpeFixture[] => {
  const seen = new Map<string, TpeFixture>();
  for (const tpe of tpes) {
    if (!tpe.id) continue;
    const existing = seen.get(tpe.id);
    if (!existing) {
      seen.set(tpe.id, tpe);
    } else {
      // Prefer the one with more canonical fields populated
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
      // If equal, keep existing (primary source wins)
    }
  }
  return Array.from(seen.values());
};

/**
 * Simulates the complete season advance TPE expiry pipeline:
 * 1) Merge tradeExceptions[] + exceptions.tpe[] sources (dedupe by id)
 * 2) Run processTradeExceptions to filter expired/active
 * 3) Return persisted tradeExceptions[] and summary
 *
 * This mirrors the flow in processTeamSeasonTransitionWithOptions.
 */
const simulateSeasonAdvanceTPEExpiry = (
  team: TpeTeamFixture,
  toSeason: string
) => {
  // Step 1: Gather TPEs from both sources
  const primaryTPEs = team.tradeExceptions ?? [];
  const legacyTPEs = team.exceptions?.tpe ?? [];

  // Step 2: Dedupe by ID (prefer primary source which has canonical fields)
  const mergedTPEs = dedupeById([...primaryTPEs, ...legacyTPEs]);

  // Step 3: Run expiry processing
  const result = processTradeExceptions(mergedTPEs, toSeason);

  // Return the updated state
  return {
    persistedTradeExceptions: result.activeTPEs,
    expiredTPEs: result.expiredTPEs,
    hasChanges: result.hasChanges,
    // Helpful for assertions
    mergedCount: mergedTPEs.length,
    dedupeApplied: primaryTPEs.length + legacyTPEs.length > mergedTPEs.length,
  };
};

function requireTpe<T extends TpeLifecycleRecord>(
  tpe: T | undefined,
  label: string
): T {
  expect(tpe).toBeDefined();
  if (!tpe) {
    throw new Error(`Expected ${label}`);
  }
  return tpe;
}

function requireExpiryParams(
  tpe: TpeLifecycleRecord
): NonNullable<TpeLifecycleRecord['_expiryParams']> {
  expect(tpe._expiryParams).toBeDefined();
  if (!tpe._expiryParams) {
    throw new Error('Expected TPE expiry params');
  }
  return tpe._expiryParams;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Phase 51: Season Advance TPE Expiry Integration Tests', () => {
  beforeEach(() => {
    // Use fake timers for deterministic Date.now() calls
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // TEST 1: Expired TPE Removed, Active TPE Remains
  // ==========================================================================
  describe('Test 1: Expired TPE Removed/Inactive After Season Advance', () => {
    test('TPE expiring before boundary is removed; TPE expiring after boundary remains', () => {
      // SCENARIO: Team has 2 TPEs:
      //   - expiredTPE: expires 2026-06-30 (before boundary 2026-07-01) → should be removed
      //   - activeTPE: expires 2026-08-15 (after boundary) → should remain

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
      };

      // Run season advance
      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // ASSERTIONS
      expect(result.hasChanges).toBe(true);

      // Persisted tradeExceptions should contain ONLY the active TPE
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_active_1');
      expect(result.persistedTradeExceptions[0].remainingAmount).toBe(
        10_000_000
      );

      // Expired list should contain the expired TPE
      expect(result.expiredTPEs).toHaveLength(1);
      const expiredTpe = requireTpe(result.expiredTPEs[0], 'expired TPE');
      expect(expiredTpe.id).toBe('tpe_expired_1');
      expect(requireExpiryParams(expiredTpe).boundaryStr).toBe(
        BOUNDARY_ISO
      );
    });

    test('multiple expired TPEs are all removed', () => {
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
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      expect(result.hasChanges).toBe(true);
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_active_x');
      expect(result.expiredTPEs).toHaveLength(2);
      expect(result.expiredTPEs.map((t) => t.id).sort()).toEqual([
        'tpe_exp_a',
        'tpe_exp_b',
      ]);
    });
  });

  // ==========================================================================
  // TEST 2: Boundary Condition (Exact Cutoff)
  // ==========================================================================
  describe('Test 2: Boundary Condition (Exact Cutoff)', () => {
    test('TPE expiring exactly on boundary (2026-07-01T00:00:00.000Z) is ACTIVE (not expired)', () => {
      // DOCUMENTED DECISION:
      // - Boundary semantics: expiry < boundary → expired; expiry >= boundary → active
      // - A TPE that expires on July 1st at midnight is considered active for the new season

      const boundaryTPE = makeTPE('tpe_boundary', 8_000_000, BOUNDARY_ISO);

      const team = {
        teamCode: 'MIA',
        tradeExceptions: [boundaryTPE],
        exceptions: { tpe: [] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // ASSERTION: TPE at exact boundary should be ACTIVE (kept)
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_boundary');
      expect(result.expiredTPEs).toHaveLength(0);
    });

    test('TPE expiring 1ms before boundary is EXPIRED', () => {
      const justBeforeTPE = makeTPE(
        'tpe_just_before',
        4_000_000,
        BEFORE_BOUNDARY_ISO
      );

      const team = {
        teamCode: 'CHI',
        tradeExceptions: [justBeforeTPE],
        exceptions: { tpe: [] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      expect(result.persistedTradeExceptions).toHaveLength(0);
      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.expiredTPEs[0].id).toBe('tpe_just_before');
    });

    test('TPE expiring 1ms after boundary is ACTIVE', () => {
      const justAfterTPE = makeTPE(
        'tpe_just_after',
        6_000_000,
        AFTER_BOUNDARY_ISO
      );

      const team = {
        teamCode: 'PHX',
        tradeExceptions: [justAfterTPE],
        exceptions: { tpe: [] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_just_after');
      expect(result.expiredTPEs).toHaveLength(0);
    });
  });

  // ==========================================================================
  // TEST 3: Dual-Source "No Ghosts" Dedupe
  // ==========================================================================
  describe('Test 3: Dual-Source "No Ghosts" Dedupe', () => {
    test('duplicate TPE in both sources is deduped by id; expired entries removed', () => {
      // SCENARIO: Same TPE id exists in both tradeExceptions[] and exceptions.tpe[]
      // - tradeExceptions has canonical fields (expiresOn)
      // - exceptions.tpe has legacy fields (expiryISO)
      // - Both refer to same TPE → should dedupe to ONE entry
      // - If expired, should be removed after dedupe

      const primaryTPE = makeTPE(
        'tpe_dupe',
        5_000_000,
        '2026-08-01T00:00:00.000Z'
      ); // Active
      const legacyDupe = makeLegacyTPE(
        'tpe_dupe',
        5_000_000,
        '2026-08-01T00:00:00.000Z'
      ); // Same TPE via legacy

      const team = {
        teamCode: 'DEN',
        tradeExceptions: [primaryTPE],
        exceptions: { tpe: [legacyDupe] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Should have deduped (2 sources → 1 entry)
      expect(result.mergedCount).toBe(1);
      expect(result.dedupeApplied).toBe(true);

      // Result: 1 active TPE, 0 expired
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_dupe');
      // Should have canonical expiresOn (from primary source)
      expect(result.persistedTradeExceptions[0].expiresOn).toBeDefined();
    });

    test('legacy-only TPE in exceptions.tpe[] is included and processed', () => {
      // SCENARIO: tradeExceptions has one TPE, exceptions.tpe has a different legacy TPE
      // Both should be merged and processed

      const primaryTPE = makeTPE(
        'tpe_primary',
        8_000_000,
        '2026-09-15T00:00:00.000Z'
      ); // Active
      const legacyOnlyTPE = makeLegacyTPE(
        'tpe_legacy_only',
        4_000_000,
        '2026-03-01T00:00:00.000Z'
      ); // Expired

      const team = {
        teamCode: 'GSW',
        tradeExceptions: [primaryTPE],
        exceptions: { tpe: [legacyOnlyTPE] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Merged: 2 unique TPEs
      expect(result.mergedCount).toBe(2);
      expect(result.dedupeApplied).toBe(false); // No duplicates to remove

      // Result: 1 active (primary), 1 expired (legacy)
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_primary');
      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.expiredTPEs[0].id).toBe('tpe_legacy_only');
    });

    test('canonical fields normalized: legacy TPE gains expiresOn via backfill', () => {
      // SCENARIO: Legacy TPE with only expiryISO (no expiresOn) that is ACTIVE
      // processTradeExceptions should backfill expiresOn from expiryISO

      const legacyActiveTPE = makeLegacyTPE(
        'tpe_backfill',
        6_000_000,
        '2027-01-15T00:00:00.000Z'
      ); // Active

      const team = {
        teamCode: 'NYK',
        tradeExceptions: [],
        exceptions: { tpe: [legacyActiveTPE] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Should have backfilled expiresOn
      expect(result.hasChanges).toBe(true); // Backfill counts as change
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_backfill');
      expect(result.persistedTradeExceptions[0].expiresOn).toBe(
        '2027-01-15T00:00:00.000Z'
      );
      // Original expiryISO should be preserved
      expect(result.persistedTradeExceptions[0].expiryISO).toBe(
        '2027-01-15T00:00:00.000Z'
      );
    });

    test('no ghost TPEs: output count matches deduped active count', () => {
      // SCENARIO: Multiple overlapping sources with some duplicates
      // Verify that output contains exactly the expected TPEs with no ghosts

      const tpe1 = makeTPE('tpe_1', 5_000_000, '2026-09-01T00:00:00.000Z'); // Active
      const tpe2 = makeTPE('tpe_2', 3_000_000, '2026-04-01T00:00:00.000Z'); // Expired
      const tpe1Dupe = makeLegacyTPE(
        'tpe_1',
        5_000_000,
        '2026-09-01T00:00:00.000Z'
      ); // Dupe of tpe_1
      const tpe3Legacy = makeLegacyTPE(
        'tpe_3',
        7_000_000,
        '2027-03-01T00:00:00.000Z'
      ); // Active, legacy-only

      const team = {
        teamCode: 'DAL',
        tradeExceptions: [tpe1, tpe2],
        exceptions: { tpe: [tpe1Dupe, tpe3Legacy] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Merged: 3 unique TPEs (tpe_1, tpe_2, tpe_3)
      expect(result.mergedCount).toBe(3);
      expect(result.dedupeApplied).toBe(true); // tpe_1 was duped

      // Active: tpe_1, tpe_3 (2 TPEs)
      expect(result.persistedTradeExceptions).toHaveLength(2);
      const activeIds = result.persistedTradeExceptions.map((t) => t.id).sort();
      expect(activeIds).toEqual(['tpe_1', 'tpe_3']);

      // Expired: tpe_2 (1 TPE)
      expect(result.expiredTPEs).toHaveLength(1);
      expect(result.expiredTPEs[0].id).toBe('tpe_2');

      // Total output = 2 active + 1 expired = 3 unique = no ghosts
    });
  });

  // ==========================================================================
  // TEST 4: Idempotency
  // ==========================================================================
  describe('Test 4: Idempotency', () => {
    test('running season advance twice produces identical results', () => {
      // SCENARIO: Run season advance with same initial state twice
      // Second run should produce identical output (no additional drops or changes)

      const expiredTPE = makeTPE(
        'tpe_idem_exp',
        4_000_000,
        '2026-05-15T00:00:00.000Z'
      );
      const activeTPE = makeTPE(
        'tpe_idem_act',
        9_000_000,
        '2026-10-01T00:00:00.000Z'
      );

      const initialTeam = {
        teamCode: 'MIL',
        tradeExceptions: [expiredTPE, activeTPE],
        exceptions: { tpe: [] },
      };

      // First run
      const result1 = simulateSeasonAdvanceTPEExpiry(initialTeam, TO_SEASON);

      // Build "persisted" team state after first run
      const teamAfterFirstRun = {
        ...initialTeam,
        tradeExceptions: result1.persistedTradeExceptions,
        // exceptions.tpe would be empty or synced in real persistence
        exceptions: { tpe: [] },
      };

      // Second run (on already-advanced team)
      const result2 = simulateSeasonAdvanceTPEExpiry(
        teamAfterFirstRun,
        TO_SEASON
      );

      // ASSERTIONS
      // Second run should have no additional changes (expired already removed)
      expect(result2.hasChanges).toBe(false);
      expect(result2.persistedTradeExceptions).toHaveLength(1);
      expect(result2.persistedTradeExceptions[0].id).toBe('tpe_idem_act');
      expect(result2.expiredTPEs).toHaveLength(0); // Already expired in first run
    });

    test('idempotency with dual sources: same merged result each run', () => {
      // SCENARIO: Both sources have data; after first run, merged into tradeExceptions
      // Second run should not find anything new to merge or expire

      const tpe1 = makeTPE('tpe_a', 5_000_000, '2026-12-01T00:00:00.000Z'); // Active
      const tpe2Legacy = makeLegacyTPE(
        'tpe_b',
        3_000_000,
        '2026-02-01T00:00:00.000Z'
      ); // Expired

      const initialTeam = {
        teamCode: 'OKC',
        tradeExceptions: [tpe1],
        exceptions: { tpe: [tpe2Legacy] },
      };

      // First run
      const result1 = simulateSeasonAdvanceTPEExpiry(initialTeam, TO_SEASON);

      expect(result1.persistedTradeExceptions).toHaveLength(1);
      expect(result1.expiredTPEs).toHaveLength(1);

      // Simulate persistence: all TPEs now in tradeExceptions, exceptions.tpe cleared
      const teamAfterFirstRun = {
        ...initialTeam,
        tradeExceptions: result1.persistedTradeExceptions,
        exceptions: { tpe: [] },
      };

      // Second run
      const result2 = simulateSeasonAdvanceTPEExpiry(
        teamAfterFirstRun,
        TO_SEASON
      );

      // Should be identical to result1's persisted state
      expect(result2.hasChanges).toBe(false);
      expect(result2.persistedTradeExceptions).toHaveLength(1);
      expect(result2.persistedTradeExceptions[0].id).toBe('tpe_a');
      expect(result2.expiredTPEs).toHaveLength(0);
    });

    test('re-running with same input (no persistence between) gives same output', () => {
      // Pure function check: same input → same output

      const tpes = [
        makeTPE('tpe_x', 6_000_000, '2026-08-01T00:00:00.000Z'),
        makeTPE('tpe_y', 2_000_000, '2026-03-01T00:00:00.000Z'),
      ];

      const team = {
        teamCode: 'ATL',
        tradeExceptions: tpes,
        exceptions: { tpe: [] },
      };

      const result1 = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);
      const result2 = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Results should be deeply equal
      expect(result1.persistedTradeExceptions.length).toBe(
        result2.persistedTradeExceptions.length
      );
      expect(result1.expiredTPEs.length).toBe(result2.expiredTPEs.length);
      expect(result1.hasChanges).toBe(result2.hasChanges);

      // Same IDs in same order
      expect(result1.persistedTradeExceptions.map((t) => t.id)).toEqual(
        result2.persistedTradeExceptions.map((t) => t.id)
      );
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  describe('Edge Cases', () => {
    test('empty tradeExceptions and exceptions.tpe returns no changes', () => {
      const team = {
        teamCode: 'SAS',
        tradeExceptions: [],
        exceptions: { tpe: [] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      expect(result.hasChanges).toBe(false);
      expect(result.persistedTradeExceptions).toHaveLength(0);
      expect(result.expiredTPEs).toHaveLength(0);
    });

    test('TPE with missing expiry date is preserved (fail-safe)', () => {
      const noExpiryTPE = {
        id: 'tpe_no_expiry',
        amount: 3_000_000,
        remainingAmount: 3_000_000,
        usedAmount: 0,
        createdSeason: 2025,
        // NO expiresOn, NO expiryISO
        isUsed: false,
        createdFrom: 'Unknown',
      };

      const team = {
        teamCode: 'POR',
        tradeExceptions: [noExpiryTPE],
        exceptions: { tpe: [] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Should be preserved (not expired) as fail-safe
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_no_expiry');
      expect(result.expiredTPEs).toHaveLength(0);
    });

    test('TPE with invalid expiry date is preserved (fail-safe)', () => {
      const invalidDateTPE = makeTPE('tpe_invalid', 2_000_000, 'not-a-date');

      const team = {
        teamCode: 'SAC',
        tradeExceptions: [invalidDateTPE],
        exceptions: { tpe: [] },
      };

      const result = simulateSeasonAdvanceTPEExpiry(team, TO_SEASON);

      // Should be preserved (not expired) as fail-safe
      expect(result.persistedTradeExceptions).toHaveLength(1);
      expect(result.persistedTradeExceptions[0].id).toBe('tpe_invalid');
      expect(result.expiredTPEs).toHaveLength(0);
    });
  });
});

// ============================================================================
// HELPER TESTS (validate test utilities work correctly)
// ============================================================================

describe('Phase 51: Test Utility Validation', () => {
  test('getTpeExpiryISO prioritizes expiresOn over expiryISO', () => {
    const tpeWithBoth = {
      expiresOn: '2026-09-01T00:00:00.000Z',
      expiryISO: '2026-08-01T00:00:00.000Z',
    };

    expect(getTpeExpiryISO(tpeWithBoth)).toBe('2026-09-01T00:00:00.000Z');
  });

  test('getTpeExpiryISO falls back to expiryISO if expiresOn missing', () => {
    const legacyTPE = {
      expiryISO: '2026-08-01T00:00:00.000Z',
    };

    expect(getTpeExpiryISO(legacyTPE)).toBe('2026-08-01T00:00:00.000Z');
  });

  test('dedupeById keeps primary source when canonical scores equal', () => {
    const primary = makeTPE('tpe_test', 5_000_000, '2026-09-01T00:00:00.000Z');
    const secondary = makeTPE(
      'tpe_test',
      5_000_000,
      '2026-09-01T00:00:00.000Z'
    );
    secondary.createdFrom = 'Should be discarded';

    const result = dedupeById([primary, secondary]);

    expect(result).toHaveLength(1);
    expect(result[0].createdFrom).toBe('Test Trade'); // From primary (makeTPE default)
  });
});
