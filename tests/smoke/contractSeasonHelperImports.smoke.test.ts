import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_CASES = [
  {
    label: 'seasonFormat',
    aliasBase: '@/features/architect/utils/seasonFormat',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/seasonFormat.js'
    ),
    exportNames: [
      'toSeasonCode',
      'toEndYear',
      'parseSeason',
      'getDefaultSeasonEndYear',
      'toSeasonKey',
      'seasonEndYearsFromCaps',
    ],
    absentTokens: [
      'export function toSeasonCode',
      'export function parseSeason',
      'export function seasonEndYearsFromCaps',
    ],
  },
  {
    label: 'contractUtils',
    aliasBase: '@/features/architect/utils/contractUtils',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/contractUtils.js'
    ),
    exportNames: [
      'generateContract',
      'generateExtensionContract',
      'getContractYearsForDisplay',
      'getYearsRemainingDisplay',
      'getContractYearSlice',
      'createMaxContract',
      'generateRookieContract',
      'getMinimumSalary',
      'stretchContract',
      'getMinimumCapHit',
      'calculateCapHold',
      'generateDefaultFreeAgentContract',
      'getLastSalary',
    ],
    absentTokens: [
      'function normalizeContractYears',
      'const rookieScale',
      'export function getLastSalary',
    ],
  },
  {
    label: 'contractSalaryUtils',
    aliasBase: '@/features/architect/utils/contractSalaryUtils',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/contractSalaryUtils.js'
    ),
    exportNames: ['getContractSalaryForYear', 'getSalaryWithFallback'],
    absentTokens: [
      'export function getContractSalaryForYear',
      'const fallbackSources',
      'Expected contract.salariesByYear',
    ],
  },
] as const;

describe('contract-season helper import compatibility', () => {
  for (const moduleCase of MODULE_CASES) {
    it(`resolves ${moduleCase.label} via extensionless and explicit .js imports`, async () => {
      const extensionless = await import(moduleCase.aliasBase);
      const withJs = await import(`${moduleCase.aliasBase}.js`);

      for (const exportName of moduleCase.exportNames) {
        expect(extensionless[exportName]).toBeDefined();
        expect(withJs[exportName]).toBe(extensionless[exportName]);
      }
    });
  }

  it('kept js files remain pure compatibility shims', () => {
    for (const moduleCase of MODULE_CASES) {
      const shimContent = fs.readFileSync(moduleCase.shimPath, 'utf8');
      const tsBasename = path.basename(moduleCase.shimPath, '.js');

      expect(shimContent).toContain(`export * from './${tsBasename}.ts';`);

      for (const absentToken of moduleCase.absentTokens) {
        expect(shimContent).not.toContain(absentToken);
      }
    }
  });
});
