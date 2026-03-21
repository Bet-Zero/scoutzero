/**
 * FILE: src/tests/architect/finalArchitectInventoryGate.e132.guardrail.test.ts
 * PURPOSE: Final inventory gate confirming zero JS/JSX files remain in Architect scope.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E132 - Original inventory, parity, and explicit-import allowlist guardrail.
 *  - 2026-03-21: Lane 1 cleanup - Rewritten to assert 0 remaining JS/JSX files after full shim deletion.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const architectRoot = path.resolve(__dirname, '../../features/architect');

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function normalizeRelative(filePath: string) {
  return filePath.replaceAll(path.sep, '/');
}

function listArchitectJsJsxFiles() {
  return walkFiles(architectRoot)
    .filter((filePath) => /\.(js|jsx)$/.test(filePath))
    .map((filePath) => normalizeRelative(path.relative(architectRoot, filePath)))
    .sort();
}

function stripComments(content: string) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function extractExplicitArchitectJsImportSpecifiers(content: string) {
  const withoutComments = stripComments(content);
  const importPattern =
    /(?:from\s*['"]([^'"]+\.(?:js|jsx))['"]|import\(\s*['"]([^'"]+\.(?:js|jsx))['"]\s*\))/gms;
  const specifiers: string[] = [];

  for (const match of withoutComments.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier.includes('features/architect')) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function collectExplicitArchitectJsImports(baseDir: string) {
  const repoRoot = path.resolve(__dirname, '../../..');
  const absoluteBaseDir = path.join(repoRoot, baseDir);

  return walkFiles(absoluteBaseDir)
    .filter((filePath) => !filePath.endsWith('.md'))
    .flatMap((filePath) =>
      extractExplicitArchitectJsImportSpecifiers(fs.readFileSync(filePath, 'utf-8')).map(
        (specifier) => ({
          importer: normalizeRelative(path.relative(repoRoot, filePath)),
          specifier,
        })
      )
    );
}

describe('E132 final Architect inventory gate — post-Lane-1', () => {
  it('has zero remaining JS/JSX files in the Architect scope', () => {
    const remaining = listArchitectJsJsxFiles();
    expect(remaining).toEqual([]);
  });

  it('has zero explicit .js/.jsx Architect import specifiers in source code', () => {
    const sourceImports = collectExplicitArchitectJsImports('src').filter(
      ({ importer }) => !importer.startsWith('src/tests/')
    );
    expect(sourceImports).toEqual([]);
  });

  it('has zero explicit .js/.jsx Architect import specifiers in tests', () => {
    const testImports = collectExplicitArchitectJsImports('src')
      .filter(({ importer }) => importer.startsWith('src/tests/'))
      .concat(collectExplicitArchitectJsImports('tests'));
    expect(testImports).toEqual([]);
  });
});
