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
 *   - D4 compares the complete persisted world after rejected default actions
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

const firebaseEmulatorConfigContent = fs.existsSync(
  FIREBASE_EMULATOR_CONFIG_PATH
)
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
      expect(d4TestContent).toMatch(
        /import.*\{.*db.*\}.*from.*['"]@\/firebaseConfig['"]/
      );
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

  describe('E) Default first-round no-write verification', () => {
    it('TEST 12: compares the complete persisted world after the real trade call', () => {
      expect(d4TestContent).toContain('async function savedWorld()');
      expect(d4TestContent).toContain('ref.listCollections()');
      expect(d4TestContent).toContain('await visit(child.ref)');
      expect(d4TestContent).toContain('const before = await savedWorld()');
      expect(d4TestContent).toContain('expect(await savedWorld()).toEqual(before)');
      expect(d4TestContent.lastIndexOf('await savedWorld()')).toBeGreaterThan(
        d4TestContent.indexOf('await applyWorldMutation(')
      );
    });

    it('TEST 13: rejects an unqualified season transition and verifies no writes', () => {
      const start = d4TestContent.indexOf("it('does not infer a season transition");
      const end = d4TestContent.indexOf("it('keeps direct client", start);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      const transition = d4TestContent.slice(start, end);
      expect(transition).toContain('await advanceSeasonInWorld(');
      expect(transition).toContain('expect(result.success).toBe(false)');
      expect(transition).toContain('expect(await savedWorld()).toEqual(before)');
    });

    it('TEST 14: distinguishes the default first-round rejection and repeats it', () => {
      expect(d4TestContent).toContain("['d4-first', 'd4-retry']");
      expect(d4TestContent).toContain('expect(result.success).toBe(false)');
      expect(d4TestContent).toContain('JSON.stringify(result.violations)');
      expect(d4TestContent).toContain('/Stepien|governedDraftHistory/');
    });

    it('TEST 15: rejects copied metadata as permission with unchanged persisted state', () => {
      const start = d4TestContent.indexOf("it('rejects copied review metadata");
      const end = d4TestContent.indexOf("it('does not infer", start);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      const forged = d4TestContent.slice(start, end);
      expect(forged).toContain('draftReviewAuthority: { ...source.reviews[0], eligible: true }');
      expect(forged).toContain('Unrecognized or unavailable draft review permission');
      expect(forged).toContain('expect(await savedWorld()).toEqual(before)');
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
      // The vitest.emulator.config.js setupFiles should NOT include setupFirebaseMocks.ts
      // It's okay to mention it in comments, but it must not be in the actual setupFiles array
      expect(vitestEmulatorConfigContent).toMatch(/setupFiles.*setupDebug/);
      // Ensure the actual setupFiles doesn't include firebase mocks (only debug)
      const setupFilesMatch = vitestEmulatorConfigContent.match(
        /setupFiles:\s*\[([^\]]+)\]/
      );
      if (setupFilesMatch) {
        expect(setupFilesMatch[1]).not.toMatch(/setupFirebaseMocks\.js/);
      }
    });
  });
});
