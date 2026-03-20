/**
 * FILE: src/tests/architect/topLevelHelperShimBatch.e118.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E118 top-level Architect helper shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E118 - Added exact deletion-batch absence checks plus representative extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const architectUtilsRoot = path.resolve(__dirname, '../../features/architect/utils');

const deletedBatchPaths = [
  'capUtils.js',
  'cbaConstants.js',
  'consentUtils.js',
  'contractUtils.js',
  'faExceptionUtils.js',
  'hardCapUtils.js',
  'reacqUtils.js',
  'seasonFormat.js',
  'seasonUtils.js',
  'stepienUtils.js',
  'timingUtils.js',
  'tradeHelpers.js',
] as const;

const moduleParityCases = [
  {
    label: 'capUtils',
    extensionlessSpecifier: '@/features/architect/utils/capUtils',
    authoritySpecifier: '../../features/architect/utils/capUtils.ts',
    exportNames: [
      'getApronStatus',
      'getAllowableIncomingMargin',
      'getTeamApronStatus',
      'isFirstApronTeam',
      'isSecondApronTeam',
    ],
  },
  {
    label: 'cbaConstants',
    extensionlessSpecifier: '@/features/architect/utils/cbaConstants',
    authoritySpecifier: '../../features/architect/utils/cbaConstants.ts',
    exportNames: [
      'BYC_PERCENT',
      'DEFAULT_AVERAGE_SALARY',
      'FA_EXCEPTION_TRADE_USAGE',
      'MATCHING_BANDS_2023',
    ],
  },
  {
    label: 'consentUtils',
    extensionlessSpecifier: '@/features/architect/utils/consentUtils',
    authoritySpecifier: '../../features/architect/utils/consentUtils.ts',
    exportNames: [
      'collectConsentViolations',
      'hasConsent',
      'requiresConsent',
      'requiresLimitedNTCConsent',
    ],
  },
  {
    label: 'contractUtils',
    extensionlessSpecifier: '@/features/architect/utils/contractUtils',
    authoritySpecifier: '../../features/architect/utils/contractUtils.ts',
    exportNames: [
      'calculateCapHold',
      'generateContract',
      'getContractYearSlice',
      'getMinimumSalary',
    ],
  },
  {
    label: 'faExceptionUtils',
    extensionlessSpecifier: '@/features/architect/utils/faExceptionUtils',
    authoritySpecifier: '../../features/architect/utils/faExceptionUtils.ts',
    exportNames: [
      'canUseFaException',
      'getTeamFaExceptionBuckets',
      'isFaExceptionEligibleType',
    ],
  },
  {
    label: 'hardCapUtils',
    extensionlessSpecifier: '@/features/architect/utils/hardCapUtils',
    authoritySpecifier: '../../features/architect/utils/hardCapUtils.ts',
    exportNames: [
      'getFirstApronHardCapReason',
      'isHardCappedAtFirstApron',
      'wouldExceedHardCap',
    ],
  },
  {
    label: 'reacqUtils',
    extensionlessSpecifier: '@/features/architect/utils/reacqUtils',
    authoritySpecifier: '../../features/architect/utils/reacqUtils.ts',
    exportNames: ['getReacqBlock', 'violatesReacquisitionBar'],
  },
  {
    label: 'seasonFormat',
    extensionlessSpecifier: '@/features/architect/utils/seasonFormat',
    authoritySpecifier: '../../features/architect/utils/seasonFormat.ts',
    exportNames: [
      'getDefaultSeasonEndYear',
      'seasonEndYearsFromCaps',
      'toEndYear',
      'toSeasonCode',
    ],
  },
  {
    label: 'seasonUtils',
    extensionlessSpecifier: '@/features/architect/utils/seasonUtils',
    authoritySpecifier: '../../features/architect/utils/seasonUtils.ts',
    exportNames: ['parseSeasonEndYear', 'toEndYear', 'toSeasonCode', 'toSeasonKey'],
  },
  {
    label: 'stepienUtils',
    extensionlessSpecifier: '@/features/architect/utils/stepienUtils',
    authoritySpecifier: '../../features/architect/utils/stepienUtils.ts',
    exportNames: ['buildFirstRoundCalendar', 'hasStepienViolation', 'passesStepienRule'],
  },
  {
    label: 'timingUtils',
    extensionlessSpecifier: '@/features/architect/utils/timingUtils',
    authoritySpecifier: '../../features/architect/utils/timingUtils.ts',
    exportNames: [
      'daysSince',
      'isWithinMoratorium',
      'violates30Day',
      'violatesReacquisitionBar',
    ],
  },
  {
    label: 'tradeHelpers',
    extensionlessSpecifier: '@/features/architect/utils/tradeHelpers',
    authoritySpecifier: '../../features/architect/utils/tradeHelpers.ts',
    exportNames: [
      'calculateAllowableIncoming',
      'formatCurrency',
      'getApronStatus',
      'getSalaryForYear',
      'wouldExceedHardCap',
    ],
  },
] as const;

describe('E118 top-level helper shim deletion batch guardrails', () => {
  it('tracks the exact 12-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(12);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(architectUtilsRoot, relativePath))
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
