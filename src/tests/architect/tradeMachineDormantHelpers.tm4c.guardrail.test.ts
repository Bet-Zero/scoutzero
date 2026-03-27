/**
 * FILE: src/tests/architect/tradeMachineDormantHelpers.tm4c.guardrail.test.ts
 * PURPOSE: Guardrail coverage for TM-4C dormant Trade Machine helper retirement.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const guardrailPath = path.resolve(
  repoRoot,
  'src/tests/architect/tradeMachineDormantHelpers.tm4c.guardrail.test.ts'
);
const retiredHelperPaths = [
  'src/features/architect/utils/tradeMachine/rules/rosterValidation.ts',
  'src/features/architect/utils/tradeMachine/rules/enforcement.ts',
] as const;
const retiredRosterRuleExports = [
  'validateRosterWindow',
  'enforceRosterRules',
  'enforceRosterWindowAdvanced',
  'enforceRosterWindowLegacy',
  'validateRosterWindowLegacy',
] as const;
const searchRoots = [
  path.resolve(repoRoot, 'src'),
  path.resolve(repoRoot, 'tests'),
] as const;

function collectSourceFiles(rootDir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath, files);
      continue;
    }

    if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isRetiredHelperSpecifier(
  specifier: string,
  filePath: string
): boolean {
  const normalizedSpecifier = specifier.replace(/\\/g, '/');
  const normalizedFilePath = filePath.replace(/\\/g, '/');

  if (
    normalizedSpecifier === './rosterValidation' ||
    normalizedSpecifier === './enforcement'
  ) {
    return normalizedFilePath.includes('/tradeMachine/rules/');
  }

  if (
    normalizedSpecifier === '../rules/rosterValidation' ||
    normalizedSpecifier === '../rules/enforcement'
  ) {
    return normalizedFilePath.includes('/tradeMachine/');
  }

  return (
    normalizedSpecifier.includes('tradeMachine/rules/rosterValidation') ||
    normalizedSpecifier.includes('tradeMachine/rules/enforcement') ||
    normalizedSpecifier.endsWith('/rules/rosterValidation') ||
    normalizedSpecifier.endsWith('/rules/enforcement')
  );
}

function findRetiredHelperImports() {
  const violations: Array<{ file: string; line: number; content: string }> = [];

  for (const rootDir of searchRoots) {
    for (const filePath of collectSourceFiles(rootDir)) {
      if (filePath === guardrailPath) continue;

      const lines = fs.readFileSync(filePath, 'utf8').split('\n');

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        if (
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('*') ||
          trimmedLine.startsWith('/*')
        ) {
          return;
        }

        const matches = line.matchAll(
          /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
        );

        for (const match of matches) {
          const specifier = match[1] || match[2];

          if (!specifier || !isRetiredHelperSpecifier(specifier, filePath)) {
            continue;
          }

          violations.push({
            file: path.relative(repoRoot, filePath),
            line: index + 1,
            content: trimmedLine,
          });
        }
      });
    }
  }

  return violations;
}

describe('TM-4C dormant helper retirement guardrails', () => {
  it('keeps retired helper authority files absent', () => {
    const existingPaths = retiredHelperPaths.filter((relativePath) =>
      fs.existsSync(path.resolve(repoRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  it('keeps src and tests free of retired helper imports', () => {
    expect(findRetiredHelperImports()).toEqual([]);
  });

  it('keeps the rules barrel free of retired roster helper exports', async () => {
    const rules = (await import('@/features/architect/utils/tradeMachine/rules')) as Record<
      string,
      unknown
    >;

    retiredRosterRuleExports.forEach((exportName) => {
      expect(rules).not.toHaveProperty(exportName);
    });
  });

  it('keeps the public Trade Machine roster helper aligned with validateRoster.ts', async () => {
    const tradeMachine = (await import(
      '@/features/architect/utils/tradeMachine'
    )) as Record<string, unknown>;
    const validateRoster = await import(
      '@/features/architect/utils/tradeMachine/rules/validateRoster'
    );

    expect(tradeMachine.enforceRosterWindow).toBe(
      validateRoster.enforceRosterWindow
    );
  });
});
