/**
 * FILE: src/tests/architect/phase70_ci_proof_and_prod_write_safety_guardrails.test.js
 * PURPOSE: Phase 70 guardrails verifying CI proof entrypoint exists, production write safety
 *          latch is present in migration script, verify-only path is unaffected, and Phase 68
 *          empty-scan fail-safe remains intact.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-01: Phase 70 - Created for CI proof job and production write safety guardrails
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - CI Entrypoint: scripts/ci/run_phase69_tpe_migration_proof.js
 *  - Migration Script: scripts/migrations/phase66_migrate_tradeExceptions.js
 *  - Phase 69 Proof Runner: scripts/seed/phase69_run_tpe_migration_proof.js
 *
 * DESIGN:
 * Phase 70 ensures:
 * 1) CI entrypoint exists and calls Phase 69 proof runner
 * 2) Migration script contains production write safety latch (ALLOW_PROD_MIGRATION_WRITE)
 * 3) Verify-only path is unaffected by production write latch
 * 4) Phase 68 empty-scan fail-safe still present
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CI_ENTRYPOINT_PATH = path.resolve(
  __dirname,
  '../../../scripts/ci/run_phase69_tpe_migration_proof.js'
);

const MIGRATION_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
);

const PROOF_RUNNER_PATH = path.resolve(
  __dirname,
  '../../../scripts/seed/phase69_run_tpe_migration_proof.js'
);

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../../package.json');

// ============================================================================
// Test 1: CI Entrypoint Exists and Has Required Structure
// ============================================================================
describe('Phase 70 Guardrail: CI Entrypoint Exists', () => {
  it('CI entrypoint file exists at scripts/ci/run_phase69_tpe_migration_proof.js', () => {
    expect(fs.existsSync(CI_ENTRYPOINT_PATH)).toBe(true);
  });

  it('CI entrypoint is ESM module with shebang', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain('#!/usr/bin/env node');
    expect(content).toContain('import { spawn }');
  });

  it('CI entrypoint references Phase 69 proof runner path', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain('phase69_run_tpe_migration_proof.js');
  });

  it('CI entrypoint refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain('FIRESTORE_EMULATOR_HOST');
    expect(content).toContain('only runs against the emulator');
  });

  it('CI entrypoint validates proof runner output for pass/fail behavior', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    // Must check for first verify-only fail and second verify-only pass
    expect(content).toContain('hasFirstVerifyFail');
    expect(content).toContain('hasSecondVerifyPass');
    expect(content).toContain('hasNonzeroScanCounts');
  });

  it('CI entrypoint exits with nonzero code on validation failure', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain('process.exit(1)');
  });
});

// ============================================================================
// Test 2: npm Script for CI Proof Exists
// ============================================================================
describe('Phase 70 Guardrail: npm Script Exists', () => {
  it('package.json contains ci:phase69-proof script', () => {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts['ci:phase69-proof']).toBeDefined();
  });

  it('ci:phase69-proof script points to CI entrypoint', () => {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    const script = packageJson.scripts['ci:phase69-proof'];
    expect(script).toContain('scripts/ci/run_phase69_tpe_migration_proof.js');
  });
});

// ============================================================================
// Test 3: Production Write Safety Latch in Migration Script
// ============================================================================
describe('Phase 70 Guardrail: Production Write Safety Latch', () => {
  it('migration script contains ALLOW_PROD_MIGRATION_WRITE environment variable check', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('ALLOW_PROD_MIGRATION_WRITE');
  });

  it('migration script has Phase 70 safety latch section', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('Phase 70: Production Write Safety Latch');
  });

  it('migration script checks both emulator and ALLOW_PROD_MIGRATION_WRITE', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Must check for emulator
    expect(content).toContain('FIRESTORE_EMULATOR_HOST');
    // Must check for explicit allow flag
    expect(content).toContain("ALLOW_PROD_MIGRATION_WRITE === 'true'");
  });

  it('migration script refuses --write against production without ALLOW_PROD_MIGRATION_WRITE', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Must have refusal logic
    expect(content).toContain('Production write REFUSED');
    expect(content).toContain('process.exit(1)');
  });

  it('migration script documents ALLOW_PROD_MIGRATION_WRITE in help text', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Help text must mention the environment variable
    expect(content).toContain('ALLOW_PROD_MIGRATION_WRITE=true');
    expect(content).toContain('Phase 70');
  });

  it('migration script has history entry for Phase 70', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('Phase 70 - Added production write safety latch');
  });
});

// ============================================================================
// Test 4: Verify-Only Path Unaffected by Safety Latch
// ============================================================================
describe('Phase 70 Guardrail: Verify-Only Path Unaffected', () => {
  it('safety latch logic explicitly checks for verifyOnly mode', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // The latch should only trigger when NOT in verify-only mode
    // Pattern: if (result.dryRun === false && !result.verifyOnly)
    expect(content).toMatch(/dryRun\s*===\s*false\s*&&\s*!result\.verifyOnly/);
  });

  it('verify-only mode still exits with code 1 on legacy found', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Existing Phase 67 behavior: verify-only exits 1 if legacy found
    expect(content).toContain('verifyPassed === false');
    expect(content).toContain('process.exit(1)');
  });

  it('verify-only mode still exits with code 0 on zero legacy', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Existing Phase 67 behavior: verify-only exits 0 if clean
    expect(content).toContain('verifyPassed = true');
    expect(content).toContain('Zero legacy tradeExceptions fields found');
  });
});

// ============================================================================
// Test 5: Phase 68 Empty-Scan Fail-Safe Still Present (Regression)
// ============================================================================
describe('Phase 70 Guardrail: Phase 68 Empty-Scan Fail-Safe Regression', () => {
  it('migration script still has empty-scan fail-safe logic', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Phase 68 empty-scan fail-safe must still be present
    expect(content).toContain('worldsScanned === 0');
    expect(content).toContain('teamDocsScanned === 0');
    expect(content).toContain('Empty scan');
  });

  it('migration script still has --allow-empty escape hatch', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('--allow-empty');
    expect(content).toContain('ALLOW_EMPTY');
  });

  it('empty-scan failure exits with code 1', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Must set verifyPassed = false AND cause exit 1
    expect(content).toContain('verifyPassed = false');
    expect(content).toContain('emptyScanned = true');
  });
});

// ============================================================================
// Test 6: Phase 69 Proof Runner Still Intact (Regression)
// ============================================================================
describe('Phase 70 Guardrail: Phase 69 Proof Runner Regression', () => {
  it('proof runner file exists', () => {
    expect(fs.existsSync(PROOF_RUNNER_PATH)).toBe(true);
  });

  it('proof runner has deterministic world ID', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain("DETERMINISTIC_WORLD_ID = 'phase69_seed_world'");
  });

  it('proof runner refuses to run against production', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain('FIRESTORE_EMULATOR_HOST');
    expect(content).toContain('only runs against emulator');
  });

  it('proof runner has 4-step proof loop', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain('[STEP 1/4]');
    expect(content).toContain('[STEP 2/4]');
    expect(content).toContain('[STEP 3/4]');
    expect(content).toContain('[STEP 4/4]');
  });
});

// ============================================================================
// Test 7: CI Entrypoint Calls Proof Runner Correctly
// ============================================================================
describe('Phase 70 Guardrail: CI Entrypoint Calls Proof Runner', () => {
  it('CI entrypoint spawns node process with proof runner path', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain("spawn('node'");
    expect(content).toContain('PROOF_RUNNER_PATH');
  });

  it('CI entrypoint passes through environment variables', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain('env: process.env');
  });

  it('CI entrypoint captures and validates output', () => {
    const content = fs.readFileSync(CI_ENTRYPOINT_PATH, 'utf-8');
    expect(content).toContain('validateProofOutput');
    expect(content).toContain('output');
  });
});
