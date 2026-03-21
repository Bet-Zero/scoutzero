/**
 * FILE: src/tests/architect/finalArchitectInventoryGate.e132.guardrail.test.ts
 * PURPOSE: Final Phase 7E inventory gate for remaining Architect JS/JSX surfaces.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E132 - Added the final inventory, parity, and explicit-import allowlist guardrail.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const architectRoot = path.join(repoRoot, 'src/features/architect');

const componentCompatSurfaces = [
  'capSheet/CapSheet/CapSheet.jsx',
  'capSheet/CapSheet/CapSummaryTiles.jsx',
  'capSheet/CapSheetFull/CapSheetFull.jsx',
  'capSheet/ExceptionTracker/ExceptionTracker.jsx',
  'capSheet/modals/ManageDeadMoneyModal.jsx',
  'capSheet/modals/ManageExceptionsModal.jsx',
  'contract/ContractEditor/ContractEditor.jsx',
  'contract/ContractEditorModal/ContractEditorModal.jsx',
  'freeAgency/FreeAgentPool/FreeAgentCard.jsx',
  'freeAgency/FreeAgentPool/FreeAgentPool.jsx',
  'freeAgency/FreeAgentPool/FreeAgentRow.jsx',
  'shared/RosterVisual/RosterVisual.jsx',
  'shared/ValidationWarnings/ValidationWarnings.jsx',
] as const;

const hookCompatSurfaces = [
  'hooks/useArchitectPlayerData.js',
  'hooks/useCapValidation.js',
  'hooks/usePlayerRulesProfiles.js',
  'hooks/useTradeMachine.js',
  'hooks/useTradeMachineSnapshot.js',
] as const;

const utilityCompatSurfaces = [
  'utils/capProjections.js',
  'utils/exceptions/exceptionLifecycle.js',
] as const;

const legacyCompatContracts = ['utils/tradeContext/legacy/index.js'] as const;

const intentionalNonTwinCompatEntries = [
  'utils/draftPickUtils.js',
  'utils/tradeMachine/rules/enforceEligibility.js',
] as const;

const embeddedTestArtifacts = ['utils/validatePhase21.test.js'] as const;

const samePathCompatSurfaces = [
  ...componentCompatSurfaces,
  ...hookCompatSurfaces,
  ...utilityCompatSurfaces,
  ...legacyCompatContracts,
].sort() as string[];

const exactRemainingInventory = [
  ...samePathCompatSurfaces,
  ...intentionalNonTwinCompatEntries,
  ...embeddedTestArtifacts,
].sort() as string[];

const allowedSourceExplicitArchitectImports = [] as const;

const allowedTestExplicitArchitectCompatSpecifiers = [
  '../../features/architect/contract/ContractEditorModal/ContractEditorModal.jsx',
  '../../features/architect/hooks/useCapValidation.js',
  '../../features/architect/hooks/usePlayerRulesProfiles.js',
  '../../features/architect/hooks/useTradeMachine.js',
  '../../features/architect/hooks/useTradeMachineSnapshot.js',
  '@/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx',
  '@/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx',
  '@/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx',
  '@/features/architect/utils/capProjections.js',
  '@/features/architect/utils/exceptions/exceptionLifecycle.js',
  '@/features/architect/utils/tradeContext/legacy/index.js',
  '@/features/architect/utils/tradeMachine/rules/enforceEligibility.js',
].sort() as string[];

function normalizeRelative(filePath: string) {
  return filePath.replaceAll(path.sep, '/');
}

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

function extractExplicitArchitectImportSpecifiers(content: string) {
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

function collectExplicitArchitectImports(baseDir: string) {
  const absoluteBaseDir = path.join(repoRoot, baseDir);

  return walkFiles(absoluteBaseDir)
    .filter((filePath) => !filePath.endsWith('.md'))
    .flatMap((filePath) =>
      extractExplicitArchitectImportSpecifiers(fs.readFileSync(filePath, 'utf-8')).map(
        (specifier) => ({
          importer: normalizeRelative(path.relative(repoRoot, filePath)),
          specifier,
        })
      )
    );
}

function findAuthorityPath(relativePath: string) {
  const shimAbsolutePath = path.join(architectRoot, relativePath);
  const parsedPath = path.parse(shimAbsolutePath);
  const candidateTsPath = path.join(parsedPath.dir, `${parsedPath.name}.ts`);
  const candidateTsxPath = path.join(parsedPath.dir, `${parsedPath.name}.tsx`);

  if (fs.existsSync(candidateTsPath)) {
    return normalizeRelative(path.relative(architectRoot, candidateTsPath));
  }

  if (fs.existsSync(candidateTsxPath)) {
    return normalizeRelative(path.relative(architectRoot, candidateTsxPath));
  }

  throw new Error(`Missing TS/TSX authority for ${relativePath}`);
}

function toArchitectTestSpecifier(relativePath: string) {
  return `../../features/architect/${relativePath}`;
}

describe('E132 final Architect inventory gate', () => {
  it('freezes the exact remaining Architect JS/JSX inventory at 24 files', () => {
    expect(listArchitectJsJsxFiles()).toEqual(exactRemainingInventory);
    expect(exactRemainingInventory).toHaveLength(24);
  });

  it('freezes the exact remaining same-path compatibility surface inventory at 21 files', () => {
    const actualSamePathCompatSurfaces = listArchitectJsJsxFiles().filter((relativePath) => {
      if (relativePath.endsWith('.test.js')) return false;
      const absolutePath = path.join(architectRoot, relativePath);
      const parsedPath = path.parse(absolutePath);
      return (
        fs.existsSync(path.join(parsedPath.dir, `${parsedPath.name}.ts`)) ||
        fs.existsSync(path.join(parsedPath.dir, `${parsedPath.name}.tsx`))
      );
    });

    expect(actualSamePathCompatSurfaces).toEqual(samePathCompatSurfaces);
    expect(samePathCompatSurfaces).toHaveLength(21);
  });

  it('freezes the non-twin and embedded-test exceptions explicitly', () => {
    expect(intentionalNonTwinCompatEntries).toEqual([
      'utils/draftPickUtils.js',
      'utils/tradeMachine/rules/enforceEligibility.js',
    ]);
    expect(embeddedTestArtifacts).toEqual(['utils/validatePhase21.test.js']);
  });

  for (const relativePath of samePathCompatSurfaces) {
    it(`keeps ${relativePath} aligned with its TS/TSX authority`, async () => {
      const shimSpecifier = toArchitectTestSpecifier(relativePath);
      const authorityRelativePath = findAuthorityPath(relativePath);
      const authoritySpecifier = toArchitectTestSpecifier(authorityRelativePath);
      const shimModule = (await import(shimSpecifier)) as Record<string, unknown>;
      const authorityModule = (await import(authoritySpecifier)) as Record<string, unknown>;
      const shimExportNames = Object.keys(shimModule).sort();
      const authorityExportNames = Object.keys(authorityModule).sort();

      expect(shimExportNames).toEqual(authorityExportNames);

      for (const exportName of authorityExportNames) {
        expect(shimModule[exportName]).toBe(authorityModule[exportName]);
      }
    });
  }

  it('keeps draftPickUtils.js as the standalone frozen-pick compatibility utility', () => {
    const source = fs.readFileSync(
      path.join(architectRoot, 'utils/draftPickUtils.js'),
      'utf-8'
    );

    expect(source).toContain('Compatibility surface for frozen-pick guardrail tests');
    expect(source).toContain('export function isFrozenPick');
    expect(source).toContain('export default { isFrozenPick };');
  });

  it('keeps enforceEligibility.js as the single explicit wrapper with no same-path TS twin', () => {
    const source = fs.readFileSync(
      path.join(architectRoot, 'utils/tradeMachine/rules/enforceEligibility.js'),
      'utf-8'
    );

    expect(source).toContain('Compatibility shim for the authoritative eligibility enforcement surface');
    expect(source.trim()).toContain("export { enforceEligibility } from './validateEligibility';");
  });

  it('allows only the one explicit Architect .js source import that is still intentional', () => {
    const sourceImports = collectExplicitArchitectImports('src').filter(
      ({ importer }) => !importer.startsWith('src/tests/')
    );

    expect(sourceImports).toEqual(allowedSourceExplicitArchitectImports);
  });

  it('allows only the documented explicit Architect .js/.jsx compatibility specifiers inside tests', () => {
    const testImportSpecifiers = collectExplicitArchitectImports('src')
      .filter(({ importer }) => importer.startsWith('src/tests/'))
      .concat(collectExplicitArchitectImports('tests'))
      .map(({ specifier }) => specifier)
      .sort();

    expect([...new Set(testImportSpecifiers)]).toEqual(
      allowedTestExplicitArchitectCompatSpecifiers
    );
  });
});
