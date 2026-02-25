import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetLeague: vi.fn(),
  mockResolveEntitlementsForTeam: vi.fn(),
  mockResolveEntitlement: vi.fn(),
  mockRunTeamExclusivityGate: vi.fn(),
  mockRunLeagueClaimUniquenessGate: vi.fn(),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getLeague: (...args: unknown[]) => mocks.mockGetLeague(...args),
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: (...args: unknown[]) =>
    mocks.mockResolveEntitlementsForTeam(...args),
  resolveEntitlement: (...args: unknown[]) =>
    mocks.mockResolveEntitlement(...args),
}));

vi.mock('@/features/architect/utils/entitlements/runTeamExclusivityGate', () => ({
  runTeamExclusivityGate: (...args: unknown[]) =>
    mocks.mockRunTeamExclusivityGate(...args),
}));

vi.mock(
  '@/features/architect/utils/entitlements/leagueClaimUniquenessGate',
  () => ({
    runLeagueClaimUniquenessGate: (...args: unknown[]) =>
      mocks.mockRunLeagueClaimUniquenessGate(...args),
  })
);

import { validateTradeApplyExclusivity } from '@/features/architect/utils/leagueInvariants';

describe('validateTradeApplyExclusivity scope guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockResolveEntitlementsForTeam.mockResolvedValue([
      {
        id: 'ent-out',
        kind: 'pick_ownership',
        underlyingPickId: 'LAL_2027_1st',
      },
    ]);
    mocks.mockResolveEntitlement.mockResolvedValue({
      id: 'ent-in',
      kind: 'pick_ownership',
      underlyingPickId: 'MIA_2027_1st',
    });
    mocks.mockRunTeamExclusivityGate.mockReturnValue({ ok: true });
    mocks.mockRunLeagueClaimUniquenessGate.mockResolvedValue({ ok: true });
  });

  it('passes FULL_LEAGUE scope to league claim uniqueness gate', async () => {
    const result = await validateTradeApplyExclusivity(
      'world-1',
      'executeTrade',
      {
        entitlementUpdates: [{ entitlementId: 'ent-in', holderTeam: 'LAL' }],
        metadata: {
          entitlementsTraded: {
            LAL: { out: ['ent-out'], in: ['ent-in'] },
          },
        },
      }
    );

    expect(result.valid).toBe(true);
    expect(mocks.mockRunLeagueClaimUniquenessGate).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world-1',
        context: 'WORLD_TRADE_APPLY',
        scopeMode: 'FULL_LEAGUE',
      })
    );
  });
});
