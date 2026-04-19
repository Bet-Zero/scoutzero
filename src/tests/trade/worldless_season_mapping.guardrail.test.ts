/**
 * FILE: src/tests/trade/worldless_season_mapping.guardrail.test.js
 * PURPOSE: Guardrail tests to ensure season dropdown selection produces correct yearKey/seasonKey mapping.
 * OWNERSHIP: Feature: architect (Trade Machine - Worldless Mode)
 *
 * HISTORY:
 *  - 2026-01-03: Created for P0 Worldless Baseline Salary fix
 *
 * WHAT THIS TESTS:
 * - UI season dropdown (e.g., "2025-26") maps correctly to yearKey (e.g., 2026)
 * - yearKey maps correctly to seasonKey for cap settings (e.g., "2025-26")
 * - Salary slice lookups use the correct yearKey
 * - Cap settings provider returns correct values for the yearKey
 */

import { describe, test, expect } from 'vitest';
import { toSeasonKey, toEndYear } from '@/features/architect/utils/seasonFormat';
import { getCapSettingsForYear, yearToSeasonKey } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';

describe('Worldless Season Mapping Guardrails', () => {
  // ==========================================================================
  // Season Format Utilities
  // ==========================================================================
  
  describe('Season Format Conversion', () => {
    test('toSeasonKey converts endYear to season string correctly', () => {
      expect(toSeasonKey(2025)).toBe('2024-25');
      expect(toSeasonKey(2026)).toBe('2025-26');
      expect(toSeasonKey(2027)).toBe('2026-27');
    });

    test('toEndYear converts season string to endYear correctly', () => {
      expect(toEndYear('2024-25')).toBe(2025);
      expect(toEndYear('2025-26')).toBe(2026);
      expect(toEndYear('2026-27')).toBe(2027);
    });

    test('toSeasonKey and toEndYear are inverses', () => {
      const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
      for (const year of years) {
        const seasonKey = toSeasonKey(year);
        const roundTrip = toEndYear(seasonKey);
        expect(roundTrip).toBe(year);
      }
    });
  });

  // ==========================================================================
  // Cap Settings Season Mapping
  // ==========================================================================
  
  describe('Cap Settings Season Mapping', () => {
    test('yearToSeasonKey in capSettingsProvider matches toSeasonKey', () => {
      // These should produce identical results
      expect(yearToSeasonKey(2025)).toBe(toSeasonKey(2025));
      expect(yearToSeasonKey(2026)).toBe(toSeasonKey(2026));
      expect(yearToSeasonKey(2027)).toBe(toSeasonKey(2027));
    });

    test('getCapSettingsForYear returns valid cap settings for known years', () => {
      const result = getCapSettingsForYear(2026);
      
      // Should have core cap settings
      expect(result.salaryCap).toBeGreaterThan(0);
      expect(result.firstApron).toBeGreaterThan(result.salaryCap);
      expect(result.secondApron).toBeGreaterThan(result.firstApron);
      
      // Should have metadata
      expect(result._meta).toBeDefined();
      expect(result._meta.seasonKey).toBe('2025-26');
    });

    test('getCapSettingsForYear accepts both endYear and seasonKey format', () => {
      const fromEndYear = getCapSettingsForYear(2026);
      const fromSeasonKey = getCapSettingsForYear('2025-26');
      
      // Both should return the same cap values
      expect(fromEndYear.salaryCap).toBe(fromSeasonKey.salaryCap);
      expect(fromEndYear.firstApron).toBe(fromSeasonKey.firstApron);
      expect(fromEndYear.secondApron).toBe(fromSeasonKey.secondApron);
    });
  });

  // ==========================================================================
  // Contract Year Slice Mapping
  // ==========================================================================
  
  describe('Contract Year Slice Mapping', () => {
    const mockPlayerWithContract = {
      id: 'test-player-1',
      name: 'Test Player',
      contract: {
        salariesByYear: [
          { season: '2024-25', salary: 10000000, capHit: 10000000 },
          { season: '2025-26', salary: 12000000, capHit: 12000000 },
          { season: '2026-27', salary: 14000000, capHit: 14000000 },
        ],
      },
    };

    test('getContractYearSlice uses endYear to find correct season', () => {
      // endYear 2025 should find "2024-25" season
      const slice2025 = getContractYearSlice(mockPlayerWithContract, 2025);
      expect(slice2025?.salary).toBe(10000000);

      // endYear 2026 should find "2025-26" season
      const slice2026 = getContractYearSlice(mockPlayerWithContract, 2026);
      expect(slice2026?.salary).toBe(12000000);

      // endYear 2027 should find "2026-27" season
      const slice2027 = getContractYearSlice(mockPlayerWithContract, 2027);
      expect(slice2027?.salary).toBe(14000000);
    });

    test('getContractYearSlice returns null for years outside contract', () => {
      const slice2024 = getContractYearSlice(mockPlayerWithContract, 2024);
      expect(slice2024).toBeNull();

      const slice2028 = getContractYearSlice(mockPlayerWithContract, 2028);
      expect(slice2028).toBeNull();
    });
  });

  // ==========================================================================
  // UI Season Dropdown Integration
  // ==========================================================================
  
  describe('UI Season Dropdown Value Mapping', () => {
    /**
     * This test verifies that the season dropdown value format (endYear integer)
     * is correctly used by all downstream functions.
     * 
     * GMDashboard uses: value={currentYear} where currentYear is an integer (e.g., 2026)
     * This integer (endYear) must be consistently used for:
     * 1. Salary slice lookups
     * 2. Cap settings lookups
     * 3. Trade validator context
     */
    
    test('season dropdown value (endYear) works for all downstream functions', () => {
      const dropdownValue = 2026; // This is what GMDashboard uses
      
      // 1. Should work for season key conversion
      const seasonKey = toSeasonKey(dropdownValue);
      expect(seasonKey).toBe('2025-26');
      
      // 2. Should work for cap settings
      const capSettings = getCapSettingsForYear(dropdownValue);
      expect(capSettings._meta.seasonKey).toBe('2025-26');
      expect(capSettings.salaryCap).toBeGreaterThan(0);
      
      // 3. Should work for contract year slice
      const mockPlayer = {
        contract: {
          salariesByYear: [
            { season: '2025-26', salary: 15000000, capHit: 15000000 },
          ],
        },
      };
      const slice = getContractYearSlice(mockPlayer, dropdownValue);
      expect(slice?.salary).toBe(15000000);
    });
  });
});
