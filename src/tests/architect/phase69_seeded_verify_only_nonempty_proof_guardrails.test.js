/**
 * FILE: src/tests/architect/phase69_seeded_verify_only_nonempty_proof_guardrails.test.js
 * PURPOSE: Phase 69 guardrails verifying seeded emulator proof harness for TPE migration.
 *          Tests enforce seed script structure, deterministic worldId, legacy field presence,
 *          proof harness execution order, and Phase 68 regression (empty-scan must fail).
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-01: Phase 69 - Created for seeded emulator proof harness verification
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 68 Guardrails: phase68_verify_only_empty_scan_must_fail_guardrails.test.js
 *  - Seed Script: scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js
 *  - Proof Runner: scripts/seed/phase69_run_tpe_migration_proof.js
 *
 * DESIGN:
 * Phase 69 proves verify-only with non-empty scans by:
 * 1) Seeding emulator with deterministic world + teams (including legacy tradeExceptions)
 * 2) Running verify-only (must FAIL with nonzero scans and legacy hits)
 * 3) Running write migration
 * 4) Running verify-only again (must PASS with nonzero scans and zero legacy)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SEED_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js'
);

const PROOF_RUNNER_PATH = path.resolve(
  __dirname,
  '../../../scripts/seed/phase69_run_tpe_migration_proof.js'
);

const MIGRATION_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
);

// ============================================================================
// Test 1: Seed Script Exists and Has Required Structure
// ============================================================================
describe('Phase 69 Guardrail: Seed Script Exists', () => {
  it('seed script file exists at expected path', () => {
    expect(fs.existsSync(SEED_SCRIPT_PATH)).toBe(true);
  });

  it('seed script contains deterministic worldId string', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must have deterministic world ID for reproducibility
    expect(content).toContain("DETERMINISTIC_WORLD_ID = 'phase69_seed_world'");
  });

  it('seed script contains deterministic timestamp', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must have deterministic timestamp for reproducibility
    expect(content).toContain('DETERMINISTIC_TIMESTAMP');
    expect(content).toContain('2026-02-01T00:00:00.000Z');
  });

  it('seed script refuses to run against production', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must check FIRESTORE_EMULATOR_HOST is set
    expect(content).toContain('FIRESTORE_EMULATOR_HOST');
    expect(content).toContain('only runs against emulator');
  });
});

// ============================================================================
// Test 2: Seed Script Creates Team Docs with Legacy tradeExceptions
// ============================================================================
describe('Phase 69 Guardrail: Seed Script Creates Legacy TPE Data', () => {
  it('seed script writes team docs to architect_worlds subcollection', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must write to teams subcollection
    expect(content).toContain("worldRef.collection('teams')");
  });

  it('seed script creates at least one team with legacy tradeExceptions field', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must include legacy tradeExceptions field in team doc
    expect(content).toContain('tradeExceptions:');
    expect(content).toContain('createTeamWithLegacyTpe');
  });

  it('seed script creates team doc fixture with tradeExceptions array', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Fixture must have legacy tradeExceptions as an array with TPE items
    expect(content).toMatch(/tradeExceptions:\s*\[/);
    expect(content).toContain('totalAmount');
    expect(content).toContain('remainingAmount');
    expect(content).toContain('createdFrom');
  });

  it('seed script creates at least one team with canonical exceptions.tpe field', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must also create canonical team for comparison
    expect(content).toContain('createTeamWithCanonicalTpe');
    expect(content).toMatch(/exceptions:\s*\{[\s\S]*?tpe:\s*\[/);
  });

  it('seed script tracks which teams have legacy vs canonical', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must track legacy teams for summary output
    expect(content).toContain('TEAM_WITH_LEGACY');
    expect(content).toContain('TEAM_WITH_CANONICAL');
    expect(content).toContain('legacyTeams');
    expect(content).toContain('canonicalTeams');
  });
});

// ============================================================================
// Test 3: Seed Script Is Idempotent
// ============================================================================
describe('Phase 69 Guardrail: Seed Script Is Idempotent', () => {
  it('seed script uses set with merge: false for overwrite semantics', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must use set with merge: false for idempotent overwrite
    expect(content).toContain('merge: false');
  });

  it('seed script uses deterministic IDs (no random UUIDs)', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must not use uuid or random ID generation
    expect(content).not.toContain('uuid');
    expect(content).not.toContain('Math.random');
    // Must have deterministic TPE IDs
    expect(content).toContain('legacy-tpe-');
    expect(content).toContain('canonical-tpe-');
  });
});

// ============================================================================
// Test 4: Proof Runner Exists and Has Correct Execution Order
// ============================================================================
describe('Phase 69 Guardrail: Proof Runner Exists', () => {
  it('proof runner file exists at expected path', () => {
    expect(fs.existsSync(PROOF_RUNNER_PATH)).toBe(true);
  });

  it('proof runner contains reference to seed script', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain(
      'phase69_seed_architect_worlds_for_tpe_migration'
    );
  });

  it('proof runner contains reference to migration script', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain('phase66_migrate_tradeExceptions');
  });

  it('proof runner uses deterministic worldId', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain('phase69_seed_world');
  });
});

// ============================================================================
// Test 5: Proof Runner Execution Order (Seed → Verify → Write → Verify)
// ============================================================================
describe('Phase 69 Guardrail: Proof Runner Execution Order', () => {
  it('proof runner runs seed first', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    // Must have seed as first step
    expect(content).toContain('STEP 1/4');
    expect(content).toContain('Seed');
  });

  it('proof runner runs verify-only second (expected fail)', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    // Must have verify-only as second step
    expect(content).toContain('STEP 2/4');
    expect(content).toContain('--verify-only');
  });

  it('proof runner runs write migration third', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    // Must have write migration as third step
    expect(content).toContain('STEP 3/4');
    expect(content).toContain('--write');
  });

  it('proof runner runs verify-only fourth (expected pass)', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    // Must have final verify-only as fourth step
    expect(content).toContain('STEP 4/4');
  });

  it('proof runner checks first verify-only fails with exit code 1', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    // Must expect first verify-only to fail
    expect(content).toContain('verifyBeforeResult.code === 0');
    expect(content).toContain('should have failed');
  });

  it('proof runner checks second verify-only passes with exit code 0', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    // Must expect second verify-only to pass
    expect(content).toContain('verifyAfterResult.code !== 0');
    expect(content).toContain('should have passed');
  });
});

// ============================================================================
// Test 6: Phase 68 Regression - Empty Scan Must Still Fail
// ============================================================================
describe('Phase 69 Guardrail: Phase 68 Regression Check', () => {
  it('migration script still has empty-scan fail logic', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Phase 68 empty-scan fail logic must still exist
    expect(content).toContain('worldsScanned === 0');
    expect(content).toContain('teamDocsScanned === 0');
    expect(content).toContain('[VERIFY FAILED] Empty scan');
  });

  it('migration script still has --allow-empty escape hatch', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Phase 68 escape hatch must still exist
    expect(content).toContain("'--allow-empty'");
    expect(content).toContain('ALLOW_EMPTY');
    expect(content).toContain('&& !ALLOW_EMPTY');
  });

  it('migration script still outputs scan counts in verify output', () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT_PATH, 'utf-8');
    // Phase 68 scan count output must still exist
    expect(content).toContain('Worlds scanned:');
    expect(content).toContain('Team docs scanned:');
    expect(content).toContain('Proof: Scanned');
  });
});

// ============================================================================
// Test 7: Seed Script Creates Merge Test Data (Both Legacy + Canonical)
// ============================================================================
describe('Phase 69 Guardrail: Seed Script Merge Test Data', () => {
  it('seed script creates team with BOTH legacy and canonical TPEs', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must have team with both for merge testing
    expect(content).toContain('TEAM_WITH_BOTH');
    expect(content).toContain('createTeamWithBothTpe');
  });

  it('seed script includes multiple team codes', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    // Must seed at least 3 teams (legacy, canonical, both)
    expect(content).toContain("'BOS'");
    expect(content).toContain("'LAL'");
    expect(content).toContain("'MIA'");
  });
});

// ============================================================================
// Test 8: Documentation Headers
// ============================================================================
describe('Phase 69 Guardrail: Documentation Headers', () => {
  it('seed script has proper file header', () => {
    const content = fs.readFileSync(SEED_SCRIPT_PATH, 'utf-8');
    expect(content).toContain('FILE:');
    expect(content).toContain('PURPOSE:');
    expect(content).toContain('HISTORY:');
    expect(content).toContain('Phase 69');
  });

  it('proof runner has proper file header', () => {
    const content = fs.readFileSync(PROOF_RUNNER_PATH, 'utf-8');
    expect(content).toContain('FILE:');
    expect(content).toContain('PURPOSE:');
    expect(content).toContain('HISTORY:');
    expect(content).toContain('Phase 69');
  });
});
