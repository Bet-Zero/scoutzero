/**
 * FILE: src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js
 * PURPOSE: Anti-regression guardrail tests for Phase 57 + Phase 58 + Phase 59.
 *
 * These tests enforce that validateTrade() is NOT called within compute/persistence
 * modules. Trade validation must occur BEFORE compute via the snapshot → validate → compute
 * pipeline established in Phase 56.
 *
 * ENFORCED INVARIANTS:
 * 1. computeTradeResult region of mutationPipeline.ts must not contain validateTrade(
 * 2. persistWorldMutation region of mutationPipeline.ts must not contain validateTrade(
 * 3. Compute helpers (buildPostTradeTeamsSnapshot in tradeContext/) must not call validateTrade(
 *
 * PHASE 58 UPDATES:
 * - buildPostTradeTeamsSnapshot and validatePostTradeSnapshotForContext moved to tradeContext/
 * - Tests now cover both mutationPipeline.ts AND tradeContext/ module
 * - Allowlist approach: validateTrade( allowed ONLY in validatePostTradeSnapshotForContext
 *
 * PHASE 59 UPDATES:
 * - validateTradeForPipeline removed from mutationPipeline.ts
 * - validateTradeForContext moved to tradeContext/legacy/ namespace
 * - mutationPipeline.ts no longer re-exports validateTradeForContext
 *
 * ALLOWED EXCEPTIONS (ALLOWLIST):
 * - validatePostTradeSnapshotForContext: This IS the validation function, it calls validateTrade
 * - legacy/index.ts: Contains deprecated validateTradeForContext wrapper
 * - legacy/index.js: Pure compatibility shim for the deprecated wrapper
 * - Import statements: These are not function calls
 * - Comments/docstrings: References to validateTrade in documentation
 *
 * NOTE: This test reads source files as plain text and uses regex to detect violations.
 * It is designed to be fast and strict.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Helper to read source file content
function readSourceFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf-8');
}

// Helper to extract a region of code between two markers
function extractRegion(source, startMarker, endMarkerOrEOF = null) {
  const startIndex = source.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Region start marker not found: ${startMarker}`);
  }

  let endIndex;
  if (endMarkerOrEOF) {
    endIndex = source.indexOf(endMarkerOrEOF, startIndex + startMarker.length);
    if (endIndex === -1) {
      // Use end of file if marker not found
      endIndex = source.length;
    }
  } else {
    endIndex = source.length;
  }

  return source.slice(startIndex, endIndex);
}

// Helper to check if validateTrade( appears in code (excluding allowed patterns)
function findValidateTradeCallsInRegion(regionCode, regionName) {
  const lines = regionCode.split('\n');
  const violations = [];

  // Patterns that are ALLOWED (not violations)
  const allowedPatterns = [
    /^\s*\/\//, // Single-line comments
    /^\s*\*/, // Multi-line comment lines
    /^\s*\/\*\*/, // JSDoc start
    /import\s+.*validateTrade/, // Import statements
    /export\s+.*validateTrade/, // Export statements
    /'validateTrade'/, // String literal
    /"validateTrade"/, // String literal
    /`validateTrade/, // Template literal
  ];

  // The actual violation pattern: calling validateTrade as a function
  const violationPattern = /validateTrade\s*\(/;

  lines.forEach((line, index) => {
    // Skip if line matches any allowed pattern
    const isAllowed = allowedPatterns.some((pattern) => pattern.test(line));
    if (isAllowed) return;

    // Check for violation
    if (violationPattern.test(line)) {
      violations.push({
        line: index + 1,
        content: line.trim(),
        region: regionName,
      });
    }
  });

  return violations;
}

describe('Phase 57: Forbid validateTrade in Compute/Persist Modules', () => {
  describe('Test 1: computeTradeResult region is pure (no validateTrade calls)', () => {
    it('should not contain validateTrade( calls in computeTradeResult function body', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Extract the computeTradeResult function region
      // The function starts with "function computeTradeResult({" and ends before computeSigningResult
      const computeTradeResultStart = 'function computeTradeResult({';
      const computeTradeResultEnd = '\nfunction computeSigningResult';

      const regionCode = extractRegion(
        source,
        computeTradeResultStart,
        computeTradeResultEnd
      );

      const violations = findValidateTradeCallsInRegion(
        regionCode,
        'computeTradeResult'
      );

      expect(violations).toEqual([]);
    });
  });

  describe('Test 2: persistWorldMutation region is pure (no validateTrade calls)', () => {
    it('should not contain validateTrade( calls in persistWorldMutation function', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Extract the persistWorldMutation function region
      const persistStart = 'async function persistWorldMutation({';
      const persistEnd = '\n/**\n * Apply mutation';

      const regionCode = extractRegion(source, persistStart, persistEnd);

      const violations = findValidateTradeCallsInRegion(
        regionCode,
        'persistWorldMutation'
      );

      expect(violations).toEqual([]);
    });
  });

  // Phase 58: Updated to check tradeContext module instead of mutationPipeline.ts
  describe('Test 3: buildPostTradeTeamsSnapshot is pure (no validateTrade calls)', () => {
    it('should not contain validateTrade( calls in buildPostTradeTeamsSnapshot function (tradeContext module)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/tradeContext.ts'
      );

      // Extract the buildPostTradeTeamsSnapshot function region
      const snapshotStart = 'export function buildPostTradeTeamsSnapshot({';
      const snapshotEnd = '\n// ====';

      const regionCode = extractRegion(source, snapshotStart, snapshotEnd);

      const violations = findValidateTradeCallsInRegion(
        regionCode,
        'buildPostTradeTeamsSnapshot'
      );

      expect(violations).toEqual([]);
    });
  });

  describe('Test 4: computeWorldMutation executeTrade case is pure', () => {
    it('should not call validateTrade directly in computeWorldMutation executeTrade case', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // The executeTrade case in computeWorldMutation should only call:
      // - buildPostTradeTeamsSnapshot (pure)
      // - validatePostTradeSnapshotForContext (the designated validation point)
      // - computeTradeResult (pure, requires validated context)

      // Extract the computeWorldMutation function region
      const computeWorldStart = 'export function computeWorldMutation({';
      const computeWorldEnd = "\n    case 'signFreeAgent':";

      const regionCode = extractRegion(
        source,
        computeWorldStart,
        computeWorldEnd
      );

      // Check that validatePostTradeSnapshotForContext is called (the ONLY allowed validation call)
      expect(regionCode).toContain('validatePostTradeSnapshotForContext');

      // Check that validateTrade is NOT called directly (it should go through the snapshot validator)
      const violations = findValidateTradeCallsInRegion(
        regionCode,
        'computeWorldMutation.executeTrade'
      );

      // Filter out the validatePostTradeSnapshotForContext call since that's allowed
      const realViolations = violations.filter(
        (v) => !v.content.includes('validatePostTradeSnapshotForContext')
      );

      expect(realViolations).toEqual([]);
    });
  });

  describe('Test 5: computeSignAndTradeResult follows snapshot→validate→compute pattern', () => {
    it('should call validatePostTradeSnapshotForContext before computeTradeResult', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Extract computeSignAndTradeResult function
      const satStart = 'function computeSignAndTradeResult({';
      const satEnd = '\n// ===============';

      const regionCode = extractRegion(source, satStart, satEnd);

      // Should contain the snapshot→validate→compute calls in order
      expect(regionCode).toContain('buildPostTradeTeamsSnapshot');
      expect(regionCode).toContain('validatePostTradeSnapshotForContext');
      expect(regionCode).toContain('computeTradeResult');

      // The order should be correct (buildSnapshot before validateSnapshot before computeResult)
      const buildIdx = regionCode.indexOf('buildPostTradeTeamsSnapshot');
      const validateIdx = regionCode.indexOf(
        'validatePostTradeSnapshotForContext'
      );
      const computeIdx = regionCode.indexOf('computeTradeResult({');

      expect(buildIdx).toBeLessThan(validateIdx);
      expect(validateIdx).toBeLessThan(computeIdx);
    });

    it('should not call validateTrade directly (only through validatePostTradeSnapshotForContext)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      const satStart = 'function computeSignAndTradeResult({';
      const satEnd = '\n// ===============';

      const regionCode = extractRegion(source, satStart, satEnd);

      const violations = findValidateTradeCallsInRegion(
        regionCode,
        'computeSignAndTradeResult'
      );

      // Filter out validatePostTradeSnapshotForContext (allowed)
      const realViolations = violations.filter(
        (v) => !v.content.includes('validatePostTradeSnapshotForContext')
      );

      expect(realViolations).toEqual([]);
    });
  });

  describe('Test 6: validateMutation for trades uses pre-validated context', () => {
    it('should not call validateTradeForPipeline for executeTrade (removed in Phase 57)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Extract the validateMutation function executeTrade case
      const vmStart = "if (mutationType === 'executeTrade')";
      const vmEnd = '\n  const currentYear';

      const regionCode = extractRegion(source, vmStart, vmEnd);

      // Should NOT contain validateTradeForPipeline (removed in Phase 57)
      expect(regionCode).not.toContain('validateTradeForPipeline');

      // Should contain the Phase 57 error for missing context
      expect(regionCode).toContain('Phase 57 violation');
    });

    it('should not call validateTradeForPipeline for signAndTrade (removed in Phase 57)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Find the signAndTrade case in validateMutation
      const satCaseStart = "case 'signAndTrade': {";
      const satCaseEnd = '\n    default:';

      // Find validateMutation first, then extract signAndTrade case
      const vmStart = source.indexOf('function validateMutation({');
      const satStart = source.indexOf(satCaseStart, vmStart);
      const satEnd = source.indexOf(satCaseEnd, satStart);

      const regionCode = source.slice(satStart, satEnd);

      // Should NOT contain validateTradeForPipeline (removed in Phase 57)
      expect(regionCode).not.toContain('validateTradeForPipeline');

      // Should contain the Phase 57 error for missing context
      expect(regionCode).toContain('Phase 57 violation');
    });
  });

  describe('Test 7: Module-level import check (informational)', () => {
    it('should import validateTrade at module level (needed for validation functions)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // The import should exist at module level
      expect(source).toContain(
        "import { validateTrade } from '@/features/architect/utils/tradeMachine'"
      );

      // This is expected and correct - validatePostTradeSnapshotForContext needs it
    });
  });

  // ===========================================================================
  // PHASE 58: TRADE CONTEXT MODULE GUARDRAILS
  // ===========================================================================

  describe('Test 8: tradeContext module exists and has expected structure', () => {
    it('should have tradeContext.ts with required exports (Phase 59: validateTradeForContext moved to legacy)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/tradeContext.ts'
      );

      // Should export buildPostTradeTeamsSnapshot
      expect(source).toContain('export function buildPostTradeTeamsSnapshot');

      // Should export validatePostTradeSnapshotForContext
      expect(source).toContain(
        'export function validatePostTradeSnapshotForContext'
      );

      // Phase 59: validateTradeForContext moved to legacy namespace
      expect(source).toContain('PHASE 59: LEGACY FUNCTION MOVED');
    });

    it('should retire tradeContext.js once the TS authority owns the surface', () => {
      expect(
        existsSync('src/features/architect/utils/tradeContext/tradeContext.js')
      ).toBe(false);
    });

    it('should have legacy/index.ts with deprecated validateTradeForContext', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/legacy/index.ts'
      );

      // Should export legacy_validateTradeForContext
      expect(source).toContain(
        'export function legacy_validateTradeForContext'
      );

      // Should have loud deprecation warnings
      expect(source).toContain('LEGACY NAMESPACE');
      expect(source).toContain('DO NOT IMPORT IN MUTATION MODULES');
    });

    it('confirms legacy/index.js shim has been deleted (TS authority owns the surface)', () => {
      expect(
        existsSync('src/features/architect/utils/tradeContext/legacy/index.js')
      ).toBe(false);
    });

    it('should have assertions.ts with runtime assertions', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/assertions.ts'
      );

      // Should export assertPostTradeSnapshot
      expect(source).toContain('export function assertPostTradeSnapshot');

      // Should export assertValidatedTradeContext
      expect(source).toContain('export function assertValidatedTradeContext');

      // Should export assertTradeComputeInputs
      expect(source).toContain('export function assertTradeComputeInputs');
    });

    it('should delete assertions.js in the E113 shim cleanup batch', () => {
      expect(
        existsSync('src/features/architect/utils/tradeContext/assertions.js')
      ).toBe(false);
    });

    it('should have index.ts re-exporting all public API', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/index.ts'
      );

      // Should re-export core functions
      expect(source).toContain('buildPostTradeTeamsSnapshot');
      expect(source).toContain('validatePostTradeSnapshotForContext');
      expect(source).toContain('validateTradeForContext');

      // Should re-export assertions
      expect(source).toContain('assertPostTradeSnapshot');
      expect(source).toContain('assertValidatedTradeContext');
      expect(source).toContain('assertTradeComputeInputs');
    });
  });

  describe('Test 9: validateTrade ONLY allowed in validatePostTradeSnapshotForContext (ALLOWLIST)', () => {
    it('should only call validateTrade in validatePostTradeSnapshotForContext function', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/tradeContext.ts'
      );

      // Find all lines that call validateTrade (not imports/comments)
      const lines = source.split('\n');
      const validateTradeCalls = [];

      lines.forEach((line, index) => {
        // Skip comments and imports
        if (/^\s*\/\//.test(line)) return;
        if (/^\s*\*/.test(line)) return;
        if (/import\s+.*validateTrade/.test(line)) return;

        // Check for validateTrade call
        if (/validateTrade\s*\(/.test(line)) {
          validateTradeCalls.push({ line: index + 1, content: line.trim() });
        }
      });

      // There should be exactly ONE call to validateTrade
      // (inside validatePostTradeSnapshotForContext)
      expect(validateTradeCalls.length).toBe(1);

      // That call should be inside validatePostTradeSnapshotForContext
      // Find where validatePostTradeSnapshotForContext is defined
      const validateFnStart = source.indexOf(
        'export function validatePostTradeSnapshotForContext'
      );
      const validateFnEnd = source.indexOf('\n// ====', validateFnStart);

      // The validateTrade call line number should be within this range
      const startLine = source.slice(0, validateFnStart).split('\n').length;
      const endLine = source.slice(0, validateFnEnd).split('\n').length;

      expect(validateTradeCalls[0].line).toBeGreaterThanOrEqual(startLine);
      expect(validateTradeCalls[0].line).toBeLessThanOrEqual(endLine);
    });
  });

  describe('Test 10: assertions module is pure (no validateTrade calls)', () => {
    it('should not contain any validateTrade calls in assertions.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/assertions.ts'
      );

      const violations = findValidateTradeCallsInRegion(
        source,
        'assertions.ts'
      );

      expect(violations).toEqual([]);
    });
  });

  describe('Test 11: mutationPipeline imports from tradeContext module', () => {
    it('should import trade context functions from tradeContext module', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Should import from tradeContext module
      expect(source).toContain(
        "from '@/features/architect/utils/tradeContext'"
      );

      // Should import the core functions
      expect(source).toContain('buildPostTradeTeamsSnapshot');
      expect(source).toContain('validatePostTradeSnapshotForContext');
      expect(source).toContain('assertTradeComputeInputs');
    });

    it('should re-export core trade context functions (Phase 59: not validateTradeForContext)', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Should re-export core functions for backward compatibility
      expect(source).toContain('export {');
      expect(source).toContain('buildPostTradeTeamsSnapshot');
      expect(source).toContain('validatePostTradeSnapshotForContext');

      // Phase 59: validateTradeForContext moved to legacy namespace
      // mutationPipeline should NOT re-export it
      expect(source).toContain(
        'Phase 59: Legacy helpers moved to tradeContext/legacy/'
      );
    });
  });

  describe('Test 12: computeTradeResult uses shared assertions', () => {
    it('should call assertTradeComputeInputs in computeTradeResult', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Extract computeTradeResult function
      const fnStart = 'function computeTradeResult({';
      const fnEnd = '\nfunction computeSigningResult';

      const regionCode = extractRegion(source, fnStart, fnEnd);

      // Should use the shared assertion
      expect(regionCode).toContain('assertTradeComputeInputs');
    });
  });
});
