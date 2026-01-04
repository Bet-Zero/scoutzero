/**
 * Trade Machine Draft Picks - Phase 2 Tests
 *
 * Tests for swap handling, pick shape validation, and Stepien rule compliance.
 * These tests use the fixtures from src/tests/fixtures/tradeMachinePicks/
 *
 * Phase 2 EXECUTION - January 2026
 *
 * @file src/tests/tradeMachine/draftPicksPreflight.test.js
 */

import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';
import { ensurePickId, generatePickId, normalizeRound } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils.js';

// Import fixtures
import swapOnly from '../fixtures/tradeMachinePicks/swapOnly.json';
import swapPlusAdjacentPick from '../fixtures/tradeMachinePicks/swapPlusAdjacentPick.json';
import protectionStringPresent from '../fixtures/tradeMachinePicks/protectionStringPresent.json';
import missingOriginalTeam from '../fixtures/tradeMachinePicks/missingOriginalTeam.json';
import multiTeamTrade from '../fixtures/tradeMachinePicks/multiTeamTrade.json';
import secondApronFrozenSwap from '../fixtures/tradeMachinePicks/secondApronFrozenSwap.json';

/**
 * Phase 2: Swap Rights Validation (Option B: "Reserve Most")
 *
 * Rules:
 * - Outright picks always reserve year for Stepien
 * - Swap picks (isSwap === true) reserve year UNLESS swapType === 'worst_of'
 * - Missing swapType treated as 'best_of'
 */
describe('Phase 2 Swap Validation', () => {
  describe('swapOnly fixture', () => {
    it('single swap should pass Stepien (no consecutive year)', () => {
      const team = swapOnly.teams[0];
      const result = validateStepien({ outgoingPicks: team.picksOut }, {});

      // Passes because single pick - no consecutive year issue
      expect(result.passed).toBe(true);
    });
  });

  describe('swapPlusAdjacentPick fixture', () => {
    it('swap (best_of) + adjacent unprotected 1st should FAIL Stepien', () => {
      const team = swapPlusAdjacentPick.teams[0];
      const result = validateStepien({ outgoingPicks: team.picksOut }, {});

      // Phase 2: should fail due to consecutive year obligation
      // 2026 swap (best_of by default) reserves year, 2027 unprotected = consecutive
      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(expect.stringMatching(/consecutive/i));
    });

    it('swap (worst_of) + adjacent unprotected 1st should PASS Stepien', () => {
      // Create a modified fixture with worst_of swap type
      const picks = [
        {
          id: 'PHI_2026_1',
          year: 2026,
          round: 1,
          originalTeam: 'PHI',
          protection: null,
          isSwap: true,
          swapType: 'worst_of', // Does NOT reserve year
          swapWithTeamId: 'OKC',
        },
        {
          id: 'PHI_2027_1',
          year: 2027,
          round: 1,
          originalTeam: 'PHI',
          protection: null,
          isSwap: false,
        },
      ];
      const result = validateStepien({ outgoingPicks: picks }, {});

      // Phase 2: should PASS because worst_of swap doesn't reserve year
      // Only 2027 is Stepien-relevant (single year, no consecutive issue)
      expect(result.passed).toBe(true);
    });
  });

  describe('swapType backwards compatibility', () => {
    it('isSwap:true with missing swapType behaves as best_of', () => {
      // Pick with isSwap but NO swapType (legacy format)
      const picks = [
        {
          id: 'PHI_2026_1',
          year: 2026,
          round: 1,
          originalTeam: 'PHI',
          protection: null,
          isSwap: true, // No swapType - should default to best_of
          swapWithTeamId: 'OKC',
        },
        {
          id: 'PHI_2027_1',
          year: 2027,
          round: 1,
          originalTeam: 'PHI',
          protection: null,
          isSwap: false,
        },
      ];
      const result = validateStepien({ outgoingPicks: picks }, {});

      // Should fail - missing swapType treated as best_of, which reserves year
      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(expect.stringMatching(/consecutive/i));
    });
  });

  describe('swap-only does NOT automatically fail Stepien', () => {
    it('single swap alone passes Stepien', () => {
      const picks = [
        {
          id: 'PHI_2026_1',
          year: 2026,
          round: 1,
          originalTeam: 'PHI',
          protection: null,
          isSwap: true,
          swapType: 'best_of',
          swapWithTeamId: 'OKC',
        },
      ];
      const result = validateStepien({ outgoingPicks: picks }, {});

      // Single pick (swap or not) should pass - no consecutive year issue
      expect(result.passed).toBe(true);
    });
  });
});

/**
 * Phase 1 Protection Handling (Already Implemented)
 *
 * Verifies that string-based protection detection works correctly.
 */
describe('Protection String Handling', () => {
  it('protected pick should bypass consecutive year violation', () => {
    const team = protectionStringPresent.teams[0];
    const result = validateStepien({ outgoingPicks: team.picksOut }, {});

    // 2026 is "Top 3" protected, 2027 is unprotected
    // isMeaningfulProtection("Top 3") = true, so no violation
    expect(result.passed).toBe(true);
  });
});

/**
 * Pick ID Generation with Missing Fields
 */
describe('Pick ID Fallback Handling', () => {
  it('missing originalTeam generates UNK fallback with warning', () => {
    const pickWithoutOriginalTeam = missingOriginalTeam.teams[0].picksOut[0];
    const result = ensurePickId(pickWithoutOriginalTeam);

    expect(result.id).toBe('UNK_2026_1');
    expect(result.pickIdWarning).toBeDefined();
    expect(result.pickIdWarning).toContain('originalTeam');
  });
});

/**
 * Multi-Team Trade Validation
 */
describe('Multi-Team Trade Picks', () => {
  it('each team evaluated independently for Stepien', () => {
    // Each team in multiTeamTrade sends a single non-consecutive pick
    multiTeamTrade.teams.forEach((team) => {
      const result = validateStepien({ outgoingPicks: team.picksOut }, {});
      expect(result.passed).toBe(true);
    });
  });
});

/**
 * Second Apron Frozen Pick Restrictions
 *
 * Phase 2: Second apron teams cannot trade their own 7-year-out first-round pick assets,
 * whether outright OR swap rights.
 */
describe('Second Apron Frozen Pick Restriction', () => {
  it('second apron team cannot trade own 7-year-out swap', () => {
    const team = secondApronFrozenSwap.teams[0];
    const result = validateStepien(
      {
        teamId: team.teamId,
        outgoingPicks: team.picksOut,
        postTradeStatus: team.postTradeStatus,
      },
      {
        year: secondApronFrozenSwap.context.currentYear,
        capSettings: secondApronFrozenSwap.context.capSettings,
      }
    );

    // Phase 2: should fail due to second apron frozen pick restriction
    // Swaps are subject to the same restriction as outright picks
    expect(result.passed).toBe(false);
    expect(result.violations).toContainEqual(
      expect.stringMatching(/second apron.*cannot trade/i)
    );
  });

  it('second apron team cannot trade own 7-year-out outright pick', () => {
    // Outright pick version of the same test
    const picks = [
      {
        id: 'MIA_2032_1',
        year: 2032,
        round: 1,
        originalTeam: 'MIA',
        protection: null,
        isSwap: false, // Outright pick
      },
    ];
    const result = validateStepien(
      {
        teamId: 'MIA',
        outgoingPicks: picks,
        postTradeStatus: { isAtOrAboveSecondApron: true },
      },
      {
        year: 2025,
        capSettings: { secondApron: 190000000 },
      }
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toContainEqual(
      expect.stringMatching(/second apron.*cannot trade/i)
    );
  });

  it('second apron team CAN trade other team 7-year-out pick', () => {
    // Second apron team trading acquired pick from another team
    const picks = [
      {
        id: 'OKC_2032_1',
        year: 2032,
        round: 1,
        originalTeam: 'OKC', // Not MIA's own pick
        protection: null,
        isSwap: false,
      },
    ];
    const result = validateStepien(
      {
        teamId: 'MIA',
        outgoingPicks: picks,
        postTradeStatus: { isAtOrAboveSecondApron: true },
      },
      {
        year: 2025,
        capSettings: { secondApron: 190000000 },
      }
    );

    // Should pass - it's not MIA's own pick
    expect(result.passed).toBe(true);
  });
});

/**
 * Pick Shape Validation Tests
 *
 * Verifies that picks have expected fields at various pipeline stages.
 */
describe('Pick Shape Validation', () => {
  describe('normalizeRound handles all input formats', () => {
    const roundFormats = [
      [1, 1],
      [2, 2],
      ['1st', 1],
      ['2nd', 2],
      ['first', 1],
      ['second', 2],
      ['First', 1],
      ['Second', 2],
      ['1', 1],
      ['2', 2],
    ];

    roundFormats.forEach(([input, expected]) => {
      it(`normalizeRound(${JSON.stringify(input)}) = ${expected}`, () => {
        expect(normalizeRound(input)).toBe(expected);
      });
    });
  });

  describe('generatePickId produces canonical format', () => {
    it('generates {originalTeam}_{year}_{round} format', () => {
      const pick = { originalTeam: 'PHI', year: 2026, round: '1st' };
      expect(generatePickId(pick)).toBe('PHI_2026_1');
    });

    it('handles missing originalTeam with UNK', () => {
      const pick = { year: 2026, round: 1 };
      expect(generatePickId(pick)).toBe('UNK_2026_1');
    });
  });
});
