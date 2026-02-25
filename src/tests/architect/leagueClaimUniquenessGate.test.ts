import { describe, it, expect } from 'vitest';
import {
  assertLeagueClaimGateScopeSafety,
  detectCrossTeamClaimConflicts,
  evaluateLeagueClaimUniquenessForMap,
} from '@/features/architect/utils/entitlements/leagueClaimUniquenessGate';
import type { EntitlementDocLike } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';

function makePickOwnership(
  id: string,
  underlyingPickId: string
): EntitlementDocLike {
  return { id, kind: 'pick_ownership', underlyingPickId };
}

describe('leagueClaimUniquenessGate', () => {
  it('detects cross-team claim conflicts by claim key', () => {
    const conflicts = detectCrossTeamClaimConflicts({
      BOS: [makePickOwnership('ent-bos', 'LAL_2028_1st')],
      LAL: [makePickOwnership('ent-lal', 'LAL_2028_1st')],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].claimKey).toBe('own:LAL_2028_1st');
    expect(conflicts[0].teams).toEqual(['BOS', 'LAL']);
  });

  it('does not report same-team duplicates as league conflicts', () => {
    const conflicts = detectCrossTeamClaimConflicts({
      BOS: [
        makePickOwnership('ent-bos-a', 'BOS_2029_1st'),
        makePickOwnership('ent-bos-b', 'BOS_2029_1st'),
      ],
      LAL: [],
    });

    expect(conflicts).toHaveLength(0);
  });

  it('returns ok when no cross-team conflicts exist', () => {
    const result = evaluateLeagueClaimUniquenessForMap({
      context: 'WORLD_TRADE_APPLY',
      entitlementsByTeam: {
        BOS: [makePickOwnership('ent-bos', 'BOS_2029_1st')],
        LAL: [makePickOwnership('ent-lal', 'LAL_2029_1st')],
      },
    });

    expect(result.ok).toBe(true);
  });

  it('fails closed when provided a malformed team set', () => {
    const result = evaluateLeagueClaimUniquenessForMap({
      context: 'ENTITLEMENT_SAVE',
      entitlementsByTeam: {
        BOS: 'not-an-array' as unknown as EntitlementDocLike[],
      },
    });

    expect(result.ok).toBe(false);
    const failedResult = result as Exclude<typeof result, { ok: true }>;
    expect(failedResult.errorType).toBe('VALIDATION_UNAVAILABLE');
    expect(failedResult.message).toContain(
      'Cannot validate league-wide claim uniqueness'
    );
  });

  it('throws when CUSTOM scope omits scopeReason', () => {
    expect(() =>
      assertLeagueClaimGateScopeSafety({
        context: 'WORLD_TRADE_APPLY',
        scopeMode: 'CUSTOM',
        teamCodes: ['LAL', 'BOS'],
      })
    ).toThrow(/scopeReason/i);
  });

  it('throws when core write contexts attempt CUSTOM scope', () => {
    expect(() =>
      assertLeagueClaimGateScopeSafety({
        context: 'ENTITLEMENT_SAVE',
        scopeMode: 'CUSTOM',
        scopeReason: 'PERF_SAFE_INDEXED_LOOKUP',
        teamCodes: ['LAL', 'BOS'],
      })
    ).toThrow(/FULL_LEAGUE/i);
  });

  it('throws when FULL_LEAGUE mode is passed teamCodes', () => {
    expect(() =>
      assertLeagueClaimGateScopeSafety({
        context: 'ENTITLEMENT_MOVE',
        scopeMode: 'FULL_LEAGUE',
        teamCodes: ['LAL', 'BOS'],
      })
    ).toThrow(/teamCodes/i);
  });
});
