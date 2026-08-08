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

/**
 * Every governed source file, walked recursively. A flat `readdirSync` would
 * skip a nested directory, and a `.ts`-only filter would skip a `.tsx` file, so
 * either would let a prohibited import land somewhere the fence never reads.
 */
function governedSourceFiles(directory: string = GOVERNED_DIR): string[] {
  const found = readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return governedSourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    }
  );

  return directory === GOVERNED_DIR ? [...found, GOVERNED_LEDGER_ENTRY] : found;
}

/**
 * Every static module-specifier form the repository supports. Matching only
 * single-quoted `from '…'` would let a double-quoted import, a side-effect
 * import, a dynamic `import()`, or a `require()` walk straight past the fence.
 */
export function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((match) => match[1]);
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

function fencedImportsIn(source: string): string[] {
  return importSpecifiers(stripComments(source)).filter((specifier) =>
    FENCED_LEGACY_MODULE_PATTERNS.some((pattern) => specifier.includes(pattern))
  );
}

describe('BZE-270 governed / legacy compatibility fence', () => {
  it('walks every governed source file recursively, including the ledger entry', () => {
    const files = governedSourceFiles();

    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files).toContain(GOVERNED_LEDGER_ENTRY);
    expect(files).toContain(join(GOVERNED_DIR, 'governedSeasonEnvelope.ts'));
    files.forEach((file) => {
      expect(() => readFileSync(file, 'utf8')).not.toThrow();
    });
  });

  it('never imports an ungoverned season-input module', () => {
    const offenders: string[] = [];

    governedSourceFiles().forEach((file) => {
      fencedImportsIn(readFileSync(file, 'utf8')).forEach((specifier) => {
        offenders.push(`${file} imports ${specifier}`);
      });
    });

    expect(offenders).toEqual([]);
  });

  it('catches every prohibited module form, so the fence cannot fail open', () => {
    const prohibited = [
      "import { capProjections } from '../capProjections';",
      'import { capProjections } from "../capProjections";',
      "import '../capProjections';",
      'import "../capProjections";',
      "const p = await import('../capProjections');",
      'const p = await import("../capProjections");',
      "const p = require('../capProjections');",
      'const p = require("../capProjections");',
      "export { capProjections } from '@/features/architect/utils/capProjections';",
      "import { getCapRulesForYear } from '../capRulesProfile/capRulesProfile';",
      "import { MINIMUM_SALARY_SCALES } from '@/features/architect/data/minimumSalaryScales';",
      "import { resolveWorldAsOfDate } from '../mutationPipeline.read.utils';",
      "import { CBA_THRESHOLDS } from '../tradeMachine/constants/cbaConstants';",
    ];

    prohibited.forEach((form) => {
      expect(fencedImportsIn(form), `undetected: ${form}`).not.toEqual([]);
    });
  });

  it('does not flag a governed or unrelated import', () => {
    const allowed = [
      "import { isZonedDateTime } from './governedTime';",
      "import { describe } from 'vitest';",
      "import { readFileSync } from 'node:fs';",
      "import { evaluateDatedSalaryLedgers } from './datedSalaryLedgers';",
    ];

    allowed.forEach((form) => {
      expect(fencedImportsIn(form), `false positive: ${form}`).toEqual([]);
    });
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
