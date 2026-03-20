/**
 * FILE: src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js
 * PURPOSE: Phase 61 guardrail tests for persistence contract (allowlist) enforcement.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 61 - Created for allowlist-based persistence contract enforcement tests
 *
 * LINKS:
 *  - Contracts: src/features/architect/utils/persistenceContracts/
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *
 * TEST CATEGORIES:
 * A) Unit tests: validator path reporting
 * B) Enforcement gating: shouldEnforcePersistenceContracts behavior
 * C) Source-scan tests: persistWorldMutation uses enforcement
 * D) Drift detection tests: unknown fields trigger actionable errors
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  findDisallowedKeyPaths,
  validatePersistableShape,
  formatViolationMessage,
  shouldEnforcePersistenceContracts,
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
  TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
  PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST,
  EVENT_TOP_LEVEL_ALLOWLIST,
  EVENT_METADATA_TOP_LEVEL_ALLOWLIST,
  TRADE_EXCEPTION_ITEM_ALLOWLIST,
  EXCEPTION_HISTORY_ITEM_ALLOWLIST,
} from '@/features/architect/utils/persistenceContracts';

// Helper to read source files for source-scan tests
function readSourceFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf-8');
}

// ==============================================================================
// CATEGORY A: Unit tests - Validator path reporting
// ==============================================================================

describe('Phase 61: findDisallowedKeyPaths unit tests', () => {
  it('TEST 1: returns empty array for object with all allowed keys', () => {
    const obj = { teamCode: 'BOS', teamName: 'Boston Celtics', roster: [] };
    const violations = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
    });
    expect(violations).toEqual([]);
  });

  it('TEST 2: detects single unknown top-level key', () => {
    const obj = {
      teamCode: 'BOS',
      unknownField: true, // Not in allowlist
    };
    const violations = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
    });
    expect(violations).toContain('team.unknownField');
    expect(violations.length).toBe(1);
  });

  it('TEST 3: detects multiple unknown top-level keys', () => {
    const obj = {
      teamCode: 'BOS',
      debugFoo: true,
      internalBar: { nested: 'value' },
    };
    const violations = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
    });
    expect(violations).toContain('team.debugFoo');
    expect(violations).toContain('team.internalBar');
    expect(violations.length).toBe(2);
  });

  it('TEST 4: allows _meta field (Phase 60 preserved it for UI)', () => {
    const obj = {
      teamCode: 'BOS',
      _meta: { computedTotals: true },
    };
    const violations = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
    });
    expect(violations).toEqual([]);
  });

  it('TEST 5: detects unknown keys in tradeExceptions[] items with deep rules', () => {
    const obj = {
      teamCode: 'BOS',
      exceptions: {
        tpe: [
          {
            id: 'tpe_001',
            totalAmount: 5000000,
            debugFlag: true, // Not in TRADE_EXCEPTION_ITEM_ALLOWLIST
          },
        ],
      },
    };
    const violations = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: {
        'exceptions.tpe': TRADE_EXCEPTION_ITEM_ALLOWLIST,
      },
    });
    expect(violations).toContain('team.exceptions.tpe[0].debugFlag');
    expect(violations.length).toBe(1);
  });

  it('TEST 6: detects unknown keys in exceptionHistory[] items with deep rules', () => {
    const obj = {
      teamCode: 'BOS',
      exceptionHistory: [
        {
          historyKey: 'key_001',
          type: 'TPE_CREATED',
          teamCode: 'BOS',
          internalDebug: 'shouldNotPersist', // Not in EXCEPTION_HISTORY_ITEM_ALLOWLIST
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: {
        exceptionHistory: EXCEPTION_HISTORY_ITEM_ALLOWLIST,
      },
    });
    expect(violations).toContain('team.exceptionHistory[0].internalDebug');
    expect(violations.length).toBe(1);
  });

  it('TEST 7: handles null and undefined gracefully', () => {
    expect(
      findDisallowedKeyPaths({
        obj: null,
        allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      })
    ).toEqual([]);
    expect(
      findDisallowedKeyPaths({
        obj: undefined,
        allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      })
    ).toEqual([]);
  });

  it('TEST 8: produces stable/deterministic path output', () => {
    const obj = {
      teamCode: 'BOS',
      foo: 1,
      bar: 2,
      baz: 3,
    };
    const violations1 = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
    });
    const violations2 = findDisallowedKeyPaths({
      obj,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
    });
    expect(violations1).toEqual(violations2);
    expect(violations1.length).toBe(3);
  });
});

describe('Phase 61: validatePersistableShape unit tests', () => {
  it('TEST 9: returns valid=true for conforming object', () => {
    const obj = {
      playerId: 'player_001',
      displayName: 'Test Player',
      teamCode: 'BOS',
    };
    const result = validatePersistableShape({
      obj,
      allowlist: PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST,
      label: 'PLAYER',
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.label).toBe('PLAYER');
  });

  it('TEST 10: returns valid=false with violations for non-conforming object', () => {
    const obj = {
      playerId: 'player_001',
      _internalState: true,
      debugInfo: {},
    };
    const result = validatePersistableShape({
      obj,
      allowlist: PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST,
      label: 'PLAYER',
    });
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBe(2);
    expect(result.violations).toContain('player._internalState');
    expect(result.violations).toContain('player.debugInfo');
  });
});

describe('Phase 61: formatViolationMessage tests', () => {
  it('TEST 11: formats single violation message correctly', () => {
    const message = formatViolationMessage(['team.foo'], 'TEAM');
    expect(message).toContain('[PERSISTENCE CONTRACT VIOLATION]');
    expect(message).toContain('TEAM');
    expect(message).toContain('team.foo');
    expect(message).toContain('persistenceContracts/contracts.ts');
  });

  it('TEST 12: truncates long violation lists with count', () => {
    const violations = Array.from({ length: 30 }, (_, i) => `team.field${i}`);
    const message = formatViolationMessage(violations, 'TEAM', 25);
    expect(message).toContain('30 disallowed field(s)');
    expect(message).toContain('team.field0');
    expect(message).toContain('... and 5 more');
  });

  it('TEST 13: returns empty string for no violations', () => {
    const message = formatViolationMessage([], 'TEAM');
    expect(message).toBe('');
  });
});

// ==============================================================================
// CATEGORY B: Enforcement gating tests
// ==============================================================================

describe('Phase 61: shouldEnforcePersistenceContracts gating', () => {
  it('TEST 14: returns true in test environment (NODE_ENV=test)', () => {
    // Vitest runs with NODE_ENV=test by default
    expect(shouldEnforcePersistenceContracts()).toBe(true);
  });

  it('TEST 15: enforcement function is deterministic', () => {
    const result1 = shouldEnforcePersistenceContracts();
    const result2 = shouldEnforcePersistenceContracts();
    expect(result1).toBe(result2);
  });
});

// ==============================================================================
// CATEGORY C: Source-scan tests - persistWorldMutation wiring
// ==============================================================================

describe('Phase 61: persistWorldMutation source-scan for contract enforcement', () => {
  let mutationPipelineSource;

  beforeAll(() => {
    mutationPipelineSource = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );
  });

  it('TEST 16: mutationPipeline.ts imports assertPersistableOrThrow', () => {
    expect(mutationPipelineSource).toContain('assertPersistableOrThrow');
    expect(mutationPipelineSource).toContain(
      "from '@/features/architect/utils/persistenceContracts'"
    );
  });

  it('TEST 17: mutationPipeline.ts imports PERSISTENCE_CONTRACTS', () => {
    expect(mutationPipelineSource).toContain('PERSISTENCE_CONTRACTS');
  });

  it('TEST 18: persistWorldMutation calls assertPersistableOrThrow for TEAM writes', () => {
    // Find the persistWorldMutation function region
    const persistStart = mutationPipelineSource.indexOf(
      'async function persistWorldMutation'
    );
    const persistEnd = mutationPipelineSource.indexOf(
      'function computeStoreOfferSheetResult'
    );
    expect(persistStart).toBeGreaterThan(-1);
    expect(persistEnd).toBeGreaterThan(persistStart);

    const persistRegion = mutationPipelineSource.slice(
      persistStart,
      persistEnd
    );

    // Verify TEAM contract enforcement is present
    const hasTeamEnforcement =
      persistRegion.includes('contract: PERSISTENCE_CONTRACTS.TEAM') &&
      persistRegion.includes("label: 'TEAM'");
    expect(hasTeamEnforcement).toBe(true);
  });

  it('TEST 19: persistWorldMutation calls assertPersistableOrThrow for PLAYER writes', () => {
    const persistStart = mutationPipelineSource.indexOf(
      'async function persistWorldMutation'
    );
    const persistEnd = mutationPipelineSource.indexOf(
      'function computeStoreOfferSheetResult'
    );
    const persistRegion = mutationPipelineSource.slice(
      persistStart,
      persistEnd
    );

    const hasPlayerEnforcement =
      persistRegion.includes('contract: PERSISTENCE_CONTRACTS.PLAYER') &&
      persistRegion.includes("label: 'PLAYER'");
    expect(hasPlayerEnforcement).toBe(true);
  });

  it('TEST 20: persistWorldMutation calls assertPersistableOrThrow for EVENT writes', () => {
    const persistStart = mutationPipelineSource.indexOf(
      'async function persistWorldMutation'
    );
    const persistEnd = mutationPipelineSource.indexOf(
      'function computeStoreOfferSheetResult'
    );
    const persistRegion = mutationPipelineSource.slice(
      persistStart,
      persistEnd
    );

    const hasEventEnforcement =
      persistRegion.includes('contract: PERSISTENCE_CONTRACTS.EVENT') &&
      persistRegion.includes("label: 'EVENT'");
    expect(hasEventEnforcement).toBe(true);
  });

  it('TEST 21: persistWorldMutation calls assertPersistableOrThrow for EVENT_METADATA', () => {
    const persistStart = mutationPipelineSource.indexOf(
      'async function persistWorldMutation'
    );
    const persistEnd = mutationPipelineSource.indexOf(
      'function computeStoreOfferSheetResult'
    );
    const persistRegion = mutationPipelineSource.slice(
      persistStart,
      persistEnd
    );

    const hasMetadataEnforcement =
      persistRegion.includes(
        'contract: PERSISTENCE_CONTRACTS.EVENT_METADATA'
      ) && persistRegion.includes("label: 'EVENT_METADATA'");
    expect(hasMetadataEnforcement).toBe(true);
  });

  it('TEST 22: enforcement happens after sanitize and before removeUndefined (ordering check)', () => {
    // Look for the pattern: sanitize → assertPersistableOrThrow → removeUndefinedDeep
    const persistStart = mutationPipelineSource.indexOf(
      'async function persistWorldMutation'
    );
    const persistEnd = mutationPipelineSource.indexOf(
      'function computeStoreOfferSheetResult'
    );
    const persistRegion = mutationPipelineSource.slice(
      persistStart,
      persistEnd
    );

    // For team writes, check ordering comment exists
    expect(persistRegion).toContain(
      'Ordering: sanitize → validate contract → removeUndefined'
    );

    // Verify pattern: sanitize comes before assert, assert comes before removeUndefined
    const sanitizeIdx = persistRegion.indexOf(
      'sanitizeTransientFieldsForPersistence(team)'
    );
    const assertIdx = persistRegion.indexOf(
      'contract: PERSISTENCE_CONTRACTS.TEAM'
    );
    const removeIdx = persistRegion.indexOf(
      'removeUndefinedDeep(afterSanitize)'
    );

    expect(sanitizeIdx).toBeGreaterThan(-1);
    expect(assertIdx).toBeGreaterThan(sanitizeIdx);
    expect(removeIdx).toBeGreaterThan(assertIdx);
  });
});

// ==============================================================================
// CATEGORY D: Drift detection tests - unknown fields trigger actionable errors
// ==============================================================================

describe('Phase 61: Drift detection - assertPersistableOrThrow throws for violations', () => {
  it('TEST 23: throws for TEAM with unknown field, message includes label and path', () => {
    const badTeam = {
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      debugFoo: true, // Unknown field
    };

    expect(() =>
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      })
    ).toThrow();

    try {
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
    } catch (error) {
      expect(error.message).toContain('TEAM');
      expect(error.message).toContain('team.debugFoo');
      expect(error.message).toContain('persistenceContracts/contracts.ts');
    }
  });

  it('TEST 24: throws for PLAYER with unknown field', () => {
    const badPlayer = {
      playerId: 'player_001',
      _internalComputeState: { cached: true },
    };

    expect(() =>
      assertPersistableOrThrow({
        obj: badPlayer,
        contract: PERSISTENCE_CONTRACTS.PLAYER,
        label: 'PLAYER',
      })
    ).toThrow();
  });

  it('TEST 25: throws for EVENT with unknown field', () => {
    const badEvent = {
      eventId: 'event_001',
      type: 'executeTrade',
      _debugContext: {},
    };

    expect(() =>
      assertPersistableOrThrow({
        obj: badEvent,
        contract: PERSISTENCE_CONTRACTS.EVENT,
        label: 'EVENT',
      })
    ).toThrow();
  });

  it('TEST 26: throws for EVENT_METADATA with unknown field', () => {
    const badMetadata = {
      type: 'trade',
      teamsInvolved: ['BOS', 'LAL'],
      _rawValidationResult: {}, // Should have been stripped by Phase 60
    };

    expect(() =>
      assertPersistableOrThrow({
        obj: badMetadata,
        contract: PERSISTENCE_CONTRACTS.EVENT_METADATA,
        label: 'EVENT_METADATA',
      })
    ).toThrow();
  });

  it('TEST 27: does NOT throw for valid conforming TEAM object', () => {
    const validTeam = {
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      roster: ['player_001', 'player_002'],
      exceptions: {},
      _meta: { computedAt: Date.now() }, // _meta is allowed
    };

    expect(() =>
      assertPersistableOrThrow({
        obj: validTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      })
    ).not.toThrow();
  });

  it('TEST 28: does NOT throw for null/undefined objects', () => {
    expect(() =>
      assertPersistableOrThrow({
        obj: null,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      })
    ).not.toThrow();

    expect(() =>
      assertPersistableOrThrow({
        obj: undefined,
        contract: PERSISTENCE_CONTRACTS.PLAYER,
        label: 'PLAYER',
      })
    ).not.toThrow();
  });
});

// ==============================================================================
// CATEGORY E: Contract structure validation
// ==============================================================================

describe('Phase 61: Persistence contract structure validation', () => {
  it('TEST 29: PERSISTENCE_CONTRACTS has all required document types', () => {
    expect(PERSISTENCE_CONTRACTS.TEAM).toBeDefined();
    expect(PERSISTENCE_CONTRACTS.PLAYER).toBeDefined();
    expect(PERSISTENCE_CONTRACTS.EVENT).toBeDefined();
    expect(PERSISTENCE_CONTRACTS.EVENT_METADATA).toBeDefined();
  });

  it('TEST 30: each contract has topLevel array', () => {
    expect(Array.isArray(PERSISTENCE_CONTRACTS.TEAM.topLevel)).toBe(true);
    expect(Array.isArray(PERSISTENCE_CONTRACTS.PLAYER.topLevel)).toBe(true);
    expect(Array.isArray(PERSISTENCE_CONTRACTS.EVENT.topLevel)).toBe(true);
    expect(Array.isArray(PERSISTENCE_CONTRACTS.EVENT_METADATA.topLevel)).toBe(
      true
    );
  });

  it('TEST 31: TEAM contract has deepRules for nested arrays', () => {
    const deepRules = PERSISTENCE_CONTRACTS.TEAM.deepRules;
    expect(deepRules).toBeDefined();
    expect(deepRules['exceptions.tpe']).toBeDefined();
    expect(deepRules['exceptionHistory']).toBeDefined();
  });

  it('TEST 32: allowlist arrays are frozen (immutable)', () => {
    expect(Object.isFrozen(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST)).toBe(true);
    expect(Object.isFrozen(PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST)).toBe(true);
    expect(Object.isFrozen(EVENT_TOP_LEVEL_ALLOWLIST)).toBe(true);
    expect(Object.isFrozen(EVENT_METADATA_TOP_LEVEL_ALLOWLIST)).toBe(true);
    expect(Object.isFrozen(TRADE_EXCEPTION_ITEM_ALLOWLIST)).toBe(true);
    expect(Object.isFrozen(EXCEPTION_HISTORY_ITEM_ALLOWLIST)).toBe(true);
  });

  it('TEST 33: TEAM allowlist includes expected core fields', () => {
    expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('teamCode');
    expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('roster');
    expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('exceptions');
    expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('exceptionHistory');
    expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('_meta');
  });

  it('TEST 34: EVENT allowlist includes expected fields', () => {
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('eventId');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('schemaVersion');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('validatorVersion');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('operationId');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('mutationType');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('occurredAt');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('worldId');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('teamCodes');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('playerIds');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('beforeTotalsByTeam');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('afterTotalsByTeam');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('valid');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('violations');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('warnings');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('diffSummary');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('type');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('timestamp');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('metadata');
    expect(EVENT_TOP_LEVEL_ALLOWLIST).toContain('teamsAffected');
  });
});
