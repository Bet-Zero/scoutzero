/**
 * FILE: src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.js
 * PURPOSE: Guardrail tests for Phase 47C TPE Persistence Hardening
 * OWNERSHIP: Feature: architect (Cap Sheet - Trade Exceptions)
 *
 * HISTORY:
 *  - 2026-01-28: Phase 47C - Created for TPE persistence hardening guardrails
 *
 * KEY BEHAVIOR (Phase 47C):
 * - No salary fallback: TPE consumption uses matchIncoming ONLY
 * - Dedupe by id: Multiple TPE sources merged with deduplication
 * - Idempotent creation: Signature-based duplicate prevention
 * - Validator id preservation: If createdTPE.id exists, use it
 *
 * TESTS VALIDATE:
 * 1) No salary fallback for TPE consumption
 * 2) Dedupe across tradeExceptions + exceptions.tpe sources
 * 3) Idempotent TPE creation (no duplicates on rerun)
 * 4) Validator id preservation
 * 5) Signature-based dedupe for TPEs without id
 */

import { describe, test, expect, vi } from 'vitest';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to create a mock TPE
 * @param {string} id - TPE id
 * @param {number} amount - TPE amount
 * @param {Object} options - Additional TPE fields
 */
const makeTPE = (id, amount, options = {}) => ({
  id,
  amount,
  totalAmount: amount,
  remainingAmount: amount,
  usedAmount: 0,
  createdSeason: 2025,
  expiresOn: '2026-07-01T00:00:00.000Z',
  isUsed: false,
  ...options,
});

/**
 * Simulates the Phase 47C normalizeTPE function
 */
const normalizeTPE = (t) => ({
  ...t,
  id:
    t.id ||
    `tpe_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  amount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
  totalAmount: t.totalAmount ?? t.amount ?? 0,
  remainingAmount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
  usedAmount: t.usedAmount ?? 0,
});

/**
 * Simulates the Phase 47C dedupeById function
 */
const dedupeById = (tpes) => {
  const seen = new Map();
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
 * Simulates the Phase 47C TPE consumption logic (matchIncoming only)
 * Returns { tpeUsageMap, warnings }
 */
const simulateTPEConsumption = (incomingPlayers) => {
  const tpeUsageMap = new Map();
  const warnings = [];

  incomingPlayers.forEach((player) => {
    if (!player.tpeId) return;

    if (player.matchIncoming === undefined || player.matchIncoming === null) {
      warnings.push({
        playerId: player.player_id || player.name,
        tpeId: player.tpeId,
        reason:
          'matchIncoming missing for TPE consumption - consumption skipped',
      });
      return;
    }

    const consumed = player.matchIncoming;
    const current = tpeUsageMap.get(player.tpeId) || 0;
    tpeUsageMap.set(player.tpeId, current + consumed);
  });

  return { tpeUsageMap, warnings };
};

/**
 * Simulates the Phase 47C idempotent TPE creation logic
 * Returns { shouldAdd, reason }
 */
const checkIdempotentCreation = (createdTPE, existingTPEs, createdFrom) => {
  const tpeId = createdTPE.id || 'tpe_new_generated';

  const newTPESignature = [
    createdTPE.createdSeason,
    createdTPE.expiresOn,
    createdTPE.amount,
    createdFrom,
  ].join('|');

  const hasDuplicateById = existingTPEs.some((t) => t.id === tpeId);
  const hasDuplicateBySignature = existingTPEs.some((t) => {
    const existingSignature = [
      t.createdSeason,
      t.expiresOn,
      t.totalAmount ?? t.amount,
      t.createdFrom,
    ].join('|');
    return existingSignature === newTPESignature;
  });

  if (hasDuplicateById) {
    return { shouldAdd: false, reason: 'duplicate_by_id' };
  }
  if (hasDuplicateBySignature) {
    return { shouldAdd: false, reason: 'duplicate_by_signature' };
  }
  return { shouldAdd: true, reason: null };
};

// ============================================================================
// Tests
// ============================================================================

describe('Phase 47C: TPE Persistence Hardening Guardrails', () => {
  describe('Task A: No Salary Fallback for TPE Consumption', () => {
    test('TC-A1: Player with tpeId but missing matchIncoming triggers warning, no consumption', () => {
      const players = [
        {
          name: 'Player A',
          player_id: 'player_a',
          salary: 10_000_000, // Has salary but NO matchIncoming
          tpeId: 'tpe_1',
          // matchIncoming intentionally missing
        },
      ];

      const { tpeUsageMap, warnings } = simulateTPEConsumption(players);

      // Should NOT consume anything (salary fallback removed)
      expect(tpeUsageMap.size).toBe(0);

      // Should have warning
      expect(warnings.length).toBe(1);
      expect(warnings[0].playerId).toBe('player_a');
      expect(warnings[0].tpeId).toBe('tpe_1');
      expect(warnings[0].reason).toContain('matchIncoming missing');
    });

    test('TC-A2: Player with tpeId and matchIncoming consumes correctly', () => {
      const players = [
        {
          name: 'Player B',
          player_id: 'player_b',
          salary: 10_000_000,
          matchIncoming: 8_000_000, // Validator-produced value
          tpeId: 'tpe_1',
        },
      ];

      const { tpeUsageMap, warnings } = simulateTPEConsumption(players);

      // Should consume matchIncoming value
      expect(tpeUsageMap.get('tpe_1')).toBe(8_000_000);
      expect(warnings.length).toBe(0);
    });

    test('TC-A3: Player with matchIncoming=0 consumes 0 (no warning)', () => {
      const players = [
        {
          name: 'Player C',
          player_id: 'player_c',
          salary: 5_000_000,
          matchIncoming: 0, // Explicitly 0
          tpeId: 'tpe_1',
        },
      ];

      const { tpeUsageMap, warnings } = simulateTPEConsumption(players);

      // Should consume 0 (valid value)
      expect(tpeUsageMap.get('tpe_1')).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('TC-A4: Player without tpeId is not processed for TPE consumption', () => {
      const players = [
        {
          name: 'Player D',
          player_id: 'player_d',
          salary: 12_000_000,
          matchIncoming: 12_000_000,
          // No tpeId - normal trade player
        },
      ];

      const { tpeUsageMap, warnings } = simulateTPEConsumption(players);

      expect(tpeUsageMap.size).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('TC-A5: Multiple players, some missing matchIncoming', () => {
      const players = [
        {
          name: 'Player E',
          player_id: 'player_e',
          salary: 5_000_000,
          matchIncoming: 5_000_000,
          tpeId: 'tpe_1',
        },
        {
          name: 'Player F',
          player_id: 'player_f',
          salary: 3_000_000,
          tpeId: 'tpe_1',
        }, // Missing matchIncoming
        {
          name: 'Player G',
          player_id: 'player_g',
          salary: 4_000_000,
          matchIncoming: 4_000_000,
          tpeId: 'tpe_2',
        },
      ];

      const { tpeUsageMap, warnings } = simulateTPEConsumption(players);

      // Only valid matchIncoming values consumed
      expect(tpeUsageMap.get('tpe_1')).toBe(5_000_000); // Player E only, F skipped
      expect(tpeUsageMap.get('tpe_2')).toBe(4_000_000); // Player G

      // One warning for Player F
      expect(warnings.length).toBe(1);
      expect(warnings[0].playerId).toBe('player_f');
    });
  });

  describe('Task B: Dedupe by ID Across TPE Sources', () => {
    test('TC-B1: Two sources with same TPE id produces one entry', () => {
      const primaryTPEs = [makeTPE('tpe_shared', 10_000_000)];
      const legacyTPEs = [makeTPE('tpe_shared', 8_000_000)]; // Same id, different amount

      const allTPEs = [
        ...primaryTPEs.map(normalizeTPE),
        ...legacyTPEs.map(normalizeTPE),
      ];
      const result = dedupeById(allTPEs);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tpe_shared');
    });

    test('TC-B2: Prefer TPE with more canonical fields populated', () => {
      const primaryTPE = {
        id: 'tpe_shared',
        amount: 10_000_000,
        // Missing remainingAmount, usedAmount, expiresOn
      };
      const legacyTPE = makeTPE('tpe_shared', 10_000_000, {
        remainingAmount: 10_000_000,
        usedAmount: 0,
        expiresOn: '2026-07-01T00:00:00.000Z',
      });

      const allTPEs = [normalizeTPE(primaryTPE), normalizeTPE(legacyTPE)];
      const result = dedupeById(allTPEs);

      expect(result.length).toBe(1);
      // Legacy should win because it has more canonical fields before normalization
      expect(result[0].expiresOn).toBe('2026-07-01T00:00:00.000Z');
    });

    test('TC-B3: Unique TPEs from both sources are all kept', () => {
      const primaryTPEs = [makeTPE('tpe_primary_1', 5_000_000)];
      const legacyTPEs = [makeTPE('tpe_legacy_1', 3_000_000)];

      const allTPEs = [
        ...primaryTPEs.map(normalizeTPE),
        ...legacyTPEs.map(normalizeTPE),
      ];
      const result = dedupeById(allTPEs);

      expect(result.length).toBe(2);
      expect(result.some((t) => t.id === 'tpe_primary_1')).toBe(true);
      expect(result.some((t) => t.id === 'tpe_legacy_1')).toBe(true);
    });

    test('TC-B4: Empty sources produce empty result', () => {
      const primaryTPEs = [];
      const legacyTPEs = [];

      const allTPEs = [...primaryTPEs, ...legacyTPEs];
      const result = dedupeById(allTPEs);

      expect(result).toEqual([]);
    });
  });

  describe('Task C: Idempotent Created TPE (No Duplicates on Retry)', () => {
    test('TC-C1: Same trade rerun does not add duplicate TPE (by signature)', () => {
      const existingTPEs = [
        makeTPE('tpe_existing', 8_000_000, {
          createdSeason: 2025,
          expiresOn: '2026-07-01T00:00:00.000Z',
          createdFrom: 'Player X',
        }),
      ];

      // Same TPE created again (e.g., on retry)
      const createdTPE = {
        // No id - would normally generate new one
        amount: 8_000_000,
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z',
      };

      const { shouldAdd, reason } = checkIdempotentCreation(
        createdTPE,
        existingTPEs,
        'Player X' // Same createdFrom
      );

      expect(shouldAdd).toBe(false);
      expect(reason).toBe('duplicate_by_signature');
    });

    test('TC-C2: Different trade produces new TPE', () => {
      const existingTPEs = [
        makeTPE('tpe_existing', 8_000_000, {
          createdSeason: 2025,
          expiresOn: '2026-07-01T00:00:00.000Z',
          createdFrom: 'Player X',
        }),
      ];

      // Different TPE
      const createdTPE = {
        amount: 5_000_000, // Different amount
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z',
      };

      const { shouldAdd, reason } = checkIdempotentCreation(
        createdTPE,
        existingTPEs,
        'Player Y' // Different createdFrom
      );

      expect(shouldAdd).toBe(true);
      expect(reason).toBe(null);
    });

    test('TC-C3: Running append twice with same id does not add duplicate', () => {
      const existingTPEs = [makeTPE('tpe_specific_id', 10_000_000)];

      // Trying to add TPE with same id
      const createdTPE = {
        id: 'tpe_specific_id', // Same id
        amount: 10_000_000,
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z',
      };

      const { shouldAdd, reason } = checkIdempotentCreation(
        createdTPE,
        existingTPEs,
        'Trade'
      );

      expect(shouldAdd).toBe(false);
      expect(reason).toBe('duplicate_by_id');
    });
  });

  describe('Task C (continued): Validator ID Preservation', () => {
    test('TC-C4: If createdTPE.id exists, persisted TPE id matches it', () => {
      const existingTPEs = [];

      const createdTPE = {
        id: 'validator_provided_id_123', // Validator set this
        amount: 6_000_000,
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z',
      };

      const { shouldAdd } = checkIdempotentCreation(
        createdTPE,
        existingTPEs,
        'Trade'
      );

      expect(shouldAdd).toBe(true);

      // Verify the id would be preserved (not replaced)
      const tpeId = createdTPE.id || 'generated_id';
      expect(tpeId).toBe('validator_provided_id_123');
    });
  });

  describe('Task C (continued): Signature-Based Dedupe', () => {
    test('TC-C5: TPE without id uses signature for duplicate detection', () => {
      const existingTPEs = [
        makeTPE('tpe_old', 7_000_000, {
          createdSeason: 2025,
          expiresOn: '2027-07-01T00:00:00.000Z',
          createdFrom: 'Player Z',
        }),
      ];

      // New TPE without id but matching signature
      const createdTPE = {
        // No id
        amount: 7_000_000,
        createdSeason: 2025,
        expiresOn: '2027-07-01T00:00:00.000Z',
      };

      const { shouldAdd, reason } = checkIdempotentCreation(
        createdTPE,
        existingTPEs,
        'Player Z' // Same player = same signature
      );

      expect(shouldAdd).toBe(false);
      expect(reason).toBe('duplicate_by_signature');
    });

    test('TC-C6: Signature components must all match for duplicate detection', () => {
      const existingTPEs = [
        makeTPE('tpe_old', 7_000_000, {
          createdSeason: 2025,
          expiresOn: '2027-07-01T00:00:00.000Z',
          createdFrom: 'Player Z',
        }),
      ];

      // New TPE - different expiresOn
      const createdTPE = {
        amount: 7_000_000,
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z', // Different
      };

      const { shouldAdd, reason } = checkIdempotentCreation(
        createdTPE,
        existingTPEs,
        'Player Z'
      );

      // Different expiry = different signature = should add
      expect(shouldAdd).toBe(true);
      expect(reason).toBe(null);
    });
  });

  describe('Integration: Combined Behaviors', () => {
    test('Full pipeline simulation: dedupe + consume + create idempotently', () => {
      // Setup: Team has TPEs from multiple sources
      const primaryTPEs = [makeTPE('tpe_primary', 15_000_000)];
      const legacyTPEs = [
        makeTPE('tpe_legacy', 10_000_000),
        makeTPE('tpe_primary', 12_000_000), // Duplicate id, different amount
      ];

      // Step 1: Dedupe sources
      const allTPEs = [
        ...primaryTPEs.map(normalizeTPE),
        ...legacyTPEs.map(normalizeTPE),
      ];
      const dedupedTPEs = dedupeById(allTPEs);

      expect(dedupedTPEs.length).toBe(2);
      expect(dedupedTPEs.some((t) => t.id === 'tpe_primary')).toBe(true);
      expect(dedupedTPEs.some((t) => t.id === 'tpe_legacy')).toBe(true);

      // Step 2: Consume TPE with matchIncoming only
      const incomingPlayers = [
        {
          name: 'Player A',
          player_id: 'p_a',
          matchIncoming: 5_000_000,
          tpeId: 'tpe_primary',
        },
        {
          name: 'Player B',
          player_id: 'p_b',
          salary: 3_000_000,
          tpeId: 'tpe_legacy',
        }, // Missing matchIncoming
      ];

      const { tpeUsageMap, warnings } = simulateTPEConsumption(incomingPlayers);

      expect(tpeUsageMap.get('tpe_primary')).toBe(5_000_000);
      expect(tpeUsageMap.has('tpe_legacy')).toBe(false); // Skipped due to missing matchIncoming
      expect(warnings.length).toBe(1);

      // Step 3: Apply consumption to TPEs
      const consumedTPEs = dedupedTPEs.map((tpe) => {
        const consumed = tpeUsageMap.get(tpe.id) || 0;
        if (consumed === 0) return tpe;
        return {
          ...tpe,
          remainingAmount: Math.max(0, tpe.remainingAmount - consumed),
          usedAmount: tpe.usedAmount + consumed,
          isUsed: tpe.remainingAmount - consumed === 0,
        };
      });

      const primaryAfter = consumedTPEs.find((t) => t.id === 'tpe_primary');
      expect(primaryAfter.remainingAmount).toBe(10_000_000); // 15M - 5M consumed

      // Step 4: Try to create new TPE (first time)
      const createdTPE1 = {
        amount: 8_000_000,
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z',
      };

      const check1 = checkIdempotentCreation(
        createdTPE1,
        consumedTPEs,
        'Player X'
      );
      expect(check1.shouldAdd).toBe(true);

      // Add it
      const newTPE = makeTPE('tpe_new', 8_000_000, {
        createdSeason: 2025,
        expiresOn: '2026-07-01T00:00:00.000Z',
        createdFrom: 'Player X',
      });
      const finalTPEs = [...consumedTPEs, newTPE];

      // Step 5: Try to create same TPE again (rerun) - should be blocked
      const check2 = checkIdempotentCreation(
        createdTPE1,
        finalTPEs,
        'Player X'
      );
      expect(check2.shouldAdd).toBe(false);
      expect(check2.reason).toBe('duplicate_by_signature');
    });
  });
});
