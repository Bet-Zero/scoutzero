/**
 * FILE: src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js
 * PURPOSE: Guardrail test to prevent apron logic drift by detecting raw apron comparisons
 *          added outside allowlisted canonical locations.
 * OWNERSHIP: Architect / CBA compliance
 *
 * HISTORY:
 *  - 2026-01-28: Phase 43 - Initial guardrail implementation
 *
 * STRATEGY:
 *  - Scans Architect source files for patterns that indicate direct apron derivation/gating
 *  - Maintains an allowlist of files where such patterns are expected (SSOT, UI-only, etc.)
 *  - Fails if new derivation patterns appear outside the allowlist
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// ALLOWLIST: Files permitted to contain raw apron comparison patterns
// ============================================================================
const ALLOWLIST = [
  // SSOT - canonical apron derivation logic lives here
  'src/features/architect/utils/tradeMachine/utils/capUtils.ts',
  'src/features/architect/utils/tradeMachine/utils/salaryMargin.ts',
  'src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts',

  // TradeMachine rule validators (internal to tradeMachine)
  'src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.ts',
  'src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts',
  'src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts',
  'src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.ts',
  'src/features/architect/utils/tradeMachine/rules/validateStepien.ts',
  'src/features/architect/utils/tradeMachine/rules/validateAggregation.ts',
  'src/features/architect/utils/tradeMachine/rules/basicRules.ts',

  // UI-only warning patterns (acceptable inline for display purposes)
  'src/features/architect/hooks/useCapValidation.ts',
  'src/features/architect/tradeMachine/FaExceptionTracker.tsx',

  // Hard cap utilities (threshold-based, not apron derivation)
  'src/features/architect/utils/hardCapUtils.ts',
];

// Patterns that indicate apron derivation/gating logic
// These detect direct comparisons like `salary > secondApron` or `total >= firstApron`
const DERIVATION_PATTERNS = [
  // Direct variable comparisons with apron thresholds
  /\b(teamSalary|totalSalary|projectedSalary|salary|teamTotalSalary|currentYearCapHit|projectedCap)\s*(>|>=)\s*(secondApron|firstApron)\b/g,
  /\b(secondApron|firstApron)\s*(<|<=)\s*(teamSalary|totalSalary|projectedSalary|salary|teamTotalSalary|currentYearCapHit|projectedCap)\b/g,
];

// Patterns in comments or docstrings are OK - we only care about code
const COMMENT_LINE_REGEX = /^\s*(\/\/|\/\*|\*)/;

type DerivationMatch = {
  line: number;
  content: string;
  match: string;
};

/**
 * Scans a file for derivation patterns and returns matches
 */
function scanFileForDerivationPatterns(filePath: string): DerivationMatch[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches: DerivationMatch[] = [];

  lines.forEach((line, index) => {
    // Skip comment lines
    if (COMMENT_LINE_REGEX.test(line)) return;

    for (const pattern of DERIVATION_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        matches.push({
          line: index + 1,
          content: line.trim(),
          match: match[0],
        });
      }
    }
  });

  return matches;
}

/**
 * Normalizes path for cross-platform comparison
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('Phase 43 Apron Drift Prevention Guardrails', () => {
  test('no raw apron derivation patterns outside allowlist', async () => {
    const projectRoot = process.cwd();
    const architectDir = path.join(projectRoot, 'src/features/architect');

    // Find all JS/TS files in architect directory
    const files = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: architectDir,
      ignore: ['**/node_modules/**', '**/*.test.js', '**/*.test.ts'],
    });

    const violations = [];

    for (const file of files) {
      const fullPath = path.join(architectDir, file);
      const relativePath = normalizePath(path.relative(projectRoot, fullPath));

      // Skip allowlisted files
      if (ALLOWLIST.some((allowed) => relativePath.includes(allowed))) {
        continue;
      }

      const matches = scanFileForDerivationPatterns(fullPath);
      if (matches.length > 0) {
        violations.push({
          file: relativePath,
          matches,
        });
      }
    }

    // Format violation report
    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `\n  ${v.file}:\n` +
            v.matches
              .map((m) => `    L${m.line}: ${m.match} in "${m.content}"`)
              .join('\n')
        )
        .join('');

      expect.fail(
        `Found apron derivation patterns outside allowlist:${report}\n\n` +
          'If these are intentional UI-only warnings, add the file to the ALLOWLIST in this test.\n' +
          'If these are derivation/gating logic, refactor to use canonical helpers from @/features/architect/utils/capUtils.'
      );
    }
  });

  test('allowlist files exist', () => {
    const projectRoot = process.cwd();

    // Verify that allowlisted files actually exist
    // This prevents stale allowlist entries
    const missingFiles = ALLOWLIST.filter((file) => {
      const fullPath = path.join(projectRoot, file);
      return !fs.existsSync(fullPath);
    });

    if (missingFiles.length > 0) {
      expect.fail(
        `Allowlist contains non-existent files:\n  ${missingFiles.join('\n  ')}\n\n` +
          'Remove these entries from the ALLOWLIST or verify the file paths.'
      );
    }
  });

  test('capUtils.ts points at the extensionless tradeMachine authority facade', () => {
    const projectRoot = process.cwd();
    const capUtilsTsPath = path.join(
      projectRoot,
      'src/features/architect/utils/capUtils.ts'
    );

    const authoritativeContent = fs.readFileSync(capUtilsTsPath, 'utf-8');

    expect(authoritativeContent).toContain(
      "from './tradeMachine/utils/capUtils'"
    );
    expect(authoritativeContent).not.toContain(
      "from './tradeMachine/utils/capUtils.js'"
    );
    expect(authoritativeContent).toContain('export { getTeamApronStatus');
    expect(authoritativeContent).toContain('isSecondApronTeam');
    expect(authoritativeContent).toContain('isFirstApronTeam');
  });

  test('buildRuleContext.ts uses canonical import path', () => {
    // Stage 6B: the canonical capUtils import was moved into the
    // co-located buildRuleContext.helpers.ts module that the main
    // buildRuleContext re-exports through. Concatenate both files so
    // the canonical-vs-relative import invariant remains checkable.
    const projectRoot = process.cwd();
    const buildRuleContextPath = path.join(
      projectRoot,
      'src/features/architect/utils/buildRuleContext.ts'
    );
    const buildRuleContextHelpersPath = path.join(
      projectRoot,
      'src/features/architect/utils/buildRuleContext.helpers.ts'
    );
    let content = fs.readFileSync(buildRuleContextPath, 'utf-8');
    if (fs.existsSync(buildRuleContextHelpersPath)) {
      content += fs.readFileSync(buildRuleContextHelpersPath, 'utf-8');
    }

    // Should NOT import directly from tradeMachine
    expect(content).not.toContain("from './tradeMachine/utils/capUtils");

    // Should import from canonical surface
    expect(content).toContain("from '@/features/architect/utils/capUtils'");
  });

  test('tradeHelpers.ts uses canonical extensionless helper imports', () => {
    const projectRoot = process.cwd();
    const tradeHelpersTsPath = path.join(
      projectRoot,
      'src/features/architect/utils/tradeHelpers.ts'
    );

    const authoritativeContent = fs.readFileSync(tradeHelpersTsPath, 'utf-8');

    expect(authoritativeContent).not.toContain(
      "from './tradeMachine/utils/capUtils"
    );
    expect(authoritativeContent).not.toContain(
      "@/features/architect/utils/cbaConstants.js"
    );
    expect(authoritativeContent).not.toContain(
      "@/features/architect/utils/hardCapUtils.js"
    );
    expect(authoritativeContent).not.toContain(
      "@/features/architect/utils/faExceptionUtils.js"
    );
    expect(authoritativeContent).not.toContain("from './seasonFormat.js'");
    expect(authoritativeContent).toContain(
      "from '@/features/architect/utils/capUtils'"
    );
    expect(authoritativeContent).toContain(
      "from '@/features/architect/utils/cbaConstants'"
    );
    expect(authoritativeContent).toContain(
      "from '@/features/architect/utils/hardCapUtils'"
    );
    expect(authoritativeContent).toContain(
      "from '@/features/architect/utils/faExceptionUtils'"
    );
    expect(authoritativeContent).toContain("from './seasonFormat'");
  });
});
