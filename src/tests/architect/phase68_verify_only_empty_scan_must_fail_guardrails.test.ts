/**
 * FILE: src/tests/architect/phase68_verify_only_empty_scan_must_fail_guardrails.test.js
 * PURPOSE: Phase 68 guardrails verifying that verify-only mode fails on empty scans
 *          (0 worlds or 0 team docs) to make it CI-trustworthy. Also verifies --allow-empty
 *          escape hatch and scan count output.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-01: Phase 68 - Created for empty-scan fail-safe verification
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 67 Guardrails: phase67_migration_execution_guardrails.test.js
 *
 * DESIGN:
 * Phase 68 makes verify-only CI-trustworthy by:
 * 1) Failing on empty scans (0 worlds or 0 team docs) by default
 * 2) Providing --allow-empty escape hatch with loud warning
 * 3) Printing explicit environment targeting info (projectId, emulator vs prod)
 * 4) Including scan counts in verify output for proof
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
);

// ============================================================================
// Test 1: Empty-Scan Fail Logic Exists
// ============================================================================
describe('Phase 68 Guardrail: Empty-Scan Fail Logic', () => {
  it('migration script contains empty-scan fail condition (worldsScanned === 0)', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must check for zero worlds scanned
    expect(content).toContain('worldsScanned === 0');
  });

  it('migration script contains empty-scan fail condition (teamDocsScanned === 0)', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must check for zero team docs scanned
    expect(content).toContain('teamDocsScanned === 0');
  });

  it('migration script outputs VERIFY FAILED message on empty scan', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have specific empty scan failure message
    expect(content).toContain(
      '[VERIFY FAILED] Empty scan (0 worlds or 0 team docs)'
    );
  });

  it('migration script sets verifyPassed = false on empty scan', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // verifyPassed must be false when empty scan fails
    expect(content).toMatch(/worldsScanned === 0[\s\S]*verifyPassed = false/);
  });

  it('migration script sets emptyScanned = true on empty scan failure', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Should track that failure was due to empty scan
    expect(content).toContain('report.emptyScanned = true');
  });
});

// ============================================================================
// Test 2: --allow-empty Escape Hatch Exists
// ============================================================================
describe('Phase 68 Guardrail: --allow-empty Escape Hatch', () => {
  it('migration script supports --allow-empty CLI flag', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have --allow-empty as a recognized flag
    expect(content).toContain("'--allow-empty'");
  });

  it('migration script sets allowEmpty = true when --allow-empty is passed', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must set allowEmpty flag
    expect(content).toContain('result.allowEmpty = true');
  });

  it('migration script has ALLOW_EMPTY configuration variable', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have module-level ALLOW_EMPTY variable
    expect(content).toContain('let ALLOW_EMPTY =');
  });

  it('migration script bypasses empty-scan fail when ALLOW_EMPTY is true', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must check !ALLOW_EMPTY in the fail condition
    expect(content).toContain('&& !ALLOW_EMPTY');
  });

  it('migration script outputs loud warning when --allow-empty is used with empty scan', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have warning about empty scan with --allow-empty
    expect(content).toContain('[VERIFY WARNING]');
    expect(content).toContain('--allow-empty is set');
  });

  it('help text documents --allow-empty flag', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must document the escape hatch in help text
    expect(content).toContain('--allow-empty');
    expect(content).toMatch(/allow.*empty.*scan/i);
  });
});

// ============================================================================
// Test 3: Scan Counts Are Printed in Verify Output
// ============================================================================
describe('Phase 68 Guardrail: Scan Counts in Verify Output', () => {
  it('migration script outputs worlds scanned count on verification', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must output worlds scanned count
    expect(content).toContain('Worlds scanned:');
  });

  it('migration script outputs team docs scanned count on verification', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must output team docs scanned count
    expect(content).toContain('Team docs scanned:');
  });

  it('migration script outputs proof line on VERIFY PASSED', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must include scan counts in success proof
    expect(content).toContain('Proof: Scanned');
    expect(content).toMatch(/Scanned.*world.*team doc/);
  });
});

// ============================================================================
// Test 4: Explicit Environment Targeting Output
// ============================================================================
describe('Phase 68 Guardrail: Explicit Environment Targeting', () => {
  it('migration script has printEnvironmentInfo function', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have environment info printing function
    expect(content).toContain('function printEnvironmentInfo()');
  });

  it('migration script prints Project ID', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must output project ID
    expect(content).toContain('Project ID:');
  });

  it('migration script prints Emulator Host status', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must output emulator host info
    expect(content).toContain('Emulator Host:');
  });

  it('migration script prints Firestore Instance type (EMULATOR vs PRODUCTION)', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must distinguish between emulator and production
    expect(content).toContain('Firestore Instance: EMULATOR');
    expect(content).toContain('Firestore Instance: PRODUCTION');
  });

  it('migration script calls printEnvironmentInfo in runMigration', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must call the function
    expect(content).toContain('printEnvironmentInfo()');
  });
});

// ============================================================================
// Test 5: Phase 68 Header Updates
// ============================================================================
describe('Phase 68 Guardrail: Documentation Headers Updated', () => {
  it('migration script has Phase 68 history entry', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have Phase 68 in header
    expect(content).toContain('Phase 68');
    expect(content).toContain('empty-scan fail-safe');
  });

  it('migration script help text mentions CI safety', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Help text should explain CI safety
    expect(content).toContain('Phase 68 (CI safety)');
  });

  it('migration script mentions Phase 68 in markdown report', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    // Markdown generator should reference Phase 68
    expect(content).toContain('Phase 66/67/68');
  });
});

// ============================================================================
// Test 6: Phase 67 Verify-Only Logic Still Present (Regression)
// ============================================================================
describe('Phase 68 Guardrail: Phase 67 Logic Preserved (Regression)', () => {
  it('migration script still supports --verify-only CLI flag', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain("'--verify-only'");
    expect(content).toContain('result.verifyOnly = true');
  });

  it('migration script still exits with code 1 when verify-only finds legacy', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('VERIFY_ONLY');
    expect(content).toContain('verifyPassed === false');
    expect(content).toContain('process.exit(1)');
  });

  it('migration script still outputs VERIFY PASSED message on success', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('[VERIFY PASSED]');
  });

  it('migration script still outputs VERIFY FAILED message on legacy found', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('[VERIFY FAILED]');
    expect(content).toContain('legacy tradeExceptions field');
  });

  it('migration script still uses deterministic phase67 prefix in filenames', () => {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    expect(content).toContain('phase67_');
    expect(content).toMatch(/fileBase.*=.*phase67/);
  });
});
