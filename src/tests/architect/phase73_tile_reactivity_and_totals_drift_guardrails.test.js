/**
 * FILE: src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js
 * PURPOSE: Guardrail tests for Phase 73 - Tile Reactivity Hardening + Totals Drift Guardrails
 *
 * TESTS:
 *   - Source scan: CapImpactTiles memoization
 *   - Source scan: warnOnTotalsDivergence rate-limiting
 *   - Behavioral: warnOnTotalsDivergence function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import the functions under test
import {
  warnOnTotalsDivergence,
  resetWarnedKeys,
} from '@/features/architect/utils/capTotals';

describe('Phase 73 Tile Reactivity and Totals Drift Guardrails', () => {
  // ==========================================================================
  // SOURCE SCAN TESTS
  // ==========================================================================

  describe('Source scan: CapImpactTiles memoization', () => {
    const capImpactTilesPath = path.resolve(
      __dirname,
      '../../features/architect/tradeMachine/CapImpactTiles.jsx'
    );

    it('CapImpactTiles.jsx uses useMemo', () => {
      const content = fs.readFileSync(capImpactTilesPath, 'utf-8');
      expect(content).toContain('useMemo');
    });

    it('CapImpactTiles.jsx imports useMemo from React', () => {
      const content = fs.readFileSync(capImpactTilesPath, 'utf-8');
      expect(content).toMatch(/import\s+.*useMemo.*from\s+['"]react['"]/);
    });

    it('CapImpactTiles.jsx imports computeTeamCapTotals', () => {
      const content = fs.readFileSync(capImpactTilesPath, 'utf-8');
      expect(content).toContain('computeTeamCapTotals');
    });

    it('CapImpactTiles.jsx memoizes baselineTotals with correct deps', () => {
      const content = fs.readFileSync(capImpactTilesPath, 'utf-8');
      // Check for useMemo with computeTeamCapTotals and [team, yearKey] deps
      expect(content).toMatch(
        /useMemo\(\s*\(\)\s*=>\s*computeTeamCapTotals\(team,\s*yearKey\)/
      );
      expect(content).toMatch(/\[team,\s*yearKey\]/);
    });

    it('CapImpactTiles.jsx memoizes hardCapStatus', () => {
      const content = fs.readFileSync(capImpactTilesPath, 'utf-8');
      expect(content).toMatch(/hardCapStatus\s*=\s*useMemo/);
    });

    it('CapImpactTiles.jsx memoizes salaryIn/salaryOut', () => {
      const content = fs.readFileSync(capImpactTilesPath, 'utf-8');
      expect(content).toMatch(/\{\s*salaryOut,\s*salaryIn\s*\}\s*=\s*useMemo/);
    });
  });

  describe('Source scan: warnOnTotalsDivergence', () => {
    const computeCapTotalsPath = path.resolve(
      __dirname,
      '../../features/architect/utils/capTotals/computeTeamCapTotals.js'
    );

    it('computeTeamCapTotals.js contains DEV gate in warnOnTotalsDivergence', () => {
      const content = fs.readFileSync(computeCapTotalsPath, 'utf-8');
      expect(content).toContain('import.meta.env.DEV');
    });

    it('computeTeamCapTotals.js contains rate-limit mechanism (warnedKeys)', () => {
      const content = fs.readFileSync(computeCapTotalsPath, 'utf-8');
      expect(content).toContain('warnedKeys');
      expect(content).toMatch(/warnedKeys\s*=\s*new\s+Set\(\)/);
    });

    it('computeTeamCapTotals.js exports resetWarnedKeys', () => {
      const content = fs.readFileSync(computeCapTotalsPath, 'utf-8');
      expect(content).toContain('export function resetWarnedKeys');
    });
  });

  describe('Source scan: TradeTeamCard drift detection', () => {
    const tradeTeamCardPath = path.resolve(
      __dirname,
      '../../features/architect/tradeMachine/TradeTeamCard.jsx'
    );

    it('TradeTeamCard.jsx imports warnOnTotalsDivergence', () => {
      const content = fs.readFileSync(tradeTeamCardPath, 'utf-8');
      expect(content).toContain('warnOnTotalsDivergence');
    });

    it('TradeTeamCard.jsx calls warnOnTotalsDivergence for outgoingSalary', () => {
      const content = fs.readFileSync(tradeTeamCardPath, 'utf-8');
      expect(content).toMatch(
        /warnOnTotalsDivergence\(\s*['"]TradeTeamCard['"]\s*,\s*['"]outgoingSalary['"]/
      );
    });

    it('TradeTeamCard.jsx calls warnOnTotalsDivergence for incomingSalary', () => {
      const content = fs.readFileSync(tradeTeamCardPath, 'utf-8');
      expect(content).toMatch(
        /warnOnTotalsDivergence\(\s*['"]TradeTeamCard['"]\s*,\s*['"]incomingSalary['"]/
      );
    });
  });

  // ==========================================================================
  // BEHAVIORAL TESTS
  // ==========================================================================

  describe('Behavioral: warnOnTotalsDivergence', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      // Reset warned keys before each test
      resetWarnedKeys();
      // Spy on console.warn
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('does NOT warn when values match exactly', () => {
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 100, 1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('does NOT warn when difference is within tolerance', () => {
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 101, 1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('DOES warn when values diverge beyond tolerance', () => {
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 105, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('TOTALS DIVERGENCE DETECTED'),
        expect.objectContaining({
          displayedValue: 100,
          canonicalValue: 105,
          diff: 5,
        })
      );
    });

    it('only warns once per unique key (rate limiting)', () => {
      // First call should warn
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 200, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Second call with same component:field should NOT warn
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 300, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Different field should warn
      warnOnTotalsDivergence('TestComponent', 'otherField', 100, 200, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

      // Different component should warn
      warnOnTotalsDivergence('OtherComponent', 'testField', 100, 200, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('resetWarnedKeys allows same key to warn again', () => {
      // First call should warn
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 200, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Reset cache
      resetWarnedKeys();

      // Same key should warn again after reset
      warnOnTotalsDivergence('TestComponent', 'testField', 100, 200, 1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('respects custom tolerance values', () => {
      // With tolerance of 10, diff of 5 should NOT warn
      warnOnTotalsDivergence('TestComponent', 'field1', 100, 105, 10);
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // With tolerance of 10, diff of 15 SHOULD warn
      warnOnTotalsDivergence('TestComponent', 'field2', 100, 115, 10);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
