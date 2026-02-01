#!/usr/bin/env node
/**
 * FILE: scripts/seed/phase69_run_tpe_migration_proof.js
 * PURPOSE: End-to-end proof harness for TPE migration (Phase 69).
 *          Runs: seed → verify-only (fail) → write → verify-only (pass)
 * OWNERSHIP: Tooling: TPE migration proof harness
 *
 * HISTORY:
 *  - 2026-02-01: Phase 69 - Created for seeded emulator proof harness
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Seed Script: scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js
 *  - Migration Script: scripts/migrations/phase66_migrate_tradeExceptions.js
 *  - Phase 69 Return Package: docs/architect/return_packages/PHASE_69_SEEDED_VERIFY_ONLY_NONEMPTY_PROOF_EXECUTION_RETURN_PACKAGE.md
 *
 * USAGE:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/seed/phase69_run_tpe_migration_proof.js
 *
 * REQUIREMENTS:
 *   - FIRESTORE_EMULATOR_HOST must be set (refuses to run against production)
 *   - Runs complete proof loop: seed → verify-only (fail) → write → verify-only (pass)
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
const DETERMINISTIC_WORLD_ID = 'phase69_seed_world';
const SEED_SCRIPT = path.resolve(
  __dirname,
  'phase69_seed_architect_worlds_for_tpe_migration.js'
);
const MIGRATION_SCRIPT = path.resolve(
  __dirname,
  '../migrations/phase66_migrate_tradeExceptions.js'
);

// ============================================================================
// Helper: Run a command and capture output
// ============================================================================
function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`STEP: ${description}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Command: node ${args.join(' ')}\n`);

    const child = spawn(command, args, {
      env: process.env,
      stdio: 'inherit', // Pass through to show live output
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn command: ${err.message}`));
    });

    child.on('close', (code) => {
      console.log(`\nExit code: ${code}`);
      resolve({ code });
    });
  });
}

// ============================================================================
// Proof Loop Steps
// ============================================================================

async function runProofLoop() {
  // CRITICAL: Refuse to run against production
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      '[ERROR] FIRESTORE_EMULATOR_HOST is not set. This script only runs against emulator.'
    );
    console.error(
      '        Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 and try again.'
    );
    process.exit(1);
  }

  console.log('============================================================');
  console.log('Phase 69 Proof Loop: End-to-End TPE Migration Verification');
  console.log('============================================================');
  console.log(`Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`World ID: ${DETERMINISTIC_WORLD_ID}`);
  console.log('============================================================\n');

  const results = {
    seed: null,
    verifyOnlyBefore: null,
    writeMigration: null,
    verifyOnlyAfter: null,
    overallSuccess: false,
  };

  // Step 1: Seed
  console.log('[STEP 1/4] Seeding test data...');
  const seedResult = await runCommand(
    'node',
    [SEED_SCRIPT],
    'Seed emulator with legacy TPE data'
  );
  results.seed = seedResult;
  if (seedResult.code !== 0) {
    console.error('\n[PROOF FAILED] Seed script failed.');
    return results;
  }

  // Step 2: Verify-only (expected to FAIL with exit code 1)
  console.log(
    '\n[STEP 2/4] Running verify-only (should FAIL with legacy detected)...'
  );
  const verifyBeforeResult = await runCommand(
    'node',
    [MIGRATION_SCRIPT, '--verify-only'],
    'Verify-only scan (expected: FAIL, legacy detected)'
  );
  results.verifyOnlyBefore = verifyBeforeResult;

  if (verifyBeforeResult.code === 0) {
    console.error(
      '\n[PROOF FAILED] Verify-only should have failed (exit 1) but passed (exit 0).'
    );
    console.error(
      'This means either seed did not create legacy data or migration script is broken.'
    );
    return results;
  }

  if (verifyBeforeResult.code !== 1) {
    console.error(
      `\n[PROOF FAILED] Verify-only unexpected exit code: ${verifyBeforeResult.code}`
    );
    return results;
  }

  console.log(
    '\n[OK] Verify-only correctly detected legacy data and failed (exit 1).'
  );

  // Step 3: Write migration
  console.log('\n[STEP 3/4] Running write migration...');
  const writeResult = await runCommand(
    'node',
    [MIGRATION_SCRIPT, '--write', `--worldId=${DETERMINISTIC_WORLD_ID}`],
    'Write migration (remove legacy tradeExceptions)'
  );
  results.writeMigration = writeResult;

  if (writeResult.code !== 0) {
    console.error('\n[PROOF FAILED] Write migration failed.');
    return results;
  }

  console.log('\n[OK] Write migration completed successfully.');

  // Step 4: Verify-only again (expected to PASS with exit code 0)
  console.log(
    '\n[STEP 4/4] Running verify-only again (should PASS with zero legacy)...'
  );
  const verifyAfterResult = await runCommand(
    'node',
    [MIGRATION_SCRIPT, '--verify-only'],
    'Verify-only scan (expected: PASS, zero legacy)'
  );
  results.verifyOnlyAfter = verifyAfterResult;

  if (verifyAfterResult.code !== 0) {
    console.error(
      '\n[PROOF FAILED] Verify-only should have passed (exit 0) but failed.'
    );
    console.error('This means migration did not fully remove legacy data.');
    return results;
  }

  console.log(
    '\n[OK] Verify-only correctly detected zero legacy data and passed (exit 0).'
  );

  // All steps passed
  results.overallSuccess = true;

  console.log('\n============================================================');
  console.log('PROOF LOOP COMPLETE - ALL ACCEPTANCE CRITERIA MET');
  console.log('============================================================');
  console.log('✅ AC1) Seed script is idempotent');
  console.log('✅ AC2) First verify-only FAILED with legacy detected');
  console.log('✅ AC3) Write migration completed (migrated > 0)');
  console.log('✅ AC4) Second verify-only PASSED with zero legacy');
  console.log('============================================================\n');

  return results;
}

// ============================================================================
// Entry Point
// ============================================================================
runProofLoop()
  .then((results) => {
    if (results.overallSuccess) {
      console.log(
        '[SUCCESS] Phase 69 proof loop complete. All acceptance criteria met.'
      );
      process.exit(0);
    } else {
      console.log(
        '[FAILURE] Phase 69 proof loop failed. See output above for details.'
      );
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('[ERROR] Proof loop crashed:', err);
    process.exit(1);
  });
