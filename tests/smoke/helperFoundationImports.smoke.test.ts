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
});
