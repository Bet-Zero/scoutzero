/**
 * FILE: src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.js
 * PURPOSE: Guardrail tests for Phase D3 TRUE E2E Gate.
 *          Ensures the CI script calls REAL entrypoints and contains NO simulation.
 * OWNERSHIP: Feature: architect/dare
 *
 * HISTORY:
 *  - 2026-02-04: Phase D3 - Created to prevent regression to simulation
 *
 * LINKS:
 *  - Master Doc: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - CI Script: scripts/ci/run_phaseD3_true_e2e_gate.js
 *
 * TESTS:
 * A) Script existence and safety:
 *    1. Script file exists
 *    2. Script refuses to run without FIRESTORE_EMULATOR_HOST
 *
 * B) NO SIMULATION markers (regression prevention):
 *    3. Script does NOT contain simulateTrade2Team
 *    4. Script does NOT contain simulateTrade3TeamRouted
 *    5. Script does NOT contain simulateDAREResolution
 *    6. Script does NOT contain advanceWorldMetadata (inline)
 *    7. Script does NOT directly mutate entitlementIds arrays
 *    8. Script does NOT directly write resolvedOutcome
 *
 * C) REAL entrypoint calls:
 *    9. Script imports applyWorldMutation
 *    10. Script imports advanceSeasonInWorld
 *    11. Script calls applyWorldMutation with mutationType: 'executeTrade'
 *    12. Script calls advanceSeasonInWorld
 *
 * D) Configuration:
 *    13. package.json includes ci:phaseD3-dare-gate script
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// FILE PATHS
// ============================================================================

const CI_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../scripts/ci/run_phaseD3_true_e2e_gate.js'
);

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../../../package.json');

// ============================================================================
// A) SCRIPT EXISTENCE AND SAFETY
// ============================================================================

describe('Phase D3: TRUE E2E Gate Guardrails', () => {
  describe('A) Script Existence and Safety', () => {
    it('TEST 1: CI script file exists', () => {
      expect(fs.existsSync(CI_SCRIPT_PATH)).toBe(true);
    });

    it('TEST 2: Script refuses to run without FIRESTORE_EMULATOR_HOST', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must check for FIRESTORE_EMULATOR_HOST
      expect(content).toContain('FIRESTORE_EMULATOR_HOST');

      // Must have explicit check for missing emulator
      expect(content).toMatch(
        /if\s*\(\s*!process\.env\.FIRESTORE_EMULATOR_HOST/
      );

      // Must have safety comment or check
      expect(content).toMatch(/SAFETY|production|CRITICAL/i);
    });
  });

  // ============================================================================
  // B) NO SIMULATION MARKERS - REGRESSION PREVENTION
  // ============================================================================

  describe('B) No Simulation Markers (Regression Prevention)', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
    });

    it('TEST 3: Script does NOT contain simulateTrade2Team function', () => {
      // This was the D2 simulation function - must not exist in D3
      expect(content).not.toMatch(/function\s+simulateTrade2Team/);
      expect(content).not.toMatch(/async\s+function\s+simulateTrade2Team/);
    });

    it('TEST 4: Script does NOT contain simulateTrade3TeamRouted function', () => {
      // This was the D2 3-team simulation - must not exist in D3
      expect(content).not.toMatch(/function\s+simulateTrade3TeamRouted/);
      expect(content).not.toMatch(
        /async\s+function\s+simulateTrade3TeamRouted/
      );
    });

    it('TEST 5: Script does NOT contain simulateDAREResolution function', () => {
      // This was the D2 DARE simulation - must not exist in D3
      expect(content).not.toMatch(/function\s+simulateDAREResolution/);
      expect(content).not.toMatch(/async\s+function\s+simulateDAREResolution/);
    });

    it('TEST 6: Script does NOT contain inline advanceWorldMetadata function', () => {
      // D2 had an inline advanceWorldMetadata - D3 must use real advanceSeasonInWorld
      expect(content).not.toMatch(/function\s+advanceWorldMetadata/);
      expect(content).not.toMatch(/async\s+function\s+advanceWorldMetadata/);
    });

    it('TEST 7: Script does NOT directly mutate entitlementIds arrays (simulation pattern)', () => {
      // D2 simulation pattern: directly filtering/pushing entitlementIds
      // This is a heuristic check - false positives are acceptable if they catch regressions

      // Check for simulation-style direct mutation patterns
      const simulationPatterns = [
        // Filter-and-reassign pattern from D2 simulateTrade2Team
        /fromTeam\.entitlementIds\s*=\s*\([^)]+\)\.filter/,
        /toTeam\.entitlementIds\s*=\s*\[\s*\.\.\./,
        // Direct push to entitlementIds
        /\.entitlementIds\.push\(/,
        // Direct filter assignment without going through pipeline
        /entitlementIds\s*=\s*entitlementIds\.filter/,
      ];

      simulationPatterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('TEST 8: Script does NOT directly write resolvedOutcome (DARE simulation pattern)', () => {
      // D2 simulation pattern: entitlement.resolvedOutcome = 'swap_exercised'
      // D3 must let advanceSeasonInWorld/DARE write this

      // Direct assignment to resolvedOutcome (simulation)
      expect(content).not.toMatch(/entitlement\.resolvedOutcome\s*=/);
      expect(content).not.toMatch(/\.resolvedOutcome\s*=\s*['"]conveyed['"]/);
      expect(content).not.toMatch(
        /\.resolvedOutcome\s*=\s*['"]swap_exercised['"]/
      );
      expect(content).not.toMatch(
        /\.resolvedOutcome\s*=\s*['"]swap_declined['"]/
      );
    });
  });

  // ============================================================================
  // C) REAL ENTRYPOINT CALLS
  // ============================================================================

  describe('C) Real Entrypoint Calls', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
    });

    it('TEST 9: Script imports applyWorldMutation', () => {
      // Must import the real function
      expect(content).toMatch(/applyWorldMutation/);

      // Must have an import, dynamic import, or assignment from import
      // The D3 script uses dynamic import: mutationPipeline.applyWorldMutation
      expect(content).toMatch(
        /import.*applyWorldMutation|\.applyWorldMutation|applyWorldMutation\s*=/
      );
    });

    it('TEST 10: Script imports advanceSeasonInWorld', () => {
      // Must import the real function
      expect(content).toMatch(/advanceSeasonInWorld/);

      // Must have an import, dynamic import, or assignment from import
      // The D3 script uses dynamic import: seasonManager.advanceSeasonInWorld
      expect(content).toMatch(
        /import.*advanceSeasonInWorld|\.advanceSeasonInWorld|advanceSeasonInWorld\s*=/
      );
    });

    it('TEST 11: Script calls applyWorldMutation with mutationType: executeTrade', () => {
      // Must call applyWorldMutation
      expect(content).toMatch(/applyWorldMutation\s*\(/);

      // Must pass executeTrade as mutationType
      expect(content).toMatch(/mutationType:\s*['"]executeTrade['"]/);
    });

    it('TEST 12: Script calls advanceSeasonInWorld', () => {
      // Must call the real function (not simulate)
      expect(content).toMatch(/advanceSeasonInWorld\s*\(/);

      // Should pass worldId as first argument
      expect(content).toMatch(
        /advanceSeasonInWorld\s*\(\s*(DETERMINISTIC_WORLD_ID|worldId)/
      );
    });
  });

  // ============================================================================
  // D) CONFIGURATION
  // ============================================================================

  describe('D) Configuration', () => {
    it('TEST 13: package.json includes ci:phaseD3-dare-gate script', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')
      );

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts['ci:phaseD3-dare-gate']).toBeDefined();
      // Script runs the integration test file via vitest
      expect(packageJson.scripts['ci:phaseD3-dare-gate']).toContain(
        'phaseD3_true_e2e_gate.integration.test.js'
      );
    });
  });

  // ============================================================================
  // E) QUALITY INDICATORS
  // ============================================================================

  describe('E) Quality Indicators', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
    });

    it('TEST 14: Script logs that it uses REAL entrypoints (not simulation)', () => {
      // Should explicitly state this is not simulation
      expect(content).toMatch(/REAL|real entrypoints|not simulation/i);
    });

    it('TEST 15: Script has D3.A, D3.B, D3.C test sections', () => {
      expect(content).toContain('D3.A');
      expect(content).toContain('D3.B');
      expect(content).toContain('D3.C');
    });

    it('TEST 16: Script proves what D2 did not prove', () => {
      // Should reference that this proves something D2 didn't
      expect(content).toMatch(
        /Proven|REAL.*entrypoint|not simulation|D3.*different|upgrade/i
      );
    });
  });
});
