/**
 * FILE: src/tests/architect/persistenceContractsShimBatch.e123.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E123 persistenceContracts shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E123 - Added exact deletion-batch absence checks plus persistence-contract extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const persistenceContractsRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/persistenceContracts'
);

const deletedBatchPaths = [
  'contracts.js',
  'enforcement.js',
  'normalizeTeamTpe.js',
  'validatePersistableShape.js',
] as const;

const moduleParityCases = [
  {
    label: 'contracts',
    extensionlessSpecifier:
      '@/features/architect/utils/persistenceContracts/contracts',
    authoritySpecifier:
      '../../features/architect/utils/persistenceContracts/contracts.ts',
    exportNames: [
      'CAP_HOLD_ITEM_ALLOWLIST',
      'DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST',
      'DEAD_CAP_ITEM_ALLOWLIST',
      'EVENT_METADATA_TOP_LEVEL_ALLOWLIST',
      'EVENT_TOP_LEVEL_ALLOWLIST',
      'EXCEPTION_HISTORY_ITEM_ALLOWLIST',
      'PERSISTENCE_CONTRACTS',
      'PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST',
      'TEAM_DEEP_RULES',
      'TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST',
      'TRADE_EXCEPTION_ITEM_ALLOWLIST',
    ],
  },
  {
    label: 'validatePersistableShape',
    extensionlessSpecifier:
      '@/features/architect/utils/persistenceContracts/validatePersistableShape',
    authoritySpecifier:
      '../../features/architect/utils/persistenceContracts/validatePersistableShape.ts',
    exportNames: [
      'findDisallowedKeyPaths',
      'formatViolationMessage',
      'validatePersistableShape',
    ],
  },
  {
    label: 'enforcement',
    extensionlessSpecifier:
      '@/features/architect/utils/persistenceContracts/enforcement',
    authoritySpecifier:
      '../../features/architect/utils/persistenceContracts/enforcement.ts',
    exportNames: [
      'assertPersistableOrThrow',
      'checkPersistableContract',
      'shouldEnforcePersistenceContracts',
    ],
  },
  {
    label: 'normalizeTeamTpe',
    extensionlessSpecifier:
      '@/features/architect/utils/persistenceContracts/normalizeTeamTpe',
    authoritySpecifier:
      '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.ts',
    exportNames: [
      'getLegacyTpeFallbackCount',
      'getTeamTpeList',
      'getTpeIdentityKey',
      'normalizeTeamTpeSchema',
      'resetLegacyTpeFallbackTelemetry',
    ],
  },
] as const;

describe('E123 persistenceContracts shim deletion batch guardrails', () => {
  it('tracks the exact 4-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(4);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(persistenceContractsRoot, relativePath))
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

  it('keeps the persistenceContracts barrel aligned with representative extensionless exports', async () => {
    const barrelModule = await import(
      '@/features/architect/utils/persistenceContracts'
    );
    const contractsModule = await import(
      '@/features/architect/utils/persistenceContracts/contracts'
    );
    const validateModule = await import(
      '@/features/architect/utils/persistenceContracts/validatePersistableShape'
    );
    const enforcementModule = await import(
      '@/features/architect/utils/persistenceContracts/enforcement'
    );
    const normalizeModule = await import(
      '@/features/architect/utils/persistenceContracts/normalizeTeamTpe'
    );

    expect(barrelModule.PERSISTENCE_CONTRACTS).toBe(
      contractsModule.PERSISTENCE_CONTRACTS
    );
    expect(barrelModule.validatePersistableShape).toBe(
      validateModule.validatePersistableShape
    );
    expect(barrelModule.assertPersistableOrThrow).toBe(
      enforcementModule.assertPersistableOrThrow
    );
    expect(barrelModule.getTeamTpeList).toBe(normalizeModule.getTeamTpeList);
  });
});
