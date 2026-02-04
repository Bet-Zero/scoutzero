/**
 * FILE: src/tests/architect/dare/phaseD4_true_e2e_gate_guardrails.test.js
 * PURPOSE: Guardrail tests to prevent regression in the D4 TRUE E2E Emulator Gate.
 *          Ensures the D4 test file contains correct patterns for real E2E testing.
 * OWNERSHIP: Feature: architect/dare
 *
 * HISTORY:
 *  - 2026-02-04: Phase D4 - Created for regression prevention
 *
 * LINKS:
 *  - Master Doc: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - D4 Test: phaseD4_true_e2e_emulator_gate.emulator.test.ts
 *
 * TESTS:
 *   - D4 test file exists
 *   - D4 test imports applyWorldMutation
 *   - D4 test imports advanceSeasonInWorld
 *   - D4 test contains FIRESTORE_EMULATOR_HOST check
 *   - D4 test reloads data from emulator (not just writes)
 *   - Package.json has ci:phaseD4-dare-emulator-gate script
 *   - vitest.emulator.config.js exists and aliases firebaseConfig
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// File Paths
// ============================================================================

const D4_TEST_PATH = path.resolve(
  __dirname,
  'phaseD4_true_e2e_emulator_gate.emulator.test.ts'
);
const VITEST_EMULATOR_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../vitest.emulator.config.js'
);
const FIREBASE_EMULATOR_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../scripts/ci/firebaseEmulatorConfig.ts'
);
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../../../package.json');

// ============================================================================
// Load Files
// ============================================================================

const d4TestContent = fs.existsSync(D4_TEST_PATH)
  ? fs.readFileSync(D4_TEST_PATH, 'utf-8')
  : '';

const vitestEmulatorConfigContent = fs.existsSync(VITEST_EMULATOR_CONFIG_PATH)
  ? fs.readFileSync(VITEST_EMULATOR_CONFIG_PATH, 'utf-8')
  : '';

const firebaseEmulatorConfigContent = fs.existsSync(FIREBASE_EMULATOR_CONFIG_PATH)
  ? fs.readFileSync(FIREBASE_EMULATOR_CONFIG_PATH, 'utf-8')
  : '';

const packageJsonContent = fs.existsSync(PACKAGE_JSON_PATH)
  ? fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  : '';

// ============================================================================
// Tests
// ============================================================================

describe('Phase D4: TRUE E2E Emulator Gate Guardrails', () => {
  describe('A) Test File Existence', () => {
    it('TEST 1: D4 emulator test file exists', () => {
      expect(fs.existsSync(D4_TEST_PATH)).toBe(true);
    });

    it('TEST 2: vitest.emulator.config.js exists', () => {
      expect(fs.existsSync(VITEST_EMULATOR_CONFIG_PATH)).toBe(true);
    });

    it('TEST 3: firebaseEmulatorConfig.ts exists', () => {
      expect(fs.existsSync(FIREBASE_EMULATOR_CONFIG_PATH)).toBe(true);
    });
  });

  describe('B) Real Entrypoint Imports', () => {
    it('TEST 4: D4 test imports applyWorldMutation', () => {
      expect(d4TestContent).toMatch(/import.*applyWorldMutation/);
    });

    it('TEST 5: D4 test imports advanceSeasonInWorld', () => {
      expect(d4TestContent).toMatch(/import.*advanceSeasonInWorld/);
    });

    it('TEST 6: D4 test imports db from @/firebaseConfig', () => {
      expect(d4TestContent).toMatch(/import.*\{.*db.*\}.*from.*['"]@\/firebaseConfig['"]/);
    });
  });

  describe('C) Real Entrypoint Calls', () => {
    it('TEST 7: D4 test calls applyWorldMutation with mutationType: executeTrade', () => {
      expect(d4TestContent).toMatch(/applyWorldMutation\s*\(/);
      expect(d4TestContent).toMatch(/mutationType:\s*['"]executeTrade['"]/);
    });

    it('TEST 8: D4 test calls advanceSeasonInWorld', () => {
      expect(d4TestContent).toMatch(/advanceSeasonInWorld\s*\(/);
    });
  });

  describe('D) Emulator Safety', () => {
    it('TEST 9: D4 test checks FIRESTORE_EMULATOR_HOST', () => {
      expect(d4TestContent).toMatch(/FIRESTORE_EMULATOR_HOST/);
    });

    it('TEST 10: firebaseEmulatorConfig refuses to run without emulator', () => {
      expect(firebaseEmulatorConfigContent).toMatch(/FIRESTORE_EMULATOR_HOST/);
      expect(firebaseEmulatorConfigContent).toMatch(/throw.*Error/);
    });

    it('TEST 11: vitest.emulator.config.js aliases @/firebaseConfig to emulator config', () => {
      expect(vitestEmulatorConfigContent).toMatch(/@\/firebaseConfig/);
      expect(vitestEmulatorConfigContent).toMatch(/firebaseEmulatorConfig/);
    });
  });

  describe('E) Persistence Verification (What D4 Proves That D3 Didn\'t)', () => {
    it('TEST 12: D4 test reloads teams after trade (not just writes)', () => {
      expect(d4TestContent).toMatch(/reloadTeam/);
      // Must reload AFTER applyWorldMutation to verify persistence
      const applyIndex = d4TestContent.indexOf('applyWorldMutation');
      const reloadIndex = d4TestContent.lastIndexOf('reloadTeam');
      expect(reloadIndex).toBeGreaterThan(applyIndex);
    });

    it('TEST 13: D4 test reloads entitlements after DARE (not just writes)', () => {
      expect(d4TestContent).toMatch(/reloadWorldEntitlement/);
      // Must reload AFTER advanceSeasonInWorld to verify DARE persistence
      const advanceIndex = d4TestContent.indexOf('advanceSeasonInWorld');
      const reloadEntIndex = d4TestContent.lastIndexOf('reloadWorldEntitlement');
      expect(reloadEntIndex).toBeGreaterThan(advanceIndex);
    });

    it('TEST 14: D4 test verifies resolved=true via reload', () => {
      expect(d4TestContent).toMatch(/resolved.*===.*true|resolved.*toBe.*true/);
    });

    it('TEST 15: D4 test verifies resolvedAt timestamp exists', () => {
      expect(d4TestContent).toMatch(/resolvedAt/);
    });
  });

  describe('F) CI Configuration', () => {
    it('TEST 16: package.json has ci:phaseD4-dare-emulator-gate script', () => {
      expect(packageJsonContent).toMatch(/ci:phaseD4-dare-emulator-gate/);
    });

    it('TEST 17: D4 CI script uses vitest.emulator.config.js', () => {
      expect(packageJsonContent).toMatch(
        /ci:phaseD4-dare-emulator-gate.*vitest\.emulator\.config\.js/
      );
    });

    it('TEST 18: D4 CI script targets the emulator test file', () => {
      expect(packageJsonContent).toMatch(
        /ci:phaseD4-dare-emulator-gate.*phaseD4_true_e2e_emulator_gate\.emulator\.test\.ts/
      );
    });
  });

  describe('G) No Simulation Markers (Regression Prevention)', () => {
    it('TEST 19: D4 test does NOT contain simulateTrade function', () => {
      expect(d4TestContent).not.toMatch(/function\s+simulateTrade/);
    });

    it('TEST 20: D4 test does NOT contain simulateDAREResolution function', () => {
      expect(d4TestContent).not.toMatch(/function\s+simulateDAREResolution/);
    });

    it('TEST 21: vitest.emulator.config.js does NOT include setupFirebaseMocks in setupFiles', () => {
      // The vitest.emulator.config.js setupFiles should NOT include setupFirebaseMocks.js
      // It's okay to mention it in comments, but it must not be in the actual setupFiles array
      expect(vitestEmulatorConfigContent).toMatch(/setupFiles.*setupDebug/);
      // Ensure the actual setupFiles doesn't include firebase mocks (only debug)
      const setupFilesMatch = vitestEmulatorConfigContent.match(/setupFiles:\s*\[([^\]]+)\]/);
      if (setupFilesMatch) {
        expect(setupFilesMatch[1]).not.toMatch(/setupFirebaseMocks\.js/);
      }
    });
  });
});
