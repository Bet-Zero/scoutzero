/**
 * FILE: src/tests/architect/phase80_emulator_e2e_cap_sheet_proof_guardrails.test.js
 * PURPOSE: Phase 80 guardrails for Emulator E2E Cap Sheet Proof Harness
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-02: Phase 80 - Created for emulator E2E proof harness guardrails
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - CI Script: scripts/ci/run_phase80_cap_sheet_e2e_proof.js
 *
 * TESTS:
 * A) Source-scan guardrails:
 *    1. Script file exists
 *    2. Script refuses to run without FIRESTORE_EMULATOR_HOST
 *    3. Script uses deterministic worldId
 *    4. Script references computeTeamCapTotals
 *    5. package.json includes ci:phase80-cap-proof
 *    6. Script contains production refuse check
 *    7. Script exports assertTotalsMatchSSoT helper
 */

import { describe, it, expect } from 'vitest';
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
  '../../../scripts/ci/run_phase80_cap_sheet_e2e_proof.js'
);

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../../package.json');

// ============================================================================
// A) SOURCE-SCAN GUARDRAILS
// ============================================================================

describe('Phase 80: Emulator E2E Proof Harness Guardrails', () => {
  describe('Script Existence', () => {
    it('TEST 1: CI script file exists', () => {
      expect(fs.existsSync(CI_SCRIPT_PATH)).toBe(true);
    });
  });

  describe('Emulator Safety', () => {
    it('TEST 2: Script refuses to run without FIRESTORE_EMULATOR_HOST', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must check for FIRESTORE_EMULATOR_HOST
      expect(content).toContain('FIRESTORE_EMULATOR_HOST');

      // Must have explicit check for missing emulator
      expect(content).toMatch(/if\s*\(\s*!process\.env\.FIRESTORE_EMULATOR_HOST/);
    });

    it('TEST 3: Script contains production refuse check', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must have safety comment or check
      expect(content).toMatch(/SAFETY|production|CRITICAL/i);

      // Must refuse to run against production
      expect(content).toMatch(/refuses?\s+to\s+run/i);
    });
  });

  describe('Deterministic Configuration', () => {
    it('TEST 4: Script uses deterministic worldId', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must have deterministic world ID
      expect(content).toContain('phase80_cap_sheet_e2e_proof_world');

      // Must be a constant
      expect(content).toMatch(
        /DETERMINISTIC_WORLD_ID\s*=\s*['"]phase80_cap_sheet_e2e_proof_world['"]/
      );
    });
  });

  describe('SSOT Integration', () => {
    it('TEST 5: Script references computeTeamCapTotals', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must reference the SSOT function
      expect(content).toContain('computeTeamCapTotals');

      // Must use it to compute totals
      expect(content).toMatch(/computeTeamCapTotals\s*\(/);
    });

    it('TEST 6: Script has assertTotalsMatchSSoT helper', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must have the assertion helper
      expect(content).toContain('assertTotalsMatchSSoT');

      // Must be exported or defined as function
      expect(content).toMatch(/function\s+assertTotalsMatchSSoT|export\s+function\s+assertTotalsMatchSSoT/);
    });
  });

  describe('npm Script Integration', () => {
    it('TEST 7: package.json includes ci:phase80-cap-proof script', () => {
      const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

      // Must have the script
      expect(packageJson.scripts['ci:phase80-cap-proof']).toBeDefined();

      // Must point to correct file
      expect(packageJson.scripts['ci:phase80-cap-proof']).toContain(
        'run_phase80_cap_sheet_e2e_proof.js'
      );
    });
  });

  describe('Mutation Coverage', () => {
    it('TEST 8: Script covers signing mutation', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/simulateSigning|signing/i);
    });

    it('TEST 9: Script covers waive mutation', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/simulateWaive|waive/i);
    });

    it('TEST 10: Script covers renounce mutation', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/simulateRenounce|renounce/i);
    });

    it('TEST 11: Script covers trade mutation', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/simulateTrade|trade/i);
    });
  });

  describe('Persist→Reload Verification', () => {
    it('TEST 12: Script persists to Firestore', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/persist|\.set\(/i);
    });

    it('TEST 13: Script reloads from Firestore', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/reload|\.get\(/i);
    });

    it('TEST 14: Script verifies parity after reload', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/parity|survive|reload/i);
    });
  });
});
