import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const authorityModuleSegments = [
  'tradeContext/tradeExecutionAuthority',
  'tradeContext\\tradeExecutionAuthority',
] as const;
const sourceRoots = [
  path.resolve(repoRoot, 'src'),
  path.resolve(repoRoot, 'tests'),
] as const;
const allowedAuthorityImportFiles = new Set([
  'src/features/architect/utils/mutationPipeline.ts',
  'src/features/architect/utils/mutationPipeline.validate.ts',
  'src/features/architect/utils/tradeContext/tradeContext.ts',
  'src/features/architect/utils/tradeContext/index.ts',
]);
const allowedSupportingHelperImports = new Map<string, Set<string>>([
  [
    'evaluateTradeSnapshotValidationStage',
    new Set([
      'src/features/architect/utils/mutationPipeline.ts',
      'src/features/architect/utils/mutationPipeline.validate.ts',
    ]),
  ],
  [
    'validateTradePreviewAuthority',
    new Set(['src/features/architect/utils/tradeContext/tradeContext.ts']),
  ],
  ['runTradePostStateLegalityStage', new Set<string>()],
]);

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

function toRepoRelative(filePath: string) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function isAuthoritySpecifier(specifier: string, filePath: string) {
  const normalizedSpecifier = specifier.replace(/\\/g, '/');
  const normalizedFilePath = filePath.replace(/\\/g, '/');

  if (
    normalizedSpecifier === './tradeExecutionAuthority' ||
    normalizedSpecifier === './tradeExecutionAuthority.ts'
  ) {
    return normalizedFilePath.includes(
      '/src/features/architect/utils/tradeContext/'
    );
  }

  return authorityModuleSegments.some((segment) =>
    normalizedSpecifier.includes(segment)
  );
}

function findDirectAuthorityImports() {
  const violations: Array<{ file: string; line: number; content: string }> = [];

  for (const rootDir of sourceRoots) {
    for (const filePath of collectSourceFiles(rootDir)) {
      const relativePath = toRepoRelative(filePath);
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
          if (!specifier || !isAuthoritySpecifier(specifier, filePath)) {
            continue;
          }

          if (!allowedAuthorityImportFiles.has(relativePath)) {
            violations.push({
              file: relativePath,
              line: index + 1,
              content: trimmedLine,
            });
          }
        }
      });
    }
  }

  return violations;
}

function findSupportingHelperImports() {
  const violations: Array<{ file: string; imports: string[] }> = [];
  const sourceFiles = collectSourceFiles(path.resolve(repoRoot, 'src'));

  for (const filePath of sourceFiles) {
    const relativePath = toRepoRelative(filePath);
    const source = fs.readFileSync(filePath, 'utf8');
    const importMatches = source.matchAll(
      /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g
    );

    const unexpectedImports = new Set<string>();

    for (const match of importMatches) {
      const specifier = match[2];
      if (!specifier || !isAuthoritySpecifier(specifier, filePath)) {
        continue;
      }

      const importedNames = match[1]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^type\s+/, '').split(/\s+as\s+/)[0]);

      for (const helperName of importedNames) {
        const allowedFiles = allowedSupportingHelperImports.get(helperName);
        if (!allowedFiles) {
          continue;
        }

        if (!allowedFiles.has(relativePath)) {
          unexpectedImports.add(helperName);
        }
      }
    }

    if (unexpectedImports.size > 0) {
      violations.push({
        file: relativePath,
        imports: Array.from(unexpectedImports).sort(),
      });
    }
  }

  return violations;
}

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8');
}

describe('TM-5D intentional staging guardrails', () => {
  it('keeps direct tradeExecutionAuthority imports limited to the intended source files', () => {
    expect(findDirectAuthorityImports()).toEqual([]);
  });

  it('keeps supporting helper imports limited to their intended callers', () => {
    expect(findSupportingHelperImports()).toEqual([]);
  });

  it('documents the canonical preparation and preview ownership phrases', () => {
    // Wave 9 Step 4: preparation handoff moved to tradeContext.snapshot.ts
    const tradeContextSource = readRepoFile(
      'src/features/architect/utils/tradeContext/tradeContext.ts'
    ) + readRepoFile('src/features/architect/utils/tradeContext/tradeContext.snapshot.ts');

    expect(tradeContextSource).toContain(
      'This function is the canonical preparation handoff.'
    );
    expect(tradeContextSource).toContain(
      'Preview intentionally omits the live world-state-only gates'
    );
  });

  it('documents the canonical-vs-supporting authority split', () => {
    const authoritySource = readRepoFile(
      'src/features/architect/utils/tradeContext/tradeExecutionAuthority.ts'
    );

    expect(authoritySource).toContain(
      'CANONICAL SURFACES VS SUPPORTING HELPERS'
    );
    expect(authoritySource).toContain(
      'not a new canonical public authority'
    );
    expect(authoritySource).toContain(
      'not a standalone replacement authority'
    );
  });

  it('documents post-state legality and persistence as separate ownership boundaries', () => {
    const postStateSource = readRepoFile(
      'src/features/architect/utils/capLegality/postStateCapValidator.ts'
    );
    const mutationPipelineSource = (readRepoFile('src/features/architect/utils/mutationPipeline.ts') +
      readRepoFile('src/features/architect/utils/mutationPipeline.persist.ts') +
      readRepoFile('src/features/architect/utils/mutationPipeline.validate.ts'));

    expect(postStateSource).toContain(
      'This file owns post-state team legality only.'
    );
    expect(postStateSource).toContain(
      'This file must not absorb sequencing or persistence concerns.'
    );
    expect(mutationPipelineSource).toContain('compatibility-stage adapter');
    expect(mutationPipelineSource).toContain(
      'prepared context -> execution authority -> persist boundary'
    );
    expect(mutationPipelineSource).toContain(
      'It must not absorb legality/business-rule ownership'
    );
  });

  it('documents the shared post-state validator role across mutation families', () => {
    const postStateSource = readRepoFile(
      'src/features/architect/utils/capLegality/postStateCapValidator.ts'
    );
    const authoritySource = readRepoFile(
      'src/features/architect/utils/tradeContext/tradeExecutionAuthority.ts'
    );
    const mutationPipelineSource = (readRepoFile('src/features/architect/utils/mutationPipeline.ts') +
      readRepoFile('src/features/architect/utils/mutationPipeline.persist.ts') +
      readRepoFile('src/features/architect/utils/mutationPipeline.validate.ts'));
    const seasonManagerSource = readRepoFile(
      'src/features/architect/utils/seasonManager.ts'
    );

    expect(postStateSource).toContain(
      'This file is intentionally shared across mutation families.'
    );
    expect(postStateSource).toContain(
      'Earlier validators feed this layer, but they are not substitutes for'
    );
    expect(authoritySource).toContain(
      'That shared post-state layer is also used by non-trade apply paths, season'
    );
    expect(mutationPipelineSource).toContain(
      'This shared validator runs after compute has produced authoritative'
    );
    expect(mutationPipelineSource).toContain(
      'substitutes for final-state artifact validation.'
    );
    expect(seasonManagerSource).toContain(
      'Season advance intentionally reuses the shared post-state final-artifact'
    );
  });
});
