/**
 * FILE: src/tests/architect/dare/phaseD2_true_e2e_trade_to_advance_gate.test.js
 * PURPOSE: Guardrail tests for Phase D2 TRUE E2E Trade → DARE Gate.
 *          Verifies the CI script exists and contains required patterns.
 * OWNERSHIP: Feature: architect/dare
 *
 * HISTORY:
 *  - 2026-02-04: Phase D2 - Created for TRUE E2E entitlement lifecycle verification
 *
 * LINKS:
 *  - Master Doc: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *  - CI Script: scripts/ci/run_phaseD2_true_e2e_trade_to_advance_gate.js
 *
 * TESTS:
 * A) Source-scan guardrails:
 *    1. Script file exists
 *    2. Script refuses to run without FIRESTORE_EMULATOR_HOST
 *    3. Script uses deterministic worldId
 *    4. Script contains 2-team trade test (D2.1A)
 *    5. Script contains 3-team routing test (D2.1B)
 *    6. Script contains DARE resolution test (D2.1C)
 *    7. Script contains SSOT reload test (D2.1D)
 *    8. Script verifies B5 invariant (no duplicate entitlements)
 *    9. package.json includes ci:phaseD2-dare-gate script
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
  '../../../../scripts/ci/run_phaseD2_true_e2e_trade_to_advance_gate.js'
);

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../../../package.json');

// ============================================================================
// A) SOURCE-SCAN GUARDRAILS
// ============================================================================

describe('Phase D2: TRUE E2E Trade → DARE Gate Guardrails', () => {
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
      expect(content).toMatch(
        /if\s*\(\s*!process\.env\.FIRESTORE_EMULATOR_HOST/
      );
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
      expect(content).toContain('phaseD2_true_e2e_dare_gate_world');

      // Must be a constant
      expect(content).toMatch(
        /DETERMINISTIC_WORLD_ID\s*=\s*['"]phaseD2_true_e2e_dare_gate_world['"]/
      );
    });
  });

  describe('Test Coverage - D2.1A through D2.1D', () => {
    it('TEST 5: Script contains 2-team trade test (D2.1A)', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must reference D2.1A
      expect(content).toMatch(/D2\.1A|2-Team Trade/i);

      // Must test entitlement transfer
      expect(content).toContain('simulateTrade2Team');
    });

    it('TEST 6: Script contains 3-team routing test (D2.1B)', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must reference D2.1B
      expect(content).toMatch(/D2\.1B|3-Team/i);

      // Must test explicit routing (not broadcast)
      expect(content).toContain('simulateTrade3TeamRouted');
    });

    it('TEST 7: Script contains DARE resolution test (D2.1C)', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must reference D2.1C
      expect(content).toMatch(/D2\.1C|DARE|Season Advance/i);

      // Must resolve and persist
      expect(content).toContain('simulateDAREResolution');
      expect(content).toMatch(/resolved\s*=\s*true/);
    });

    it('TEST 8: Script contains SSOT reload test (D2.1D)', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must reference D2.1D
      expect(content).toMatch(/D2\.1D|SSOT|View|Reload/i);

      // Must reload and verify
      expect(content).toContain('reloadTeam');
      expect(content).toMatch(/Final\s*BOS|Final\s*LAL|Final\s*MIA/);
    });
  });

  describe('Invariant Verification', () => {
    it('TEST 9: Script verifies B5 invariant (no duplicate entitlements)', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');

      // Must check for duplicates
      expect(content).toMatch(/B5\s*Invariant|duplicate|uniqueEntIds/i);

      // Must have Set-based uniqueness check
      expect(content).toContain('new Set(');
    });
  });

  describe('Entitlement Kind Coverage', () => {
    it('TEST 10: Script tests pick_ownership entitlements', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toContain('pick_ownership');
      expect(content).toContain('createPickOwnershipEntitlement');
    });

    it('TEST 11: Script tests swap_right entitlements', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toContain('swap_right');
      expect(content).toContain('createSwapRightEntitlement');
    });
  });

  describe('DARE Resolution Verification', () => {
    it('TEST 12: Script verifies swap resolution outcome', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/swap_exercised|swap_declined/);
      expect(content).toContain('resolvedOutcome');
    });

    it('TEST 13: Script verifies resolved=true persistence', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toMatch(/resolved.*===.*true/);
      expect(content).toContain('resolvedAt');
    });
  });

  describe('npm Script Integration', () => {
    it('TEST 14: package.json includes ci:phaseD2-dare-gate script', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')
      );

      // Must have the script
      expect(packageJson.scripts['ci:phaseD2-dare-gate']).toBeDefined();

      // Must point to correct file
      expect(packageJson.scripts['ci:phaseD2-dare-gate']).toContain(
        'run_phaseD2_true_e2e_trade_to_advance_gate.js'
      );
    });
  });

  describe('Persist → Reload Pattern', () => {
    it('TEST 15: Script persists teams to Firestore', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toContain('persistTeam');
      expect(content).toMatch(/\.set\(/);
    });

    it('TEST 16: Script persists entitlements to Firestore', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toContain('persistWorldEntitlement');
      expect(content).toContain('persistBaseEntitlement');
    });

    it('TEST 17: Script reloads from Firestore', () => {
      const content = fs.readFileSync(CI_SCRIPT_PATH, 'utf8');
      expect(content).toContain('reloadTeam');
      expect(content).toContain('reloadWorldEntitlement');
      expect(content).toMatch(/\.get\(/);
    });
  });
});
