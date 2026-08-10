/**
 * FILE: tests/architect/contractHistory/contractHistoryFence.test.ts
 * PURPOSE: BZE-271 structural fence between the contract history and the mutable contract path.
 *
 * The fence metadata is imported from the fence module rather than the public
 * barrel: it describes a boundary, it is not part of the feature's runtime API.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_GOVERNED_HISTORY_MODULE,
  FENCED_HISTORY_DIRECTORY,
  FENCED_HISTORY_SCHEMA_MODULE,
  FENCED_MUTABLE_CONTRACT_PATTERNS,
  GOVERNED_CONTRACT_HISTORY_CONSUMERS,
  MUTABLE_CONTRACT_CONSUMERS,
} from '@/features/architect/utils/contractHistory/contractHistoryFence';

const REPO_ROOT = resolve(__dirname, '../../..');
const HISTORY_DIR = join(REPO_ROOT, FENCED_HISTORY_DIRECTORY);
const HISTORY_SCHEMA = join(REPO_ROOT, FENCED_HISTORY_SCHEMA_MODULE);

/**
 * Every history source file, walked recursively, plus the canonical schema. A
 * flat `readdirSync` would skip a nested directory and a `.ts`-only filter would
 * skip a `.tsx` file, so either would let a prohibited import land somewhere the
 * fence never reads.
 */
function historySourceFiles(directory: string = HISTORY_DIR): string[] {
  const found = readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return historySourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    }
  );

  return directory === HISTORY_DIR ? [...found, HISTORY_SCHEMA] : found;
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

/**
 * Resolve a specifier to a repo-relative module path with no extension, so an
 * alias spelling, a relative spelling, and an extensioned spelling of the same
 * module all normalize to one string that can be compared exactly.
 *
 * Returns `null` for a bare package specifier such as `zod`, which is not a
 * repo module and cannot be the governed one.
 */
export function normalizeSpecifier(
  specifier: string,
  importingFile: string
): string | null {
  const withoutExtension = specifier.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');

  const absolute = withoutExtension.startsWith('@/')
    ? join(REPO_ROOT, 'src', withoutExtension.slice(2))
    : withoutExtension.startsWith('.')
      ? resolve(dirname(importingFile), withoutExtension)
      : null;

  if (absolute === null) return null;

  return relative(REPO_ROOT, absolute).split(/[\\/]/).join(posix.sep);
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
 * Governed imports that are not exactly the one allowed date module.
 *
 * Comparison is on the normalized module path, never a substring: a substring
 * test would admit `governedSeason/governedTime/money` and every other module
 * nested beneath the allowed one. Contract history needs dates and Salary Cap
 * Years, never Salary Cap, floor, Tax, or apron values, so pulling in the
 * envelope, the registry, or a submodule is a fence break even though all of
 * them live on the governed side.
 */
export function disallowedGovernedImportsIn(
  source: string,
  importingFile: string
): string[] {
  return importSpecifiers(stripComments(source))
    .filter((specifier) => specifier.includes('governedSeason'))
    .filter(
      (specifier) =>
        normalizeSpecifier(specifier, importingFile) !==
        ALLOWED_GOVERNED_HISTORY_MODULE
    );
}

/** A file inside the history directory, used to anchor relative specifiers. */
const ANCHOR_FILE = join(HISTORY_DIR, 'contractEventRecords.ts');

describe('BZE-271 history / mutable-contract compatibility fence', () => {
  it('walks every history source file recursively, including the canonical schema', () => {
    const files = historySourceFiles();

    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files).toContain(join(HISTORY_DIR, 'contractEventRecords.ts'));
    expect(files).toContain(join(HISTORY_DIR, 'contractStateProjection.ts'));
    expect(files).toContain(join(HISTORY_DIR, 'contractEventSerialization.ts'));
    expect(files).toContain(HISTORY_SCHEMA);
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
      "import { z } from 'zod';",
      "import { ContractEventRecordZ } from '@/schemas/contractEventLedger';",
      "import { describe } from 'vitest';",
      "import { readFileSync } from 'node:fs';",
    ];

    allowed.forEach((form) => {
      expect(fencedImportsIn(form), `false positive: ${form}`).toEqual([]);
    });
  });

  it('normalizes alias, relative, and extensioned spellings to one module path', () => {
    expect(
      normalizeSpecifier('../governedSeason/governedTime', ANCHOR_FILE)
    ).toBe(ALLOWED_GOVERNED_HISTORY_MODULE);
    expect(
      normalizeSpecifier(
        '@/features/architect/utils/governedSeason/governedTime',
        ANCHOR_FILE
      )
    ).toBe(ALLOWED_GOVERNED_HISTORY_MODULE);
    expect(
      normalizeSpecifier('../governedSeason/governedTime.ts', ANCHOR_FILE)
    ).toBe(ALLOWED_GOVERNED_HISTORY_MODULE);
    expect(
      normalizeSpecifier('../../utils/governedSeason/governedTime', ANCHOR_FILE)
    ).toBe(ALLOWED_GOVERNED_HISTORY_MODULE);
    // Bare package specifiers are not repo modules.
    expect(normalizeSpecifier('zod', ANCHOR_FILE)).toBeNull();
  });

  it('allows the governed date module and prohibits a submodule beneath it', () => {
    // The intended module stays allowed.
    expect(
      disallowedGovernedImportsIn(
        "import { isZonedDateTime } from '../governedSeason/governedTime';",
        ANCHOR_FILE
      )
    ).toEqual([]);

    // A submodule nested under the allowed one is NOT the allowed module. This
    // is the case a substring comparison silently admitted.
    expect(
      disallowedGovernedImportsIn(
        "import { money } from '../governedSeason/governedTime/money';",
        ANCHOR_FILE
      )
    ).toEqual(['../governedSeason/governedTime/money']);
    expect(
      disallowedGovernedImportsIn(
        "import { x } from '../governedSeason/governedTimeExtras';",
        ANCHOR_FILE
      )
    ).toEqual(['../governedSeason/governedTimeExtras']);
  });

  it('cannot be weakened by an aliased or relative spelling', () => {
    // Aliased spelling of the allowed module is still allowed.
    expect(
      disallowedGovernedImportsIn(
        "import { isZonedDateTime } from '@/features/architect/utils/governedSeason/governedTime';",
        ANCHOR_FILE
      )
    ).toEqual([]);

    // Aliased spelling of a submodule is still prohibited.
    expect(
      disallowedGovernedImportsIn(
        "import { m } from '@/features/architect/utils/governedSeason/governedTime/money';",
        ANCHOR_FILE
      )
    ).toHaveLength(1);

    // A roundabout relative spelling of a prohibited module is still prohibited.
    expect(
      disallowedGovernedImportsIn(
        "import { r } from '../governedSeason/../governedSeason/canonGovernedSeasonRegistry';",
        ANCHOR_FILE
      )
    ).toHaveLength(1);
  });

  it('prohibits the governed envelope, registry, and barrel', () => {
    [
      "import { resolveGovernedSeasonEnvelope } from '../governedSeason';",
      "import { CANON_GOVERNED_SEASON_REGISTRY } from '../governedSeason/canonGovernedSeasonRegistry';",
      "import { resolveGovernedSeasonEnvelope } from '../governedSeason/governedSeasonEnvelope';",
      "import { createGovernedSeasonRegistry } from '../governedSeason/governedSeasonRecords';",
    ].forEach((form) => {
      expect(
        disallowedGovernedImportsIn(form, ANCHOR_FILE),
        `undetected: ${form}`
      ).toHaveLength(1);
    });
  });

  it('imports only the governed date primitives, never the money envelope', () => {
    const offenders: string[] = [];

    historySourceFiles().forEach((file) => {
      disallowedGovernedImportsIn(readFileSync(file, 'utf8'), file).forEach(
        (specifier) => {
          offenders.push(`${file} imports ${specifier}`);
        }
      );
    });

    expect(offenders).toEqual([]);
  });

  it('actually reuses the BZE-270 date primitives', () => {
    const importing = historySourceFiles()
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(
        ({ file, source }) =>
          importSpecifiers(stripComments(source)).filter(
            (specifier) =>
              normalizeSpecifier(specifier, file) ===
              ALLOWED_GOVERNED_HISTORY_MODULE
          ).length > 0
      );

    expect(importing.length).toBeGreaterThanOrEqual(2);
    const joined = importing.map(({ source }) => source).join('\n');
    expect(joined).toContain('isZonedDateTime');
    expect(joined).toContain('isSupportedSalaryCapYear');
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

  it('does not publish the fence metadata on the public barrel', () => {
    const barrel = readFileSync(join(HISTORY_DIR, 'index.ts'), 'utf8');

    expect(barrel).not.toContain('MUTABLE_CONTRACT_CONSUMERS');
    expect(barrel).not.toContain('FENCED_MUTABLE_CONTRACT_PATTERNS');
    expect(barrel).not.toContain('ALLOWED_GOVERNED_HISTORY_MODULE');
  });

  it('is imported only by the explicit governed source-bootstrap consumer', () => {
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
            const relativePath = path.slice(REPO_ROOT.length + 1);
            if (!GOVERNED_CONTRACT_HISTORY_CONSUMERS.includes(relativePath as never)) {
              offenders.push(`${path} imports ${specifier}`);
            }
          }
        });
      });
    }

    walk(join(REPO_ROOT, 'src'));

    expect(offenders).toEqual([]);
    GOVERNED_CONTRACT_HISTORY_CONSUMERS.forEach((consumer) => {
      expect(readFileSync(join(REPO_ROOT, consumer), 'utf8')).toContain(
        'contractHistory'
      );
    });
  });
});
