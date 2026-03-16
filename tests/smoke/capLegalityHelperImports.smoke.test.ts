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
    authorityPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/contractNormalization.ts'
    ),
    deletedPath: path.resolve(
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
    authorityPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/capHoldTransitionHelpers.ts'
    ),
    deletedPath: path.resolve(
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
    it(`resolves ${moduleCase.label} via extensionless imports after the E113 shim deletion batch`, async () => {
      const extensionless = await import(moduleCase.aliasBase);

      for (const exportName of moduleCase.exportNames) {
        expect(extensionless[exportName]).toBeDefined();
      }
    });
  }

  it('deleted batch js files stay absent while TS authorities remain in place', () => {
    for (const moduleCase of MODULE_CASES) {
      const authorityContent = fs.readFileSync(moduleCase.authorityPath, 'utf8');

      expect(fs.existsSync(moduleCase.deletedPath)).toBe(false);
      expect(authorityContent.length).toBeGreaterThan(0);
    }
  });
});
