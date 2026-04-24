/**
 * FILE: src/tests/architect/phase59_legacy_import_guardrail.test.js
 * PURPOSE: Anti-regression guardrail tests for Phase 59 Legacy Trade Validation Retirement.
 *
 * These tests enforce that mutation modules cannot import legacy validation helpers,
 * preventing accidental regression to pre-Phase 56 architecture.
 *
 * ENFORCED INVARIANTS:
 * 1. mutationPipeline.ts must NOT import from tradeContext/legacy/
 * 2. mutationPipeline.ts must NOT reference validateTradeForPipeline (removed)
 * 3. mutationPipeline.ts must NOT reference legacy_validateTradeForContext
 * 4. No files in utils/ should import from tradeContext/legacy/ except tests
 * 5. legacy/index.ts remains the thin authoritative wrapper for deprecated helpers
 *
 * ALLOWED EXCEPTIONS:
 * - Test files may import from legacy/ for backward compatibility testing
 * - Only the legacy namespace itself may export deprecated compatibility helpers
 *
 * NOTE: This test reads source files as plain text and uses regex to detect violations.
 * It is designed to be fast and strict.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// Helper to read source file content
function readSourceFile(relativePath: string): string {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf-8');
}

// Helper to recursively find all .js files in a directory
function findJsFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip legacy directory (it's allowed to exist)
      if (item === 'legacy') continue;
      findJsFiles(fullPath, files);
    } else if (item.endsWith('.js') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Phase 59: Legacy Import Guardrails', () => {
  // ===========================================================================
  // TEST 1: mutationPipeline.ts must NOT import from tradeContext/legacy/
  // ===========================================================================
  describe('Test 1: mutationPipeline.ts must NOT import from legacy namespace', () => {
    it('should not import from tradeContext/legacy/', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Check for forbidden imports (actual import statements, not comments)
      const lines = source.split('\n');
      const violations: Array<{ line: number; content: string }> = [];

      lines.forEach((line, index) => {
        // Skip comments
        if (/^\s*\/\//.test(line)) return;
        if (/^\s*\*/.test(line)) return;

        // Check for actual import from legacy
        if (/^\s*import.*from\s+['"].*tradeContext\/legacy/.test(line)) {
          violations.push({ line: index + 1, content: line.trim() });
        }
      });

      expect(violations).toEqual([]);
    });

    it('should not reference legacy_validateTradeForContext', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Skip comments
      const lines = source.split('\n');
      const codeLines = lines.filter(
        (line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')
      );
      const codeOnly = codeLines.join('\n');

      expect(codeOnly).not.toContain('legacy_validateTradeForContext');
    });
  });

  // ===========================================================================
  // TEST 2: validateTradeForPipeline has been removed
  // ===========================================================================
  describe('Test 2: validateTradeForPipeline has been removed', () => {
    it('should not define validateTradeForPipeline function', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Check for function definition
      const fnDefPattern = /function\s+validateTradeForPipeline\s*\(/;
      const hasFnDef = fnDefPattern.test(source);

      expect(hasFnDef).toBe(false);
    });

    it('should not call validateTradeForPipeline anywhere', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      // Skip comments and the marker that says it was removed
      const lines = source.split('\n');
      const violations: Array<{ line: number; content: string }> = [];

      lines.forEach((line, index) => {
        // Skip comments
        if (/^\s*\/\//.test(line)) return;
        if (/^\s*\*/.test(line)) return;

        // Check for function call (not just mention in a string)
        if (/validateTradeForPipeline\s*\(/.test(line)) {
          violations.push({ line: index + 1, content: line.trim() });
        }
      });

      expect(violations).toEqual([]);
    });
  });

  // ===========================================================================
  // TEST 3: Legacy namespace has correct structure and warnings
  // ===========================================================================
  describe('Test 3: Legacy namespace has correct structure', () => {
    it('should have loud deprecation warnings', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/legacy/index.ts'
      );

      // Must have warning emojis and clear deprecation message
      expect(source).toContain('⚠️⚠️⚠️');
      expect(source).toContain('LEGACY NAMESPACE');
      expect(source).toContain('DEPRECATED');
    });

    it('should explicitly forbid mutation module imports', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/legacy/index.ts'
      );

      expect(source).toContain('DO NOT IMPORT IN MUTATION MODULES');
      expect(source).toContain('mutationPipeline.ts');
    });

    it('should export legacy_validateTradeForContext and validateTradeForContext alias from legacy/index.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/legacy/index.ts'
      );

      expect(source).toContain(
        'export function legacy_validateTradeForContext'
      );
      expect(source).toContain('export const validateTradeForContext');
    });

    it('should preserve the exact Date.now -> build snapshot -> validate call order in legacy/index.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/legacy/index.ts'
      );

      const timestampIndex = source.indexOf('Date.now()');
      const buildIndex = source.indexOf('buildPostTradeTeamsSnapshot({');
      const validateIndex = source.indexOf(
        'validatePostTradeSnapshotForContext({ snapshot, payload, seasonId })'
      );

      expect(timestampIndex).toBeGreaterThan(-1);
      expect(buildIndex).toBeGreaterThan(timestampIndex);
      expect(validateIndex).toBeGreaterThan(buildIndex);
    });

    it('confirms legacy/index.js shim has been deleted (TS authority owns the surface)', () => {
      expect(
        existsSync(resolve(process.cwd(), 'src/features/architect/utils/tradeContext/legacy/index.js'))
      ).toBe(false);
    });
  });

  // ===========================================================================
  // TEST 4: Main barrel stays canonical-only while legacy owns compatibility
  // ===========================================================================
  describe('Test 4: Canonical vs legacy export boundary', () => {
    it('should not re-export legacy helpers from tradeContext/index.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/index.ts'
      );

      expect(source).not.toContain("from './legacy'");
      expect(source).not.toContain('validateTradeForContext,');
      expect(source).not.toContain('legacy_validateTradeForContext,');
      expect(source).not.toContain('getFullLegalityPreview,');
    });

    it('should document the canonical-only boundary clearly', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/index.ts'
      );

      expect(source).toContain('CANONICAL EXPORTS');
      expect(source).toContain('LEGACY COMPATIBILITY IMPORTS');
    });

    it('should preserve direct legacy namespace import compatibility via TS authority', async () => {
      const legacyNamespace = await import(
        '@/features/architect/utils/tradeContext/legacy'
      );

      expect(legacyNamespace.legacy_validateTradeForContext).toBeTypeOf(
        'function'
      );
      expect(legacyNamespace.validateTradeForContext).toBe(
        legacyNamespace.legacy_validateTradeForContext
      );
      expect(legacyNamespace.getFullLegalityPreview).toBeTypeOf('function');
    });
  });

  // ===========================================================================
  // TEST 5: No mutation utils import from legacy namespace
  // ===========================================================================
  describe('Test 5: Mutation utility files must not import from legacy', () => {
    it('should not have any architect util files importing from legacy', () => {
      const utilsDir = resolve(process.cwd(), 'src/features/architect/utils');
      const files = findJsFiles(utilsDir);

      const violations: string[] = [];

      for (const filePath of files) {
        // Skip legacy directory itself
        if (filePath.includes('/legacy/')) continue;

        const source = readFileSync(filePath, 'utf-8');
        const lines = source.split('\n');

        // Check for actual import statements from legacy (not comments)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip comments
          if (/^\s*\/\//.test(line)) continue;
          if (/^\s*\*/.test(line)) continue;

          // Check for actual import from legacy
          if (
            /^\s*import.*from\s+['"].*\/legacy['"]/.test(line) ||
            /^\s*import.*from\s+['"].*\/legacy\//.test(line)
          ) {
            violations.push(`${filePath}:${i + 1}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // ===========================================================================
  // TEST 6: Phase 59 marker comments exist in modified files
  // ===========================================================================
  describe('Test 6: Phase 59 changes are documented in source', () => {
    it('should have Phase 59 marker in mutationPipeline.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/mutationPipeline.ts'
      );

      expect(source).toContain('Phase 59');
    });

    it('should have Phase 59 marker in tradeContext/tradeContext.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/tradeContext.ts'
      );

      expect(source).toContain('Phase 59');
    });

    it('should have Phase 59 marker in tradeContext/index.ts', () => {
      const source = readSourceFile(
        'src/features/architect/utils/tradeContext/index.ts'
      );

      expect(source).toContain('Phase 59');
    });
  });
});
