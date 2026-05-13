/**
 * FILE: src/tests/architect/tradeMachineEngineShimBatch.e121.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E121 tradeMachine/engine shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E121 - Added exact deletion-batch absence checks plus engine extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const engineRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeMachine/engine'
);

const deletedBatchPaths = [
  'engineUtils.js',
  'performanceMonitor.js',
  'tradeDebug.js',
  'tradeValidator.js',
  'validationDebugMonitor.js',
  'validationPerformanceMonitor.js',
  'validationUtils.js',
] as const;

const moduleParityCases = [
  {
    label: 'tradeValidator',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/tradeValidator',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/tradeValidator.ts',
    exportNames: [
      'TRADE_VALIDATOR_VERSION',
      'validateFaExceptionUsage',
      'validateTrade',
    ],
  },
  {
    label: 'tradeDebug',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/tradeDebug',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/tradeDebug.ts',
    // updated: Wave 3 export-shape change — tradeDebug is now a named export (see commits 10f5fed7, 692f4f8a)
    exportNames: ['debug'],
  },
  {
    label: 'engineUtils',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/engineUtils',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/engineUtils.ts',
    exportNames: ['computeTradeKicker', 'debug'],
  },
  {
    label: 'validationUtils',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/validationUtils',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/validationUtils.ts',
    exportNames: [
      'createTrackedValidator',
      'validateTemplateRule',
      'validatorDebug',
      'wrapCommonValidators',
    ],
  },
  {
    label: 'performanceMonitor',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/performanceMonitor',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/performanceMonitor.ts',
    exportNames: ['PerformanceMonitor', 'performanceMonitor'],
  },
  {
    label: 'validationPerformanceMonitor',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.ts',
    exportNames: ['ValidationPerformanceMonitor', 'performanceMonitor'],
  },
  {
    label: 'validationDebugMonitor',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/engine/validationDebugMonitor',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/engine/validationDebugMonitor.ts',
    exportNames: ['ValidationDebugMonitor', 'debugMonitor'],
  },
] as const;

describe('E121 tradeMachine engine shim deletion batch guardrails', () => {
  it('tracks the exact 7-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(7);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(engineRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  for (const moduleCase of moduleParityCases) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the TS authority`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const expectedExportNames = [...moduleCase.exportNames];

      expect('default' in authorityModule).toBe(
        (expectedExportNames as string[]).includes('default')
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
