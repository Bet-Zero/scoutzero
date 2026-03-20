/**
 * FILE: src/tests/architect/capCoreHelperShimBatch.e126.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E126 cap-core helper shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E126 - Added deleted-path checks plus extensionless/authority parity for capLegalityValidation and computeTeamCapTotals.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const architectUtilsRoot = path.resolve(__dirname, '../../features/architect/utils');

const deletedBatchPaths = [
  'capLegalityValidation.js',
  'capTotals/computeTeamCapTotals.js',
] as const;

const moduleParityCases = [
  {
    label: 'capLegalityValidation',
    extensionlessSpecifier: '@/features/architect/utils/capLegalityValidation',
    authoritySpecifier: '../../features/architect/utils/capLegalityValidation.ts',
    exportNames: ['validateExceptionEligibility', 'validateSigning', 'default'],
  },
  {
    label: 'computeTeamCapTotals',
    extensionlessSpecifier:
      '@/features/architect/utils/capTotals/computeTeamCapTotals',
    authoritySpecifier:
      '../../features/architect/utils/capTotals/computeTeamCapTotals.ts',
    exportNames: ['computeTeamCapTotals', 'canUseRoomException', 'default'],
  },
] as const;

describe('E126 cap-core helper shim deletion batch guardrails', () => {
  it('tracks the exact 2-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(2);
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

      for (const exportName of moduleCase.exportNames) {
        expect(extensionlessModule[exportName]).toBe(authorityModule[exportName]);
      }
    });
  }

  it('keeps the capTotals barrel aligned with the retired compute helper authority', async () => {
    const barrelModule = await import('../../features/architect/utils/capTotals/index.js');
    const extensionlessModule = await import(
      '@/features/architect/utils/capTotals/computeTeamCapTotals'
    );

    expect(barrelModule.computeTeamCapTotals).toBe(
      extensionlessModule.computeTeamCapTotals
    );
    expect(barrelModule.canUseRoomException).toBe(
      extensionlessModule.canUseRoomException
    );
  });
});
