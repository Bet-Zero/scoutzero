/**
 * FILE: src/tests/architect/exceptionManagement.test.js
 * PURPOSE: Tests for Manual Exception Management (Phase 27)
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-21: Phase 27 - Created for Manual Exception Management tests
 *
 * LINKS:
 *  - Plan: Phase 27 execution prompt
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 */

import { describe, it, expect } from 'vitest';
import { validateExceptions } from '@/features/architect/utils/capLegalityValidation';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

/**
 * Phase 27: Manual Exception Management Tests
 *
 * Verifies:
 * 1. Schema validation rules (object structure, enabled boolean, amounts, seasonKey).
 * 2. Mutation pipeline support for 'setExceptions'.
 * 3. Persistence contract (full replacement semantics).
 */
describe('Exception Management (setExceptions)', () => {
  describe('Validation (validateExceptions)', () => {
    // Test 1: Valid payload persists exceptions object
    it('should validate a correct exceptions object', () => {
      const validExceptions = {
        mle: {
          enabled: true,
          totalAmount: 12500000,
          usedAmount: 5000000,
          seasonKey: '2025-26',
        },
        bae: {
          enabled: false,
          totalAmount: 4500000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
      };

      const { violations, warnings } = validateExceptions(validExceptions);
      expect(violations).toHaveLength(0);
      expect(warnings || []).toHaveLength(0);
    });

    // Test 2: Missing/null exceptions is valid (means clearing all)
    it('should accept null or undefined exceptions (clearing)', () => {
      const { violations: v1 } = validateExceptions(null);
      expect(v1).toHaveLength(0);

      const { violations: v2 } = validateExceptions(undefined);
      expect(v2).toHaveLength(0);
    });

    // Test 3: Non-object exceptions blocks
    it('should fail if exceptions is not an object', () => {
      const { violations: v1 } = validateExceptions('not an object');
      expect(v1).toHaveLength(1);
      expect(v1[0].rule).toBe('exceptions_schema_invalid');

      const { violations: v2 } = validateExceptions([]);
      expect(v2).toHaveLength(1);
      expect(v2[0].rule).toBe('exceptions_schema_invalid');
      expect(v2[0].message).toContain('must be an object');
    });

    // Test 4: Negative amounts block
    it('should fail if totalAmount is negative', () => {
      const invalid = {
        mle: {
          enabled: true,
          totalAmount: -5000000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain('totalAmount cannot be negative');
    });

    // Test 5: usedAmount > totalAmount blocks
    it('should fail if usedAmount exceeds totalAmount', () => {
      const invalid = {
        mle: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: 7000000,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain(
        'usedAmount (7000000) cannot exceed totalAmount (5000000)'
      );
    });

    // Test 6: enabled not boolean blocks
    it('should fail if enabled is not boolean', () => {
      const invalid = {
        mle: {
          enabled: 'yes',
          totalAmount: 5000000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain('enabled must be boolean');
    });

    // Test 7: missing/empty seasonKey blocks
    it('should fail if seasonKey is empty string', () => {
      const invalid = {
        mle: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: 0,
          seasonKey: '',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain('seasonKey cannot be empty');
    });

    // Test 8: Unknown exception key policy enforced (hard-block)
    it('should fail if unknown exception key is provided', () => {
      const invalid = {
        mle: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
        unknownException: {
          enabled: true,
          totalAmount: 1000000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_unknown_key');
      expect(violations[0].message).toContain('Unknown exception keys');
      expect(violations[0].message).toContain('unknownException');
    });

    // Test 9: usedAmount negative blocks
    it('should fail if usedAmount is negative', () => {
      const invalid = {
        bae: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: -1000000,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain('usedAmount cannot be negative');
    });

    // Test 10: seasonKey not string blocks
    it('should fail if seasonKey is not a string', () => {
      const invalid = {
        tpmle: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: 0,
          seasonKey: 2025,
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain('seasonKey must be a string');
    });
  });

  describe('Pipeline (computeSetExceptionsResult)', () => {
    // Test 11: Full replacement semantics (old exceptions removed)
    it('should replace the exceptions object on the team (full replacement)', () => {
      const currentState = {
        team: {
          teamCode: 'LAL',
          exceptions: {
            mle: {
              enabled: true,
              totalAmount: 10000000,
              usedAmount: 2000000,
              seasonKey: '2024-25',
            },
            bae: {
              enabled: true,
              totalAmount: 4500000,
              usedAmount: 0,
              seasonKey: '2024-25',
            },
          },
        },
      };

      const newExceptions = {
        mle: {
          enabled: true,
          totalAmount: 12500000,
          usedAmount: 5000000,
          seasonKey: '2025-26',
        },
        // Note: bae is NOT included - should be removed
      };

      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'LAL',
          exceptions: newExceptions,
        },
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.teamUpdates).toHaveLength(1);
      expect(result.teamUpdates[0].team.exceptions).toEqual(newExceptions);
      // Ensure bae is removed (full replacement, not merge)
      expect(result.teamUpdates[0].team.exceptions.bae).toBeUndefined();
      expect(result.teamUpdates[0].team.exceptions.mle.seasonKey).toBe(
        '2025-26'
      );
    });

    // Test 12: Persistence contract (returns teamUpdates with exceptions)
    it('should return teamUpdates including updated team exceptions field', () => {
      const newExceptions = {
        mle: {
          enabled: true,
          totalAmount: 12500000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
      };

      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'BOS',
          exceptions: newExceptions,
        },
        currentState: { team: { teamCode: 'BOS' } },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.teamUpdates).toHaveLength(1);
      expect(result.teamUpdates[0].teamCode).toBe('BOS');
      expect(result.teamUpdates[0].team.exceptions).toEqual(newExceptions);
    });

    // Test 13: Empty object is valid (clearing all exceptions)
    it('should accept empty object as exceptions (clearing all)', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'MIA',
          exceptions: {},
        },
        currentState: {
          team: {
            teamCode: 'MIA',
            exceptions: {
              mle: {
                enabled: true,
                totalAmount: 5000000,
                usedAmount: 0,
                seasonKey: '2025-26',
              },
            },
          },
        },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.teamUpdates[0].team.exceptions).toEqual({});
    });

    // Test 14: Mutation fails if exceptions payload is array (not object)
    it('should fail if exceptions payload is an array', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'LAL',
          exceptions: [],
        },
        currentState: { team: { teamCode: 'LAL' } },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid exceptions payload');
    });

    // Test 15: All valid exception types can be set
    it('should accept all valid exception types (mle, tpmle, bae, room)', () => {
      const allExceptions = {
        mle: {
          enabled: true,
          totalAmount: 12500000,
          usedAmount: 5000000,
          seasonKey: '2025-26',
        },
        tpmle: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
        bae: {
          enabled: false,
          totalAmount: 4500000,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
        room: {
          enabled: true,
          totalAmount: 7000000,
          usedAmount: 2000000,
          seasonKey: '2025-26',
        },
      };

      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'GSW',
          exceptions: allExceptions,
        },
        currentState: { team: { teamCode: 'GSW' } },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(Object.keys(result.teamUpdates[0].team.exceptions)).toHaveLength(
        4
      );
      expect(result.teamUpdates[0].team.exceptions.mle.enabled).toBe(true);
      expect(result.teamUpdates[0].team.exceptions.tpmle.enabled).toBe(true);
      expect(result.teamUpdates[0].team.exceptions.bae.enabled).toBe(false);
      expect(result.teamUpdates[0].team.exceptions.room.enabled).toBe(true);
    });
  });

  describe('Additional Validation Edge Cases', () => {
    // Test 16: Exception entry is not an object
    it('should fail if exception entry is not an object', () => {
      const invalid = {
        mle: 'not an object',
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain(
        "Exception 'mle': must be an object"
      );
    });

    // Test 17: Non-finite number blocks
    it('should fail if totalAmount is Infinity', () => {
      const invalid = {
        mle: {
          enabled: true,
          totalAmount: Infinity,
          usedAmount: 0,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain(
        'totalAmount must be a finite number'
      );
    });

    // Test 18: NaN blocks
    it('should fail if usedAmount is NaN', () => {
      const invalid = {
        mle: {
          enabled: true,
          totalAmount: 5000000,
          usedAmount: NaN,
          seasonKey: '2025-26',
        },
      };
      const { violations } = validateExceptions(invalid);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('exceptions_schema_invalid');
      expect(violations[0].message).toContain(
        'usedAmount must be a finite number'
      );
    });
  });
});
