/**
 * FILE: src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.js
 * PURPOSE: Anti-regression guardrail tests for Phase 60 - Mutation Persistence Sanitization.
 *
 * These tests enforce that transient validation/context artifacts are NEVER persisted
 * to Firestore. The mutation pipeline uses internal keys (e.g., _validatedTradeContext)
 * during compute/validation, but these MUST be stripped at the persistence boundary.
 *
 * ENFORCED INVARIANTS:
 * 1. executeTrade compute results do not leak forbidden transient keys to persistence
 * 2. signAndTrade compute results do not leak forbidden transient keys to persistence
 * 3. persistWorldMutation uses sanitizeTransientFieldsForPersistence before writes
 *
 * FORBIDDEN TRANSIENT KEYS (defined in mutationPipeline.ts):
 * - _validatedTradeContext
 * - _signingValidation
 * - _isPostTradeSnapshot
 * - _isValidatedTradeContext
 * - _rawValidation
 *
 * NOTE: _meta is NOT forbidden - it's legitimately used for computed totals display.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  FORBIDDEN_TRANSIENT_KEYS,
  sanitizeTransientFieldsForPersistence,
} from '@/features/architect/utils/mutationPipeline';

// ==============================================================================
// HELPER: Deep-scan for forbidden keys
// ==============================================================================

/**
 * Recursively scan an object for forbidden transient keys.
 * Returns an array of paths where forbidden keys are found.
 * @param {any} obj - Object to scan
 * @param {string[]} forbiddenKeys - Keys that should not exist
 * @param {string} [path=''] - Current path (for error reporting)
 * @returns {string[]} Array of paths with forbidden keys (e.g., ['teams.BOS._validatedTradeContext'])
 */
function findForbiddenKeyPaths(obj, forbiddenKeys, path = '') {
  const violations = [];

  if (obj === null || obj === undefined) {
    return violations;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      violations.push(
        ...findForbiddenKeyPaths(item, forbiddenKeys, `${path}[${index}]`)
      );
    });
    return violations;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      // Check if this key is forbidden
      if (forbiddenKeys.includes(key)) {
        violations.push(currentPath);
      }

      // Recurse into nested objects/arrays
      violations.push(
        ...findForbiddenKeyPaths(value, forbiddenKeys, currentPath)
      );
    }
  }

  return violations;
}

// Helper to read source file content
function readSourceFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf-8');
}

// ==============================================================================
// TEST SUITE: Sanitization Function Unit Tests
// ==============================================================================

describe('Phase 60: sanitizeTransientFieldsForPersistence unit tests', () => {
  it('TEST 1: removes forbidden transient keys from flat object', () => {
    const input = {
      teamCode: 'BOS',
      players: [],
      _validatedTradeContext: { legal: true },
      _signingValidation: { valid: true },
    };

    const result = sanitizeTransientFieldsForPersistence(input);

    expect(result.teamCode).toBe('BOS');
    expect(result.players).toEqual([]);
    expect(result._validatedTradeContext).toBeUndefined();
    expect(result._signingValidation).toBeUndefined();
  });

  it('TEST 2: removes forbidden keys from nested objects', () => {
    const input = {
      teamUpdates: [
        {
          teamCode: 'BOS',
          team: {
            players: [{ name: 'Tatum' }],
            _isValidatedTradeContext: true,
            nested: {
              _rawValidation: { errors: [] },
              validField: 'keep',
            },
          },
        },
      ],
    };

    const result = sanitizeTransientFieldsForPersistence(input);

    expect(result.teamUpdates[0].teamCode).toBe('BOS');
    expect(result.teamUpdates[0].team.players[0].name).toBe('Tatum');
    expect(result.teamUpdates[0].team._isValidatedTradeContext).toBeUndefined();
    expect(result.teamUpdates[0].team.nested._rawValidation).toBeUndefined();
    expect(result.teamUpdates[0].team.nested.validField).toBe('keep');
  });

  it('TEST 3: preserves _meta (NOT in forbidden list)', () => {
    const input = {
      teamCode: 'LAL',
      _meta: {
        rulesSource: 'computed',
        incompleteRosterCharge: { missingSlots: 2 },
      },
      _validatedTradeContext: { legal: false },
    };

    const result = sanitizeTransientFieldsForPersistence(input);

    // _meta should be preserved
    expect(result._meta).toBeDefined();
    expect(result._meta.rulesSource).toBe('computed');
    expect(result._meta.incompleteRosterCharge.missingSlots).toBe(2);

    // _validatedTradeContext should be removed
    expect(result._validatedTradeContext).toBeUndefined();
  });

  it('TEST 4: handles null and undefined gracefully', () => {
    expect(sanitizeTransientFieldsForPersistence(null)).toBeNull();
    expect(sanitizeTransientFieldsForPersistence(undefined)).toBeUndefined();
  });

  it('TEST 5: handles arrays with nested forbidden keys', () => {
    const input = [
      { teamCode: 'BOS', _isPostTradeSnapshot: true },
      { teamCode: 'LAL', _signingValidation: { valid: true } },
    ];

    const result = sanitizeTransientFieldsForPersistence(input);

    expect(result).toHaveLength(2);
    expect(result[0].teamCode).toBe('BOS');
    expect(result[0]._isPostTradeSnapshot).toBeUndefined();
    expect(result[1].teamCode).toBe('LAL');
    expect(result[1]._signingValidation).toBeUndefined();
  });

  it('TEST 6: passes through primitives unchanged', () => {
    expect(sanitizeTransientFieldsForPersistence('string')).toBe('string');
    expect(sanitizeTransientFieldsForPersistence(42)).toBe(42);
    expect(sanitizeTransientFieldsForPersistence(true)).toBe(true);
  });
});

// ==============================================================================
// TEST SUITE: Deep-scan helper tests
// ==============================================================================

describe('Phase 60: findForbiddenKeyPaths helper', () => {
  it('TEST 7: finds forbidden keys at top level', () => {
    const obj = {
      teamCode: 'BOS',
      _validatedTradeContext: { legal: true },
    };

    const violations = findForbiddenKeyPaths(obj, FORBIDDEN_TRANSIENT_KEYS);

    expect(violations).toEqual(['_validatedTradeContext']);
  });

  it('TEST 8: finds forbidden keys at nested levels', () => {
    const obj = {
      teamUpdates: [
        {
          teamCode: 'BOS',
          team: {
            _isValidatedTradeContext: true,
            nested: {
              _rawValidation: {},
            },
          },
        },
      ],
    };

    const violations = findForbiddenKeyPaths(obj, FORBIDDEN_TRANSIENT_KEYS);

    expect(violations).toContain(
      'teamUpdates[0].team._isValidatedTradeContext'
    );
    expect(violations).toContain('teamUpdates[0].team.nested._rawValidation');
    expect(violations).toHaveLength(2);
  });

  it('TEST 9: returns empty array when no violations', () => {
    const obj = {
      teamCode: 'BOS',
      players: [{ name: 'Tatum' }],
      _meta: { source: 'computed' }, // _meta is allowed
    };

    const violations = findForbiddenKeyPaths(obj, FORBIDDEN_TRANSIENT_KEYS);

    expect(violations).toEqual([]);
  });
});

// ==============================================================================
// TEST SUITE: Compute result sanitization (mock integration)
// ==============================================================================

describe('Phase 60: executeTrade compute result sanitization', () => {
  it('TEST 10: executeTrade computeResult with transient fields is sanitized', () => {
    // Simulate a compute result that includes transient fields
    const mockComputeResult = {
      success: true,
      teamUpdates: [
        {
          teamCode: 'BOS',
          team: {
            teamCode: 'BOS',
            players: [{ name: 'Tatum', salary: 30000000 }],
            tradeExceptions: [],
            exceptionHistory: [],
          },
        },
        {
          teamCode: 'LAL',
          team: {
            teamCode: 'LAL',
            players: [{ name: 'Davis', salary: 40000000 }],
            tradeExceptions: [],
          },
        },
      ],
      playerUpdates: [],
      metadata: { type: 'trade', teamsInvolved: ['BOS', 'LAL'] },
      // These are the transient fields that MUST be stripped
      _validatedTradeContext: {
        legal: true,
        _isValidatedTradeContext: true,
        validationTeams: [{ teamCode: 'BOS' }, { teamCode: 'LAL' }],
      },
    };

    // Pre-sanitization: should have forbidden keys
    const preViolations = findForbiddenKeyPaths(
      mockComputeResult,
      FORBIDDEN_TRANSIENT_KEYS
    );
    expect(preViolations).toContain('_validatedTradeContext');
    expect(preViolations).toContain(
      '_validatedTradeContext._isValidatedTradeContext'
    );

    // Apply sanitization (same as persistWorldMutation does)
    const sanitized = {
      ...mockComputeResult,
      teamUpdates: mockComputeResult.teamUpdates.map(({ teamCode, team }) => ({
        teamCode,
        team: sanitizeTransientFieldsForPersistence(team),
      })),
    };

    // Post-sanitization: teamUpdates should be clean
    const teamViolations = findForbiddenKeyPaths(
      sanitized.teamUpdates,
      FORBIDDEN_TRANSIENT_KEYS
    );
    expect(teamViolations).toEqual([]);
  });

  it('TEST 11: signAndTrade computeResult with _signingValidation is sanitized', () => {
    // Simulate a S&T compute result
    const mockComputeResult = {
      success: true,
      teamUpdates: [
        {
          teamCode: 'MIA',
          team: {
            teamCode: 'MIA',
            players: [{ name: 'Butler', salary: 50000000 }],
          },
        },
      ],
      playerUpdates: [],
      metadata: { type: 'signAndTrade' },
      // S&T specific transient fields
      _signingValidation: { valid: true, signedUsing: 'bird' },
      _validatedTradeContext: {
        legal: true,
        _isValidatedTradeContext: true,
      },
    };

    // Pre-sanitization check
    const preViolations = findForbiddenKeyPaths(
      mockComputeResult,
      FORBIDDEN_TRANSIENT_KEYS
    );
    expect(preViolations.length).toBeGreaterThan(0);

    // Apply sanitization at compute result level
    const sanitizedResult =
      sanitizeTransientFieldsForPersistence(mockComputeResult);

    // Post-sanitization: entire result should be clean
    const postViolations = findForbiddenKeyPaths(
      sanitizedResult,
      FORBIDDEN_TRANSIENT_KEYS
    );
    expect(postViolations).toEqual([]);

    // But business data is preserved
    expect(sanitizedResult.success).toBe(true);
    expect(sanitizedResult.teamUpdates[0].teamCode).toBe('MIA');
  });
});

// ==============================================================================
// TEST SUITE: Source-scan guardrail (persistWorldMutation uses sanitizer)
// ==============================================================================

describe('Phase 60: Source-scan guardrails for persistence boundary', () => {
  it('TEST 12: persistWorldMutation calls sanitizeTransientFieldsForPersistence for team writes', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Extract the persistWorldMutation function region
    const startMarker = 'async function persistWorldMutation(';
    const endMarker =
      '// ==============================================================================';
    const startIdx = source.indexOf(startMarker);
    const endIdx = source.indexOf(endMarker, startIdx + startMarker.length);
    const persistRegion = source.slice(startIdx, endIdx);

    // Verify sanitizeTransientFieldsForPersistence is called for team writes
    // Note: the argument is the pipeline-local variable name after stripping compute-only fields
    const hasSanitizerForTeam =
      persistRegion.includes('sanitizeTransientFieldsForPersistence(team)') ||
      persistRegion.includes('sanitizeTransientFieldsForPersistence(team,') ||
      persistRegion.includes('sanitizeTransientFieldsForPersistence(persistenceReadyTeam)') ||
      persistRegion.includes('sanitizeTransientFieldsForPersistence(persistenceReadyTeam,') ||
      // Handle multi-line call format (formatter may split args to next line)
      (persistRegion.includes('sanitizeTransientFieldsForPersistence(') &&
       persistRegion.includes('persistenceReadyTeam'));

    expect(hasSanitizerForTeam).toBe(true);
  });

  it('TEST 13: persistWorldMutation calls sanitizeTransientFieldsForPersistence for player writes', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Extract the persistWorldMutation function region
    const startMarker = 'async function persistWorldMutation(';
    const endMarker =
      '// ==============================================================================';
    const startIdx = source.indexOf(startMarker);
    const endIdx = source.indexOf(endMarker, startIdx + startMarker.length);
    const persistRegion = source.slice(startIdx, endIdx);

    // Verify sanitizeTransientFieldsForPersistence is called for player writes
    // Note: the argument is the pipeline-local variable name after normalizing the player shape
    const hasSanitizerForPlayer =
      persistRegion.includes('sanitizeTransientFieldsForPersistence(player)') ||
      persistRegion.includes('sanitizeTransientFieldsForPersistence(player,') ||
      persistRegion.includes('sanitizeTransientFieldsForPersistence(persistablePlayer)') ||
      persistRegion.includes('sanitizeTransientFieldsForPersistence(persistablePlayer,') ||
      // Handle multi-line call format (formatter may split args to next line)
      (persistRegion.includes('sanitizeTransientFieldsForPersistence(') &&
       persistRegion.includes('persistablePlayer'));

    expect(hasSanitizerForPlayer).toBe(true);
  });

  it('TEST 14: FORBIDDEN_TRANSIENT_KEYS is exported and contains expected keys', () => {
    expect(FORBIDDEN_TRANSIENT_KEYS).toBeDefined();
    expect(Array.isArray(FORBIDDEN_TRANSIENT_KEYS)).toBe(true);

    // Verify all expected transient keys are in the list
    expect(FORBIDDEN_TRANSIENT_KEYS).toContain('_validatedTradeContext');
    expect(FORBIDDEN_TRANSIENT_KEYS).toContain('_signingValidation');
    expect(FORBIDDEN_TRANSIENT_KEYS).toContain('_isPostTradeSnapshot');
    expect(FORBIDDEN_TRANSIENT_KEYS).toContain('_isValidatedTradeContext');
    expect(FORBIDDEN_TRANSIENT_KEYS).toContain('_rawValidation');

    // Verify _meta is NOT in the forbidden list
    expect(FORBIDDEN_TRANSIENT_KEYS).not.toContain('_meta');
  });

  it('TEST 15: FORBIDDEN_TRANSIENT_KEYS is frozen (immutable)', () => {
    expect(Object.isFrozen(FORBIDDEN_TRANSIENT_KEYS)).toBe(true);
  });
});

// ==============================================================================
// TEST SUITE: Defense-in-depth - Event metadata sanitization
// ==============================================================================

describe('Phase 60: Event metadata sanitization', () => {
  it('TEST 16: persistWorldMutation sanitizes event metadata', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Look for sanitization of computeResult.metadata (may be multiline due to Phase 61 refactoring)
    // Pattern: sanitizeTransientFieldsForPersistence followed by computeResult.metadata
    const hasMetadataSanitization =
      source.includes(
        'sanitizeTransientFieldsForPersistence(computeResult.metadata)'
      ) ||
      (source.includes('sanitizeTransientFieldsForPersistence(') &&
        source.includes('computeResult.metadata') &&
        source.includes('sanitizedMetadataRaw'));

    expect(hasMetadataSanitization).toBe(true);
  });

  it('TEST 17: persistWorldMutation sanitizes entire event object', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Look for sanitization of the event object before writing
    const hasEventSanitization = source.includes(
      'sanitizeTransientFieldsForPersistence(event)'
    );

    expect(hasEventSanitization).toBe(true);
  });
});
