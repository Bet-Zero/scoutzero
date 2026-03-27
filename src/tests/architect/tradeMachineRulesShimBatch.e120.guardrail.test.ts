/**
 * FILE: src/tests/architect/tradeMachineRulesShimBatch.e120.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E120 tradeMachine/rules shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E120 - Added exact deletion-batch absence checks plus representative extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const rulesRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeMachine/rules'
);

const deletedBatchPaths = [
  'basicRules.js',
  'draftRules.js',
  'enforcement.js',
  'enforceConsent.js',
  'hardCapValidation.js',
  'miscRules.js',
  'rosterValidation.js',
  'timingValidation.js',
  'tradeExceptions.js',
  'validateAggregation.js',
  'validateCash.js',
  'validateConsent.js',
  'validateEligibility.js',
  'validateEntitlementRouting.js',
  'validateFaExceptionUsage.js',
  'validatePlayerRouting.js',
  'validateReacquisition.js',
  'validateSalaryMatching.js',
  'validateSignAndTrade.js',
  'validateStepien.js',
  'validateTradeExceptions.js',
] as const;

const moduleParityCases = [
  {
    label: 'validateSalaryMatching',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts',
    exportNames: ['SALARY_MATCHING_VERSION', 'validateSalaryMatching'],
  },
  {
    label: 'hardCapValidation',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/hardCapValidation',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/hardCapValidation.ts',
    exportNames: [
      'validateHardCap',
      'hardCapValidation',
      'wouldExceedHardCapAfterTrade',
    ],
  },
  {
    label: 'validateStepien',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateStepien',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateStepien.ts',
    exportNames: ['validateStepien'],
  },
  {
    label: 'validateAggregation',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateAggregation',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateAggregation.ts',
    exportNames: ['validateAggregation'],
  },
  {
    label: 'validateTradeExceptions',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateTradeExceptions.ts',
    exportNames: ['validateTradeExceptions'],
  },
  {
    label: 'basicRules',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/basicRules',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/basicRules.ts',
    exportNames: [
      'enforceSecondApronHandcuffs',
      'validateSecondApron',
      'validateSecondApronRules',
    ],
  },
  {
    label: 'timingValidation',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/timingValidation',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/timingValidation.ts',
    exportNames: [
      'enforceTiming',
      'enforceTimingGates',
      'enforceTimingLegacy',
      'validateTiming',
      'validateTimingLegacy',
    ],
  },
  {
    label: 'validateEligibility',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateEligibility',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateEligibility.ts',
    exportNames: ['enforceEligibility', 'validateEligibility'],
  },
  {
    label: 'validateConsent',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateConsent',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateConsent.ts',
    exportNames: ['validateConsent'],
  },
  {
    label: 'validateEntitlementRouting',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validateEntitlementRouting',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validateEntitlementRouting.ts',
    exportNames: [
      'default',
      'enforceEntitlementRouting',
      'validateEntitlementLinkageLegality',
      'validateEntitlementRouting',
    ],
  },
  {
    label: 'validatePlayerRouting',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/validatePlayerRouting',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/validatePlayerRouting.ts',
    exportNames: ['default', 'enforcePlayerRouting', 'validatePlayerRouting'],
  },
  {
    label: 'draftRules',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/rules/draftRules',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/rules/draftRules.ts',
    exportNames: ['hasStepienViolation', 'validateDraftPicks'],
  },
] as const;

describe('E120 tradeMachine rules shim deletion batch guardrails', () => {
  it('tracks the exact 21-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(21);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(rulesRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  for (const moduleCase of moduleParityCases) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the TS authority`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const expectedExportNames = [...moduleCase.exportNames];

      expect('default' in authorityModule).toBe(
        expectedExportNames.includes('default')
      );
      expect(Object.keys(authorityModule)).toEqual(
        expect.arrayContaining(expectedExportNames)
      );

      for (const exportName of expectedExportNames) {
        expect(extensionlessModule[exportName]).toBe(authorityModule[exportName]);
      }
    });
  }
});
