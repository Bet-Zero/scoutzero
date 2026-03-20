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
    authoritySpecifier:
      '../../src/features/architect/utils/playerRulesProfile/minimumSalaryRules.ts',
    deletedShimPath: path.resolve(
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
  },
  {
    label: 'maxSalaryRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/maxSalaryRules',
    authoritySpecifier:
      '../../src/features/architect/utils/playerRulesProfile/maxSalaryRules.ts',
    deletedShimPath: path.resolve(
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
  },
  {
    label: 'birdRightsRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/birdRightsRules',
    authoritySpecifier:
      '../../src/features/architect/utils/playerRulesProfile/birdRightsRules.ts',
    deletedShimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/birdRightsRules.js'
    ),
    exportNames: [
      'computeBirdRights',
      'computeBirdRightsFromRuleContext',
      'BIRD_RIGHTS_TYPES',
    ],
  },
  {
    label: 'rfaRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/rfaRules',
    authoritySpecifier:
      '../../src/features/architect/utils/playerRulesProfile/rfaRules.ts',
    deletedShimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/rfaRules.js'
    ),
    exportNames: [
      'computeRFAStatus',
      'computeQualifyingOffer',
      'computeRFAFromRuleContext',
      'RFA_STATUS',
    ],
  },
  {
    label: 'extensionRules',
    aliasBase: '@/features/architect/utils/playerRulesProfile/extensionRules',
    authoritySpecifier:
      '../../src/features/architect/utils/playerRulesProfile/extensionRules.ts',
    deletedShimPath: path.resolve(
      __dirname,
      '../../src/features/architect/utils/playerRulesProfile/extensionRules.js'
    ),
    exportNames: [
      'computeExtensionEligibility',
      'computeExtensionTerms',
      'computeExtensionFromRuleContext',
      'EXTENSION_TYPES',
    ],
  },
] as const;

describe('playerRulesProfile leaf import compatibility', () => {
  for (const moduleCase of MODULE_CASES) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the TS authority`, async () => {
      const extensionless = await import(moduleCase.aliasBase);
      const authority = await import(moduleCase.authoritySpecifier);

      expect('default' in authority).toBe(false);
      expect(Object.keys(authority)).toEqual(
        expect.arrayContaining([...moduleCase.exportNames])
      );

      for (const exportName of moduleCase.exportNames) {
        expect(extensionless[exportName]).toBeDefined();
        expect(extensionless[exportName]).toBe(authority[exportName]);
      }
    });
  }

  it('retired leaf shim paths are absent', () => {
    for (const moduleCase of MODULE_CASES) {
      expect(fs.existsSync(moduleCase.deletedShimPath)).toBe(false);
    }
  });
});
