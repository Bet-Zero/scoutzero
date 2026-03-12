import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_CASES = [
  {
    label: 'contractNormalization',
    aliasBase: '@/features/architect/utils/contractNormalization',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/contractNormalization.js'
    ),
    exportNames: [
      'isPlausibleFreeAgencyYear',
      'normalizeTeamRef',
      'normalizePlayerTeamRef',
      'normalizeOptionUsed',
      'normalizeSalaryRow',
      'normalizeFreeAgency',
      'validateFreeAgencyState',
      'normalizeSigningDate',
      'normalizeContractForWorld',
      'normalizeFutureContract',
      'isOptionAccepted',
      'isOptionDeclined',
      'hasOptionDecision',
    ],
    absentTokens: [
      'export function normalizeOptionUsed',
      'const DEFAULT_CONTEXT_YEAR = 2026',
      'export function normalizeContractForWorld',
    ],
  },
  {
    label: 'capHoldTransitionHelpers',
    aliasBase: '@/features/architect/utils/capHoldTransitionHelpers',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/capHoldTransitionHelpers.js'
    ),
    exportNames: [
      'getRightsTypeFromPlayer',
      'deriveFreeAgencyYearFromOptionSeason',
      'getCapHoldForPlayer',
      'didCreateCapHold',
      'didRemoveCapHold',
      'isCapHoldAmountValid',
      'shouldExpectCapHoldOnDecline',
      'computeExpectedCapHoldAmount',
      'validateDeclineFreeAgency',
    ],
    absentTokens: [
      'export function getRightsTypeFromPlayer',
      'const DEFAULT_CAP_HOLD_MULTIPLIER = 1.5',
      'Option decline must set freeAgency state',
    ],
  },
] as const;

describe('cap legality helper import compatibility', () => {
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
