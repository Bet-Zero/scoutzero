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

  it('resolves capTotals via barrel, extensionless, and explicit .js imports', async () => {
    const barrel = await import('@/features/architect/utils/capTotals');
    const extensionless = await import(
      '@/features/architect/utils/capTotals/computeTeamCapTotals'
    );
    const withJs = await import(
      '@/features/architect/utils/capTotals/computeTeamCapTotals.js'
    );

    expect(barrel.computeTeamCapTotals).toBeTypeOf('function');
    expect(barrel.canUseRoomException).toBeTypeOf('function');
    expect(extensionless.computeTeamCapTotals).toBeTypeOf('function');
    expect(extensionless.default).toBeTypeOf('function');
    expect(withJs.computeTeamCapTotals).toBeTypeOf('function');
    expect(withJs.canUseRoomException).toBeTypeOf('function');
    expect(withJs.default).toBeTypeOf('function');
  });

  it('resolves persistenceContracts via barrel, extensionless, and explicit .js imports', async () => {
    const barrel = await import('@/features/architect/utils/persistenceContracts');
    const normalizeExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/normalizeTeamTpe'
    );
    const normalizeWithJs = await import(
      '@/features/architect/utils/persistenceContracts/normalizeTeamTpe.js'
    );
    const validateExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/validatePersistableShape'
    );
    const validateWithJs = await import(
      '@/features/architect/utils/persistenceContracts/validatePersistableShape.js'
    );
    const enforcementExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/enforcement'
    );
    const enforcementWithJs = await import(
      '@/features/architect/utils/persistenceContracts/enforcement.js'
    );
    const contractsExtensionless = await import(
      '@/features/architect/utils/persistenceContracts/contracts'
    );
    const contractsWithJs = await import(
      '@/features/architect/utils/persistenceContracts/contracts.js'
    );

    expect(barrel.getTeamTpeList).toBeTypeOf('function');
    expect(barrel.validatePersistableShape).toBeTypeOf('function');
    expect(barrel.assertPersistableOrThrow).toBeTypeOf('function');
    expect(barrel.PERSISTENCE_CONTRACTS.TEAM).toBeDefined();

    expect(normalizeExtensionless.normalizeTeamTpeSchema).toBeTypeOf('function');
    expect(normalizeWithJs.getTpeIdentityKey).toBeTypeOf('function');
    expect(validateExtensionless.findDisallowedKeyPaths).toBeTypeOf('function');
    expect(validateWithJs.formatViolationMessage).toBeTypeOf('function');
    expect(enforcementExtensionless.assertPersistableOrThrow).toBeTypeOf(
      'function'
    );
    expect(enforcementWithJs.shouldEnforcePersistenceContracts).toBeTypeOf(
      'function'
    );
    expect(Array.isArray(contractsExtensionless.TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST)).toBe(true);
    expect(Array.isArray(contractsWithJs.TRADE_EXCEPTION_ITEM_ALLOWLIST)).toBe(
      true
    );
  });
});
