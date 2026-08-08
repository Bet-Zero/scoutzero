/**
 * FILE: tests/architect/contractHistory/contractHistoryFence.test.ts
 * PURPOSE: BZE-271 structural fence between the contract history and the mutable contract path.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_GOVERNED_HISTORY_IMPORT,
  FENCED_MUTABLE_CONTRACT_PATTERNS,
  MUTABLE_CONTRACT_CONSUMERS,
} from '@/features/architect/utils/contractHistory';

const REPO_ROOT = resolve(__dirname, '../../..');
const HISTORY_DIR = join(
  REPO_ROOT,
  'src/features/architect/utils/contractHistory'
);

/**
 * Every history source file, walked recursively. A flat `readdirSync` would
 * skip a nested directory and a `.ts`-only filter would skip a `.tsx` file, so
 * either would let a prohibited import land somewhere the fence never reads.
 */
function historySourceFiles(directory: string = HISTORY_DIR): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return historySourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Decode the escape sequences a JavaScript string literal may carry, so a
 * specifier spelled `'../contractUtils'` is matched as the module the
 * runtime actually resolves rather than as its raw source text.
 */
export function decodeSpecifier(raw: string): string {
  return raw
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );
}

/**
 * Every static module-specifier form the repository supports. Matching only
 * single-quoted `from '…'` would let a double-quoted import, a side-effect
 * import, a dynamic `import()`, or a `require()` walk straight past the fence.
 */
export function importSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/\bfrom\s*['"]((?:[^'"\\]|\\.)+)['"]/g),
    ...source.matchAll(/\bimport\s*['"]((?:[^'"\\]|\\.)+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]((?:[^'"\\]|\\.)+)['"]\s*\)/g),
    ...source.matchAll(/\brequire\s*\(\s*['"]((?:[^'"\\]|\\.)+)['"]\s*\)/g),
  ].map((match) => decodeSpecifier(match[1]));
}

/** The fence describes the mutable modules by name, so it reads code only. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function fencedImportsIn(source: string): string[] {
  return importSpecifiers(stripComments(source)).filter((specifier) =>
    FENCED_MUTABLE_CONTRACT_PATTERNS.some((pattern) =>
      specifier.includes(pattern)
    )
  );
}

/**
 * Governed imports that are not the one allowed date primitive. Contract
 * history needs dates and Salary Cap Years, never Salary Cap, floor, Tax, or
 * apron values, so pulling the envelope or registry in is a fence break even
 * though both live on the governed side.
 */
function disallowedGovernedImportsIn(source: string): string[] {
  return importSpecifiers(stripComments(source)).filter(
    (specifier) =>
      specifier.includes('governedSeason') &&
      !specifier.includes(ALLOWED_GOVERNED_HISTORY_IMPORT)
  );
}

describe('BZE-271 history / mutable-contract compatibility fence', () => {
  it('walks every history source file recursively', () => {
    const files = historySourceFiles();

    expect(files.length).toBeGreaterThanOrEqual(5);
    expect(files).toContain(join(HISTORY_DIR, 'contractEventRecords.ts'));
    expect(files).toContain(join(HISTORY_DIR, 'contractStateProjection.ts'));
    expect(files).toContain(join(HISTORY_DIR, 'contractEventSerialization.ts'));
    files.forEach((file) => {
      expect(() => readFileSync(file, 'utf8')).not.toThrow();
    });
  });

  it('never imports a mutable contract or ungoverned money module', () => {
    const offenders: string[] = [];

    historySourceFiles().forEach((file) => {
      fencedImportsIn(readFileSync(file, 'utf8')).forEach((specifier) => {
        offenders.push(`${file} imports ${specifier}`);
      });
    });

    expect(offenders).toEqual([]);
  });

  it('catches every prohibited module form, so the fence cannot fail open', () => {
    const prohibited = [
      "import { getContractYearSlice } from '../contractUtils';",
      'import { getContractYearSlice } from "../contractUtils";',
      "import '../contractNormalization';",
      "const m = await import('../mutationPipeline');",
      "const m = require('../offseason/resolveOffseasonTransition');",
      "export { computeTeamCapTotals } from '@/features/architect/utils/capTotals';",
      "import { capProjections } from '@/features/architect/utils/capProjections';",
      "import { getCapRulesForYear } from '../capRulesProfile/capRulesProfile';",
      "import { MINIMUM_SALARY_SCALES } from '@/features/architect/data/minimumSalaryScales';",
      "import { CBA_THRESHOLDS } from '../tradeMachine/constants/cbaConstants';",
      "import { normalizeSalaryRow } from '../contractSalaryUtils';",
      // Escaped specifiers: the raw text carries no fenced name, the resolved
      // module does.
      "import '../contract\\u0055tils';",
      "import { x } from '../contract\\u{55}tils';",
      "const m = require('../contract\\x55tils');",
    ];

    prohibited.forEach((form) => {
      expect(fencedImportsIn(form), `undetected: ${form}`).not.toEqual([]);
    });
  });

  it('decodes escaped specifiers to the module actually resolved', () => {
    expect(decodeSpecifier('../contract\\u0055tils')).toBe('../contractUtils');
    expect(decodeSpecifier('../contract\\u{55}tils')).toBe('../contractUtils');
    expect(decodeSpecifier('../contract\\x55tils')).toBe('../contractUtils');
    expect(decodeSpecifier('./contractEventRecords')).toBe(
      './contractEventRecords'
    );
  });

  it('does not flag an in-boundary or unrelated import', () => {
    const allowed = [
      "import { eventKey } from './contractEventRecords';",
      "import { isZonedDateTime } from '../governedSeason/governedTime';",
      "import { describe } from 'vitest';",
      "import { readFileSync } from 'node:fs';",
    ];

    allowed.forEach((form) => {
      expect(fencedImportsIn(form), `false positive: ${form}`).toEqual([]);
    });
  });

  it('imports only the governed date primitives, never the money envelope', () => {
    const offenders: string[] = [];

    historySourceFiles().forEach((file) => {
      disallowedGovernedImportsIn(readFileSync(file, 'utf8')).forEach(
        (specifier) => {
          offenders.push(`${file} imports ${specifier}`);
        }
      );
    });

    expect(offenders).toEqual([]);
    expect(
      disallowedGovernedImportsIn(
        "import { resolveGovernedSeasonEnvelope } from '../governedSeason';"
      )
    ).toEqual(['../governedSeason']);
    expect(
      disallowedGovernedImportsIn(
        "import { CANON_GOVERNED_SEASON_REGISTRY } from '../governedSeason/canonGovernedSeasonRegistry';"
      )
    ).toHaveLength(1);
    expect(
      disallowedGovernedImportsIn(
        "import { isZonedDateTime } from '../governedSeason/governedTime';"
      )
    ).toEqual([]);
  });

  it('actually reuses the BZE-270 date primitives', () => {
    const sources = historySourceFiles().map((file) =>
      readFileSync(file, 'utf8')
    );
    const importing = sources.filter((source) =>
      source.includes(ALLOWED_GOVERNED_HISTORY_IMPORT)
    );

    expect(importing.length).toBeGreaterThanOrEqual(2);
    expect(importing.join('\n')).toContain('isZonedDateTime');
    expect(importing.join('\n')).toContain('isSupportedSalaryCapYear');
  });

  it('never reads the runtime clock or derives a current year', () => {
    const offenders: string[] = [];

    historySourceFiles().forEach((file) => {
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

  it('documents each unmigrated mutable surface with its Canon leaf', () => {
    expect(MUTABLE_CONTRACT_CONSUMERS.length).toBeGreaterThanOrEqual(5);

    MUTABLE_CONTRACT_CONSUMERS.forEach((entry) => {
      expect(entry.module).toMatch(/^src\/features\/architect\/.+\.ts$/);
      expect(entry.reason).toMatch(/CBA2-L02\.\d/);
    });

    const modules = MUTABLE_CONTRACT_CONSUMERS.map((entry) => entry.module);
    expect(modules).toContain('src/features/architect/utils/contractUtils.ts');
    expect(modules).toContain(
      'src/features/architect/utils/offseason/resolveOffseasonTransition.ts'
    );
  });

  it('leaves the mutable surfaces in place and unmigrated', () => {
    MUTABLE_CONTRACT_CONSUMERS.forEach((entry) => {
      const source = readFileSync(join(REPO_ROOT, entry.module), 'utf8');
      expect(source.length).toBeGreaterThan(0);
      expect(source).not.toContain('contractHistory');
    });
  });

  it('is not imported by any module outside the history boundary', () => {
    const offenders: string[] = [];

    function walk(directory: string): void {
      readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
        const path = join(directory, entry.name);
        if (path === HISTORY_DIR) return;
        if (entry.isDirectory()) {
          walk(path);
          return;
        }
        if (!/\.tsx?$/.test(entry.name)) return;

        const code = stripComments(readFileSync(path, 'utf8'));
        importSpecifiers(code).forEach((specifier) => {
          if (specifier.includes('contractHistory')) {
            offenders.push(`${path} imports ${specifier}`);
          }
        });
      });
    }

    walk(join(REPO_ROOT, 'src'));

    expect(offenders).toEqual([]);
  });
});
