/**
 * FILE: src/tests/architect/sharedContractHelpersShimBatch.e124.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E124 shared contract-helper shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E124 - Added exact deletion-batch absence checks plus shared contract-helper extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const sharedContractsRoot = path.resolve(__dirname, '../../shared/utils/contracts');

const deletedBatchPaths = ['contractUtils.js', 'seasonNormalizer.js'] as const;

const moduleParityCases = [
  {
    label: 'contractUtils',
    extensionlessSpecifier: '@/shared/utils/contracts/contractUtils',
    authoritySpecifier: '../../shared/utils/contracts/contractUtils.ts',
    exportNames: ['getCurrentSeasonYear', 'getYearsRemaining'],
  },
  {
    label: 'seasonNormalizer',
    extensionlessSpecifier: '@/shared/utils/contracts/seasonNormalizer',
    authoritySpecifier: '../../shared/utils/contracts/seasonNormalizer.ts',
    exportNames: [
      'compareSeason',
      'isSeasonActive',
      'isSeasonExpired',
      'isSeasonFuture',
      'normalizeSeason',
      'seasonStartYear',
    ],
  },
] as const;

describe('E124 shared contract-helper shim deletion batch guardrails', () => {
  it('tracks the exact 2-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(2);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(sharedContractsRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  for (const moduleCase of moduleParityCases) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the TS authority`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const expectedExportNames: string[] = [...moduleCase.exportNames];

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

  it('keeps the shared contracts barrel aligned with representative extensionless exports', async () => {
    const barrelModule = await import('../../shared/utils/contracts');
    const contractUtilsModule = await import('@/shared/utils/contracts/contractUtils');
    const seasonNormalizerModule = await import(
      '@/shared/utils/contracts/seasonNormalizer'
    );

    expect(barrelModule.getCurrentSeasonYear).toBe(
      contractUtilsModule.getCurrentSeasonYear
    );
    expect(barrelModule.getYearsRemaining).toBe(
      contractUtilsModule.getYearsRemaining
    );
    expect(barrelModule.normalizeSeason).toBe(
      seasonNormalizerModule.normalizeSeason
    );
    expect(barrelModule.compareSeason).toBe(
      seasonNormalizerModule.compareSeason
    );
  });
});
