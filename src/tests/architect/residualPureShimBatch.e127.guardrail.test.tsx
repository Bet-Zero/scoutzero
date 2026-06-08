/**
 * FILE: src/tests/architect/residualPureShimBatch.e127.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E127 residual pure-shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * @vitest-environment jsdom
 *
 * HISTORY:
 *  - 2026-03-20: E127 - Added deleted-path checks plus extensionless/authority parity for residual pure shims formerly treated as keepers.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const architectRoot = path.resolve(__dirname, '../../features/architect');

const deletedBatchPaths = [
  'utils/basicArchitectUtils.js',
  'utils/playerRulesProfile/types.js',
  'utils/tradeMachine/utils/hardCapStatus.js',
  'tradeMachine/ValidationStateHeader.jsx',
  'tradeMachine/EntitlementPicksList.jsx',
  'GMDashboard/components/DraftPositionsInput.jsx',
] as const;

const moduleParityCases = [
  {
    label: 'basicArchitectUtils',
    extensionlessSpecifier: '@/features/architect/utils/basicArchitectUtils',
    authoritySpecifier: '../../features/architect/utils/basicArchitectUtils.ts',
    // Post default->named export conversion (10f5fed7): no default; the module's
    // getCapPercentage helper is the named export that replaced it.
    exportNames: [
      'CBA_MECHANICS',
      'attachDefaultPicks',
      'generateDefaultPicks',
      'getCapPercentage',
      'markHardCapTriggered',
    ],
  },
  {
    label: 'playerRulesProfile/types',
    extensionlessSpecifier: '@/features/architect/utils/playerRulesProfile/types',
    authoritySpecifier:
      '../../features/architect/utils/playerRulesProfile/types.ts',
    exportNames: ['default'],
  },
  {
    label: 'hardCapStatus',
    extensionlessSpecifier:
      '@/features/architect/utils/tradeMachine/utils/hardCapStatus',
    authoritySpecifier:
      '../../features/architect/utils/tradeMachine/utils/hardCapStatus.ts',
    // Post default->named export conversion (10f5fed7): no default export.
    exportNames: [
      'HARD_CAP_TYPES',
      'getSigningHardCapTriggerMetadata',
      'getHardCapStatus',
      'getHardCapStatusFromContext',
      'isTeamHardCapped',
      'resolveHardCapCeiling',
    ],
  },
  {
    label: 'ValidationStateHeader',
    extensionlessSpecifier:
      '@/features/architect/tradeMachine/ValidationStateHeader',
    authoritySpecifier:
      '../../features/architect/tradeMachine/ValidationStateHeader.tsx',
    // Post default->named export conversion (10f5fed7): named ValidationStateHeader.
    exportNames: ['MODE_TAGS', 'ModeTag', 'ValidationStateHeader'],
  },
  {
    label: 'EntitlementPicksList',
    extensionlessSpecifier: '@/features/architect/tradeMachine/EntitlementPicksList',
    authoritySpecifier:
      '../../features/architect/tradeMachine/EntitlementPicksList.tsx',
    exportNames: ['EntitlementPicksList', 'default'],
  },
  {
    label: 'DraftPositionsInput',
    extensionlessSpecifier:
      '@/features/architect/GMDashboard/components/DraftPositionsInput',
    authoritySpecifier:
      '../../features/architect/GMDashboard/components/DraftPositionsInput.tsx',
    // Post default->named export conversion (10f5fed7): named export only.
    exportNames: ['DraftPositionsInput'],
  },
] as const;

describe('E127 residual pure-shim deletion batch guardrails', () => {
  it('tracks the exact 6-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(6);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(architectRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  for (const moduleCase of moduleParityCases) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the authority module`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);
      const expectedExportNames = [...moduleCase.exportNames].sort();

      expect(Object.keys(extensionlessModule).sort()).toEqual(expectedExportNames);
      expect(Object.keys(authorityModule).sort()).toEqual(expectedExportNames);

      for (const exportName of expectedExportNames) {
        expect(extensionlessModule[exportName]).toBe(authorityModule[exportName]);
      }
    });
  }
});
