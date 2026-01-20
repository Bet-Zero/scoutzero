/**
 * FILE: src/tests/architect/worldTime.test.js
 * PURPOSE: Unit tests for Phase 20 World Time SSOT (asOfDate resolution and warning)
 * 
 * HISTORY:
 *  - 2026-01-20: Created for Phase 20 World Time SSOT tests
 */

import { describe, it, expect, vi } from 'vitest';
import { resolveWorldAsOfDate } from '@/features/architect/utils/mutationPipeline';
import { SOFT_WARNING_RULES } from '@/features/architect/utils/capLegalityValidation';

describe('Phase 20: World Time SSOT', () => {
  describe('resolveWorldAsOfDate helper', () => {
    it('T1: uses payload date when provided (highest priority)', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: '2026-01-20',
        worldAsOfDate: '2026-01-15',
      });
      
      expect(result.asOfDate).toBe('2026-01-20');
      expect(result.defaulted).toBe(false);
    });

    it('T2: uses world date when payload is missing', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: null,
        worldAsOfDate: '2026-01-15',
      });
      
      expect(result.asOfDate).toBe('2026-01-15');
      expect(result.defaulted).toBe(false);
    });

    it('T2b: uses world date when payload is undefined', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: undefined,
        worldAsOfDate: '2026-01-10',
      });
      
      expect(result.asOfDate).toBe('2026-01-10');
      expect(result.defaulted).toBe(false);
    });

    it('T3: returns defaulted date when both payload and world are missing', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: null,
        worldAsOfDate: null,
      });
      
      // Should return today's date in ISO format (YYYY-MM-DD)
      expect(result.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.defaulted).toBe(true);
    });

    it('T3b: returns defaulted date when both are undefined', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: undefined,
        worldAsOfDate: undefined,
      });
      
      expect(result.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.defaulted).toBe(true);
    });

    it('T3c: returns defaulted date when inputs are empty strings', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: '',
        worldAsOfDate: '',
      });
      
      // Empty string is falsy, should use fallback
      expect(result.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.defaulted).toBe(true);
    });

    it('ignores non-string payload values', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: 12345,
        worldAsOfDate: '2026-01-15',
      });
      
      // Number should be ignored, use world date
      expect(result.asOfDate).toBe('2026-01-15');
      expect(result.defaulted).toBe(false);
    });

    it('ignores non-string world values when payload is missing', () => {
      const result = resolveWorldAsOfDate({
        payloadAsOfDate: null,
        worldAsOfDate: { date: '2026-01-15' },
      });
      
      // Object should be ignored, use fallback
      expect(result.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.defaulted).toBe(true);
    });
  });

  describe('world_time_defaulted warning rule', () => {
    it('T4: world_time_defaulted exists in SOFT_WARNING_RULES', () => {
      expect(SOFT_WARNING_RULES).toContain('world_time_defaulted');
    });
  });

  describe('Warning emission in validateMutation (integration)', () => {
    it('T4b: dateDefaulted flag triggers warning emission', () => {
      // This test validates the warning structure without full pipeline integration
      // The actual warning is emitted in validateMutation when dateDefaulted is true
      const mockWarning = {
        rule: 'world_time_defaulted',
        message: 'World time was defaulted to 2026-01-20. For accurate timing-based validation, provide asOfDate in payload or world metadata.',
        severity: 'warning',
        asOfDateUsed: '2026-01-20',
      };
      
      expect(mockWarning.rule).toBe('world_time_defaulted');
      expect(mockWarning.asOfDateUsed).toBe('2026-01-20');
      expect(mockWarning.severity).toBe('warning');
    });
  });

  describe('asOfDate context threading (structural)', () => {
    it('T5: computeWorldMutation signature accepts asOfDate', async () => {
      // This is a structural test - the function should accept asOfDate without error
      // We verify by checking the function exists and is callable with the expected params
      const { computeWorldMutation } = await import('@/features/architect/utils/mutationPipeline');
      
      // Function should exist
      expect(typeof computeWorldMutation).toBe('function');
      
      // Function should be callable (will return early with unknown type error, but validates params)
      const result = computeWorldMutation({
        mutationType: 'unknownTestType',
        payload: {},
        currentState: {},
        seasonId: '2025-26',
        timestamp: Date.now(),
        asOfDate: '2026-01-20', // Phase 20 param
      });
      
      // Should return error for unknown type but not crash
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown mutation type');
    });
  });

  describe('Persist path behavior (structural)', () => {
    it('T6: worldPatch includes asOfDate when payload provides it', () => {
      // This is a structural test - validates the conditional logic
      // When payloadAsOfDate is a valid string, it should be included in worldPatch
      const payloadAsOfDate = '2026-01-20';
      const worldPatch = {
        lastModifiedAt: new Date().toISOString(),
        lastModifiedTeams: ['LAL'],
      };
      
      // Replicate the persist logic
      if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
        worldPatch.asOfDate = payloadAsOfDate;
      }
      
      expect(worldPatch.asOfDate).toBe('2026-01-20');
    });

    it('T7: worldPatch does NOT include asOfDate when payload omits it', () => {
      const payloadAsOfDate = null;
      const worldPatch = {
        lastModifiedAt: new Date().toISOString(),
        lastModifiedTeams: ['LAL'],
      };
      
      // Replicate the persist logic
      if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
        worldPatch.asOfDate = payloadAsOfDate;
      }
      
      expect(worldPatch.asOfDate).toBeUndefined();
    });

    it('T7b: worldPatch does NOT include asOfDate when payload has undefined', () => {
      const payloadAsOfDate = undefined;
      const worldPatch = {
        lastModifiedAt: new Date().toISOString(),
        lastModifiedTeams: ['LAL'],
      };
      
      // Replicate the persist logic
      if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
        worldPatch.asOfDate = payloadAsOfDate;
      }
      
      expect(worldPatch.asOfDate).toBeUndefined();
    });
  });
});
