import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FENCED_LEGACY_MODULE_PATTERNS,
  LEGACY_UNGOVERNED_SEASON_INPUTS,
} from '@/features/architect/utils/governedSeason';

const REPO_ROOT = resolve(__dirname, '../../..');
const GOVERNED_DIR = join(
  REPO_ROOT,
  'src/features/architect/utils/governedSeason'
);
const GOVERNED_LEDGER_ENTRY = join(
  REPO_ROOT,
  'src/features/architect/utils/capTotals/governedDatedSalaryLedgers.ts'
);

function governedSourceFiles(): string[] {
  return readdirSync(GOVERNED_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(GOVERNED_DIR, name))
    .concat(GOVERNED_LEDGER_ENTRY);
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
}

/**
 * Comments describe the fence and legitimately name the legacy modules, so the
 * structural checks look at code only.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('BZE-270 governed / legacy compatibility fence', () => {
  it('covers every governed source file', () => {
    const files = governedSourceFiles();
    expect(files.length).toBeGreaterThanOrEqual(6);
    files.forEach((file) => {
      expect(() => readFileSync(file, 'utf8')).not.toThrow();
    });
  });

  it('never imports an ungoverned season-input module', () => {
    const offenders: string[] = [];

    governedSourceFiles().forEach((file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      importSpecifiers(code).forEach((specifier) => {
        FENCED_LEGACY_MODULE_PATTERNS.forEach((pattern) => {
          if (specifier.includes(pattern)) {
            offenders.push(`${file} imports ${specifier}`);
          }
        });
      });
    });

    expect(offenders).toEqual([]);
  });

  it('never reads the runtime clock or derives a current year', () => {
    const offenders: string[] = [];

    governedSourceFiles().forEach((file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (/\bDate\.now\s*\(/.test(code)) {
        offenders.push(`${file} calls Date.now()`);
      }
      if (/new\s+Date\s*\(\s*\)/.test(code)) {
        offenders.push(`${file} calls new Date() with no argument`);
      }
      if (/getFullYear\s*\(/.test(code)) {
        offenders.push(`${file} derives a year from a Date instance`);
      }
    });

    expect(offenders).toEqual([]);
  });

  it('documents each unmigrated legacy surface with its defect', () => {
    expect(LEGACY_UNGOVERNED_SEASON_INPUTS.length).toBeGreaterThanOrEqual(5);

    LEGACY_UNGOVERNED_SEASON_INPUTS.forEach((entry) => {
      expect(entry.module).toMatch(/^src\/features\/architect\/.+\.ts$/);
      expect(entry.reason).toMatch(/CBA2-[A-Z]\d{2}\.\d/);
    });

    const modules = LEGACY_UNGOVERNED_SEASON_INPUTS.map(
      (entry) => entry.module
    );
    expect(modules).toContain('src/features/architect/utils/capProjections.ts');
    expect(modules).toContain(
      'src/features/architect/utils/mutationPipeline.read.utils.ts'
    );
  });

  it('leaves the legacy surfaces in place and unmigrated', () => {
    LEGACY_UNGOVERNED_SEASON_INPUTS.forEach((entry) => {
      const source = readFileSync(join(REPO_ROOT, entry.module), 'utf8');
      expect(source.length).toBeGreaterThan(0);
      expect(source).not.toContain('governedSeason');
    });
  });
});
