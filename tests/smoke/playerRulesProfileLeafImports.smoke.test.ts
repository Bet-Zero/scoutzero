import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_CASES = [
  {
    label: 'minimumSalaryRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/minimumSalaryRules',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js'
    ),
    exportNames: [
      'computeMinimumSalary',
      'computeMinimumSalaryFromRuleContext',
      'getMinimumSalaryScale',
      'getYearsOfService',
      'getMinimumCapHit',
      'MINIMUM_SALARY_SCALE',
    ],
    absentTokens: [
      'function normalizeSeasonCode',
      'function computeMinimumSalary',
      'export const MINIMUM_SALARY_SCALE =',
    ],
  },
  {
    label: 'maxSalaryRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/maxSalaryRules',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/maxSalaryRules.js'
    ),
    exportNames: [
      'computeMaxSalary',
      'computeMaxSalaryFromRuleContext',
      'MAX_SALARY_TIERS',
      'SUPERMAX_QUALIFYING_AWARDS',
      'checkSupermaxEligibility',
      'getMaxSalaryTier',
    ],
    absentTokens: [
      'function buildMaxSalaryReason',
      'function normalizeAwardType',
      'export const MAX_SALARY_TIERS =',
    ],
  },
  {
    label: 'birdRightsRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/birdRightsRules',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/birdRightsRules.js'
    ),
    exportNames: [
      'computeBirdRights',
      'computeBirdRightsFromRuleContext',
      'BIRD_RIGHTS_TYPES',
    ],
    absentTokens: [
      'function computeSigningAbilities',
      'function buildBirdRightsSummary',
      'export const BIRD_RIGHTS_TYPES =',
    ],
  },
  {
    label: 'rfaRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/rfaRules',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/rfaRules.js'
    ),
    exportNames: [
      'computeRFAStatus',
      'computeQualifyingOffer',
      'computeRFAFromRuleContext',
      'RFA_STATUS',
    ],
    absentTokens: [
      'function computeQOAcceptanceDeadline',
      'const QO_PERCENTAGES =',
      'export const RFA_STATUS =',
    ],
  },
  {
    label: 'extensionRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/extensionRules',
    shimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/extensionRules.js'
    ),
    exportNames: [
      'computeExtensionEligibility',
      'computeExtensionTerms',
      'computeExtensionFromRuleContext',
      'EXTENSION_TYPES',
    ],
    absentTokens: [
      'function computeVeteranExtensionTerms',
      'function computeRookieExtensionEligibility',
      'export const EXTENSION_TYPES =',
    ],
  },
] as const;

describe('playerRulesProfile leaf import compatibility', () => {
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
