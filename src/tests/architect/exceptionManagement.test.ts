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

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function getUpdatedTeam(
  result: ReturnType<typeof computeWorldMutation>,
  message: string
) {
  return requireValue(result.teamUpdates?.[0]?.team, message);
}

/**
 * Phase 27: Manual Exception Management Tests
 *
 * Verifies:
 * 1. Schema validation rules (object structure, enabled boolean, amounts, seasonKey).
 * 2. Mutation pipeline support for 'setExceptions'.
 * 3. Persistence contract (editable-bucket replacement + untouched-bucket preservation).
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
    // Test 11: Editable bucket replacement preserves non-editable exception state
    it('replaces only editable exception buckets while preserving TPE and other untouched buckets', () => {
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
            dpe: {
              enabled: true,
              totalAmount: 3_500_000,
              usedAmount: 0,
              seasonKey: '2024-25',
            },
            tpe: [
              {
                id: 'tpe_keep',
                totalAmount: 4_200_000,
                remainingAmount: 4_200_000,
              },
            ],
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
        // Note: bae is NOT included - editable omission should clear it
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
      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated team for setExceptions replacement test'
      );
      const updatedExceptions = requireValue(
        updatedTeam.exceptions,
        'Expected exceptions for setExceptions replacement test'
      );
      expect(updatedExceptions.mle).toEqual(
        expect.objectContaining({
          ...newExceptions.mle,
          available: true,
          maxAmount: 12500000,
          amount: 12500000,
          remainingAmount: 7500000,
        })
      );
      expect(updatedExceptions.bae).toBeUndefined();
      expect(updatedExceptions.dpe).toEqual(
        currentState.team.exceptions.dpe
      );
      expect(updatedExceptions.tpe).toEqual(
        currentState.team.exceptions.tpe
      );
      expect(
        requireValue(
          updatedExceptions.mle,
          'Expected MLE exception after setExceptions replacement test'
        ).seasonKey
      ).toBe('2025-26');
    });

    // Test 12: Persistence contract (returns teamUpdates including updated team exceptions field)
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
      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated team for teamUpdates coverage test'
      );
      expect(requireValue(result.teamUpdates?.[0]?.teamCode, 'Expected updated team code')).toBe('BOS');
      expect(updatedTeam.exceptions).toEqual({
        mle: expect.objectContaining({
          ...newExceptions.mle,
          available: true,
          maxAmount: 12500000,
          amount: 12500000,
          remainingAmount: 12500000,
        }),
      });
    });

    // Test 13: Empty object clears editable keys but preserves untouched buckets
    it('should accept empty object as exceptions and preserve non-editable buckets', () => {
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
              tpe: [{ id: 'keep_tpe', totalAmount: 2_000_000 }],
            },
          },
        },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(
        getUpdatedTeam(
          result,
          'Expected updated team for empty exceptions clearing test'
        ).exceptions
      ).toEqual({
        tpe: [{ id: 'keep_tpe', totalAmount: 2_000_000 }],
      });
    });

    // Test 14: Mutation fails if exceptions payload is array (not object)
    it('should fail if exceptions payload is an array', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'LAL',
          exceptions: [] as unknown as Record<string, unknown>,
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
      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated team for all exception types test'
      );
      const updatedExceptions = requireValue(
        updatedTeam.exceptions,
        'Expected exceptions for all exception types test'
      );
      expect(Object.keys(updatedExceptions)).toHaveLength(4);
      expect(
        requireValue(
          updatedExceptions.mle,
          'Expected MLE exception for all exception types test'
        ).enabled
      ).toBe(true);
      expect(
        requireValue(
          updatedExceptions.tpmle,
          'Expected TPMLE exception for all exception types test'
        ).enabled
      ).toBe(true);
      expect(
        requireValue(
          updatedExceptions.bae,
          'Expected BAE exception for all exception types test'
        ).enabled
      ).toBe(false);
      expect(
        requireValue(
          updatedExceptions.room,
          'Expected room exception for all exception types test'
        ).enabled
      ).toBe(true);
    });

    it('recomputes canonical totals after setExceptions updates', () => {
      const result = computeWorldMutation({
        mutationType: 'setExceptions',
        payload: {
          teamCode: 'NYK',
          exceptions: {
            mle: {
              enabled: true,
              totalAmount: 7_500_000,
              usedAmount: 1_000_000,
              seasonKey: '2025-26',
            },
          },
        },
        currentState: {
          team: {
            teamCode: 'NYK',
            players: [],
            roster: [],
            capHolds: [],
            deadCap: [],
            exceptions: { tpe: [] },
            totals: { capHit: 999 },
          },
        },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      const updatedTeam = getUpdatedTeam(
        result,
        'Expected updated team for canonical totals recompute test'
      );
      const updatedTotals = requireValue(
        updatedTeam.totals,
        'Expected totals to be recomputed after setExceptions update'
      );
      expect(updatedTotals.yearKey).toBe(2026);
      expect(typeof updatedTotals.totalCapAllocations).toBe('number');
      expect(updatedTotals.capHit).toBe(updatedTotals.totalCapAllocations);
      expect(updatedTotals.totalSalary).toBe(updatedTotals.totalCapAllocations);
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
