/**
 * FILE: src/tests/architect/dare/phase17_1_protections_guardrail.test.ts
 * PURPOSE: Phase 17.1 guardrail tests for DARE protections + simple conveyance
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 17.1 execution verification
 *
 * LINKS:
 *  - Master Doc: docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md
 *
 * These tests verify the core protection + conveyance behaviors required for Phase 17.1.
 * They test the actual implementation WITHOUT mocks to serve as guardrails against regression.
 */

import { describe, it, expect } from 'vitest';
import {
  parseProtectionThreshold,
  protectionTriggers,
  buildProtectionLadder,
  getCurrentProtectionTier,
  isFinalProtectionYear,
} from '@/features/architect/utils/entitlements/dare/protectionLadderFactory';
import { resolveConveyanceForEntitlement } from '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter';
import type { EffectiveEntitlement } from '@/features/architect/utils/entitlements/entitlementResolver';
import type {
  PickRuleDoc,
  PickRuleProtection,
} from '@/features/architect/utils/entitlements/pickRulesResolver';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a mock entitlement for testing.
 */
function createMockEntitlement(
  overrides: Partial<EffectiveEntitlement> = {}
): EffectiveEntitlement {
  return {
    id: 'ent:TEST:2026:1:own:abc123',
    holderTeam: 'BOS',
    seasonYear: 2026,
    round: 1,
    kind: 'pick_ownership',
    underlyingPickId: 'LAL_2026_1st',
    description: 'Test entitlement',
    ...overrides,
  } as EffectiveEntitlement;
}

/**
 * Create a mock pick rule for testing.
 */
function createMockPickRule(
  protections: PickRuleProtection[],
  conditions: Array<{
    kind: string;
    relatedPickIds?: string[];
    appliesToYears?: number[];
  }> = []
): PickRuleDoc {
  return {
    pickId: 'LAL_2026_1st',
    seasonYear: 2026,
    round: 1,
    protections,
    conditions,
    updatedAtISO: '2026-01-01T00:00:00Z',
    source: 'test',
  } as PickRuleDoc;
}

// =============================================================================
// PHASE 17.1 GUARDRAIL TESTS
// =============================================================================

describe('Phase 17.1: Protections + Simple Conveyance Guardrails', () => {
  describe('Protection Threshold Parsing', () => {
    /**
     * Test 1: Top-N boundary parsing
     * Verifies Top N protections are parsed correctly.
     */
    it('parseProtectionThreshold correctly parses Top N values', () => {
      expect(parseProtectionThreshold('Top 3')).toBe(3);
      expect(parseProtectionThreshold('Top 5')).toBe(5);
      expect(parseProtectionThreshold('Top 10')).toBe(10);
      expect(parseProtectionThreshold('top3')).toBe(3);
      expect(parseProtectionThreshold('TOP 14')).toBe(14);
    });

    /**
     * Test 2: Lottery protection MUST be threshold 14
     * NBA lottery is positions 1-14, this is a critical invariant.
     */
    it('parseProtectionThreshold parses Lottery as threshold 14', () => {
      expect(parseProtectionThreshold('Lottery')).toBe(14);
      expect(parseProtectionThreshold('lottery')).toBe(14);
      expect(parseProtectionThreshold('LOTTERY')).toBe(14);
      expect(parseProtectionThreshold('1-14')).toBe(14);
    });

    /**
     * Test 3: Unprotected returns null (no threshold)
     */
    it('parseProtectionThreshold returns null for Unprotected', () => {
      expect(parseProtectionThreshold('Unprotected')).toBeNull();
      expect(parseProtectionThreshold('unprotected')).toBeNull();
      expect(parseProtectionThreshold(null)).toBeNull();
      expect(parseProtectionThreshold(undefined)).toBeNull();
    });
  });

  describe('Protection Trigger Logic', () => {
    /**
     * Test 4: Top-N boundary - position AT threshold triggers protection
     */
    it('protectionTriggers returns true when position equals threshold (Top 3, pos=3)', () => {
      expect(protectionTriggers('Top 3', 3)).toBe(true);
    });

    /**
     * Test 5: Top-N conveys - position OUTSIDE threshold does NOT trigger
     */
    it('protectionTriggers returns false when position exceeds threshold (Top 3, pos=7)', () => {
      expect(protectionTriggers('Top 3', 7)).toBe(false);
    });

    /**
     * Test 6: Lottery boundary - position 14 triggers (is lottery)
     */
    it('protectionTriggers returns true for lottery position 14', () => {
      expect(protectionTriggers('Lottery', 14)).toBe(true);
    });

    /**
     * Test 7: Lottery conveys - position 15+ does NOT trigger
     */
    it('protectionTriggers returns false for non-lottery position 15', () => {
      expect(protectionTriggers('Lottery', 15)).toBe(false);
      expect(protectionTriggers('Lottery', 18)).toBe(false);
      expect(protectionTriggers('Lottery', 30)).toBe(false);
    });

    /**
     * Test 8: Unprotected never triggers
     */
    it('protectionTriggers always returns false for Unprotected', () => {
      expect(protectionTriggers('Unprotected', 1)).toBe(false);
      expect(protectionTriggers('Unprotected', 14)).toBe(false);
      expect(protectionTriggers('Unprotected', 30)).toBe(false);
    });
  });

  describe('Protection Ladder Construction', () => {
    /**
     * Test 9: Multi-year ladder builds correctly
     * 2026: Top 10 → 2027: Top 5 → 2028: Unprotected
     */
    it('buildProtectionLadder creates multi-year ladder with correct tiers', () => {
      const pickRule = createMockPickRule([
        { type: 'top_n', protectedRange: '1-10', appliesToYears: [2026] },
        { type: 'top_n', protectedRange: '1-5', appliesToYears: [2027] },
        { type: 'lottery', appliesToYears: [2028] },
      ]);
      const entitlement = createMockEntitlement({ seasonYear: 2026 });

      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder).not.toBeNull();
      expect(ladder).toHaveLength(3);

      // Year 2026: Top 10, rolls to 2027
      expect(ladder![0]).toMatchObject({
        year: 2026,
        condition: 'Top 10',
        ifTriggered: 'roll',
        rollToYear: 2027,
      });

      // Year 2027: Top 5, rolls to 2028
      expect(ladder![1]).toMatchObject({
        year: 2027,
        condition: 'Top 5',
        ifTriggered: 'roll',
        rollToYear: 2028,
      });

      // Year 2028: Lottery, final tier cancels
      expect(ladder![2]).toMatchObject({
        year: 2028,
        condition: 'Lottery',
        ifTriggered: 'cancel',
      });
    });

    /**
     * Test 10: Final year detection
     */
    it('isFinalProtectionYear correctly identifies final ladder tier', () => {
      const pickRule = createMockPickRule([
        { type: 'top_n', protectedRange: '1-3', appliesToYears: [2026] },
        { type: 'lottery', appliesToYears: [2027] },
      ]);
      const entitlement = createMockEntitlement();
      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(isFinalProtectionYear(ladder, 2026)).toBe(false);
      expect(isFinalProtectionYear(ladder, 2027)).toBe(true);
      expect(isFinalProtectionYear(ladder, 2028)).toBe(true); // Beyond final
    });

    /**
     * Test 11: Conversion condition detection
     */
    it('buildProtectionLadder detects conversion conditions', () => {
      const pickRule = createMockPickRule(
        [{ type: 'lottery', appliesToYears: [2026] }],
        [
          {
            kind: 'conveys',
            relatedPickIds: ['LAL_2026_2nd'],
            appliesToYears: [2026],
          },
        ]
      );
      const entitlement = createMockEntitlement();
      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder![0].ifTriggered).toBe('convert');
      expect(ladder![0].convertToRound).toBe(2);
    });
  });

  describe('Conveyance Resolution', () => {
    const baseOpts = {
      draftYear: 2026,
      nowIso: '2026-06-15T00:00:00Z',
      method: 'lottery' as const,
    };

    /**
     * Test 12: Simple conveyance when outside protection
     */
    it('resolveConveyanceForEntitlement returns conveyed when position outside protection', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2026:1:own:test1',
        holderTeam: 'BOS',
        seasonYear: 2026,
        underlyingPickId: 'LAL_2026_1st',
        kind: 'pick_ownership',
      });

      const pickRule = createMockPickRule([
        { type: 'top_n', protectedRange: '1-3', appliesToYears: [2026] },
      ]);
      const ladder = buildProtectionLadder(pickRule, entitlement);

      // LAL picks at position 7 (outside Top 3)
      const positionsMap = { LAL: 7, BOS: 12 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        baseOpts
      );

      expect(result.outcome).toBe('conveyed');
      expect(result.position).toBe(7);
    });

    /**
     * Test 13: Roll forward when protection triggers
     */
    it('resolveConveyanceForEntitlement returns rolled when protection triggers', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2026:1:own:test2',
        holderTeam: 'BOS',
        seasonYear: 2026,
        underlyingPickId: 'LAL_2026_1st',
        kind: 'pick_ownership',
      });

      const pickRule = createMockPickRule([
        { type: 'top_n', protectedRange: '1-10', appliesToYears: [2026] },
        { type: 'top_n', protectedRange: '1-5', appliesToYears: [2027] },
      ]);
      const ladder = buildProtectionLadder(pickRule, entitlement);

      // LAL picks at position 8 (inside Top 10)
      const positionsMap = { LAL: 8, BOS: 15 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        baseOpts
      );

      expect(result.outcome).toBe('rolled');
      expect(result.position).toBe(8);
      expect(result.newYear).toBe(2027);
      expect(result.newProtection).toBe('Top 5');
      expect(result.newEntitlementId).toBeDefined();
    });

    /**
     * Test 14: Lottery boundary at position 14 triggers roll
     */
    it('resolveConveyanceForEntitlement rolls at lottery boundary position 14', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2026:1:own:test3',
        holderTeam: 'BOS',
        seasonYear: 2026,
        underlyingPickId: 'WAS_2026_1st',
        kind: 'pick_ownership',
      });

      const pickRule = createMockPickRule([
        { type: 'lottery', appliesToYears: [2026] },
        { type: 'top_n', protectedRange: '1-5', appliesToYears: [2027] },
      ]);
      const ladder = buildProtectionLadder(pickRule, entitlement);

      // WAS picks at position 14 (lottery protected)
      const positionsMap = { WAS: 14, BOS: 20 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        baseOpts
      );

      expect(result.outcome).toBe('rolled');
      expect(result.position).toBe(14);
    });

    /**
     * Test 15: Position 15 conveys (outside lottery)
     */
    it('resolveConveyanceForEntitlement conveys at position 15 (outside lottery)', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2026:1:own:test4',
        holderTeam: 'BOS',
        seasonYear: 2026,
        underlyingPickId: 'WAS_2026_1st',
        kind: 'pick_ownership',
      });

      const pickRule = createMockPickRule([
        { type: 'lottery', appliesToYears: [2026] },
      ]);
      const ladder = buildProtectionLadder(pickRule, entitlement);

      // WAS picks at position 15 (NOT lottery protected)
      const positionsMap = { WAS: 15, BOS: 20 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        baseOpts
      );

      expect(result.outcome).toBe('conveyed');
      expect(result.position).toBe(15);
    });

    /**
     * Test 16: Final tier cancels (expired)
     */
    it('resolveConveyanceForEntitlement returns expired at final tier when protection triggers', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2027:1:own:test5',
        holderTeam: 'BOS',
        seasonYear: 2027,
        underlyingPickId: 'ORL_2027_1st',
        kind: 'pick_ownership',
      });

      // Single-year protection (final tier)
      const pickRule = createMockPickRule([
        { type: 'top_n', protectedRange: '1-3', appliesToYears: [2027] },
      ]);
      const ladder = buildProtectionLadder(pickRule, entitlement);

      // ORL picks at position 2 (inside Top 3, but it's final tier)
      const positionsMap = { ORL: 2, BOS: 18 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        { ...baseOpts, draftYear: 2027 }
      );

      // At final tier, protection still triggers cancel/expired
      expect(result.outcome).toBe('expired');
      expect(result.position).toBe(2);
    });

    /**
     * Test 17: Skip already resolved entitlements
     */
    it('resolveConveyanceForEntitlement returns unchanged for already resolved', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2026:1:own:test6',
        resolved: true,
      });

      const positionsMap = { LAL: 5, BOS: 12 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        null,
        baseOpts
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('already resolved');
    });

    /**
     * Test 18: Skip wrong year entitlements
     */
    it('resolveConveyanceForEntitlement returns unchanged for wrong year', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:BOS:2027:1:own:test7',
        seasonYear: 2027, // Different from draftYear
      });

      const positionsMap = { LAL: 5, BOS: 12 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        null,
        baseOpts // draftYear: 2026
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('does not match draft year');
    });

    /**
     * Test 19: Conversion triggers correctly
     */
    it('resolveConveyanceForEntitlement returns converted when conversion condition active', () => {
      const entitlement = createMockEntitlement({
        id: 'ent:PHX:2026:1:own:test8',
        holderTeam: 'PHX',
        seasonYear: 2026,
        underlyingPickId: 'DET_2026_1st',
        kind: 'pick_ownership',
      });

      const pickRule = createMockPickRule(
        [{ type: 'lottery', appliesToYears: [2026] }],
        [
          {
            kind: 'conveys',
            relatedPickIds: ['DET_2026_2nd'],
            appliesToYears: [2026],
          },
        ]
      );
      const ladder = buildProtectionLadder(pickRule, entitlement);

      // DET picks at position 5 (lottery = triggers conversion)
      const positionsMap = { DET: 5, PHX: 18 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        baseOpts
      );

      expect(result.outcome).toBe('converted');
      expect(result.convertedToRound).toBe(2);
      expect(result.newEntitlementId).toBeDefined();
    });
  });

  describe('Determinism Verification', () => {
    /**
     * Test 20: Ladder is sorted by year ascending
     */
    it('buildProtectionLadder returns tiers sorted by year', () => {
      // Provide protections in non-sorted order
      const pickRule = createMockPickRule([
        { type: 'lottery', appliesToYears: [2028] },
        { type: 'top_n', protectedRange: '1-3', appliesToYears: [2026] },
        { type: 'top_n', protectedRange: '1-5', appliesToYears: [2027] },
      ]);
      const entitlement = createMockEntitlement();
      const ladder = buildProtectionLadder(pickRule, entitlement);

      expect(ladder![0].year).toBe(2026);
      expect(ladder![1].year).toBe(2027);
      expect(ladder![2].year).toBe(2028);
    });
  });
});
