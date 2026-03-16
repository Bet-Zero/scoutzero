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
    const capImpactTilesAuthorityPath = path.resolve(
      __dirname,
      '../../features/architect/tradeMachine/CapImpactTiles.tsx'
    );
    const capImpactTilesShimPath = path.resolve(
      __dirname,
      '../../features/architect/tradeMachine/CapImpactTiles.jsx'
    );

    it('CapImpactTiles.tsx uses useMemo', () => {
      const content = fs.readFileSync(capImpactTilesAuthorityPath, 'utf-8');
      expect(content).toContain('useMemo');
    });

    it('CapImpactTiles.tsx imports useMemo from React', () => {
      const content = fs.readFileSync(capImpactTilesAuthorityPath, 'utf-8');
      expect(content).toMatch(/import\s+.*useMemo.*from\s+['"]react['"]/);
    });

    it('CapImpactTiles.tsx imports computeTeamCapTotals', () => {
      const content = fs.readFileSync(capImpactTilesAuthorityPath, 'utf-8');
      expect(content).toContain('computeTeamCapTotals');
    });

    it('CapImpactTiles.tsx memoizes baselineTotals with correct deps', () => {
      const content = fs.readFileSync(capImpactTilesAuthorityPath, 'utf-8');
      expect(content).toContain('computeTeamCapTotals(');
      expect(content).toMatch(/\[team,\s*yearKey\]/);
    });

    it('CapImpactTiles.tsx memoizes hardCapStatus', () => {
      const content = fs.readFileSync(capImpactTilesAuthorityPath, 'utf-8');
      expect(content).toMatch(/hardCapStatus\s*=\s*useMemo/);
    });

    it('CapImpactTiles.tsx memoizes salaryIn/salaryOut', () => {
      const content = fs.readFileSync(capImpactTilesAuthorityPath, 'utf-8');
      expect(content).toMatch(/\{\s*salaryOut,\s*salaryIn\s*\}\s*=\s*useMemo/);
    });

    it('CapImpactTiles.jsx remains a shim-only compatibility surface', () => {
      const content = fs.readFileSync(capImpactTilesShimPath, 'utf-8').trim();
      expect(content).toBe("export { default } from './CapImpactTiles.tsx';");
    });
  });

  describe('Source scan: warnOnTotalsDivergence', () => {
    const computeCapTotalsTsPath = path.resolve(
      __dirname,
      '../../features/architect/utils/capTotals/computeTeamCapTotals.ts'
    );
    const computeCapTotalsJsPath = path.resolve(
      __dirname,
      '../../features/architect/utils/capTotals/computeTeamCapTotals.js'
    );

    it('computeTeamCapTotals.ts contains DEV gate in warnOnTotalsDivergence', () => {
      const content = fs.readFileSync(computeCapTotalsTsPath, 'utf-8');
      expect(content).toContain('import.meta.env.DEV');
    });

    it('computeTeamCapTotals.ts contains rate-limit mechanism (warnedKeys)', () => {
      const content = fs.readFileSync(computeCapTotalsTsPath, 'utf-8');
      expect(content).toContain('warnedKeys');
      expect(content).toMatch(/warnedKeys\s*=\s*new\s+Set(?:<[^>]+>)?\(\)/);
    });

    it('computeTeamCapTotals.ts exports resetWarnedKeys', () => {
      const content = fs.readFileSync(computeCapTotalsTsPath, 'utf-8');
      expect(content).toContain('export function resetWarnedKeys');
    });

    it('computeTeamCapTotals.js remains a pure compatibility shim', () => {
      const content = fs.readFileSync(computeCapTotalsJsPath, 'utf-8');
      expect(content).toContain("export * from './computeTeamCapTotals.ts';");
      expect(content).toContain(
        "export { default } from './computeTeamCapTotals.ts';"
      );
      expect(content).not.toContain('import.meta.env.DEV');
      expect(content).not.toContain('warnedKeys');
    });
  });

  describe('Source scan: TradeTeamCard drift detection', () => {
    const tradeTeamCardPath = path.resolve(
      __dirname,
      '../../features/architect/tradeMachine/TradeTeamCard.tsx'
    );
    const tradeTeamCardShimPath = path.resolve(
      __dirname,
      '../../features/architect/tradeMachine/TradeTeamCard.jsx'
    );

    it('TradeTeamCard.jsx is absent after the E113 shim deletion batch', () => {
      expect(fs.existsSync(tradeTeamCardShimPath)).toBe(false);
    });

    it('TradeTeamCard.tsx imports warnOnTotalsDivergence', () => {
      const content = fs.readFileSync(tradeTeamCardPath, 'utf-8');
      expect(content).toContain('warnOnTotalsDivergence');
    });

    it('TradeTeamCard.tsx calls warnOnTotalsDivergence for outgoingSalary', () => {
      const content = fs.readFileSync(tradeTeamCardPath, 'utf-8');
      expect(content).toMatch(
        /warnOnTotalsDivergence\(\s*['"]TradeTeamCard['"]\s*,\s*['"]outgoingSalary['"]/
      );
    });

    it('TradeTeamCard.tsx calls warnOnTotalsDivergence for incomingSalary', () => {
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
