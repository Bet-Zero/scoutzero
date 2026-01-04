/**
 * Trade Machine Draft Picks - Phase 2 Preflight Test Skeleton
 *
 * Tests for swap handling, pick shape validation, and Stepien rule compliance.
 * These tests use the fixtures from src/tests/fixtures/tradeMachinePicks/
 *
 * Phase 2 PREFLIGHT - January 2026
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
 * Phase 2 Gap G1: Swap Rights Validation
 *
 * Current behavior: isSwap picks are included in Stepien checks but swap logic is not fully modeled.
 * Phase 2 target: Swaps should reserve years for Stepien purposes.
 */
describe('Phase 2 Swap Validation', () => {
  describe('swapOnly fixture', () => {
    it('single swap should pass Stepien (no consecutive year)', () => {
      const team = swapOnly.teams[0];
      const result = validateStepien({ outgoingPicks: team.picksOut }, {});

      // Current expected behavior: passes because single pick
      expect(result.passed).toBe(true);
    });
  });

  describe.skip('swapPlusAdjacentPick fixture (Phase 2 Gap G1)', () => {
    // NOTE: This test is SKIPPED because it requires Phase 2 implementation
    // Current behavior: Both picks are checked, but swap year reservation logic is incomplete
    it('swap + adjacent unprotected 1st should FAIL Stepien', () => {
      const team = swapPlusAdjacentPick.teams[0];
      const result = validateStepien({ outgoingPicks: team.picksOut }, {});

      // Phase 2 expectation: should fail due to consecutive year obligation
      // (2026 swap reserves year, 2027 unprotected = consecutive)
      expect(result.passed).toBe(false);
      expect(result.violations).toContain(expect.stringMatching(/consecutive/i));
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
 */
describe.skip('Second Apron Frozen Pick Restriction (Phase 2)', () => {
  // NOTE: This test is SKIPPED because it requires Phase 2 swap handling
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

    // Phase 2 expectation: should fail due to second apron frozen pick restriction
    expect(result.passed).toBe(false);
    expect(result.violations).toContain(
      expect.stringMatching(/second apron.*cannot trade/i)
    );
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
