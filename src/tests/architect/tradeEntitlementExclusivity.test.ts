/**
 * FILE: src/tests/architect/tradeEntitlementExclusivity.test.ts
 * PURPOSE: Tests for trade-time entitlement exclusivity validation.
 *          Validates that trades creating overlapping claims are blocked.
 * OWNERSHIP: Test suite (TM-EXCL-E1: Entitlement Exclusivity Foundation)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E1 execution.
 */

import { describe, it, expect } from 'vitest';
import { computePostTradeEntitlements } from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils';
import { validateEntitlementExclusivity } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeEnt(
  id: string,
  kind: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    entitlementId: id,
    kind,
    holderTeam: 'LAL',
    seasonYear: 2026,
    round: 1,
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Trade exclusivity: swap_right conflicts
// ═══════════════════════════════════════════════════════════════════════════════

describe('Trade exclusivity: swap_right conflicts', () => {
  it('blocks trade that sends duplicate swap controller to receiving team', () => {
    // Team LAL already has a swap on BOS_2027_1st
    const lalCurrentEntitlements = [
      makeEnt('lal-swap-1', 'swap_right', {
        swapControllerPickId: 'BOS_2027_1st',
      }),
    ];

    // Team BOS sends a swap on BOS_2027_1st to LAL
    const bosOutgoing = [
      makeEnt('bos-swap-1', 'swap_right', {
        swapControllerPickId: 'BOS_2027_1st',
        fromTeamId: 'BOS',
        toTeamId: 'LAL',
      }),
    ];

    // LAL is not sending anything out
    const lalOutgoing: typeof lalCurrentEntitlements = [];

    const postTradeSet = computePostTradeEntitlements({
      currentEntitlements: lalCurrentEntitlements,
      entitlementsOut: lalOutgoing,
      allTeamsEntitlementsOut: [bosOutgoing],
      teamId: 'LAL',
    });

    const result = validateEntitlementExclusivity({
      entitlements:
        postTradeSet as Parameters<typeof validateEntitlementExclusivity>[0]['entitlements'],
    });

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('DUP_SWAP_CONTROLLER');
    expect(result.violations[0].underlyingPickIds).toContain('BOS_2027_1st');
  });

  it('allows trade when receiving team trades away conflicting swap first', () => {
    // Team LAL has a swap on BOS_2027_1st, but is trading it out
    const lalCurrentEntitlements = [
      makeEnt('lal-swap-1', 'swap_right', {
        swapControllerPickId: 'BOS_2027_1st',
      }),
      makeEnt('lal-own-1', 'pick_ownership', {
        underlyingPickId: 'LAL_2026_1st',
      }),
    ];

    const lalOutgoing = [
      makeEnt('lal-swap-1', 'swap_right', {
        swapControllerPickId: 'BOS_2027_1st',
        fromTeamId: 'LAL',
        toTeamId: 'BOS',
      }),
    ];

    // BOS sends a different swap on BOS_2027_1st to LAL (replacement)
    const bosOutgoing = [
      makeEnt('bos-swap-2', 'swap_right', {
        swapControllerPickId: 'BOS_2027_1st',
        fromTeamId: 'BOS',
        toTeamId: 'LAL',
      }),
    ];

    const postTradeSet = computePostTradeEntitlements({
      currentEntitlements: lalCurrentEntitlements,
      entitlementsOut: lalOutgoing,
      allTeamsEntitlementsOut: [bosOutgoing],
      teamId: 'LAL',
    });

    const result = validateEntitlementExclusivity({
      entitlements:
        postTradeSet as Parameters<typeof validateEntitlementExclusivity>[0]['entitlements'],
    });

    // Should be valid: old swap removed, new swap added — only one swap on BOS_2027_1st
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Trade exclusivity: pick_ownership conflicts
// ═══════════════════════════════════════════════════════════════════════════════

describe('Trade exclusivity: pick_ownership conflicts', () => {
  it('blocks trade that creates duplicate pick ownership on receiving team', () => {
    // Team LAL already owns LAL_2026_1st
    const lalCurrentEntitlements = [
      makeEnt('lal-own-1', 'pick_ownership', {
        underlyingPickId: 'LAL_2026_1st',
      }),
    ];

    // BOS sends another ownership of LAL_2026_1st to LAL
    const bosOutgoing = [
      makeEnt('bos-own-1', 'pick_ownership', {
        underlyingPickId: 'LAL_2026_1st',
        fromTeamId: 'BOS',
        toTeamId: 'LAL',
      }),
    ];

    const postTradeSet = computePostTradeEntitlements({
      currentEntitlements: lalCurrentEntitlements,
      entitlementsOut: [],
      allTeamsEntitlementsOut: [bosOutgoing],
      teamId: 'LAL',
    });

    const result = validateEntitlementExclusivity({
      entitlements:
        postTradeSet as Parameters<typeof validateEntitlementExclusivity>[0]['entitlements'],
    });

    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('DUP_PICK_OWNERSHIP_UNDERLIER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Clean trades
// ═══════════════════════════════════════════════════════════════════════════════

describe('Trade exclusivity: clean trades', () => {
  it('allows clean 2-team trade with no conflicts', () => {
    const lalEntitlements = [
      makeEnt('lal-own-1', 'pick_ownership', {
        underlyingPickId: 'LAL_2026_1st',
      }),
    ];
    const bosEntitlements = [
      makeEnt('bos-own-1', 'pick_ownership', {
        underlyingPickId: 'BOS_2026_1st',
      }),
    ];

    // LAL sends LAL_2026_1st, BOS sends BOS_2026_1st
    const lalOut = [
      makeEnt('lal-own-1', 'pick_ownership', {
        underlyingPickId: 'LAL_2026_1st',
        fromTeamId: 'LAL',
        toTeamId: 'BOS',
      }),
    ];
    const bosOut = [
      makeEnt('bos-own-1', 'pick_ownership', {
        underlyingPickId: 'BOS_2026_1st',
        fromTeamId: 'BOS',
        toTeamId: 'LAL',
      }),
    ];

    // Check LAL's post-trade
    const lalPostTrade = computePostTradeEntitlements({
      currentEntitlements: lalEntitlements,
      entitlementsOut: lalOut,
      allTeamsEntitlementsOut: [bosOut],
      teamId: 'LAL',
    });

    const lalResult = validateEntitlementExclusivity({
      entitlements:
        lalPostTrade as Parameters<typeof validateEntitlementExclusivity>[0]['entitlements'],
    });
    expect(lalResult.valid).toBe(true);

    // Check BOS's post-trade
    const bosPostTrade = computePostTradeEntitlements({
      currentEntitlements: bosEntitlements,
      entitlementsOut: bosOut,
      allTeamsEntitlementsOut: [lalOut],
      teamId: 'BOS',
    });

    const bosResult = validateEntitlementExclusivity({
      entitlements:
        bosPostTrade as Parameters<typeof validateEntitlementExclusivity>[0]['entitlements'],
    });
    expect(bosResult.valid).toBe(true);
  });

  it('allows empty entitlement trade', () => {
    const result = validateEntitlementExclusivity({ entitlements: [] });
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Conveyance conflicts via trade
// ═══════════════════════════════════════════════════════════════════════════════

describe('Trade exclusivity: conveyance conflicts', () => {
  it('blocks trade that creates overlapping conveyance on receiving team', () => {
    // LAL already has a conveyance on pool [A, B], comparator more_favorable, rank [1]
    const lalCurrentEntitlements = [
      makeEnt('lal-conv-1', 'conveyance_right', {
        poolUnderlyingPickIds: ['A', 'B'],
        receivesComparator: 'more_favorable',
        receivesRank: [1, 2],
      }),
    ];

    // BOS sends a conveyance that overlaps: pool [B, C], same comparator, rank [2, 3]
    const bosOutgoing = [
      makeEnt('bos-conv-1', 'conveyance_right', {
        poolUnderlyingPickIds: ['B', 'C'],
        receivesComparator: 'more_favorable',
        receivesRank: [2, 3],
        fromTeamId: 'BOS',
        toTeamId: 'LAL',
      }),
    ];

    const postTradeSet = computePostTradeEntitlements({
      currentEntitlements: lalCurrentEntitlements,
      entitlementsOut: [],
      allTeamsEntitlementsOut: [bosOutgoing],
      teamId: 'LAL',
    });

    const result = validateEntitlementExclusivity({
      entitlements:
        postTradeSet as Parameters<typeof validateEntitlementExclusivity>[0]['entitlements'],
    });

    expect(result.valid).toBe(false);
    expect(result.violations[0].type).toBe('OVERLAP_CONVEYANCE_POOL_RANK');
  });
});
