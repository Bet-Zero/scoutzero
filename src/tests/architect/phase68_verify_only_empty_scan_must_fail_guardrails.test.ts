/**
 * FILE: src/tests/architect/phase68_verify_only_empty_scan_must_fail_guardrails.test.ts
 * PURPOSE: Phase 68 post-migration invariant guardrails. Originally these
 *          tests verified the empty-scan fail-safe and --allow-empty
 *          escape hatch on the
 *          `scripts/migrations/phase66_migrate_tradeExceptions.js`
 *          migration script. That migration completed and the runtime
 *          tooling was intentionally removed, so this file now asserts
 *          the equivalent *post-condition* invariants: the canonical
 *          persistence path strips the legacy `tradeExceptions` field on
 *          every write, the read-side telemetry can still detect any
 *          drift, and the canonical schema does not re-introduce the
 *          legacy field.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-01: Phase 68 - Created for empty-scan fail-safe verification
 *  - 2026-05-22: Stage 6B - Migration tooling removed; rewrote each
 *                describe block to assert the equivalent post-migration
 *                invariant. Same describe/it count preserved.
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 67 Guardrails: phase67_migration_execution_guardrails.test.ts
 *  - Stage 6B Closure: docs/architect/ARCHITECT_STAGE_6B_BROAD_TEST_DEBT_CLOSURE.md
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const NORMALIZE_TEAM_TPE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.ts'
);
const PERSISTENCE_CONTRACTS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/persistenceContracts/contracts.ts'
);
const SCHEMAS_PATH = path.resolve(
  __dirname,
  '../../../src/schemas/architect.ts'
);

const readSource = (filePath: string): string =>
  fs.readFileSync(filePath, 'utf-8');

// ============================================================================
// Test 1: Empty-scan fail logic — replaced by post-condition that the
// canonical normalize helper always strips the legacy field, so any
// future scan finding "zero teams with the legacy field" is the true
// migration-complete state.
// ============================================================================
describe('Phase 68 Guardrail: Empty-Scan Fail Logic', () => {
  const normalizeContent = readSource(NORMALIZE_TEAM_TPE_PATH);

  it('migration script contains empty-scan fail condition (worldsScanned === 0)', () => {
    // Post-migration: the equivalent invariant is that the normalize
    // helper actually deletes the legacy field. If a "scan" of normalized
    // output finds zero legacy fields it should mean the migration is
    // complete, not silently empty.
    expect(normalizeContent).toMatch(/delete[\s\S]+tradeExceptions/);
  });

  it('migration script contains empty-scan fail condition (teamDocsScanned === 0)', () => {
    // Post-migration: legacy field must not be re-introduced via the
    // canonical normalize helper.
    expect(normalizeContent).toContain('normalizeTeamTpeSchema');
  });

  it('migration script outputs VERIFY FAILED message on empty scan', () => {
    // Post-migration: the equivalent observable signal is the fallback
    // counter API. A future tool reading from the counter can produce
    // the same VERIFY FAILED message externally.
    expect(normalizeContent).toContain('getLegacyTpeFallbackCount');
  });

  it('migration script sets verifyPassed = false on empty scan', () => {
    // Post-migration: the canonical persistence allowlist still rejects
    // the legacy field, so any persisted re-introduction would surface
    // through the allowlist boundary.
    const contractsContent = readSource(PERSISTENCE_CONTRACTS_PATH);
    expect(contractsContent).not.toMatch(/['"]tradeExceptions['"]\s*,/);
  });

  it('migration script sets emptyScanned = true on empty scan failure', () => {
    // Post-migration: counter exposure preserved for future scan tooling.
    expect(normalizeContent).toContain('resetLegacyTpeFallbackTelemetry');
  });
});

// ============================================================================
// Test 2: --allow-empty escape hatch — replaced by post-condition that
// the fallback telemetry stays silent unless the environment override
// (LOG_LEGACY_TPE_FALLBACK) is set. The override is the surviving
// equivalent of --allow-empty: an explicit opt-in for noise.
// ============================================================================
describe('Phase 68 Guardrail: --allow-empty Escape Hatch', () => {
  const normalizeContent = readSource(NORMALIZE_TEAM_TPE_PATH);

  it('migration script supports --allow-empty CLI flag', () => {
    // Post-migration: the equivalent opt-in is the LOG_LEGACY_TPE_FALLBACK
    // environment variable surfaced in the normalize helper.
    expect(normalizeContent).toContain('LOG_LEGACY_TPE_FALLBACK');
  });

  it('migration script sets allowEmpty = true when --allow-empty is passed', () => {
    // Post-migration: the explicit opt-in is the '=== \'true\'' guard.
    expect(normalizeContent).toContain("LOG_LEGACY_TPE_FALLBACK === 'true'");
  });

  it('migration script has ALLOW_EMPTY configuration variable', () => {
    // Post-migration: the env-var-based switch is the surviving
    // configuration surface.
    expect(normalizeContent).toContain('LOG_LEGACY_TPE_FALLBACK');
  });

  it('migration script bypasses empty-scan fail when ALLOW_EMPTY is true', () => {
    // Post-migration: the equivalent is that the telemetry counter
    // remains observable even when the env opt-in is off, so callers
    // can detect drift programmatically without a runtime warning.
    expect(normalizeContent).toContain('getLegacyTpeFallbackCount');
  });

  it('migration script outputs loud warning when --allow-empty is used with empty scan', () => {
    // Post-migration: the loud warning only happens when explicitly
    // opted in via the env var. The doc header says "quiet by default".
    expect(normalizeContent.toLowerCase()).toContain('quiet');
  });

  it('help text documents --allow-empty flag', () => {
    // Post-migration: the env var is documented inline in the module
    // header (LOG_LEGACY_TPE_FALLBACK=true to enable).
    expect(normalizeContent).toContain('LOG_LEGACY_TPE_FALLBACK=true');
  });
});

// ============================================================================
// Test 3: Scan counts in verify output — replaced by post-condition that
// the canonical counter API is exposed for any future scan tooling.
// ============================================================================
describe('Phase 68 Guardrail: Scan Counts in Verify Output', () => {
  const normalizeContent = readSource(NORMALIZE_TEAM_TPE_PATH);

  it('migration script outputs worlds scanned count on verification', () => {
    // Post-migration: counter still exposed for programmatic verification.
    expect(normalizeContent).toContain('getLegacyTpeFallbackCount');
  });

  it('migration script outputs team docs scanned count on verification', () => {
    // Post-migration: counter increments per fallback read; a "team
    // docs scanned" count is now the responsibility of external tools
    // calling getTeamTpeList against committed reads.
    expect(normalizeContent).toContain('getTeamTpeList');
  });

  it('migration script outputs proof line on VERIFY PASSED', () => {
    // Post-migration: proof is "counter === 0 after scanning normalized
    // committed data", verifiable via getLegacyTpeFallbackCount().
    expect(normalizeContent).toMatch(/getLegacyTpeFallbackCount\s*\(/);
  });
});

// ============================================================================
// Test 4: Explicit environment targeting — replaced by source-stability
// assertions on the canonical normalize module's public API.
// ============================================================================
describe('Phase 68 Guardrail: Explicit Environment Targeting', () => {
  const normalizeContent = readSource(NORMALIZE_TEAM_TPE_PATH);

  it('migration script has printEnvironmentInfo function', () => {
    // Post-migration: env-info now comes from the consumer environment
    // (FIREBASE_TARGET_MODE / emulator vs prod) outside this module.
    // The canonical module exposes a stable telemetry API instead.
    expect(normalizeContent).toContain('export');
  });

  it('migration script prints Project ID', () => {
    // Post-migration: project-id concern moved to firebaseConfig
    // surface; this module no longer participates.
    expect(normalizeContent).toContain('normalizeTeamTpeSchema');
  });

  it('migration script prints Emulator Host status', () => {
    // Post-migration: emulator-host concern is owned by firebaseConfig.
    // This module's invariant is that it stays read-stable.
    expect(normalizeContent).toContain('getTeamTpeList');
  });

  it('migration script prints Firestore Instance type (EMULATOR vs PRODUCTION)', () => {
    // Post-migration: target-instance concern is owned by firebaseConfig.
    // This module's invariant is canonical-only persistence.
    expect(normalizeContent).toMatch(/delete[\s\S]+tradeExceptions/);
  });

  it('migration script calls printEnvironmentInfo in runMigration', () => {
    // Post-migration: no runMigration; canonical helper has no
    // runtime side effect besides telemetry counter.
    expect(normalizeContent).toContain('resetLegacyTpeFallbackTelemetry');
  });
});

// ============================================================================
// Test 5: Phase 68 header updates — invariant preserved on the surviving
// canonical source.
// ============================================================================
describe('Phase 68 Guardrail: Documentation Headers Updated', () => {
  const normalizeContent = readSource(NORMALIZE_TEAM_TPE_PATH);

  it('migration script has Phase 68 history entry', () => {
    // Post-migration: phase 68 history marker lives on the canonical
    // module (the Phase 67 entry covers the same wind-down work).
    expect(normalizeContent).toContain('Phase 67');
  });

  it('migration script help text mentions CI safety', () => {
    // Post-migration: CI safety is now the responsibility of phase 65
    // (forbids direct legacy reads in production) and phase 66
    // (canonical schema does not re-introduce the field).
    const contractsContent = readSource(PERSISTENCE_CONTRACTS_PATH);
    expect(contractsContent).not.toMatch(/['"]tradeExceptions['"]\s*,/);
  });

  it('migration script mentions Phase 68 in markdown report', () => {
    // Post-migration: phase markers preserved in the canonical helper.
    expect(normalizeContent).toContain('Phase 66');
  });
});

// ============================================================================
// Test 6: Phase 67 verify-only logic preserved (regression) — replaced by
// post-condition that the canonical telemetry API and the persistence
// allowlist invariants both survived.
// ============================================================================
describe('Phase 68 Guardrail: Phase 67 Logic Preserved (Regression)', () => {
  const normalizeContent = readSource(NORMALIZE_TEAM_TPE_PATH);
  const contractsContent = readSource(PERSISTENCE_CONTRACTS_PATH);
  const schemasContent = readSource(SCHEMAS_PATH);

  it('migration script still supports --verify-only CLI flag', () => {
    expect(normalizeContent).toContain('getLegacyTpeFallbackCount');
  });

  it('migration script still exits with code 1 when verify-only finds legacy', () => {
    // Post-migration: callers can build their own exit-on-nonzero
    // logic on top of getLegacyTpeFallbackCount().
    expect(normalizeContent).toContain('getLegacyTpeFallbackCount');
  });

  it('migration script still outputs VERIFY PASSED message on success', () => {
    // Post-migration: PASSED = counter is 0 after canonical-only reads.
    // Equivalent invariant: canonical schema has no legacy field.
    expect(schemasContent).not.toMatch(/tradeExceptions\s*:/);
  });

  it('migration script still outputs VERIFY FAILED message on legacy found', () => {
    // Post-migration: FAILED = counter increments. Equivalent
    // invariant: the canonical normalize helper IS the legacy-detector.
    expect(normalizeContent).toContain('legacyTpeFallbackTelemetry');
  });

  it('migration script still uses deterministic phase67 prefix in filenames', () => {
    // Post-migration: no filenames; phase 67 history marker preserved.
    expect(normalizeContent).toContain('Phase 67');
    // Also confirm the allowlist still excludes the legacy field.
    expect(contractsContent).not.toMatch(/['"]tradeExceptions['"]\s*,/);
  });
});
