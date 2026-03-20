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
    authoritySpecifier: '../../src/features/architect/utils/seasonFormat.ts',
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
  },
  {
    label: 'contractUtils',
    aliasBase: '@/features/architect/utils/contractUtils',
    authoritySpecifier: '../../src/features/architect/utils/contractUtils.ts',
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
  },
  {
    label: 'contractSalaryUtils',
    aliasBase: '@/features/architect/utils/contractSalaryUtils',
    authoritySpecifier: '../../src/features/architect/utils/contractSalaryUtils.ts',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/contractSalaryUtils.js'
    ),
    exportNames: ['getContractSalaryForYear', 'getSalaryWithFallback'],
  },
] as const;

describe('contract-season helper import compatibility', () => {
  for (const moduleCase of MODULE_CASES) {
    it(`resolves ${moduleCase.label} via extensionless imports after helper shim retirement`, async () => {
      const extensionless = await import(moduleCase.aliasBase);
      const authorityModule = await import(moduleCase.authoritySpecifier);

      for (const exportName of moduleCase.exportNames) {
        expect(extensionless[exportName]).toBeDefined();
        expect(extensionless[exportName]).toBe(authorityModule[exportName]);
      }
    });
  }

  it('keeps the helper shim paths absent after retirement', () => {
    for (const moduleCase of MODULE_CASES) {
      expect(fs.existsSync(moduleCase.shimPath)).toBe(false);
    }
  });
});
