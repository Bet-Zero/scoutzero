/**
 * Stepien Obligations Tests
 * 
 * Tests for the obligations-aware Stepien validation.
 * 
 * See: docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md
 * See: docs/return-packages/TRADE_MACHINE_STEPIEN_OBLIGATIONS_WIRING__EXECUTION__2026-01-08.md
 */
import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';

describe('validateStepien - Obligations Wiring', () => {
  const makeTeam = (params) => ({
    teamId: 'TEST',
    teamCode: 'TEST',
    team: {
      picks: [],
    },
    context: {
      yearKey: 2025,
    },
    outgoingPicks: [],
    draftPicksObligations: [],
    ...params,
  });

  describe('Test 1: Existing obligation causes Stepien failure', () => {
    it('blocks trade when existing obligation + new pick are consecutive years', () => {
      // Team has an existing obligation in 2027 (owed/uncontrolled 1st)
      // User tries to trade 2028 1st in the current trade
      // Expected: Stepien violation is detected
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' }, // Current trade
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              originalTeam: 'TEST',
              owner: 'OTHER', // Owed to another team
              status: 'outgoing',
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('blocks trade when existing obligation + new pick create a consecutive chain', () => {
      // Team has existing obligation in 2026
      // User tries to trade 2027 1st
      // Expected: Stepien violation
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2026,
              round: 1,
              status: 'outgoing',
              tradeable: false,
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('passes when obligation and trade pick are NOT consecutive', () => {
      // Team has existing obligation in 2027
      // User tries to trade 2029 1st (not consecutive)
      // Expected: Pass
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2029, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
            },
          ],
        })
      );
      expect(result.passed).toBe(true);
    });
  });

  describe('Test 2: Conditional/protected obligation reserves year', () => {
    it('blocks when conditional obligation (tradeable: false) + adjacent pick', () => {
      // Use a conditional pick in obligations with tradeable: false
      // Attempt to trade adjacent year 1st
      // Expected: violation
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'conditional',
              tradeable: false, // Cannot be traded - blocks Stepien
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('blocks when obligation has stepienEligible: false + adjacent pick', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2026,
              round: 1,
              stepienEligible: false, // Explicitly marked as blocking Stepien
            },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('passes when obligation has meaningful protection', () => {
      // Protected obligation should NOT cause consecutive year violation
      // when the protection is meaningful (per isMeaningfulProtection)
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st', protection: 'Top 5' }, // Protected
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
              protection: 'Top 3', // Meaningful protection
            },
          ],
        })
      );
      // Both have meaningful protection, so should pass
      expect(result.passed).toBe(true);
    });

    it('passes when trade pick is protected (even if obligation is unprotected)', () => {
      // When trade pick has meaningful protection, consecutive violation doesn't apply
      // This is consistent with existing Stepien behavior
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st', protection: 'Top 3' }, // Protected
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
              // No protection - unprotected obligation
            },
          ],
        })
      );
      // Trade pick is protected, so consecutive violation doesn't trigger
      // (Need BOTH to be unprotected for violation)
      expect(result.passed).toBe(true);
    });
  });

  describe('Test 3: Swap worst_of does not reserve year', () => {
    it('passes when existing swap obligation is worst_of + adjacent pick', () => {
      // Existing swap obligation with isSwap: true and swapType: 'worst_of'
      // Ensure it does NOT reserve year; adjacent trade should not auto-fail
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              isSwap: true,
              swapType: 'worst_of', // worst_of does NOT reserve year
            },
          ],
        })
      );
      // worst_of swap doesn't reserve year, so only 2028 is considered
      // Single pick = no consecutive violation
      expect(result.passed).toBe(true);
    });

    it('blocks when existing swap obligation is best_of + adjacent pick', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              isSwap: true,
              swapType: 'best_of', // best_of DOES reserve year
            },
          ],
        })
      );
      // best_of swap reserves year, so 2027 + 2028 = consecutive violation
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('blocks when existing swap obligation has missing swapType (defaults to best_of)', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              isSwap: true,
              // No swapType - defaults to best_of
            },
          ],
        })
      );
      // Missing swapType defaults to best_of, which reserves year
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });
  });

  describe('Edge cases', () => {
    it('handles empty obligations array gracefully', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
          ],
          draftPicksObligations: [],
        })
      );
      expect(result.passed).toBe(true);
    });

    it('handles missing draftPicksObligations field gracefully', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
          ],
          // No draftPicksObligations field at all
        })
      );
      expect(result.passed).toBe(true);
    });

    it('ignores second-round obligations for Stepien', () => {
      // Second round picks don't count for Stepien rule
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 2, // Second round - ignored for Stepien
              status: 'outgoing',
            },
          ],
        })
      );
      // Second round obligation is ignored, only 2028 1st is considered
      expect(result.passed).toBe(true);
    });

    it('considers obligations from team.team.draftPicksObligations fallback', () => {
      // Test the fallback path where obligations are on team.team
      const result = validateStepien({
        teamId: 'TEST',
        team: {
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
            },
          ],
        },
        context: {
          yearKey: 2025,
        },
        outgoingPicks: [
          { year: 2028, round: '1st' },
        ],
      });
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('includes debug info about obligations considered', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
            },
          ],
        })
      );
      // Verify debug info is present
      expect(result._debug).toBeDefined();
      expect(result._debug.obligationsConsidered).toBe(1);
      expect(result._debug.tradePicksConsidered).toBe(1);
    });
  });
});
