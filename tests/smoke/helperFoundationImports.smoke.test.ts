import { describe, expect, it } from 'vitest';

describe('helper foundation import compatibility', () => {
  it('resolves tradeHelpers via extensionless and .js imports', async () => {
    const extensionless = await import('@/features/architect/utils/tradeHelpers');
    const withJs = await import('@/features/architect/utils/tradeHelpers.js');

    expect(extensionless.getSalaryForYear).toBeTypeOf('function');
    expect(withJs.formatCurrency).toBeTypeOf('function');
  });

  it('resolves hardCapUtils via extensionless and .js imports', async () => {
    const extensionless = await import('@/features/architect/utils/hardCapUtils');
    const withJs = await import('@/features/architect/utils/hardCapUtils.js');

    expect(extensionless.wouldExceedHardCap).toBeTypeOf('function');
    expect(withJs.getFirstApronHardCapReason).toBeTypeOf('function');
  });

  it('resolves faExceptionUtils via extensionless and .js imports', async () => {
    const extensionless = await import('@/features/architect/utils/faExceptionUtils');
    const withJs = await import('@/features/architect/utils/faExceptionUtils.js');

    expect(extensionless.canUseFaException).toBeTypeOf('function');
    expect(withJs.getTeamFaExceptionBuckets).toBeTypeOf('function');
  });

  it('resolves capUtils via extensionless and .js imports', async () => {
    const extensionless = await import('@/features/architect/utils/capUtils');
    const withJs = await import('@/features/architect/utils/capUtils.js');

    expect(extensionless.getApronStatus).toBeTypeOf('function');
    expect(withJs.getAllowableIncomingMargin).toBeTypeOf('function');
  });

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
