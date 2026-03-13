/**
 * Phase 78 Guardrail Tests: Remove updateTeamCapTotals - SSOT-Only Totals
 *
 * PURPOSE: Prevent reintroduction of legacy totals helpers. After Phase 78,
 * there is exactly one way to compute team totals: computeTeamCapTotals(team, yearKey)
 *
 * These are source-scan guardrails - they read source files and verify:
 * 1. tradeManager.ts does NOT define updateTeamCapTotals
 * 2. Repo does NOT contain updateTeamCapTotals( function calls (excluding docs/return packages)
 * 3. tradeManager.ts imports computeTeamCapTotals from capTotals
 * 4. tradeManager.ts calls computeTeamCapTotals( at least once
 * 5. tradeManager.js remains a pure compatibility shim
 * 5. Phase 77 invariant preserved: seasonManager.js still uses SSOT (no legacy imports)
 *
 * @file src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// File paths
const TRADE_MANAGER_SHIM_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeManager.js'
);
const TRADE_MANAGER_AUTHORITY_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeManager.ts'
);
const SEASON_MANAGER_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/seasonManager.js'
);
const ARCHITECT_CORE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/architectCore.js'
);

describe('Phase 78: Remove updateTeamCapTotals - SSOT-Only Guardrails', () => {
  describe('Source Scan: Function Definition Removal', () => {
    it('TEST 1: tradeManager.ts does NOT define updateTeamCapTotals function', () => {
      const content = fs.readFileSync(TRADE_MANAGER_AUTHORITY_PATH, 'utf-8');

      // Check for function definition patterns
      const hasFunctionDefinition =
        /export\s+(?:async\s+)?function\s+updateTeamCapTotals\s*\(/.test(
          content
        );
      const hasConstArrowFunction =
        /(?:export\s+)?const\s+updateTeamCapTotals\s*=/.test(content);

      expect(hasFunctionDefinition).toBe(false);
      expect(hasConstArrowFunction).toBe(false);
    });

    it('TEST 2: tradeManager.js remains a pure compatibility shim', () => {
      const content = fs.readFileSync(TRADE_MANAGER_SHIM_PATH, 'utf-8').trim();

      expect(content).toBe("export * from './tradeManager.ts';");
    });

    it('TEST 3: architectCore.js does NOT export updateTeamCapTotals', () => {
      const content = fs.readFileSync(ARCHITECT_CORE_PATH, 'utf-8');

      // Check for export of updateTeamCapTotals (not in comments)
      const lines = content.split('\n');
      const nonCommentLines = lines.filter(
        (line) => !line.trim().startsWith('//')
      );
      const codeContent = nonCommentLines.join('\n');

      // Should not have updateTeamCapTotals as an export item
      const hasExport = /\bexport\s*\{[^}]*\bupdateTeamCapTotals\b[^}]*\}/.test(
        codeContent
      );

      expect(hasExport).toBe(false);
    });
  });

  describe('Source Scan: SSOT Import Presence', () => {
    it('TEST 4: tradeManager.ts imports computeTeamCapTotals from capTotals', () => {
      const content = fs.readFileSync(TRADE_MANAGER_AUTHORITY_PATH, 'utf-8');

      // Must have import from capTotals barrel
      const hasImport =
        /import\s*\{[^}]*\bcomputeTeamCapTotals\b[^}]*\}\s*from\s*['"]@\/features\/architect\/utils\/capTotals['"]/.test(
          content
        );

      expect(hasImport).toBe(true);
    });
  });

  describe('Source Scan: SSOT Usage', () => {
    it('TEST 5: tradeManager.ts calls computeTeamCapTotals( at least once', () => {
      const content = fs.readFileSync(TRADE_MANAGER_AUTHORITY_PATH, 'utf-8');

      // Remove comments to check actual code
      const contentWithoutComments = content.replace(
        /\/\/.*|\/\*[\s\S]*?\*\//g,
        ''
      );

      // Must have actual function call (not import)
      const hasFunctionCall = /\bcomputeTeamCapTotals\s*\([^)]*\)/.test(
        contentWithoutComments
      );

      expect(hasFunctionCall).toBe(true);
    });

    it('TEST 6: tradeManager.ts does NOT call updateTeamCapTotals( anywhere (except comments)', () => {
      const content = fs.readFileSync(TRADE_MANAGER_AUTHORITY_PATH, 'utf-8');

      // Remove comments to check actual code
      const contentWithoutComments = content.replace(
        /\/\/.*|\/\*[\s\S]*?\*\//g,
        ''
      );

      // Must NOT have legacy function call
      const hasLegacyCall = /\bupdateTeamCapTotals\s*\(/.test(
        contentWithoutComments
      );

      expect(hasLegacyCall).toBe(false);
    });
  });

  describe('Phase 77 Invariant Preservation', () => {
    it('TEST 7: seasonManager.js does NOT call updateTeamCapTotals (except in comments)', () => {
      const content = fs.readFileSync(SEASON_MANAGER_PATH, 'utf-8');

      // Remove comments
      const contentWithoutComments = content.replace(
        /\/\/.*|\/\*[\s\S]*?\*\//g,
        ''
      );

      // Must NOT have actual updateTeamCapTotals function call
      expect(contentWithoutComments).not.toMatch(/updateTeamCapTotals\s*\(/);

      // Must NOT have dynamic import of updateTeamCapTotals
      expect(contentWithoutComments).not.toMatch(
        /import\s*\(['"]\.\/tradeManager['"]\)/
      );
    });

    it('TEST 8: seasonManager.js imports computeTeamCapTotals from capTotals', () => {
      const content = fs.readFileSync(SEASON_MANAGER_PATH, 'utf-8');

      // Must have import from capTotals barrel
      const hasImport =
        /import\s*\{[^}]*\bcomputeTeamCapTotals\b[^}]*\}\s*from\s*['"]@\/features\/architect\/utils\/capTotals['"]/.test(
          content
        );

      expect(hasImport).toBe(true);
    });

    it('TEST 9: seasonManager.js calls computeTeamCapTotals( at least once', () => {
      const content = fs.readFileSync(SEASON_MANAGER_PATH, 'utf-8');

      // Remove comments to check actual code
      const contentWithoutComments = content.replace(
        /\/\/.*|\/\*[\s\S]*?\*\//g,
        ''
      );

      // Must have actual function call
      const hasFunctionCall = /\bcomputeTeamCapTotals\s*\([^)]*\)/.test(
        contentWithoutComments
      );

      expect(hasFunctionCall).toBe(true);
    });
  });

  describe('SSOT Invariant: No Legacy Totals Helpers in Runtime Code', () => {
    it('TEST 10: Verify SSOT-only totals across core modules', () => {
      // Check that key architect modules don't have legacy helpers
      const coreModules = [
        TRADE_MANAGER_SHIM_PATH,
        TRADE_MANAGER_AUTHORITY_PATH,
        SEASON_MANAGER_PATH,
        path.resolve(
          __dirname,
          '../../features/architect/utils/mutationPipeline.js'
        ),
      ];

      coreModules.forEach((modulePath) => {
        if (fs.existsSync(modulePath)) {
          const content = fs.readFileSync(modulePath, 'utf-8');
          const contentWithoutComments = content.replace(
            /\/\/.*|\/\*[\s\S]*?\*\//g,
            ''
          );

          // Should NOT have calculateTeamTotals calls (removed in Phase 72)
          const hasLegacyCalculate = /\bcalculateTeamTotals\s*\(/.test(
            contentWithoutComments
          );
          expect(
            hasLegacyCalculate,
            `${path.basename(modulePath)} should not have calculateTeamTotals`
          ).toBe(false);

          // Should NOT have updateTeamCapTotals calls (removed in Phase 78)
          const hasLegacyUpdate = /\bupdateTeamCapTotals\s*\(/.test(
            contentWithoutComments
          );
          expect(
            hasLegacyUpdate,
            `${path.basename(modulePath)} should not have updateTeamCapTotals`
          ).toBe(false);
        }
      });
    });
  });
});
