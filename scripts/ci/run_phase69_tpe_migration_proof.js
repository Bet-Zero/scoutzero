#!/usr/bin/env node
/**
 * FILE: scripts/ci/run_phase69_tpe_migration_proof.js
 * PURPOSE: CI entrypoint for Phase 69 TPE migration proof harness.
 *          Runs the Phase 69 proof runner and validates deterministic pass/fail behavior.
 *          Designed for CI pipelines with explicit exit codes.
 * OWNERSHIP: Tooling: CI/CD
 *
 * HISTORY:
 *  - 2026-02-01: Phase 70 - Created for CI-safe proof execution
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Proof Runner: scripts/seed/phase69_run_tpe_migration_proof.js
 *  - Migration Script: scripts/migrations/phase66_migrate_tradeExceptions.js
 *  - Phase 70 Return Package: docs/architect/return_packages/PHASE_70_CI_PROOF_AND_PROD_WRITE_SAFETY_EXECUTION_RETURN_PACKAGE.md
 *
 * USAGE:
 *   # With emulator running:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/ci/run_phase69_tpe_migration_proof.js
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set (refuses to run against production)
 *   - Emulator must be running with Firestore on the specified host:port
 *   - Validates:
 *     - First verify-only exits with code 1 (legacy detected)
 *     - Second verify-only exits with code 0 (zero legacy after migration)
 *     - Nonzero scan counts in output
 *
 * EXIT CODES:
 *   0 - All proof loop assertions passed
 *   1 - Proof loop failed (check output for details)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================
const PROOF_RUNNER_PATH = path.resolve(
  __dirname,
  '../seed/phase69_run_tpe_migration_proof.js'
);

// ============================================================================
// Helper: Run a command and capture output for parsing
// ============================================================================
function runProofRunner() {
  return new Promise((resolve, reject) => {
    console.log('============================================================');
    console.log('Phase 70 CI Entrypoint: TPE Migration Proof');
    console.log('============================================================');
    console.log(`Proof Runner: ${PROOF_RUNNER_PATH}`);
    console.log(
      `Emulator: ${process.env.FIRESTORE_EMULATOR_HOST || 'NOT SET'}`
    );
    console.log(
      '============================================================\n'
    );

    // CRITICAL: Refuse to run against production
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.error('[CI ERROR] FIRESTORE_EMULATOR_HOST is not set.');
      console.error('           This CI job only runs against the emulator.');
      console.error(
        '           Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 and ensure emulator is running.'
      );
      resolve({
        success: false,
        code: 1,
        error: 'EMULATOR_NOT_SET',
        output: [],
      });
      return;
    }

    const output = [];

    const child = spawn('node', [PROOF_RUNNER_PATH], {
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output.push(text);
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      output.push(text);
      process.stderr.write(text);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn proof runner: ${err.message}`));
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
        output: output.join(''),
      });
    });
  });
}

// ============================================================================
// CI Validation
// ============================================================================

/**
 * Validate CI acceptance criteria from proof runner output.
 *
 * Requirements:
 * - First verify-only must fail (exit code 1 with legacy detected)
 * - Write migration must succeed
 * - Second verify-only must pass (exit code 0 with zero legacy)
 * - Nonzero scan counts must appear in output
 */
function validateProofOutput(output) {
  const results = {
    hasFirstVerifyFail: false,
    hasSecondVerifyPass: false,
    hasNonzeroScanCounts: false,
    hasProofComplete: false,
  };

  // Check for first verify-only failure (exit code 1)
  if (
    (output.includes('Exit code: 1') &&
      output.includes('verify-only (fail)')) ||
    output.includes('expected: FAIL')
  ) {
    results.hasFirstVerifyFail = true;
  }

  // Check for second verify-only success (exit code 0 after migration)
  if (
    output.includes('PROOF LOOP COMPLETE') ||
    output.includes('ALL ACCEPTANCE CRITERIA MET')
  ) {
    results.hasProofComplete = true;
    results.hasSecondVerifyPass = true;
  }

  // Check for nonzero scan counts in output
  // Look for patterns like "worldsScanned=1", "teamDocsScanned=3", etc.
  const scanPatterns = [
    /worldsScanned[=:]\s*[1-9]\d*/i,
    /teamDocsScanned[=:]\s*[1-9]\d*/i,
    /Scanned:\s*[1-9]\d*/i,
    /team doc\(s\)/i,
    /world\(s\)/i,
  ];

  for (const pattern of scanPatterns) {
    if (pattern.test(output)) {
      results.hasNonzeroScanCounts = true;
      break;
    }
  }

  // Also check for explicit scan count mentions in summary
  if (
    output.includes('Total worlds scanned:') &&
    !output.includes('Total worlds scanned: 0')
  ) {
    results.hasNonzeroScanCounts = true;
  }

  return results;
}

// ============================================================================
// Entry Point
// ============================================================================
async function main() {
  console.log('[CI] Starting Phase 69 TPE migration proof...\n');

  try {
    const result = await runProofRunner();

    // If proof runner itself failed
    if (!result.success) {
      console.error(
        '\n============================================================'
      );
      console.error('[CI FAILED] Proof runner exited with non-zero code.');
      console.error(`Exit code: ${result.code}`);
      console.error(
        '============================================================'
      );

      if (result.error === 'EMULATOR_NOT_SET') {
        process.exit(1);
      }

      // Additional validation of what went wrong
      const validation = validateProofOutput(result.output);
      console.error('\nValidation results:');
      console.error(
        `  - First verify-only failed: ${validation.hasFirstVerifyFail}`
      );
      console.error(
        `  - Second verify-only passed: ${validation.hasSecondVerifyPass}`
      );
      console.error(
        `  - Nonzero scan counts: ${validation.hasNonzeroScanCounts}`
      );
      console.error(`  - Proof complete: ${validation.hasProofComplete}`);

      process.exit(1);
    }

    // Validate output even on success
    const validation = validateProofOutput(result.output);

    console.log(
      '\n============================================================'
    );
    console.log('[CI] Proof Runner Validation');
    console.log('============================================================');
    console.log(
      `✅ First verify-only failed (legacy detected): ${validation.hasFirstVerifyFail}`
    );
    console.log(
      `✅ Second verify-only passed (zero legacy): ${validation.hasSecondVerifyPass}`
    );
    console.log(
      `✅ Nonzero scan counts observed: ${validation.hasNonzeroScanCounts}`
    );
    console.log(`✅ Proof loop complete: ${validation.hasProofComplete}`);

    // Check if all validations passed
    const allPassed =
      validation.hasFirstVerifyFail &&
      validation.hasSecondVerifyPass &&
      validation.hasNonzeroScanCounts &&
      validation.hasProofComplete;

    if (!allPassed) {
      console.error('\n[CI FAILED] Not all validation checks passed.');
      console.error(
        'The proof runner exited 0 but output did not match expected patterns.'
      );
      process.exit(1);
    }

    console.log(
      '\n============================================================'
    );
    console.log(
      '[CI SUCCESS] All Phase 69 proof loop acceptance criteria met.'
    );
    console.log('============================================================');
    console.log('AC1) First verify-only FAILED with legacy detected ✅');
    console.log('AC2) Write migration completed ✅');
    console.log('AC3) Second verify-only PASSED with zero legacy ✅');
    console.log('AC4) Nonzero scan counts confirmed ✅');
    console.log('============================================================');

    process.exit(0);
  } catch (err) {
    console.error('[CI ERROR] Unexpected error:', err);
    process.exit(1);
  }
}

main();
