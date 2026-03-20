/**
 * FILE: src/tests/architect/playerRulesProfileLeafShimBatch.e119.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E119 playerRulesProfile leaf shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E119 - Added exact deletion-batch absence checks plus representative extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const playerRulesProfileRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/playerRulesProfile'
);

const deletedBatchPaths = [
  'minimumSalaryRules.js',
  'maxSalaryRules.js',
  'birdRightsRules.js',
  'rfaRules.js',
  'extensionRules.js',
  'computeProfile.js',
] as const;

const moduleParityCases = [
  {
    label: 'minimumSalaryRules',
    extensionlessSpecifier:
      '@/features/architect/utils/playerRulesProfile/minimumSalaryRules',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/minimumSalaryRules.ts',
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
    extensionlessSpecifier:
      '@/features/architect/utils/playerRulesProfile/maxSalaryRules',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/maxSalaryRules.ts',
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
    extensionlessSpecifier:
      '@/features/architect/utils/playerRulesProfile/birdRightsRules',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/birdRightsRules.ts',
    exportNames: [
      'computeBirdRights',
      'computeBirdRightsFromRuleContext',
      'BIRD_RIGHTS_TYPES',
    ],
  },
  {
    label: 'rfaRules',
    extensionlessSpecifier: '@/features/architect/utils/playerRulesProfile/rfaRules',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/rfaRules.ts',
    exportNames: [
      'computeRFAStatus',
      'computeQualifyingOffer',
      'computeRFAFromRuleContext',
      'RFA_STATUS',
    ],
  },
  {
    label: 'extensionRules',
    extensionlessSpecifier:
      '@/features/architect/utils/playerRulesProfile/extensionRules',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/extensionRules.ts',
    exportNames: [
      'computeExtensionEligibility',
      'computeExtensionTerms',
      'computeExtensionFromRuleContext',
      'EXTENSION_TYPES',
    ],
  },
  {
    label: 'computeProfile',
    extensionlessSpecifier:
      '@/features/architect/utils/playerRulesProfile/computeProfile',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/computeProfile.ts',
    exportNames: ['computePlayerRulesProfile'],
  },
] as const;

describe('E119 playerRulesProfile leaf shim deletion batch guardrails', () => {
  it('tracks the exact 6-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(6);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(playerRulesProfileRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  for (const moduleCase of moduleParityCases) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the TS authority`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);

      expect('default' in authorityModule).toBe(false);
      expect(Object.keys(authorityModule)).toEqual(
        expect.arrayContaining([...moduleCase.exportNames])
      );

      for (const exportName of moduleCase.exportNames) {
        expect(extensionlessModule[exportName]).toBe(authorityModule[exportName]);
      }
    });
  }
});
