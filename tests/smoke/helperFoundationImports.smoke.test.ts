import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const architectUtilsRoot = path.resolve(
  __dirname,
  '../../src/features/architect/utils'
);
const persistenceContractsRoot = path.join(
  architectUtilsRoot,
  'persistenceContracts'
);

const helperCases = [
  {
    label: 'tradeHelpers',
    aliasBase: '@/features/architect/utils/tradeHelpers',
    shimPath: path.join(architectUtilsRoot, 'tradeHelpers.js'),
    exportNames: ['getSalaryForYear', 'formatCurrency'],
  },
  {
    label: 'hardCapUtils',
    aliasBase: '@/features/architect/utils/hardCapUtils',
    shimPath: path.join(architectUtilsRoot, 'hardCapUtils.js'),
    exportNames: ['wouldExceedHardCap', 'getFirstApronHardCapReason'],
  },
  {
    label: 'faExceptionUtils',
    aliasBase: '@/features/architect/utils/faExceptionUtils',
    shimPath: path.join(architectUtilsRoot, 'faExceptionUtils.js'),
    exportNames: ['canUseFaException', 'getTeamFaExceptionBuckets'],
  },
  {
    label: 'capUtils',
    aliasBase: '@/features/architect/utils/capUtils',
    shimPath: path.join(architectUtilsRoot, 'capUtils.js'),
    exportNames: ['getApronStatus', 'getAllowableIncomingMargin'],
  },
] as const;

describe('helper foundation import compatibility', () => {
  for (const helperCase of helperCases) {
    it(`resolves ${helperCase.label} via extensionless imports after helper shim retirement`, async () => {
      const extensionless = await import(helperCase.aliasBase);

      for (const exportName of helperCase.exportNames) {
        expect(extensionless[exportName]).toBeTypeOf('function');
      }

      expect(fs.existsSync(helperCase.shimPath)).toBe(false);
    });
  }

  it('resolves capTotals via barrel, extensionless, and TS-authority imports after shim retirement', async () => {
    const barrel = await import('@/features/architect/utils/capTotals');
    const extensionless = await import(
      '@/features/architect/utils/capTotals/computeTeamCapTotals'
    );
    const authority = await import(
      '@/features/architect/utils/capTotals/computeTeamCapTotals.ts'
    );
    const retiredShimPath = path.join(
      architectUtilsRoot,
      'capTotals/computeTeamCapTotals.js'
    );

    expect(barrel.computeTeamCapTotals).toBeTypeOf('function');
    expect(barrel.canUseRoomException).toBeTypeOf('function');
    expect(extensionless.computeTeamCapTotals).toBeTypeOf('function');
    expect(extensionless.default).toBeTypeOf('function');
    expect(authority.computeTeamCapTotals).toBeTypeOf('function');
    expect(authority.canUseRoomException).toBeTypeOf('function');
    expect(authority.default).toBeTypeOf('function');
    expect(extensionless.computeTeamCapTotals).toBe(authority.computeTeamCapTotals);
    expect(extensionless.canUseRoomException).toBe(authority.canUseRoomException);
    expect(extensionless.default).toBe(authority.default);
    expect(fs.existsSync(retiredShimPath)).toBe(false);
  });

  it('resolves persistenceContracts via barrel and extensionless imports after helper shim retirement', async () => {
    const barrel = await import('@/features/architect/utils/persistenceContracts');
    const normalizeExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/normalizeTeamTpe'
    );
    const validateExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/validatePersistableShape'
    );
    const enforcementExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/enforcement'
    );
    const contractsExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/contracts'
    );
    const retiredShimPaths = [
      'normalizeTeamTpe.js',
      'validatePersistableShape.js',
      'enforcement.js',
      'contracts.js',
    ] as const;

    expect(barrel.getTeamTpeList).toBeTypeOf('function');
    expect(barrel.validatePersistableShape).toBeTypeOf('function');
    expect(barrel.assertPersistableOrThrow).toBeTypeOf('function');
    expect(barrel.PERSISTENCE_CONTRACTS.TEAM).toBeDefined();

    expect(normalizeExtensionless.normalizeTeamTpeSchema).toBeTypeOf('function');
    expect(normalizeExtensionless.getTpeIdentityKey).toBeTypeOf('function');
    expect(validateExtensionless.findDisallowedKeyPaths).toBeTypeOf('function');
    expect(validateExtensionless.formatViolationMessage).toBeTypeOf('function');
    expect(enforcementExtensionless.assertPersistableOrThrow).toBeTypeOf(
      'function'
    );
    expect(enforcementExtensionless.shouldEnforcePersistenceContracts).toBeTypeOf(
      'function'
    );
    expect(Array.isArray(contractsExtensionless.TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST)).toBe(true);
    expect(Array.isArray(contractsExtensionless.TRADE_EXCEPTION_ITEM_ALLOWLIST)).toBe(
      true
    );
    expect(barrel.getTeamTpeList).toBe(normalizeExtensionless.getTeamTpeList);
    expect(barrel.validatePersistableShape).toBe(
      validateExtensionless.validatePersistableShape
    );
    expect(barrel.assertPersistableOrThrow).toBe(
      enforcementExtensionless.assertPersistableOrThrow
    );
    expect(barrel.PERSISTENCE_CONTRACTS).toBe(
      contractsExtensionless.PERSISTENCE_CONTRACTS
    );
    expect(
      retiredShimPaths.filter((relativePath) =>
        fs.existsSync(path.join(persistenceContractsRoot, relativePath))
      )
    ).toEqual([]);
  });
});
