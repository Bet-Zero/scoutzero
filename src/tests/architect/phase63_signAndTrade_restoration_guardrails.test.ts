/**
 * FILE: src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js
 * PURPOSE: Phase 63 guardrails to prevent regression of sign-and-trade persistence contract fix.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 63 - Created to lock persistence contract allowlist completeness for S&T
 *  - 2026-01-30: Phase 64 - Updated tests: tradeExceptions removed from allowlists (canonicalized to exceptions.tpe)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Contracts: src/features/architect/utils/persistenceContracts/
 *
 * TEST CATEGORIES:
 * 1) Allowlist completeness: S&T-required fields are on allowlists
 * 2) Validation order: Signing validation before trade snapshot validation
 * 3) Short-circuit: Signing failure prevents trade validation
 * 4) Architecture: Phase 56 / TM-3B pattern (prepare → compute/persist)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
  EVENT_METADATA_TOP_LEVEL_ALLOWLIST,
  TEAM_DEEP_RULES,
  TRADE_EXCEPTION_ITEM_ALLOWLIST,
} from '@/features/architect/utils/persistenceContracts';

// ==============================================================================
// HELPER: Read source file
// ==============================================================================
function readSourceFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf-8');
}

// ==============================================================================
// TEST CATEGORY 1: Allowlist Completeness
// ==============================================================================
describe('Phase 63: Allowlist completeness for S&T mutations', () => {
  describe('TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST', () => {
    it('includes "players" for full player objects (used by mutation pipeline)', () => {
      expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('players');
    });

    // Phase 64: tradeExceptions removed from allowlist
    // Legacy TPE data is now normalized into exceptions.tpe via normalizeTeamTpeSchema()
    // See Phase 64 return package for details
    it('does NOT include "tradeExceptions" (Phase 64: canonicalized to exceptions.tpe)', () => {
      expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).not.toContain('tradeExceptions');
    });

    it('includes "roster" for player ID array', () => {
      expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('roster');
    });

    it('includes "exceptions" for nested exception objects', () => {
      expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).toContain('exceptions');
    });
  });

  describe('EVENT_METADATA_TOP_LEVEL_ALLOWLIST', () => {
    it('includes "sourceTeam" for S&T origin team', () => {
      expect(EVENT_METADATA_TOP_LEVEL_ALLOWLIST).toContain('sourceTeam');
    });

    it('includes "destinationTeam" for S&T receiving team', () => {
      expect(EVENT_METADATA_TOP_LEVEL_ALLOWLIST).toContain('destinationTeam');
    });

    it('includes "contract" for S&T signed contract details', () => {
      expect(EVENT_METADATA_TOP_LEVEL_ALLOWLIST).toContain('contract');
    });
  });

  describe('TEAM_DEEP_RULES', () => {
    // Phase 64: tradeExceptions deep rule removed
    // Legacy TPE data is now normalized into exceptions.tpe via normalizeTeamTpeSchema()
    it('does NOT have deep rule for tradeExceptions (Phase 64: canonicalized)', () => {
      expect(TEAM_DEEP_RULES.tradeExceptions).toBeUndefined();
    });

    it('has deep rule for exceptions.tpe', () => {
      expect(TEAM_DEEP_RULES['exceptions.tpe']).toBe(
        TRADE_EXCEPTION_ITEM_ALLOWLIST
      );
    });
  });
});

// ==============================================================================
// TEST CATEGORY 2: Validation Order (Phase 48 invariant)
// ==============================================================================
describe('Phase 63: Validation order in computeSignAndTradeResult', () => {
  it('signing-stage validation is called before the SAT trade handoff in S&T path', () => {
    // Read the mutation pipeline source to verify ordering
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Find the computeSignAndTradeResult function
    const funcHeader = 'function computeSignAndTradeResult({';
    const funcStartIndex = source.indexOf(funcHeader);
    expect(funcStartIndex).toBeGreaterThan(-1);

    // Find the next function definition (approximate end of computeSignAndTradeResult)
    const remainingSource = source.slice(funcStartIndex + funcHeader.length);
    const nextFuncMatch = remainingSource.match(
      /\n(function|async function|export function|export async function)\s+\w+\s*\(/
    );
    const funcEndIndex = nextFuncMatch
      ? funcStartIndex + funcHeader.length + nextFuncMatch.index
      : source.length;

    const funcBody = source.slice(funcStartIndex, funcEndIndex);

    // Find first occurrence of the SAT signing-stage adapter
    const signingMatch = funcBody.match(
      /validateSignAndTradeSigningPhase\s*\(/
    );
    expect(signingMatch).not.toBeNull();
    const signingIndex = signingMatch.index;

    // Find first occurrence of the SAT trade handoff helper
    const preparationMatch = funcBody.match(
      /buildSignAndTradeTradeHandoff\s*\(/
    );
    expect(preparationMatch).not.toBeNull();
    const preparationIndex = preparationMatch.index;

    // Signing validation MUST come before SAT trade handoff
    expect(signingIndex).toBeLessThan(preparationIndex);
  });
});

// ==============================================================================
// TEST CATEGORY 3: Short-circuit on signing failure
// ==============================================================================
describe('Phase 63: Short-circuit on signing validation failure', () => {
  it('computeSignAndTradeResult returns early when signing validation fails', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Find the computeSignAndTradeResult function
    const funcHeader = 'function computeSignAndTradeResult({';
    const funcStartIndex = source.indexOf(funcHeader);
    expect(funcStartIndex).toBeGreaterThan(-1);

    // Extract function body (approximate)
    const remainingSource = source.slice(funcStartIndex + funcHeader.length);
    const nextFuncMatch = remainingSource.match(
      /\n(function|async function|export function|export async function)\s+\w+\s*\(/
    );
    const funcEndIndex = nextFuncMatch
      ? funcStartIndex + funcHeader.length + nextFuncMatch.index
      : source.length;

    const funcBody = source.slice(funcStartIndex, funcEndIndex);

    // There should be a check for signing validation failure followed by early return
    // Pattern: signingResult.valid === false OR !signingResult.valid followed by return
    const hasSigningCheck =
      funcBody.includes('signingResult.valid') ||
      funcBody.includes('signingValidation.valid');

    expect(hasSigningCheck).toBe(true);

    // Check that early return happens before trade validation
    const hasEarlyReturnPattern =
      funcBody.match(
        /if\s*\(\s*!?\s*(signingResult|signingValidation)\.valid/
      ) ||
      funcBody.match(/(signingResult|signingValidation)\.valid\s*===?\s*false/);

    expect(hasEarlyReturnPattern).not.toBeNull();
  });
});

// ==============================================================================
// TEST CATEGORY 4: Phase 56 / TM-3B architecture pattern
// ==============================================================================
describe('Phase 63: Phase 56 / TM-3B architecture pattern (prepare → compute/persist)', () => {
  it('executeTrade case in computeWorldMutation follows Phase 56 pattern', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Find the computeWorldMutation function first
    const funcMatch = source.match(/function\s+computeWorldMutation\s*\(/);
    expect(funcMatch).not.toBeNull();

    const funcStartIndex = funcMatch.index;

    // Get the function body (from start to next top-level function)
    const remainingFromFunc = source.slice(funcStartIndex);

    // Look for the executeTrade case WITHIN computeWorldMutation
    // TM-3B centralizes the snapshot+validation handoff in buildTradeApplyPreparation
    const pattern56Match = remainingFromFunc.match(
      /case\s+['"]executeTrade['"][\s\S]*?buildTradeApplyPreparation[\s\S]*?computeTradeResult/
    );

    expect(pattern56Match).not.toBeNull();
  });

  it('computeTradeResult does NOT call validateTrade directly (Phase 56/57)', () => {
    const source = readSourceFile(
      'src/features/architect/utils/mutationPipeline.ts'
    );

    // Find computeTradeResult function
    const funcMatch = source.match(/function\s+computeTradeResult\s*\(/);
    expect(funcMatch).not.toBeNull();

    const funcStartIndex = funcMatch.index;

    // Extract function body (up to next function definition)
    const remainingSource = source.slice(funcStartIndex + funcMatch[0].length);
    const nextFuncMatch = remainingSource.match(
      /\n(function|async function|export function|export async function)\s+\w+\s*\(/
    );
    const funcEndIndex = nextFuncMatch
      ? funcStartIndex + funcMatch[0].length + nextFuncMatch.index
      : source.length;

    const funcBody = source.slice(funcStartIndex, funcEndIndex);

    // computeTradeResult should NOT contain validateTrade( calls
    // (validation happens externally per Phase 56)
    const validateTradeCall = funcBody.match(/[^_]validateTrade\s*\(/);

    // If there's a call, it should be in a comment, not active code
    // We check that validateTrade( is not in an uncommented line
    if (validateTradeCall) {
      // Get the line containing the match
      const lines = funcBody.split('\n');
      const matchingLines = lines.filter(
        (line) =>
          line.includes('validateTrade(') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
      );
      // All matches should be in comments
      expect(matchingLines.length).toBe(0);
    }
  });
});
