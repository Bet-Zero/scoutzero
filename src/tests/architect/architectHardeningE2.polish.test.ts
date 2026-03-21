/**
 * FILE: src/tests/architect/architectHardeningE2.polish.test.ts
 * PURPOSE: Narrow regression proof for the second TS hardening pass (E2).
 * Validates that buildSigningGuardrails returns stable runtime shapes
 * after extensionTerms/eligibility type closures and index signature removals.
 * OWNERSHIP: Feature: architect/ts-hardening
 */

import { describe, expect, it } from 'vitest';
import { buildSigningGuardrails } from '@/features/architect/hooks/useCapValidation';

const CAP_SETTINGS = {
  cap: 140_000_000,
  tax: 171_000_000,
  firstApron: 178_000_000,
  secondApron: 189_000_000,
  fullMLE: 12_800_000,
  taxpayerMLE: 5_200_000,
  roomMLE: 7_700_000,
  bae: 4_300_000,
  minimumSalary: 1_100_000,
};

describe('Architect TypeScript hardening E2 regression', () => {
  describe('buildSigningGuardrails — base bird rights', () => {
    it('Full Bird → maxYears 5, canSignToMax true', () => {
      const result = buildSigningGuardrails(
        {
          birdRights: {
            type: 'Full Bird',
            signingAbilities: {
              canSignToMax: true,
              maxFirstYearSalary: 42_000_000,
              raisePercentage: 0.08,
              maxYears: 5,
            },
          },
          maxSalary: {
            maxSalary: 42_000_000,
            maxSalaryBird: 42_000_000,
          },
          minimumSalary: 1_100_000,
        },
        CAP_SETTINGS,
        'None'
      );

      expect(result.maxYears).toBe(5);
      expect(result.canSignToMax).toBe(true);
      expect(result.birdRightsType).toBe('Full Bird');
      expect(result.maxFirstYear).toBe(42_000_000);
      expect(result.raisePct).toBe(0.08);
      expect(result.source).toBe('Full Bird');
    });
  });

  describe('buildSigningGuardrails — exception overrides', () => {
    it('Full MLE overrides maxFirstYear and maxYears', () => {
      const result = buildSigningGuardrails(
        { minimumSalary: 1_100_000 },
        CAP_SETTINGS,
        'Full MLE'
      );

      expect(result.source).toBe('Full MLE');
      expect(result.maxFirstYear).toBe(12_800_000);
      expect(result.maxYears).toBe(4);
      expect(result.raisePct).toBe(0.05);
    });

    it('Taxpayer MLE maxYears is 2 (CBA correction)', () => {
      const result = buildSigningGuardrails(
        { minimumSalary: 1_100_000 },
        CAP_SETTINGS,
        'Taxpayer MLE'
      );

      expect(result.source).toBe('Taxpayer MLE');
      expect(result.maxYears).toBe(2);
      expect(result.maxFirstYear).toBe(5_200_000);
    });
  });

  describe('buildSigningGuardrails — minimum floor enforcement', () => {
    it('minFirstYear is at least QO amount', () => {
      const result = buildSigningGuardrails(
        {
          minimumSalary: 1_100_000,
          restrictedFreeAgency: {
            isRFA: true,
            qualifyingOfferAmount: 8_000_000,
          },
        },
        CAP_SETTINGS,
        'None'
      );

      expect(result.minFirstYear).toBe(8_000_000);
      expect(result.qoAmount).toBe(8_000_000);
    });

    it('minFirstYear uses minimum salary when no QO', () => {
      const result = buildSigningGuardrails(
        { minimumSalary: 1_100_000 },
        CAP_SETTINGS,
        'None'
      );

      expect(result.minFirstYear).toBe(1_100_000);
      expect(result.qoAmount).toBe(0);
    });
  });

  describe('buildSigningGuardrails — null/missing rulesProfile', () => {
    it('returns default fallback shape with null profile', () => {
      const result = buildSigningGuardrails(null, CAP_SETTINGS, 'None');

      expect(result.minFirstYear).toBe(0);
      expect(result.maxFirstYear).toBe(null);
      expect(result.maxYears).toBe(4);
      expect(result.raisePct).toBe(0.05);
      expect(result.canSignToMax).toBe(false);
      expect(result.birdRightsType).toBe(null);
      expect(result.qoAmount).toBe(0);
    });

    it('returns default fallback shape with no arguments', () => {
      const result = buildSigningGuardrails();

      expect(result.minFirstYear).toBe(0);
      expect(result.maxFirstYear).toBe(null);
      expect(result.canSignToMax).toBe(false);
    });
  });

  describe('buildSigningGuardrails — unknown exception type', () => {
    it('falls back to base guardrails for unrecognized exception', () => {
      const result = buildSigningGuardrails(
        {
          birdRights: {
            type: 'Full Bird',
            signingAbilities: {
              canSignToMax: true,
              maxFirstYearSalary: 42_000_000,
              raisePercentage: 0.08,
              maxYears: 5,
            },
          },
          maxSalary: { maxSalary: 42_000_000, maxSalaryBird: 42_000_000 },
          minimumSalary: 1_100_000,
        },
        CAP_SETTINGS,
        'InvalidExceptionType'
      );

      // Should use base guardrails, not exception overrides
      expect(result.source).toBe('Full Bird');
      expect(result.maxYears).toBe(5);
      expect(result.raisePct).toBe(0.08);
    });
  });

  describe('buildSigningGuardrails — output shape stability', () => {
    it('always returns all required fields', () => {
      const result = buildSigningGuardrails(null, {}, 'None');

      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('minFirstYear');
      expect(result).toHaveProperty('maxFirstYear');
      expect(result).toHaveProperty('raisePct');
      expect(result).toHaveProperty('maxYears');
      expect(result).toHaveProperty('qoAmount');
      expect(result).toHaveProperty('birdRightsType');
      expect(result).toHaveProperty('canSignToMax');
      expect(typeof result.source).toBe('string');
      expect(typeof result.minFirstYear).toBe('number');
      expect(typeof result.raisePct).toBe('number');
      expect(typeof result.maxYears).toBe('number');
      expect(typeof result.qoAmount).toBe('number');
      expect(typeof result.canSignToMax).toBe('boolean');
    });
  });
});
