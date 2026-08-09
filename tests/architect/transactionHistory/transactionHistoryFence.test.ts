import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_TRANSACTION_HISTORY_LOCAL_MODULES,
  FENCED_TRANSACTION_HISTORY_DIRECTORY,
  FENCED_TRANSACTION_HISTORY_SCHEMA,
  UNMIGRATED_TRANSACTION_SURFACES,
} from '@/features/architect/utils/transactionHistory/transactionHistoryFence';

const REPO_ROOT = resolve(__dirname, '../../..');
const HISTORY_DIR = join(REPO_ROOT, FENCED_TRANSACTION_HISTORY_DIRECTORY);
const HISTORY_SCHEMA = join(REPO_ROOT, FENCED_TRANSACTION_HISTORY_SCHEMA);
const SRC_DIR = join(REPO_ROOT, 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

function historyFiles(): string[] {
  return [...sourceFiles(HISTORY_DIR), HISTORY_SCHEMA];
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/\bfrom\s*['"]((?:[^'"\\]|\\.)+)['"]/g),
    ...source.matchAll(/\bimport\s*['"]((?:[^'"\\]|\\.)+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]((?:[^'"\\]|\\.)+)['"]\s*\)/g),
    ...source.matchAll(/\brequire\s*\(\s*['"]((?:[^'"\\]|\\.)+)['"]\s*\)/g),
  ].map((match) => match[1]);
}

function normalizeSpecifier(
  specifier: string,
  importingFile: string
): string | null {
  const withoutExtension = specifier.replace(/\.(tsx?|jsx?)$/, '');
  const absolute = withoutExtension.startsWith('@/')
    ? join(REPO_ROOT, 'src', withoutExtension.slice(2))
    : withoutExtension.startsWith('.')
      ? resolve(dirname(importingFile), withoutExtension)
      : null;
  if (absolute === null) return null;
  return relative(REPO_ROOT, absolute).split(/[\\/]/).join(posix.sep);
}

describe('BZE-272 transaction-history compatibility fence', () => {
  it('covers every boundary module and the canonical schema', () => {
    const files = historyFiles();
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files).toContain(join(HISTORY_DIR, 'completedTradeLedger.ts'));
    expect(files).toContain(join(HISTORY_DIR, 'transactionCommitManifest.ts'));
    expect(files).toContain(
      join(HISTORY_DIR, 'transactionEventSerialization.ts')
    );
    expect(files).toContain(HISTORY_SCHEMA);
  });

  it('imports only its own modules, its schema, and BZE-270 governed time', () => {
    const offenders: string[] = [];
    historyFiles().forEach((file) => {
      importSpecifiers(stripComments(readFileSync(file, 'utf8'))).forEach(
        (specifier) => {
          const normalized = normalizeSpecifier(specifier, file);
          if (normalized === null) return;
          const allowed = ALLOWED_TRANSACTION_HISTORY_LOCAL_MODULES.some(
            (module) =>
              normalized === module ||
              (module.endsWith('transactionHistory') &&
                normalized.startsWith(`${module}/`))
          );
          if (!allowed)
            offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
        }
      );
    });
    expect(offenders).toEqual([]);
  });

  it('has no runtime clock, random identity, or implicit current-year source', () => {
    const prohibited = [
      /\bDate\.now\s*\(/,
      /\bnew\s+Date\s*\(\s*\)/,
      /\bMath\.random\s*\(/,
      /\brandomUUID\s*\(/,
      /\bgetFullYear\s*\(/,
      /\bgetUTCFullYear\s*\(/,
    ];
    const offenders = historyFiles().flatMap((file) => {
      const source = stripComments(readFileSync(file, 'utf8'));
      return prohibited
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relative(REPO_ROOT, file)} matches ${pattern}`);
    });
    expect(offenders).toEqual([]);
  });

  it('is not imported by any production or rendered consumer', () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter(
        (file) => !file.startsWith(HISTORY_DIR) && file !== HISTORY_SCHEMA
      )
      .flatMap((file) =>
        importSpecifiers(stripComments(readFileSync(file, 'utf8')))
          .filter(
            (specifier) =>
              specifier.includes('transactionHistory') ||
              specifier.includes('transactionEventLedger')
          )
          .map((specifier) => `${relative(REPO_ROOT, file)} -> ${specifier}`)
      );
    expect(offenders).toEqual([]);
  });

  it('documents the unchanged mutable and consumer surfaces', () => {
    expect(UNMIGRATED_TRANSACTION_SURFACES.length).toBeGreaterThanOrEqual(4);
    expect(
      UNMIGRATED_TRANSACTION_SURFACES.some((entry) =>
        entry.module.includes('mutationPipeline')
      )
    ).toBe(true);
    expect(
      UNMIGRATED_TRANSACTION_SURFACES.some((entry) =>
        entry.module.includes('tradeMachine')
      )
    ).toBe(true);
  });
});
