/**
 * FILE: src/tests/architect/phase67_migration_execution_guardrails.test.js
 * PURPOSE: Phase 67 guardrails verifying migration script CLI, verify-only mode,
 *          and telemetry wind-down to quiet-by-default.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-01: Phase 67 - Created for migration execution verification
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 66 Guardrails: phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js
 *
 * DESIGN:
 * Phase 67 completes the TPE migration by:
 * 1) Running actual migration (DRY_RUN → WRITE → VERIFY)
 * 2) Providing --verify-only mode with exit code 1 on legacy found
 * 3) Winding down telemetry to quiet-by-default
 * 4) Producing zero-legacy proof
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Test 1: Migration Script CLI Options
// ============================================================================
describe('Phase 67 Guardrail: Migration Script CLI Options', () => {
  const scriptPath = path.resolve(
    __dirname,
    '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
  );

  it('migration script supports --dry-run CLI flag', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain("'--dry-run'");
    expect(content).toContain('result.dryRun = true');
  });

  it('migration script supports --write CLI flag', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain("'--write'");
    expect(content).toContain('result.dryRun = false');
  });

  it('migration script supports --verify-only CLI flag', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain("'--verify-only'");
    expect(content).toContain('result.verifyOnly = true');
  });

  it('migration script supports --output-dir CLI flag', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain("'--output-dir='");
    expect(content).toContain('result.outputDir');
  });

  it('verify-only mode implies dry-run (no writes)', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    // When --verify-only is set, dryRun should also be true
    expect(content).toMatch(/verifyOnly.*=.*true[\s\S]*dryRun.*=.*true/);
  });
});

// ============================================================================
// Test 2: Migration Script Verify-Only Exit Codes
// ============================================================================
describe('Phase 67 Guardrail: Verify-Only Exit Codes', () => {
  const scriptPath = path.resolve(
    __dirname,
    '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
  );

  it('migration script exits with code 1 when verify-only finds legacy', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    // Should have exit(1) logic tied to verify failure
    expect(content).toContain('VERIFY_ONLY');
    expect(content).toContain('verifyPassed === false');
    expect(content).toContain('process.exit(1)');
  });

  it('migration script sets verifyPassed flag in report', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('report.verifyPassed = false');
    expect(content).toContain('report.verifyPassed = true');
  });

  it('migration script outputs VERIFY PASSED message on success', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('[VERIFY PASSED]');
  });

  it('migration script outputs VERIFY FAILED message on failure', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('[VERIFY FAILED]');
  });
});

// ============================================================================
// Test 3: Deterministic Report Filenames
// ============================================================================
describe('Phase 67 Guardrail: Deterministic Report Filenames', () => {
  const scriptPath = path.resolve(
    __dirname,
    '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
  );

  it('migration script uses phase67 prefix in filenames', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('phase67_');
  });

  it('migration script uses date-based deterministic filename pattern', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    // Should use YYYY-MM-DD format
    expect(content).toContain('.slice(0, 10)');
    expect(content).toMatch(/fileBase.*=.*phase67/);
  });

  it('migration script respects OUTPUT_DIR setting', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('OUTPUT_DIR');
    expect(content).toContain('path.resolve(OUTPUT_DIR)');
  });
});

// ============================================================================
// Test 4: Telemetry Quiet-by-Default (Phase 67 Wind-Down)
// ============================================================================
describe('Phase 67 Guardrail: Telemetry Quiet-by-Default', () => {
  const telemetryAuthorityPath = path.resolve(
    __dirname,
    '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.ts'
  );
  const telemetryShimPath = path.resolve(
    __dirname,
    '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.js'
  );

  it('telemetry is quiet by default (only logs when LOG_LEGACY_TPE_FALLBACK=true)', () => {
    const content = fs.readFileSync(telemetryAuthorityPath, 'utf-8');
    // Should NOT log by default - only when explicitly enabled
    expect(content).toContain("LOG_LEGACY_TPE_FALLBACK === 'true'");
    // Should have "quiet by default" or similar in docs
    expect(content.toLowerCase()).toContain('quiet');
  });

  it('normalizeTeamTpe.js remains a pure compatibility shim', () => {
    const shimContent = fs.readFileSync(telemetryShimPath, 'utf-8');
    expect(shimContent).toContain("export * from './normalizeTeamTpe.ts';");
    expect(shimContent).not.toContain("LOG_LEGACY_TPE_FALLBACK === 'true'");
  });

  it('telemetry counter still increments silently', async () => {
    const {
      getTeamTpeList,
      getLegacyTpeFallbackCount,
      resetLegacyTpeFallbackTelemetry,
    } = await import(
      '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.js'
    );

    resetLegacyTpeFallbackTelemetry();
    const initialCount = getLegacyTpeFallbackCount();

    // Team with only legacy tradeExceptions (no canonical)
    const legacyTeam = {
      teamCode: 'TST',
      tradeExceptions: [{ id: 'legacy-1', amount: 5000000 }],
      exceptions: {},
    };

    getTeamTpeList(legacyTeam);

    // Counter should increment even though logging is quiet
    expect(getLegacyTpeFallbackCount()).toBe(initialCount + 1);
  });

  it('telemetry does NOT log to console by default', async () => {
    const { getTeamTpeList, resetLegacyTpeFallbackTelemetry } = await import(
      '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.js'
    );

    resetLegacyTpeFallbackTelemetry();

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const legacyTeam = {
      teamCode: 'TST2',
      tradeExceptions: [{ id: 'legacy-2', amount: 3000000 }],
      exceptions: {},
    };

    getTeamTpeList(legacyTeam);

    // Should NOT have logged (quiet by default)
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// ============================================================================
// Test 5: Phase 67 Header Updates
// ============================================================================
describe('Phase 67 Guardrail: Documentation Headers Updated', () => {
  it('normalizeTeamTpe.ts has Phase 67 history entry', () => {
    const telemetryPath = path.resolve(
      __dirname,
      '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.ts'
    );
    const content = fs.readFileSync(telemetryPath, 'utf-8');
    expect(content).toContain('Phase 67');
    expect(content).toContain('quiet-by-default');
  });

  it('migration script has Phase 67 history entry', () => {
    const scriptPath = path.resolve(
      __dirname,
      '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
    );
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('Phase 67');
    expect(content).toContain('--verify-only');
  });

  it('migration script generates Phase 66/67 report header', () => {
    const scriptPath = path.resolve(
      __dirname,
      '../../../scripts/migrations/phase66_migrate_tradeExceptions.js'
    );
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('Phase 66/67 Migration Report');
  });
});
