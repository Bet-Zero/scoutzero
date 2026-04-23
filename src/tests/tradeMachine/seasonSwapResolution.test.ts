/**
 * Trade Machine Draft Picks - Phase 3 Season Swap Resolution Tests
 *
 * Tests for the season-advance integration of swap resolution.
 * Verifies that resolution is a NO-OP unless lottery results are provided.
 *
 * Phase 3 EXECUTION - January 2026
 *
 * @file src/tests/tradeMachine/seasonSwapResolution.test.js
 */

import { describe, it, expect } from 'vitest';
import { resolveDraftPickSwapsForYear } from '@/features/architect/utils/seasonManager';

type SwapResolutionResult = ReturnType<typeof resolveDraftPickSwapsForYear>;

const requireValue = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

const getDraftPick = (result: SwapResolutionResult, index: number) =>
  requireValue(result.draftPicks?.[index], `result.draftPicks[${index}]`);

/**
 * Season Advance Swap Resolution Tests
 *
 * Critical requirement: Default behavior must remain unchanged when
 * no lottery results are provided.
 */
describe('resolveDraftPickSwapsForYear()', () => {
  describe('No-op without lottery results', () => {
    it('returns team unchanged when positionsMap is null', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
            resolved: false,
          },
        ],
      };

      const result = resolveDraftPickSwapsForYear(team, 2026, null);
      const draftPick = getDraftPick(result, 0);

      // Should return team unchanged
      expect(draftPick.resolved).toBe(false);
      expect(draftPick.resolvedOwner).toBeUndefined();
    });

    it('returns team unchanged when positionsMap is undefined', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            isSwap: true,
          },
        ],
      };

      const result = resolveDraftPickSwapsForYear(team, 2026, undefined);

      // Should return team unchanged
      expect(result).toEqual(team);
    });

    it('returns team unchanged when positionsMap is empty object', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
          },
        ],
      };

      const result = resolveDraftPickSwapsForYear(team, 2026, {});
      const draftPick = getDraftPick(result, 0);

      // Should return team unchanged (no positions to resolve with)
      expect(draftPick.resolved).toBeUndefined();
    });
  });

  describe('Resolves only matching year', () => {
    it('resolves swaps for specified draft year', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
          },
        ],
      };
      const positionsMap = { PHI: 12, OKC: 5 };

      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      expect(draftPick.resolved).toBe(true);
      expect(draftPick.resolvedOwner).toBe('OKC');
    });

    it('leaves future-year swaps unresolved', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2027_1',
            year: 2027,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
          },
        ],
      };
      const positionsMap = { PHI: 12, OKC: 5 };

      // Resolving for 2026 should not affect 2027 picks
      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      expect(draftPick.resolved).toBeUndefined();
    });

    it('resolves multiple swaps in the same year', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
          },
          {
            id: 'LAL_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'LAL',
            isSwap: true,
            swapType: 'worst_of',
            swapWithTeamId: 'MIA',
          },
        ],
      };
      const positionsMap = { PHI: 12, OKC: 5, LAL: 3, MIA: 20 };

      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const firstDraftPick = getDraftPick(result, 0);
      const secondDraftPick = getDraftPick(result, 1);

      // First swap: best_of PHI vs OKC -> OKC wins
      expect(firstDraftPick.resolved).toBe(true);
      expect(firstDraftPick.resolvedOwner).toBe('OKC');

      // Second swap: worst_of LAL vs MIA -> MIA wins (20 > 3)
      expect(secondDraftPick.resolved).toBe(true);
      expect(secondDraftPick.resolvedOwner).toBe('MIA');
    });
  });

  describe('Handles incomplete data gracefully', () => {
    it('leaves swap unresolved when partner position is missing (no throw)', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC', // OKC not in positions
          },
        ],
      };
      const positionsMap = { PHI: 12 }; // Missing OKC

      // Should NOT throw during season advance
      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      // Pick should remain unresolved
      expect(draftPick.resolved).toBeUndefined();
    });

    it('leaves swap unresolved when swapWithTeamId is missing', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: null, // Missing partner
          },
        ],
      };
      const positionsMap = { PHI: 12, OKC: 5 };

      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      expect(draftPick.resolved).toBeUndefined();
    });

    it('preserves already-resolved swaps (idempotent)', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_1',
            year: 2026,
            round: 1,
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
            resolved: true,
            resolvedOwner: 'PHI', // Previously resolved
            resolvedPosition: 3,
          },
        ],
      };
      const positionsMap = { PHI: 12, OKC: 5 }; // Different positions

      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      // Should preserve original resolution
      expect(draftPick.resolved).toBe(true);
      expect(draftPick.resolvedOwner).toBe('PHI');
      expect(draftPick.resolvedPosition).toBe(3);
    });
  });

  describe('Only resolves first-round picks', () => {
    it('does not resolve second-round swaps', () => {
      const team = {
        teamCode: 'BOS',
        draftPicks: [
          {
            id: 'PHI_2026_2',
            year: 2026,
            round: 2, // Second round
            originalTeam: 'PHI',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'OKC',
          },
        ],
      };
      const positionsMap = { PHI: 42, OKC: 35 };

      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      // Second-round swaps should NOT be resolved in Phase 3
      expect(draftPick.resolved).toBeUndefined();
    });
  });

  describe('Non-swap picks unchanged', () => {
    it('does not modify outright picks', () => {
      const outrightPick = {
        id: 'PHI_2026_1',
        year: 2026,
        round: 1,
        originalTeam: 'PHI',
        isSwap: false,
        protection: 'Top 3',
      };
      const team = {
        teamCode: 'BOS',
        draftPicks: [outrightPick],
      };
      const positionsMap = { PHI: 12, OKC: 5 };

      const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap);
      const draftPick = getDraftPick(result, 0);

      expect(draftPick).toEqual(outrightPick);
    });
  });
});

/**
 * Options parameter tests
 */
describe('resolveDraftPickSwapsForYear() options', () => {
  it('accepts nowIso option for audit trail', () => {
    const team = {
      teamCode: 'BOS',
      draftPicks: [
        {
          id: 'PHI_2026_1',
          year: 2026,
          round: 1,
          originalTeam: 'PHI',
          isSwap: true,
          swapType: 'best_of',
          swapWithTeamId: 'OKC',
        },
      ],
    };
    const positionsMap = { PHI: 12, OKC: 5 };
    const customTime = '2026-06-25T20:00:00Z';

    const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap, { nowIso: customTime });
    const draftPick = getDraftPick(result, 0);

    expect(requireValue(draftPick.resolutionMeta, 'draftPick.resolutionMeta').resolvedAt).toBe(customTime);
  });

  it('accepts method option for resolution method', () => {
    const team = {
      teamCode: 'BOS',
      draftPicks: [
        {
          id: 'PHI_2026_1',
          year: 2026,
          round: 1,
          originalTeam: 'PHI',
          isSwap: true,
          swapType: 'best_of',
          swapWithTeamId: 'OKC',
        },
      ],
    };
    const positionsMap = { PHI: 12, OKC: 5 };

    const result = resolveDraftPickSwapsForYear(team, 2026, positionsMap, { method: 'manual' });
    const draftPick = getDraftPick(result, 0);

    expect(requireValue(draftPick.resolutionMeta, 'draftPick.resolutionMeta').method).toBe('manual');
  });
});
