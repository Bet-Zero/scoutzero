/**
 * FILE: src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.js
 * PURPOSE: Phase 76 guardrails for Exception Lifecycle MVP - season advance reset/recalc + reload parity
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-01: Phase 76 - Created for Exception Lifecycle Season Advance Reset/Reload Parity
 *  - 2026-02-03: Phase 86 - Canonical exception keys + DPE lifecycle clear on rollover
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

type ExceptionEnabledFlags = {
  bae?: boolean;
  tpmle?: boolean;
  mle?: boolean;
  room?: boolean;
  dpe?: boolean;
};

type ExceptionState = {
  enabled: boolean;
  maxAmount: number;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  seasonKey: string;
  notes?: string;
};

type TeamExceptions = {
  bae: ExceptionState;
  tpmle: ExceptionState;
  mle: ExceptionState;
  room: ExceptionState;
  dpe: ExceptionState;
  tpe: Array<{
    id: string;
    amount: number;
    remainingAmount: number;
    expiresOn: string;
  }>;
};

type TeamWithUsedExceptions = {
  teamCode: string;
  teamName: string;
  players: unknown[];
  roster: unknown[];
  exceptions: TeamExceptions;
  totals?: {
    capHit: number;
  };
};

type CreateTeamWithUsedExceptionsOptions = {
  baeUsed?: number;
  tpmleUsed?: number;
  mleUsed?: number;
  roomUsed?: number;
  dpeUsed?: number;
  seasonKey?: string;
  enabledFlags?: ExceptionEnabledFlags;
};

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

/**
 * Creates a team with pre-existing exception state (simulating mid-season usage).
 */
function createTeamWithUsedExceptions(
  options: CreateTeamWithUsedExceptionsOptions = {}
): TeamWithUsedExceptions {
  const {
    baeUsed = 2_000_000,
    tpmleUsed = 1_000_000,
    mleUsed = 5_000_000,
    roomUsed = 3_000_000,
    dpeUsed = 500_000,
    seasonKey = '2025-26',
    enabledFlags = {},
  } = options;
  const resolvedFlags: Required<ExceptionEnabledFlags> = {
    bae: true,
    tpmle: true,
    mle: true,
    room: true,
    dpe: true,
    ...enabledFlags,
  };

  return {
    teamCode: 'TST',
    teamName: 'Test Team',
    players: [],
      roster: [],
      exceptions: {
        bae: {
          enabled: resolvedFlags.bae,
          maxAmount: 4_700_000,
          totalAmount: 4_700_000,
          usedAmount: baeUsed,
          remainingAmount: 4_700_000 - baeUsed,
          seasonKey,
        },
        tpmle: {
          enabled: resolvedFlags.tpmle,
          maxAmount: 5_000_000,
          totalAmount: 5_000_000,
          usedAmount: tpmleUsed,
          remainingAmount: 5_000_000 - tpmleUsed,
          seasonKey,
        },
        mle: {
          enabled: resolvedFlags.mle,
          maxAmount: 12_900_000,
          totalAmount: 12_900_000,
          usedAmount: mleUsed,
          remainingAmount: 12_900_000 - mleUsed,
          seasonKey,
        },
        room: {
          enabled: resolvedFlags.room,
          maxAmount: 8_000_000,
          totalAmount: 8_000_000,
          usedAmount: roomUsed,
          remainingAmount: 8_000_000 - roomUsed,
          seasonKey,
        },
        dpe: {
          enabled: resolvedFlags.dpe,
          maxAmount: 0,
          totalAmount: 0,
          usedAmount: dpeUsed,
          remainingAmount: 0,
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
  const ostePath = path.resolve(
    __dirname,
    '../../features/architect/utils/offseason/resolveOffseasonTransition.ts'
  );
  const exceptionLifecycleAuthorityPath = path.resolve(
    __dirname,
    '../../features/architect/utils/exceptions/exceptionLifecycle.ts'
  );
  const exceptionLifecycleShimPath = path.resolve(
    __dirname,
    '../../features/architect/utils/exceptions/exceptionLifecycle.js'
  );

  it('TEST 1: OSTE imports resetTeamNonTpeExceptionsForNewSeason', () => {
    const content = fs.readFileSync(ostePath, 'utf8');

    // Must import from exceptions module
    expect(content).toContain(
      "import { resetTeamNonTpeExceptionsForNewSeason } from '@/features/architect/utils/exceptions'"
    );
  });

  it('TEST 2: OSTE calls resetTeamNonTpeExceptionsForNewSeason inside transition flow', () => {
    const content = fs.readFileSync(ostePath, 'utf8');

    // Must call the helper with nextTeam and toYear
    expect(content).toContain('resetTeamNonTpeExceptionsForNewSeason(');
    expect(content).toContain('nextTeam');
    expect(content).toContain('toYear');
  });

  it('TEST 3: exceptionLifecycle.ts does NOT reference exceptions.tpe', () => {
    const content = fs.readFileSync(exceptionLifecycleAuthorityPath, 'utf8');

    // Must NOT contain direct tpe access (TPE lifecycle is separate)
    expect(content).not.toMatch(/exceptions\.tpe\b/);
    expect(content).not.toMatch(/team\.exceptions\.tpe/);

    // Verify it only handles non-TPE types
    expect(content).toContain('NON_TPE_EXCEPTION_TYPES');
    expect(content).toContain('mle');
    expect(content).toContain('tpmle');
    expect(content).toContain('bae');
    expect(content).toContain('room');
  });

  it('TEST 3b: exceptionLifecycle.ts does NOT import or call canUseRoomException', () => {
    const content = fs.readFileSync(exceptionLifecycleAuthorityPath, 'utf8');

    // Room eligibility gating is Phase 75's responsibility, not this module
    expect(content).not.toContain('canUseRoomException');
    expect(content).not.toContain('computeTeamCapTotals');
  });

  it('TEST 3c: exceptionLifecycle.js shim has been deleted (TS authority owns the surface)', () => {
    expect(fs.existsSync(exceptionLifecycleShimPath)).toBe(false);
  });
});

// ==============================================================================
// B) BEHAVIORAL TESTS
// ==============================================================================

describe('Phase 76: resetTeamNonTpeExceptionsForNewSeason Behavioral Tests', () => {
  it('TEST 4: Reset behavior - usedAmount resets to 0 after transition', () => {
    const team = createTeamWithUsedExceptions({
      baeUsed: 2_000_000,
      tpmleUsed: 3_000_000,
      mleUsed: 5_000_000,
      roomUsed: 4_000_000,
    });

    // Verify pre-condition: exceptions have non-zero usedAmount
    expect(team.exceptions.bae.usedAmount).toBe(2_000_000);
    expect(team.exceptions.tpmle.usedAmount).toBe(3_000_000);
    expect(team.exceptions.mle.usedAmount).toBe(5_000_000);
    expect(team.exceptions.room.usedAmount).toBe(4_000_000);

    // Transition to new season
    const result = resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    expect(result.hasChanges).toBe(true);
    expect(result.transitionedExceptions).toContain('bae');
    expect(result.transitionedExceptions).toContain('tpmle');
    expect(result.transitionedExceptions).toContain('mle');
    expect(result.transitionedExceptions).toContain('room');
    expect(result.transitionedExceptions).toContain('dpe');

    // All usedAmount should be reset to 0
    expect(team.exceptions.bae.usedAmount).toBe(0);
    expect(team.exceptions.tpmle.usedAmount).toBe(0);
    expect(team.exceptions.mle.usedAmount).toBe(0);
    expect(team.exceptions.room.usedAmount).toBe(0);
    expect(team.exceptions.dpe.usedAmount).toBe(0);
    expect(team.exceptions.dpe.enabled).toBe(false);
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
    expect(team.exceptions.bae.maxAmount).toBe(expectedBae);
    expect(team.exceptions.tpmle.maxAmount).toBe(expectedTaxpayerMle);
    expect(team.exceptions.mle.maxAmount).toBe(expectedFullMle);
    expect(team.exceptions.room.maxAmount).toBe(expectedRoomMle);

    // totalAmount should also match (for compatibility)
    expect(team.exceptions.bae.totalAmount).toBe(expectedBae);
    expect(team.exceptions.tpmle.totalAmount).toBe(expectedTaxpayerMle);
    expect(team.exceptions.mle.totalAmount).toBe(expectedFullMle);
    expect(team.exceptions.room.totalAmount).toBe(expectedRoomMle);
  });

  it('TEST 6: Remaining recompute - remainingAmount equals maxAmount when enabled', () => {
    const team = createTeamWithUsedExceptions({
      baeUsed: 2_000_000,
      tpmleUsed: 3_000_000,
      enabledFlags: {
        bae: true,
        tpmle: true,
        mle: true,
        room: true,
      },
    });

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // remainingAmount should equal maxAmount (full reset, enabled)
    expect(team.exceptions.bae.remainingAmount).toBe(
      team.exceptions.bae.maxAmount
    );
    expect(team.exceptions.tpmle.remainingAmount).toBe(
      team.exceptions.tpmle.maxAmount
    );
    expect(team.exceptions.mle.remainingAmount).toBe(
      team.exceptions.mle.maxAmount
    );
    expect(team.exceptions.room.remainingAmount).toBe(
      team.exceptions.room.maxAmount
    );
  });

  it('TEST 6b: Remaining recompute - remainingAmount is 0 when disabled', () => {
    const team = createTeamWithUsedExceptions({
      enabledFlags: {
        bae: false,
        tpmle: false,
        mle: false,
        room: false,
      },
    });

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // remainingAmount should be 0 when disabled (can't use unavailable exception)
    expect(team.exceptions.bae.remainingAmount).toBe(0);
    expect(team.exceptions.tpmle.remainingAmount).toBe(0);
    expect(team.exceptions.mle.remainingAmount).toBe(0);
    expect(team.exceptions.room.remainingAmount).toBe(0);

    // But maxAmount should still be set (for reference)
    expect(team.exceptions.bae.maxAmount).toBeGreaterThan(0);
    expect(team.exceptions.tpmle.maxAmount).toBeGreaterThan(0);
    expect(team.exceptions.mle.maxAmount).toBeGreaterThan(0);
    expect(team.exceptions.room.maxAmount).toBeGreaterThan(0);
  });

  it('TEST 7: Enabled preserved - enabled flag unchanged through transition', () => {
    const team = createTeamWithUsedExceptions({
      enabledFlags: {
        bae: true,
        tpmle: false,
        mle: true,
        room: false,
      },
    });

    // Transition to new season
    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    // enabled flags should be preserved exactly
    expect(team.exceptions.bae.enabled).toBe(true);
    expect(team.exceptions.tpmle.enabled).toBe(false);
    expect(team.exceptions.mle.enabled).toBe(true);
    expect(team.exceptions.room.enabled).toBe(false);
    expect(team.exceptions.dpe.enabled).toBe(false);
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
    expect(team.exceptions.bae.seasonKey).toBe('2026-27');
    expect(team.exceptions.tpmle.seasonKey).toBe('2026-27');
    expect(team.exceptions.mle.seasonKey).toBe('2026-27');
    expect(team.exceptions.room.seasonKey).toBe('2026-27');
    expect(team.exceptions.dpe.seasonKey).toBe('2026-27');
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
      baeUsed: 2_000_000,
      tpmleUsed: 3_000_000,
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
    expect(reloaded.exceptions.bae).toEqual(team.exceptions.bae);
    expect(reloaded.exceptions.tpmle).toEqual(team.exceptions.tpmle);
    expect(reloaded.exceptions.mle).toEqual(
      team.exceptions.mle
    );
    expect(reloaded.exceptions.room).toEqual(team.exceptions.room);
    expect(reloaded.exceptions.dpe).toEqual(team.exceptions.dpe);

    // Verify specific values
    expect(reloaded.exceptions.bae.usedAmount).toBe(0);
    expect(reloaded.exceptions.bae.remainingAmount).toBe(
      reloaded.exceptions.bae.maxAmount
    );
    expect(reloaded.exceptions.bae.seasonKey).toBe('2026-27');
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
    const team: {
      teamCode: string;
      teamName: string;
      players: unknown[];
      roster: unknown[];
      exceptions?: TeamExceptions;
    } = {
      teamCode: 'NEW',
      teamName: 'New Team',
      players: [],
      roster: [],
      // No exceptions object at all
    };

    const result = resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);
    const exceptions = requireValue(
      team.exceptions,
      'Expected exceptions to be created for empty team state'
    );

    // Should create exceptions object
    expect(exceptions).toBeDefined();
    expect(result.hasChanges).toBe(true);

    // All non-TPE exceptions should be initialized (disabled by default)
    for (const type of NON_TPE_EXCEPTION_TYPES) {
      expect(exceptions[type]).toBeDefined();
      expect(exceptions[type].enabled).toBe(false);
      expect(exceptions[type].usedAmount).toBe(0);
      expect(exceptions[type].maxAmount).toBeGreaterThan(0);
      expect(exceptions[type].remainingAmount).toBe(0); // disabled
    }

    expect(exceptions.dpe).toBeDefined();
    expect(exceptions.dpe.enabled).toBe(false);
    expect(exceptions.dpe.totalAmount).toBe(0);
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
    team.exceptions.bae.notes = 'User note: reserved for guard';

    resetTeamNonTpeExceptionsForNewSeason(team, TEST_YEAR_2027);

    expect(team.exceptions.bae.notes).toBe(
      'User note: reserved for guard'
    );
  });
});

describe('Phase 76: NON_TPE_EXCEPTION_TYPES Constant Tests', () => {
  it('TEST 18: NON_TPE_EXCEPTION_TYPES contains exactly 4 types', () => {
    expect(NON_TPE_EXCEPTION_TYPES).toHaveLength(4);
  });

  it('TEST 19: NON_TPE_EXCEPTION_TYPES includes all expected types', () => {
    expect(NON_TPE_EXCEPTION_TYPES).toContain('bae');
    expect(NON_TPE_EXCEPTION_TYPES).toContain('tpmle');
    expect(NON_TPE_EXCEPTION_TYPES).toContain('mle');
    expect(NON_TPE_EXCEPTION_TYPES).toContain('room');
  });

  it('TEST 20: NON_TPE_EXCEPTION_TYPES does NOT include tpe', () => {
    expect(NON_TPE_EXCEPTION_TYPES).not.toContain('tpe');
    expect(NON_TPE_EXCEPTION_TYPES).not.toContain('tradeExceptions');
  });
});
