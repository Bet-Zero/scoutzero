/**
 * FILE: tests/entitlements/entitlementTrading.test.js
 * PURPOSE: Tests for TM-PICKS-E1 — Entitlement trading state management and post-trade computation
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import { describe, it, expect } from 'vitest';
import {
  computePostTradeEntitlements,
  buildStepienOutgoingPicksFromEntitlements,
  buildStepienBaselinePicksFromEntitlements,
} from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils';
import {
  computePostTradeEntitlements as computePostTradeEntitlementsJs,
  buildStepienOutgoingPicksFromEntitlements as buildStepienOutgoingPicksFromEntitlementsJs,
  buildStepienBaselinePicksFromEntitlements as buildStepienBaselinePicksFromEntitlementsJs,
} from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js';

// ── Test fixtures ──

const makeEntitlement = (overrides = {}) => ({
  id: `ent_${Math.random().toString(36).slice(2, 8)}`,
  holderTeam: 'LAL',
  seasonYear: 2027,
  round: 1,
  kind: 'pick_ownership',
  description: 'Test entitlement',
  underlyingPickId: 'pick_test',
  underlyingStatus: 'clean',
  ...overrides,
});

describe('computePostTradeEntitlements', () => {
  it('keeps extensionless and .js imports aligned', () => {
    expect(computePostTradeEntitlementsJs).toBe(computePostTradeEntitlements);
    expect(buildStepienOutgoingPicksFromEntitlementsJs).toBe(
      buildStepienOutgoingPicksFromEntitlements
    );
    expect(buildStepienBaselinePicksFromEntitlementsJs).toBe(
      buildStepienBaselinePicksFromEntitlements
    );
  });

  it('removes outgoing entitlements from team inventory', () => {
    const ent1 = makeEntitlement({ id: 'ent_001', holderTeam: 'LAL' });
    const ent2 = makeEntitlement({ id: 'ent_002', holderTeam: 'LAL' });
    const ent3 = makeEntitlement({ id: 'ent_003', holderTeam: 'LAL' });

    const result = computePostTradeEntitlements({
      currentEntitlements: [ent1, ent2, ent3],
      entitlementsOut: [
        { entitlementId: 'ent_002', fromTeamId: 'LAL', toTeamId: 'BOS' },
      ],
      allTeamsEntitlementsOut: [],
      teamId: 'LAL',
    });

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['ent_001', 'ent_003']);
  });

  it('adds incoming entitlements from other teams', () => {
    const lalEnt = makeEntitlement({ id: 'ent_lal', holderTeam: 'LAL' });
    const bosIncoming = makeEntitlement({
      id: 'ent_bos',
      holderTeam: 'BOS',
      fromTeamId: 'BOS',
      toTeamId: 'LAL',
    });

    const result = computePostTradeEntitlements({
      currentEntitlements: [lalEnt],
      entitlementsOut: [],
      allTeamsEntitlementsOut: [[bosIncoming]],
      teamId: 'LAL',
    });

    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('ent_bos');
    expect(result[1].holderTeam).toBe('LAL'); // Patched to new owner
  });

  it('handles simultaneous outgoing and incoming', () => {
    const lalEnt1 = makeEntitlement({ id: 'ent_lal_1', holderTeam: 'LAL' });
    const lalEnt2 = makeEntitlement({ id: 'ent_lal_2', holderTeam: 'LAL' });
    const bosEnt = makeEntitlement({
      id: 'ent_bos_1',
      holderTeam: 'BOS',
      fromTeamId: 'BOS',
      toTeamId: 'LAL',
    });

    const result = computePostTradeEntitlements({
      currentEntitlements: [lalEnt1, lalEnt2],
      entitlementsOut: [
        { entitlementId: 'ent_lal_1', fromTeamId: 'LAL', toTeamId: 'BOS' },
      ],
      allTeamsEntitlementsOut: [[bosEnt]],
      teamId: 'LAL',
    });

    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.id);
    expect(ids).toContain('ent_lal_2');
    expect(ids).toContain('ent_bos_1');
    expect(ids).not.toContain('ent_lal_1');
  });

  it('does not bring in entitlements from own team', () => {
    const lalEnt = makeEntitlement({ id: 'ent_lal', holderTeam: 'LAL' });

    const result = computePostTradeEntitlements({
      currentEntitlements: [lalEnt],
      entitlementsOut: [],
      allTeamsEntitlementsOut: [
        [{ id: 'ent_lal_out', fromTeamId: 'LAL', toTeamId: 'BOS' }],
      ],
      teamId: 'LAL',
    });

    // Should not receive own outgoing entitlement
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ent_lal');
  });

  it('returns empty array when no entitlements', () => {
    const result = computePostTradeEntitlements({
      currentEntitlements: [],
      entitlementsOut: [],
      allTeamsEntitlementsOut: [],
      teamId: 'LAL',
    });

    expect(result).toEqual([]);
  });

  it('supports entitlement.id matching for outgoing', () => {
    const ent = makeEntitlement({ id: 'ent_x' });

    const result = computePostTradeEntitlements({
      currentEntitlements: [ent],
      entitlementsOut: [{ id: 'ent_x', fromTeamId: 'LAL', toTeamId: 'BOS' }],
      allTeamsEntitlementsOut: [],
      teamId: 'LAL',
    });

    expect(result).toHaveLength(0);
  });
});

describe('buildStepienOutgoingPicksFromEntitlements (existing)', () => {
  it('only considers first-round entitlements', () => {
    const r1 = makeEntitlement({ round: 1, kind: 'pick_ownership' });
    const r2 = makeEntitlement({ round: 2, kind: 'pick_ownership' });

    const result = buildStepienOutgoingPicksFromEntitlements([r1, r2]);
    expect(result).toHaveLength(1);
    expect(result[0]._entitlementId).toBe(r1.id);
  });

  it('excludes pooled entitlements', () => {
    const pooled = makeEntitlement({ underlyingStatus: 'pooled' });

    const result = buildStepienOutgoingPicksFromEntitlements([pooled]);
    expect(result).toHaveLength(0);
  });

  it('handles swap_right kind', () => {
    const swap = makeEntitlement({ kind: 'swap_right' });

    const result = buildStepienOutgoingPicksFromEntitlements([swap]);
    expect(result).toHaveLength(1);
    expect(result[0].isSwap).toBe(true);
  });
});

describe('buildStepienBaselinePicksFromEntitlements (existing)', () => {
  it('builds baseline from team entitlements', () => {
    const ent1 = makeEntitlement({ seasonYear: 2027 });
    const ent2 = makeEntitlement({ seasonYear: 2029 });

    const result = buildStepienBaselinePicksFromEntitlements([ent1, ent2]);
    expect(result).toHaveLength(2);
    expect(result[0].year).toBe(2027);
    expect(result[1].year).toBe(2029);
    expect(result[0]._source).toBe('entitlement_baseline');
  });

  it('excludes second round from baseline', () => {
    const r2 = makeEntitlement({ round: 2 });

    const result = buildStepienBaselinePicksFromEntitlements([r2]);
    expect(result).toHaveLength(0);
  });
});
