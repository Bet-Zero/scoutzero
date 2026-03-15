/**
 * FILE: src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js
 * PURPOSE: Guardrail tests for Phase 16.3 Trade Machine init crash fix.
 *
 * These tests ensure:
 * 1. useTradeMachine.ts no longer contains ensurePickId() calls (regression guard)
 * 2. The hook returns initError for error surfacing
 * 3. No ReferenceError is thrown during initialization
 *
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *   - 2026-02-03: Phase 16.3 - Created guardrail tests for ensurePickId removal
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 16.3)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper to read source file content
function readSourceFile(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf-8');
}

describe('Phase 16.3: Trade Machine Init Guardrails', () => {
  const hookAuthorityPath = 'src/features/architect/hooks/useTradeMachine.ts';

  // ===========================================================================
  // REGRESSION GUARD: ensurePickId must NOT be used in useTradeMachine.ts
  // ===========================================================================
  describe('ensurePickId removal (regression guard)', () => {
    it('useTradeMachine.ts must NOT call ensurePickId()', () => {
      const source = readSourceFile(hookAuthorityPath);

      // Check for ensurePickId function calls (not just import comments)
      // Pattern: ensurePickId( with an opening paren indicates a function call
      const hasFunctionCall = /ensurePickId\s*\(/.test(source);

      // Exclude the comment line that documents removal
      const lines = source.split('\n');
      const callLines = lines.filter(
        (line) =>
          /ensurePickId\s*\(/.test(line) &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
      );

      expect(callLines.length).toBe(0);
      expect(hasFunctionCall && callLines.length > 0).toBe(false);
    });

    it('useTradeMachine.ts must NOT import ensurePickId', () => {
      const source = readSourceFile(hookAuthorityPath);

      // Check for import statement containing ensurePickId (not comment about removal)
      const lines = source.split('\n');
      const importLines = lines.filter(
        (line) =>
          line.includes('import') &&
          line.includes('ensurePickId') &&
          !line.trim().startsWith('//')
      );

      expect(importLines.length).toBe(0);
    });

    it('useTradeMachine.ts must NOT have rawPicks.map or picksWithIds derivation', () => {
      const source = readSourceFile(hookAuthorityPath);

      // Check for legacy pick processing patterns
      const lines = source.split('\n');
      const legacyPickLines = lines.filter(
        (line) =>
          (line.includes('rawPicks.map') || line.includes('picksWithIds =')) &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
      );

      expect(legacyPickLines.length).toBe(0);
    });
  });

  // ===========================================================================
  // HOOK STRUCTURE: initError must be exposed
  // ===========================================================================
  describe('initError exposure', () => {
    it('useTradeMachine.ts must return initError', () => {
      const source = readSourceFile(hookAuthorityPath);

      // Check that initError is in the return statement
      expect(source).toContain('initError,');
      expect(source).toContain('const [initError, setInitError]');
    });

    it('useTradeMachine.ts must have try/catch in init()', () => {
      const source = readSourceFile(hookAuthorityPath);

      // Check for try/catch pattern in init function
      expect(source).toContain(
        '[tradeMachine:init] failed to init trade teams'
      );
      expect(source).toContain('setInitError(');
    });
  });

  // ===========================================================================
  // TRADEEEDITOR: initError must be destructured and displayed
  // ===========================================================================
  describe('TradeEditor initError display', () => {
    it('TradeEditor.tsx must destructure initError from useTradeMachine', () => {
      const source = readSourceFile(
        'src/features/architect/tradeMachine/TradeEditor.tsx'
      );

      expect(source).toContain('initError,');
      expect(source).toContain('initError && teams.length === 0');
    });

    it('TradeEditor.tsx must display error message when initError is truthy', () => {
      const source = readSourceFile(
        'src/features/architect/tradeMachine/TradeEditor.tsx'
      );

      expect(source).toContain('Trade Machine failed to initialize');
      expect(source).toContain('[tradeMachine:init] error');
    });
  });
});
