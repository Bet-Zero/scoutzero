/**
 * FILE: phase16_seasonmanager_entitlements_ssot_view_guardrail.test.js
 * PURPOSE: Guardrail tests for Phase 16.1 - SeasonManager Entitlement SSOT View
 * OWNERSHIP: Feature: architect/seasonManager
 *
 * These tests verify:
 * 1. Projection mapping correctness (entitlement -> draftPick-like)
 * 2. Projection stability (graceful handling of missing data)
 * 3. Dual-read pattern (prefers _derivedDraftPicks over draftPicks)
 *
 * NOTE: These tests are deterministic and do NOT require emulator.
 */

import { describe, it, expect } from 'vitest';
import {
  projectEntitlementsToSeasonManagerView,
  __test__selectDraftPicksSource,
} from '@/features/architect/utils/entitlements/seasonManagerProjection';

type ProjectionArgs = Parameters<typeof projectEntitlementsToSeasonManagerView>[0];
type PickRulesById = NonNullable<ProjectionArgs['pickRulesById']>;
type DraftPicksSourceInput = Parameters<typeof __test__selectDraftPicksSource>[0];

const asPickRulesById = (value: Record<string, unknown>) =>
  value as unknown as PickRulesById;

const asDraftPicksSourceInput = (value: Record<string, unknown>) =>
  value as unknown as DraftPicksSourceInput;

describe('Phase 16.1: SeasonManager Entitlements SSOT View', () => {
  // ==========================================================================
  // SECTION 1: Projection Mapping Tests
  // ==========================================================================
  describe('projectEntitlementsToSeasonManagerView - mapping correctness', () => {
    it('maps pick_ownership entitlement to correct draftPick-like shape', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'LAL_2027_1st',
          holderTeam: 'BOS',
          underlyingStatus: 'clean',
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: 'BOS',
      });

      expect(result).toHaveLength(1);
      const pick = result[0];

      // Core fields
      expect(pick.year).toBe(2027);
      expect(pick.round).toBe(1);
      expect(pick.id).toBe('LAL_pick_ownership_2027_R1');

      // Ownership
      expect(pick.owner).toBe('BOS');
      expect(pick.currentOwner).toBe('BOS');
      expect(pick.originalTeam).toBe('LAL');
      expect(pick.via).toBe('LAL'); // Different from holder

      // Not a swap
      expect(pick.isSwap).toBe(false);
      expect(pick.swapWithTeamId).toBeNull();

      // Default status flags
      expect(pick.status).toBe('owned');
      expect(pick.resolved).toBe(false);
      expect(pick.stepienBlocked).toBe(false);

      // Source metadata
      expect(pick._sourceEntitlementId).toBe('LAL_pick_ownership_2027_R1');
      expect(pick._sourceKind).toBe('pick_ownership');
    });

    it('maps swap_right entitlement with isSwap=true and parses swapWithTeamId', () => {
      const entitlements = [
        {
          id: 'UTA_swap_right_2028_R1',
          kind: 'swap_right',
          seasonYear: 2028,
          round: 1,
          underlyingPickId: 'CLE_2028_1st',
          swapControllerPickId: 'UTA_2028_1st',
          holderTeam: 'CLE',
          underlyingStatus: 'encumbered',
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: 'CLE',
      });

      expect(result).toHaveLength(1);
      const pick = result[0];

      // Swap fields
      expect(pick.isSwap).toBe(true);
      expect(pick.swapType).toBe('best_of'); // Conservative default
      expect(pick.swapWithTeamId).toBe('UTA'); // Parsed from swapControllerPickId

      // Original team parsed from underlyingPickId
      expect(pick.originalTeam).toBe('CLE');
    });

    it('maps conveyance_right entitlement correctly', () => {
      const entitlements = [
        {
          id: 'PHX_conveyance_right_2026_R1',
          kind: 'conveyance_right',
          seasonYear: 2026,
          round: 1,
          underlyingPickId: 'PHX_2026_1st',
          holderTeam: 'WAS',
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: 'WAS',
      });

      expect(result).toHaveLength(1);
      const pick = result[0];

      expect(pick.year).toBe(2026);
      expect(pick.round).toBe(1);
      expect(pick.isSwap).toBe(false);
      expect(pick.originalTeam).toBe('PHX');
      expect(pick._sourceKind).toBe('conveyance_right');
    });

    it('includes protection and conveyance from pickRulesById when available', () => {
      const entitlements = [
        {
          id: 'MIA_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'MIA_2027_1st',
          holderTeam: 'OKC',
        },
      ];

      const pickRulesById = asPickRulesById({
        MIA_2027_1st: {
          pickId: 'MIA_2027_1st',
          protections: [
            { type: 'lottery', description: 'Lottery protected' },
          ],
          conditions: [
            { kind: 'conveys', description: 'Conveys if outside lottery' },
          ],
        },
      });

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById,
        teamCode: 'OKC',
      });

      expect(result).toHaveLength(1);
      const pick = result[0];

      // Protection from pick rules
      expect(pick.protection).toBe('Lottery protected');

      // Conveyance object should exist with conditions
      expect(pick.conveyance).toBeDefined();
      expect(pick.conveyance.conditions).toBeTruthy();
    });
  });

  // ==========================================================================
  // SECTION 2: Projection Stability Tests
  // ==========================================================================
  describe('projectEntitlementsToSeasonManagerView - stability', () => {
    it('returns empty array for empty entitlements', () => {
      const result = projectEntitlementsToSeasonManagerView({
        entitlements: [],
        pickRulesById: {},
        teamCode: 'BOS',
      });

      expect(result).toEqual([]);
    });

    it('returns empty array for null/undefined entitlements', () => {
      expect(
        projectEntitlementsToSeasonManagerView({
          entitlements: null,
          pickRulesById: {},
          teamCode: 'BOS',
        })
      ).toEqual([]);

      expect(
        projectEntitlementsToSeasonManagerView({
          entitlements: undefined,
          pickRulesById: {},
          teamCode: 'BOS',
        })
      ).toEqual([]);
    });

    it('returns empty array when teamCode is missing', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: '', // Empty teamCode
      });

      expect(result).toEqual([]);
    });

    it('handles missing underlyingPickId gracefully (originalTeam becomes null)', () => {
      const entitlements = [
        {
          id: 'UNKNOWN_pick_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          // No underlyingPickId
          holderTeam: 'BOS',
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: 'BOS',
      });

      expect(result).toHaveLength(1);
      expect(result[0].originalTeam).toBeNull();
      expect(result[0].via).toBeUndefined(); // No via when originalTeam is null
    });

    it('handles missing pickRulesById gracefully (no crash)', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'LAL_2027_1st',
        },
      ];

      // pickRulesById is null/undefined
      const result1 = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: null,
        teamCode: 'BOS',
      });

      const result2 = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: undefined,
        teamCode: 'BOS',
      });

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result1[0].protection).toBeUndefined();
      expect(result1[0].conveyance).toBeUndefined();
    });

    it('handles pick rule without matching entry gracefully', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'LAL_2027_1st',
        },
      ];

      const pickRulesById = asPickRulesById({
        // Different pick ID - no match
        BOS_2027_1st: { pickId: 'BOS_2027_1st', protections: [] },
      });

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById,
        teamCode: 'BOS',
      });

      expect(result).toHaveLength(1);
      expect(result[0].protection).toBeUndefined(); // No matching rule
    });

    it('handles string round values correctly', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R2',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: '2', // String round
          underlyingPickId: 'LAL_2027_2nd',
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: 'BOS',
      });

      expect(result).toHaveLength(1);
      expect(result[0].round).toBe(2); // Parsed to number
    });
  });

  // ==========================================================================
  // SECTION 3: Dual-Read Pattern Tests
  // ==========================================================================
  describe('__test__selectDraftPicksSource - dual-read pattern', () => {
    it('prefers _derivedDraftPicks when present', () => {
      const teamData = asDraftPicksSourceInput({
        _derivedDraftPicks: [{ id: 'derived-1', year: 2027 }],
        draftPicks: [{ id: 'legacy-1', year: 2027 }],
      });

      const result = __test__selectDraftPicksSource(teamData);

      expect(result).toEqual([{ id: 'derived-1', year: 2027 }]);
    });

    it('falls back to draftPicks when _derivedDraftPicks is missing', () => {
      const teamData = asDraftPicksSourceInput({
        draftPicks: [{ id: 'legacy-1', year: 2027 }],
      });

      const result = __test__selectDraftPicksSource(teamData);

      expect(result).toEqual([{ id: 'legacy-1', year: 2027 }]);
    });

    it('falls back to draftPicks when _derivedDraftPicks is empty', () => {
      const teamData = asDraftPicksSourceInput({
        _derivedDraftPicks: [],
        draftPicks: [{ id: 'legacy-1', year: 2027 }],
      });

      // Empty array is falsy in || context, so falls back
      const result = __test__selectDraftPicksSource(teamData);

      // Note: Empty array is truthy in JS, so _derivedDraftPicks wins
      expect(result).toEqual([]);
    });

    it('returns empty array when both are missing', () => {
      const teamData = {};

      const result = __test__selectDraftPicksSource(teamData);

      expect(result).toEqual([]);
    });

    it('returns empty array for null/undefined teamData', () => {
      expect(__test__selectDraftPicksSource(null)).toEqual([]);
      expect(__test__selectDraftPicksSource(undefined)).toEqual([]);
    });
  });

  // ==========================================================================
  // SECTION 4: Multiple Entitlements Tests
  // ==========================================================================
  describe('projectEntitlementsToSeasonManagerView - multiple entitlements', () => {
    it('projects multiple entitlements of different kinds correctly', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'LAL_2027_1st',
        },
        {
          id: 'BOS_swap_right_2028_R1',
          kind: 'swap_right',
          seasonYear: 2028,
          round: 1,
          underlyingPickId: 'BOS_2028_1st',
          swapControllerPickId: 'PHX_2028_1st',
        },
        {
          id: 'MIA_pick_ownership_2027_R2',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 2,
          underlyingPickId: 'MIA_2027_2nd',
        },
      ];

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById: {},
        teamCode: 'OKC',
      });

      expect(result).toHaveLength(3);

      // First: pick_ownership, first round
      expect(result[0].year).toBe(2027);
      expect(result[0].round).toBe(1);
      expect(result[0].isSwap).toBe(false);

      // Second: swap_right
      expect(result[1].year).toBe(2028);
      expect(result[1].isSwap).toBe(true);
      expect(result[1].swapWithTeamId).toBe('PHX');

      // Third: pick_ownership, second round
      expect(result[2].year).toBe(2027);
      expect(result[2].round).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION 5: Pick Rules Integration Tests
  // ==========================================================================
  describe('projectEntitlementsToSeasonManagerView - pick rules integration', () => {
    it('extracts top_n protection from pick rules', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'LAL_2027_1st',
        },
      ];

      const pickRulesById = asPickRulesById({
        LAL_2027_1st: {
          pickId: 'LAL_2027_1st',
          protections: [{ type: 'top_n', protectedRange: '1-10' }],
        },
      });

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById,
        teamCode: 'BOS',
      });

      expect(result[0].protection).toBe('Top 10 protected');
    });

    it('extracts range protection from pick rules', () => {
      const entitlements = [
        {
          id: 'LAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'LAL_2027_1st',
        },
      ];

      const pickRulesById = asPickRulesById({
        LAL_2027_1st: {
          pickId: 'LAL_2027_1st',
          protections: [{ type: 'range', protectedRange: '1-5' }],
        },
      });

      const result = projectEntitlementsToSeasonManagerView({
        entitlements,
        pickRulesById,
        teamCode: 'BOS',
      });

      expect(result[0].protection).toBe('Protected 1-5');
    });
  });
});
