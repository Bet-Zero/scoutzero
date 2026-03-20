/**
 * FILE: src/tests/architect/tradeMachineCacheShimBatch.e122.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E122 tradeMachine/cache shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E122 - Added exact deletion-batch absence checks plus cache extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const cacheRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeMachine/cache'
);

const deletedBatchPaths = [
  'cacheInvalidationManager.js',
  'validationCache.js',
  'validationCacheService.js',
] as const;

const moduleParityCases = [
  {
    label: 'validationCache',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/cache/validationCache',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/cache/validationCache.ts',
    exportNames: ['ValidationCache', 'validationCache'],
  },
  {
    label: 'validationCacheService',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/cache/validationCacheService',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/cache/validationCacheService.ts',
    exportNames: ['CACHE_TYPES', 'validationCache'],
  },
  {
    label: 'cacheInvalidationManager',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/cache/cacheInvalidationManager',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/cache/cacheInvalidationManager.ts',
    exportNames: ['CacheInvalidationManager', 'cacheInvalidationManager'],
  },
] as const;

describe('E122 tradeMachine cache shim deletion batch guardrails', () => {
  it('tracks the exact 3-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(3);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(cacheRoot, relativePath))
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
});
