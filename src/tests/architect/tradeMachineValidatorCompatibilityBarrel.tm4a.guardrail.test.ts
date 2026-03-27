/**
 * FILE: src/tests/architect/tradeMachineValidatorCompatibilityBarrel.tm4a.guardrail.test.ts
 * PURPOSE: Guardrail coverage for TM-4A validator compatibility barrel retirement.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const retiredBarrelPath = path.resolve(
  repoRoot,
  'src/features/architect/utils/tradeMachine/validators/index.ts'
);
const guardrailPath = path.resolve(
  repoRoot,
  'src/tests/architect/tradeMachineValidatorCompatibilityBarrel.tm4a.guardrail.test.ts'
);
const searchRoots = [
  path.resolve(repoRoot, 'src'),
  path.resolve(repoRoot, 'tests'),
] as const;

const retiredImportPatterns = [
  /from\s+['"][^'"]*tradeMachine\/validators(?:['"/])/,
  /import\(\s*['"][^'"]*tradeMachine\/validators(?:['"/])/,
];

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

function findRetiredImports() {
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

        if (retiredImportPatterns.some((pattern) => pattern.test(line))) {
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

describe('TM-4A validator compatibility barrel guardrails', () => {
  it('keeps the retired validators/index.ts barrel absent', () => {
    expect(fs.existsSync(retiredBarrelPath)).toBe(false);
  });

  it('keeps src and tests free of retired validator compatibility imports', () => {
    expect(findRetiredImports()).toEqual([]);
  });
});
