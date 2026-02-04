/**
 * FILE: src/tests/architect/dare/phase17_2_swap_guardrail.test.ts
 * PURPOSE: Phase 17.2 guardrail tests for DARE 2-team swap resolution (best_of / worst_of)
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 17.2 execution verification
 *
 * LINKS:
 *  - Master Doc: docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER_DOC.md
 *
 * These tests verify the core 2-team swap resolution behaviors required for Phase 17.2.
 * They test the actual implementation WITHOUT mocks to serve as guardrails against regression.
 *
 * SCOPE (Phase 17.2):
 *  ✅ 2-team best_of swap
 *  ✅ 2-team worst_of swap
 *  ✅ Deterministic tie-break (controller wins)
 *  ✅ Missing positionsMap data handling
 *  ✅ Default swapType behavior
 *
 * OUT OF SCOPE (Phase 17.4):
 *  ❌ Pool swaps (3+ teams)
 *  ❌ Chained swaps
 *  ❌ Circular detection
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSwapForEntitlement,
  _testExports,
} from '@/features/architect/utils/entitlements/dare/swapResolutionAdapter';
import type { EffectiveEntitlement } from '@/features/architect/utils/entitlements/entitlementResolver';

// =============================================================================
// TEST CONSTANTS
// =============================================================================

const BASE_OPTS = {
  draftYear: 2026,
  nowIso: '2026-06-25T12:00:00Z',
  method: 'lottery' as const,
};

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a mock swap entitlement for testing.
 *
 * @param overrides - Fields to override
 * @returns A valid swap_right entitlement
 */
function createSwapEntitlement(
  overrides: Partial<EffectiveEntitlement> = {}
): EffectiveEntitlement {
  return {
    id: 'ent:TEST:2026:1:swap:guardrail',
    kind: 'swap_right',
    holderTeam: 'NOP',
    seasonYear: 2026,
    round: 1,
    swapControllerPickId: 'NOP_2026_1st',
    swapTargetDefinition: 'Option to swap with MIL',
    description: 'Phase 17.2 guardrail test swap',
    ...overrides,
  } as EffectiveEntitlement;
}

// =============================================================================
// PHASE 17.2 GUARDRAIL TESTS: 2-TEAM SWAP RESOLUTION
// =============================================================================

describe('Phase 17.2: 2-Team Swap Resolution Guardrails', () => {
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * TEST 1: Best-of swap picks winner correctly
   *
   * Controller: position 10
   * Target: position 5
   * EXPECTED: Target wins (position 5 is "best" = lower number)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  describe('best_of swap resolution', () => {
    it('picks winner correctly (controller pos=10, target pos=5 → target wins)', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:NOP:2026:1:swap:best_of_guardrail',
        holderTeam: 'NOP',
        swapControllerPickId: 'NOP_2026_1st',
        swapTargetDefinition: 'Option to swap with MIL',
        swapType: 'best_of',
      });
      const positionsMap = { NOP: 10, MIL: 5 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('MIL');
      expect(result.swapPosition).toBe(5);
      expect(result.swapLoser).toBe('NOP');
      expect(result.reason).toContain('best_of');
    });

    it('controller wins when controller has better (lower) position', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:BOS:2026:1:swap:best_of_controller_wins',
        holderTeam: 'BOS',
        swapControllerPickId: 'BOS_2026_1st',
        swapTargetDefinition: 'Option to swap with NYK',
        swapType: 'best_of',
      });
      const positionsMap = { BOS: 3, NYK: 12 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('BOS');
      expect(result.swapPosition).toBe(3);
    });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * TEST 2: Worst-of swap picks winner correctly
   *
   * Controller: position 10
   * Target: position 5
   * EXPECTED: Controller wins (position 10 is "worst" = higher number)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  describe('worst_of swap resolution', () => {
    it('picks winner correctly (controller pos=10, target pos=5 → controller wins)', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:OKC:2026:1:swap:worst_of_guardrail',
        holderTeam: 'OKC',
        swapControllerPickId: 'OKC_2026_1st',
        swapTargetDefinition: 'Option to swap with LAL',
        swapType: 'worst_of',
      });
      const positionsMap = { OKC: 10, LAL: 5 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('OKC');
      expect(result.swapPosition).toBe(10);
      expect(result.swapLoser).toBe('LAL');
      expect(result.reason).toContain('worst_of');
    });

    it('target wins when target has worse (higher) position', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:CHI:2026:1:swap:worst_of_target_wins',
        holderTeam: 'CHI',
        swapControllerPickId: 'CHI_2026_1st',
        swapTargetDefinition: 'Option to swap with CLE',
        swapType: 'worst_of',
      });
      const positionsMap = { CHI: 8, CLE: 25 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('CLE');
      expect(result.swapPosition).toBe(25);
    });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * TEST 3: Tie-break is deterministic (controller wins)
   *
   * Controller: position 10
   * Target: position 10
   * EXPECTED: Controller wins (deterministic tie-break rule)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  describe('tie-break rule', () => {
    it('controller wins when positions are equal (best_of)', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:NYK:2026:1:swap:tiebreak_best',
        holderTeam: 'NYK',
        swapControllerPickId: 'NYK_2026_1st',
        swapTargetDefinition: 'Option to swap with BKN',
        swapType: 'best_of',
      });
      const positionsMap = { NYK: 10, BKN: 10 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('NYK'); // Controller wins ties
      expect(result.swapPosition).toBe(10);
    });

    it('controller wins when positions are equal (worst_of)', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:LAC:2026:1:swap:tiebreak_worst',
        holderTeam: 'LAC',
        swapControllerPickId: 'LAC_2026_1st',
        swapTargetDefinition: 'Option to swap with GSW',
        swapType: 'worst_of',
      });
      const positionsMap = { LAC: 15, GSW: 15 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('LAC'); // Controller wins ties
      expect(result.swapPosition).toBe(15);
    });

    it('tie-break is deterministic at boundary positions', () => {
      // Test at position 1 (best possible)
      const entitlement1 = createSwapEntitlement({
        id: 'ent:ATL:2026:1:swap:tiebreak_pos1',
        swapControllerPickId: 'ATL_2026_1st',
        swapTargetDefinition: 'Option to swap with DET',
        swapType: 'best_of',
      });
      const result1 = resolveSwapForEntitlement(
        entitlement1,
        { ATL: 1, DET: 1 },
        BASE_OPTS
      );
      expect(result1.swapWinner).toBe('ATL');

      // Test at position 30 (last first round)
      const entitlement30 = createSwapEntitlement({
        id: 'ent:MIA:2026:1:swap:tiebreak_pos30',
        swapControllerPickId: 'MIA_2026_1st',
        swapTargetDefinition: 'Option to swap with PHX',
        swapType: 'best_of',
      });
      const result30 = resolveSwapForEntitlement(
        entitlement30,
        { MIA: 30, PHX: 30 },
        BASE_OPTS
      );
      expect(result30.swapWinner).toBe('MIA');
    });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * TEST 4: Missing positionsMap entry handled gracefully
   *
   * Target missing from positionsMap
   * EXPECTED: outcome = 'unchanged' AND includes reason string
   * ═══════════════════════════════════════════════════════════════════════════
   */
  describe('missing positionsMap data handling', () => {
    it('returns unchanged with reason when target team missing from positionsMap', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:CLE:2026:1:swap:missing_target',
        holderTeam: 'CLE',
        swapControllerPickId: 'CLE_2026_1st',
        swapTargetDefinition: 'Option to swap with TOR',
      });
      const positionsMap = { CLE: 10 }; // Missing TOR

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Missing position data');
      expect(result.reason).toContain('TOR');
    });

    it('returns unchanged with reason when controller team missing from positionsMap', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:WAS:2026:1:swap:missing_controller',
        holderTeam: 'WAS',
        swapControllerPickId: 'WAS_2026_1st',
        swapTargetDefinition: 'Option to swap with ORL',
      });
      const positionsMap = { ORL: 8 }; // Missing WAS

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Missing position data');
      expect(result.reason).toContain('WAS');
    });

    it('returns unchanged when both teams missing from positionsMap', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:SAS:2026:1:swap:missing_both',
        holderTeam: 'SAS',
        swapControllerPickId: 'SAS_2026_1st',
        swapTargetDefinition: 'Option to swap with HOU',
      });
      const positionsMap = {}; // Empty

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Missing position data');
    });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * TEST 5: Default swapType behavior (best_of when not specified)
   *
   * swapType missing / not parseable
   * EXPECTED: Behaves as best_of
   * ═══════════════════════════════════════════════════════════════════════════
   */
  describe('default swapType behavior', () => {
    it('defaults to best_of when swapType not specified', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:PHI:2026:1:swap:default_type',
        holderTeam: 'PHI',
        swapControllerPickId: 'PHI_2026_1st',
        swapTargetDefinition: 'Option to swap with MEM',
        // No swapType specified
      });
      const positionsMap = { PHI: 15, MEM: 8 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      // In best_of, lower position wins, so MEM (8) should win
      expect(result.swapWinner).toBe('MEM');
      expect(result.swapPosition).toBe(8);
    });

    it('defaults to best_of even with empty description', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:DAL:2026:1:swap:empty_desc',
        holderTeam: 'DAL',
        swapControllerPickId: 'DAL_2026_1st',
        swapTargetTeam: 'DEN', // Direct target instead of description
        swapTargetDefinition: '',
      });
      const positionsMap = { DAL: 20, DEN: 12 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('DEN'); // Lower position wins (best_of default)
    });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ADDITIONAL EDGE CASE TESTS
   * ═══════════════════════════════════════════════════════════════════════════
   */
  describe('edge cases and guards', () => {
    it('returns unchanged for non-swap entitlement kind', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:LAL:2026:1:own:not_swap',
        kind: 'pick_ownership', // Not swap_right
        holderTeam: 'LAL',
      });
      const positionsMap = { LAL: 5 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Not a swap_right');
    });

    it('returns unchanged for wrong draft year', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:MIA:2027:1:swap:wrong_year',
        seasonYear: 2027, // Different from draftYear in opts
        swapControllerPickId: 'MIA_2027_1st',
        swapTargetDefinition: 'Swap with POR',
      });
      const positionsMap = { MIA: 10, POR: 15 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('does not match draft year');
    });

    it('returns unchanged for already resolved entitlement', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:UTA:2026:1:swap:already_done',
        swapControllerPickId: 'UTA_2026_1st',
        swapTargetDefinition: 'Swap with SAC',
        resolved: true,
      });
      const positionsMap = { UTA: 10, SAC: 5 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('already resolved');
    });

    it('parses worst_of from description text', () => {
      const entitlement = createSwapEntitlement({
        id: 'ent:MIN:2026:1:swap:parse_worst',
        swapControllerPickId: 'MIN_2026_1st',
        swapTargetDefinition: 'Option to swap with IND for worst pick',
        // No explicit swapType, but description contains "worst"
      });
      const positionsMap = { MIN: 5, IND: 18 };

      const result = resolveSwapForEntitlement(
        entitlement,
        positionsMap,
        BASE_OPTS
      );

      expect(result.outcome).toBe('swap_resolved');
      // In worst_of, higher position wins, so IND (18) should win
      expect(result.swapWinner).toBe('IND');
      expect(result.swapPosition).toBe(18);
    });
  });
});

// =============================================================================
// INTERNAL HELPER TESTS
// =============================================================================

describe('Phase 17.2: Internal Swap Helper Functions', () => {
  const { resolveSwapWinner, parseTeamFromPickId, parseSwapType } =
    _testExports;

  describe('resolveSwapWinner', () => {
    it('best_of returns team with lower position', () => {
      expect(resolveSwapWinner('A', 'B', 'best_of', 10, 5)).toBe('B');
      expect(resolveSwapWinner('A', 'B', 'best_of', 5, 10)).toBe('A');
    });

    it('worst_of returns team with higher position', () => {
      expect(resolveSwapWinner('A', 'B', 'worst_of', 10, 5)).toBe('A');
      expect(resolveSwapWinner('A', 'B', 'worst_of', 5, 10)).toBe('B');
    });

    it('ties always return team A (controller)', () => {
      expect(resolveSwapWinner('A', 'B', 'best_of', 10, 10)).toBe('A');
      expect(resolveSwapWinner('A', 'B', 'worst_of', 10, 10)).toBe('A');
    });
  });

  describe('parseTeamFromPickId', () => {
    it('extracts team code from standard pick ID format', () => {
      expect(parseTeamFromPickId('NOP_2026_1st')).toBe('NOP');
      expect(parseTeamFromPickId('LAL_2027_2nd')).toBe('LAL');
      expect(parseTeamFromPickId('BOS_2025_1st')).toBe('BOS');
    });

    it('returns null for invalid formats', () => {
      expect(parseTeamFromPickId('')).toBeNull();
      expect(parseTeamFromPickId(null as unknown as string)).toBeNull();
      expect(parseTeamFromPickId(undefined as unknown as string)).toBeNull();
      expect(parseTeamFromPickId('invalid')).toBeNull();
    });
  });

  describe('parseSwapType', () => {
    it('returns swapType field if present', () => {
      expect(
        parseSwapType({ swapType: 'worst_of' } as EffectiveEntitlement)
      ).toBe('worst_of');
      expect(
        parseSwapType({ swapType: 'best_of' } as EffectiveEntitlement)
      ).toBe('best_of');
    });

    it('parses from swapTargetDefinition', () => {
      expect(
        parseSwapType({
          swapTargetDefinition: 'worst of picks',
        } as EffectiveEntitlement)
      ).toBe('worst_of');
      expect(
        parseSwapType({
          swapTargetDefinition: 'less favorable pick',
        } as EffectiveEntitlement)
      ).toBe('worst_of');
    });

    it('defaults to best_of', () => {
      expect(parseSwapType({} as EffectiveEntitlement)).toBe('best_of');
      expect(
        parseSwapType({
          swapTargetDefinition: 'standard swap',
        } as EffectiveEntitlement)
      ).toBe('best_of');
    });
  });
});
