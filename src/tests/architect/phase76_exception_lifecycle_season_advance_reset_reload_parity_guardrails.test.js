/**
 * FILE: src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.js
 * PURPOSE: Phase 76 guardrails for Exception Lifecycle MVP - season advance reset/recalc + reload parity
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-01: Phase 76 - Created for Exception Lifecycle Season Advance Reset/Reload Parity
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Plan: Phase 76 execution prompt
 *
 * TESTS:
 * A) Source-scan / wiring guardrails:
 *    1. seasonManager imports resetTeamNonTpeExceptionsForNewSeason
 *    2. seasonManager calls the helper inside season advance flow
 *    3. Helper does NOT reference exceptions.tpe
 *
 * B) Behavioral tests:
 *    4. Reset behavior: usedAmount > 0 becomes 0 after transition
 *    5. Max recompute: maxAmount matches new year's cap rules
 *    6. Remaining recompute: remainingAmount === maxAmount after reset (when enabled)
 *    7. Enabled preserved: enabled flag remains unchanged through transition
 *    8. Room eligibility gating unchanged: helper does not call canUseRoomException
 *    9. Reload parity: persist → reload yields identical exception state
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the helper under test
import {
  resetTeamNonTpeExceptionsForNewSeason,
  validateNonTpeExceptionsForYear,
  NON_TPE_EXCEPTION_TYPES,
} from '@/features/architect/utils/exceptions';

// Import cap rules for behavioral tests
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================================================
// TEST HELPERS
// ==============================================================================

const TEST_YEAR_2026 = 2026; // 2025-26 season
const TEST_YEAR_2027 = 2027; // 2026-27 season

/**
 * Creates a team with pre-existing exception state (simulating mid-season usage).
 */
function createTeamWithUsedExceptions(options = {}) {
  const {
    biAnnualUsed = 2_000_000,
    miniMleUsed = 1_000_000,
    nonTaxpayerMleUsed = 5_000_000,
    roomUsed = 3_000_000,
    seasonKey = '2025-26',
    enabledFlags = {
      biAnnual: true,
      miniMle: true,
      nonTaxpayerMle: true,
      room: true,
    },
  } = options;

  return {
    teamCode: 'TST',
    teamName: 'Test Team',
    players: [],
    roster: [],
    exceptions: {
      biAnnual: {
        enabled: enabledFlags.biAnnual,
        maxAmount: 4_700_000,
        totalAmount: 4_700_000,
        usedAmount: biAnnualUsed,
        remainingAmount: 4_700_000 - biAnnualUsed,
        seasonKey,
      },
      miniMle: {
        enabled: enabledFlags.miniMle,
        maxAmount: 5_000_000,
        totalAmount: 5_000_000,
        usedAmount: miniMleUsed,
        remainingAmount: 5_000_000 - miniMleUsed,
        seasonKey,
      },
      nonTaxpayerMle: {
        enabled: enabledFlags.nonTaxpayerMle,
        maxAmount: 12_900_000,
        totalAmount: 12_900_000,
        usedAmount: nonTaxpayerMleUsed,
        remainingAmount: 12_900_000 - nonTaxpayerMleUsed,
        seasonKey,
      },
      room: {
        enabled: enabledFlags.room,
        maxAmount: 8_000_000,
        totalAmount: 8_000_000,
        usedAmount: roomUsed,
        remainingAmount: 8_000_000 - roomUsed,
        seasonKey,
      },
      // Include TPE to verify it's NOT touched
      tpe: [
        {
          id: 'tpe-001',
          amount: 10_000_000,
          remainingAmount: 10_000_000,
          expiresOn: '2027-06-15T00:00:00.000Z',
        },
      ],
    },
    totals: {
      capHit: 100_000_000,
    },
  };
}

// ==============================================================================
// A) SOURCE-SCAN / WIRING GUARDRAILS
// ==============================================================================

describe('Phase 76: Source Scan Guardrails', () => {
  const seasonManagerPath = path.resolve(
    __dirname,
    '../../features/architect/utils/seasonManager.js'
  );
  const exceptionLifecyclePath = path.resolve(
    __dirname,
    '../../features/architect/utils/exceptions/exceptionLifecycle.js'
  );

  it('TEST 1: seasonManager.js imports resetTeamNonTpeExceptionsForNewSeason', () => {
    const content = fs.readFileSync(seasonManagerPath, 'utf8');

    // Must import from exceptions module
    expect(content).toContain(
      "import { resetTeamNonTpeExceptionsForNewSeason } from '@/features/architect/utils/exceptions'"
    );
  });

  it('TEST 2: seasonManager.js calls resetTeamNonTpeExceptionsForNewSeason inside season advance flow', () => {
    const content = fs.readFileSync(seasonManagerPath, 'utf8');

    // Must call the helper with updatedTeam and toYear
    expect(content).toContain('resetTeamNonTpeExceptionsForNewSeason(');
    expect(content).toContain('updatedTeam');
    expect(content).toContain('toYear');

    // Must have Phase 76 comment marker
    expect(content).toMatch(/PHASE 76.*non-TPE exceptions/i);
  });

  it('TEST 3: exceptionLifecycle.js does NOT reference exceptions.tpe', () => {
    const content = fs.readFileSync(exceptionLifecyclePath, 'utf8');

    // Must NOT contain direct tpe access (TPE lifecycle is separate)
    expect(content).not.toMatch(/exceptions\.tpe\b/);
    expect(content).not.toMatch(/team\.exceptions\.tpe/);

    // Verify it only handles non-TPE types
    expect(content).toContain('NON_TPE_EXCEPTION_TYPES');
    expect(content).toContain('biAnnual');
    expect(content).toContain('miniMle');
    expect(content).toContain('nonTaxpayerMle');
    expect(content).toContain('room');
  });

  it('TEST 3b: exceptionLifecycle.js does NOT import or call canUseRoomException', () => {
    const content = fs.readFileSync(exceptionLifecyclePath, 'utf8');

    // Room eligibility gating is Phase 75's responsibility, not this module
    expect(content).not.toContain('canUseRoomException');
    expect(content).not.toContain('computeTeamCapTotals');
  });
});

// ==============================================================================
// B) BEHAVIORAL TESTS
// ==============================================================================

describe('Phase 76: resetTeamNonTpeExceptionsForNewSeason Behavioral Tests', () => {
  it('TEST 4: Reset behavior - usedAmount resets to 0 after transition', () => {
    const team = createTeamWithUsedExceptions({
      biAnnualUsed: 2_000_000,
      miniMleUsed: 3_000_000,
      nonTaxpayerMleUsed: 5_000_000,
      roomUsed: 4_000_000,
    });

    // Verify pre-condition: exceptions have non-zero usedAmount
    expect(team.exceptions.biAnnual.usedAmount).toBe(2_000_000);
    expect(team.exceptions.miniMle.usedAmount).toBe(3_000_000);
    expect(team.exceptions.nonTaxpayerMle.usedAmount).toBe(5_000_000);
    expect(team.exceptions.room.usedAmount).toBe(4_000_000);

    // Transition to new season
    const result = resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    expect(result.hasChanges).toBe(true);
    expect(result.transitionedExceptions).toContain('biAnnual');
    expect(result.transitionedExceptions).toContain('miniMle');
    expect(result.transitionedExceptions).toContain('nonTaxpayerMle');
    expect(result.transitionedExceptions).toContain('room');

    // All usedAmount should be reset to 0
    expect(team.exceptions.biAnnual.usedAmount).toBe(0);
    expect(team.exceptions.miniMle.usedAmount).toBe(0);
    expect(team.exceptions.nonTaxpayerMle.usedAmount).toBe(0);
    expect(team.exceptions.room.usedAmount).toBe(0);
  });

  it('TEST 5: Max recompute - maxAmount matches new year cap rules', () => {
    const team = createTeamWithUsedExceptions();

    // Get expected values from cap rules for the new year
    const capRules = getCapRulesForYear(TEST_YEAR_2027);
    const expectedBae = capRules.exceptions.bae;
    const expectedTaxpayerMle = capRules.exceptions.taxpayerMLE;
    const expectedFullMle = capRules.exceptions.fullMLE;
    const expectedRoomMle = capRules.exceptions.roomMLE;

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // maxAmount should match cap rules for new year
    expect(team.exceptions.biAnnual.maxAmount).toBe(expectedBae);
    expect(team.exceptions.miniMle.maxAmount).toBe(expectedTaxpayerMle);
    expect(team.exceptions.nonTaxpayerMle.maxAmount).toBe(expectedFullMle);
    expect(team.exceptions.room.maxAmount).toBe(expectedRoomMle);

    // totalAmount should also match (for compatibility)
    expect(team.exceptions.biAnnual.totalAmount).toBe(expectedBae);
    expect(team.exceptions.miniMle.totalAmount).toBe(expectedTaxpayerMle);
    expect(team.exceptions.nonTaxpayerMle.totalAmount).toBe(expectedFullMle);
    expect(team.exceptions.room.totalAmount).toBe(expectedRoomMle);
  });

  it('TEST 6: Remaining recompute - remainingAmount equals maxAmount when enabled', () => {
    const team = createTeamWithUsedExceptions({
      biAnnualUsed: 2_000_000,
      miniMleUsed: 3_000_000,
      enabledFlags: {
        biAnnual: true,
        miniMle: true,
        nonTaxpayerMle: true,
        room: true,
      },
    });

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // remainingAmount should equal maxAmount (full reset, enabled)
    expect(team.exceptions.biAnnual.remainingAmount).toBe(
      team.exceptions.biAnnual.maxAmount
    );
    expect(team.exceptions.miniMle.remainingAmount).toBe(
      team.exceptions.miniMle.maxAmount
    );
    expect(team.exceptions.nonTaxpayerMle.remainingAmount).toBe(
      team.exceptions.nonTaxpayerMle.maxAmount
    );
    expect(team.exceptions.room.remainingAmount).toBe(
      team.exceptions.room.maxAmount
    );
  });

  it('TEST 6b: Remaining recompute - remainingAmount is 0 when disabled', () => {
    const team = createTeamWithUsedExceptions({
      enabledFlags: {
        biAnnual: false,
        miniMle: false,
        nonTaxpayerMle: false,
        room: false,
      },
    });

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // remainingAmount should be 0 when disabled (can't use unavailable exception)
    expect(team.exceptions.biAnnual.remainingAmount).toBe(0);
    expect(team.exceptions.miniMle.remainingAmount).toBe(0);
    expect(team.exceptions.nonTaxpayerMle.remainingAmount).toBe(0);
    expect(team.exceptions.room.remainingAmount).toBe(0);

    // But maxAmount should still be set (for reference)
    expect(team.exceptions.biAnnual.maxAmount).toBeGreaterThan(0);
    expect(team.exceptions.miniMle.maxAmount).toBeGreaterThan(0);
    expect(team.exceptions.nonTaxpayerMle.maxAmount).toBeGreaterThan(0);
    expect(team.exceptions.room.maxAmount).toBeGreaterThan(0);
  });

  it('TEST 7: Enabled preserved - enabled flag unchanged through transition', () => {
    const team = createTeamWithUsedExceptions({
      enabledFlags: {
        biAnnual: true,
        miniMle: false,
        nonTaxpayerMle: true,
        room: false,
      },
    });

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // enabled flags should be preserved exactly
    expect(team.exceptions.biAnnual.enabled).toBe(true);
    expect(team.exceptions.miniMle.enabled).toBe(false);
    expect(team.exceptions.nonTaxpayerMle.enabled).toBe(true);
    expect(team.exceptions.room.enabled).toBe(false);
  });

  it('TEST 8: TPE array is NOT modified by the helper', () => {
    const team = createTeamWithUsedExceptions();
    const originalTpe = JSON.parse(JSON.stringify(team.exceptions.tpe));

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // TPE array should be completely unchanged
    expect(team.exceptions.tpe).toEqual(originalTpe);
    expect(team.exceptions.tpe.length).toBe(1);
    expect(team.exceptions.tpe[0].id).toBe('tpe-001');
    expect(team.exceptions.tpe[0].remainingAmount).toBe(10_000_000);
  });

  it('TEST 9: Season key updates to new season', () => {
    const team = createTeamWithUsedExceptions({ seasonKey: '2025-26' });

    // Transition to 2026-27 season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // Season key should be updated
    expect(team.exceptions.biAnnual.seasonKey).toBe('2026-27');
    expect(team.exceptions.miniMle.seasonKey).toBe('2026-27');
    expect(team.exceptions.nonTaxpayerMle.seasonKey).toBe('2026-27');
    expect(team.exceptions.room.seasonKey).toBe('2026-27');
  });
});

describe('Phase 76: validateNonTpeExceptionsForYear Helper Tests', () => {
  it('TEST 10: Validation passes for correctly transitioned exceptions', () => {
    const team = createTeamWithUsedExceptions();
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    const result = validateNonTpeExceptionsForYear(team, TEST_YEAR_2027);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('TEST 11: Validation fails for stale maxAmount', () => {
    const team = createTeamWithUsedExceptions({ seasonKey: '2025-26' });

    // Don't transition - exception has old values
    const result = validateNonTpeExceptionsForYear(team, TEST_YEAR_2027);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    // Should mention maxAmount mismatch
    expect(result.issues.some((i) => i.includes('maxAmount'))).toBe(true);
  });
});

describe('Phase 76: Reload Parity Tests', () => {
  it('TEST 12: Exception state survives simulated persist→reload cycle', () => {
    const team = createTeamWithUsedExceptions({
      biAnnualUsed: 2_000_000,
      miniMleUsed: 3_000_000,
    });

    // Transition to new season
    const transitionResult = resetTeamNonTpeExceptionsForNewSeason(
      team,
      TEST_YEAR_2027
    );
    expect(transitionResult.hasChanges).toBe(true);

    // Simulate persist by serializing to JSON
    const serialized = JSON.stringify(team);

    // Simulate reload by parsing from JSON
    const reloaded = JSON.parse(serialized);

    // Verify exception state matches exactly
    expect(reloaded.exceptions.biAnnual).toEqual(team.exceptions.biAnnual);
    expect(reloaded.exceptions.miniMle).toEqual(team.exceptions.miniMle);
    expect(reloaded.exceptions.nonTaxpayerMle).toEqual(
      team.exceptions.nonTaxpayerMle
    );
    expect(reloaded.exceptions.room).toEqual(team.exceptions.room);

    // Verify specific values
    expect(reloaded.exceptions.biAnnual.usedAmount).toBe(0);
    expect(reloaded.exceptions.biAnnual.remainingAmount).toBe(
      reloaded.exceptions.biAnnual.maxAmount
    );
    expect(reloaded.exceptions.biAnnual.seasonKey).toBe('2026-27');
  });

  it('TEST 13: Running transition twice is idempotent', () => {
    const team = createTeamWithUsedExceptions();

    // First transition
    const result1 = resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);
    expect(result1.hasChanges).toBe(true);

    // Snapshot state after first transition
    const snapshot1 = JSON.stringify(team.exceptions);

    // Second transition with same year
    const result2 = resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // Second run should report no changes (already transitioned)
    expect(result2.hasChanges).toBe(false);
    expect(result2.transitionedExceptions).toHaveLength(0);

    // State should be identical
    const snapshot2 = JSON.stringify(team.exceptions);
    expect(snapshot1).toBe(snapshot2);
  });
});

describe('Phase 76: Edge Cases', () => {
  it('TEST 14: Handles team with no existing exceptions gracefully', () => {
    const team = {
      teamCode: 'NEW',
      teamName: 'New Team',
      players: [],
      roster: [],
      // No exceptions object at all
    };

    const result = resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // Should create exceptions object
    expect(team.exceptions).toBeDefined();
    expect(result.hasChanges).toBe(true);

    // All non-TPE exceptions should be initialized (disabled by default)
    for (const type of NON_TPE_EXCEPTION_TYPES) {
      expect(team.exceptions[type]).toBeDefined();
      expect(team.exceptions[type].enabled).toBe(false);
      expect(team.exceptions[type].usedAmount).toBe(0);
      expect(team.exceptions[type].maxAmount).toBeGreaterThan(0);
      expect(team.exceptions[type].remainingAmount).toBe(0); // disabled
    }
  });

  it('TEST 15: Handles null team gracefully', () => {
    const result = resetTeamNonTpeExceptionsForNewSeason(null, TEST_YEAR_2027);

    expect(result.hasChanges).toBe(false);
    expect(result.transitionedExceptions).toHaveLength(0);
  });

  it('TEST 16: Handles invalid yearKey gracefully', () => {
    const team = createTeamWithUsedExceptions();
    const originalState = JSON.stringify(team.exceptions);

    const result = resetTeamNonTpeExceptionsForNewSeason(team, 'invalid');

    expect(result.hasChanges).toBe(false);
    // State should be unchanged
    expect(JSON.stringify(team.exceptions)).toBe(originalState);
  });

  it('TEST 17: Preserves notes field through transition', () => {
    const team = createTeamWithUsedExceptions();
    team.exceptions.biAnnual.notes = 'User note: reserved for guard';

    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    expect(team.exceptions.biAnnual.notes).toBe(
      'User note: reserved for guard'
    );
  });
});

describe('Phase 76: NON_TPE_EXCEPTION_TYPES Constant Tests', () => {
  it('TEST 18: NON_TPE_EXCEPTION_TYPES contains exactly 4 types', () => {
    expect(NON_TPE_EXCEPTION_TYPES).toHaveLength(4);
  });

  it('TEST 19: NON_TPE_EXCEPTION_TYPES includes all expected types', () => {
    expect(NON_TPE_EXCEPTION_TYPES).toContain('biAnnual');
    expect(NON_TPE_EXCEPTION_TYPES).toContain('miniMle');
    expect(NON_TPE_EXCEPTION_TYPES).toContain('nonTaxpayerMle');
    expect(NON_TPE_EXCEPTION_TYPES).toContain('room');
  });

  it('TEST 20: NON_TPE_EXCEPTION_TYPES does NOT include tpe', () => {
    expect(NON_TPE_EXCEPTION_TYPES).not.toContain('tpe');
    expect(NON_TPE_EXCEPTION_TYPES).not.toContain('tradeExceptions');
  });
});
