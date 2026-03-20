import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';

describe('validateStepien', () => {
  const makeTeam = (params) => ({
    teamId: 'TEST',
    team: {
      picks: [],
    },
    context: {
      yearKey: 2025,
    },
    outgoingPicks: [],
    ...params,
  });

  describe('consecutive picks rule', () => {
    it('allows trading non-consecutive firsts', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
            { year: 2028, round: '1st' },
          ],
        })
      );
      expect(result.passed).toBe(true);
    });

    it('blocks consecutive unprotected firsts', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
            { year: 2027, round: '1st' },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('allows consecutive firsts if protected', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st' },
            { year: 2027, round: '1st', protection: 'Top 3' },
          ],
        })
      );
      expect(result.passed).toBe(true);
    });
  });

  describe('seven year limit', () => {
    it('allows picks within 7 years', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2032, round: '1st' }],
        })
      );
      expect(result.passed).toBe(true);
    });

    it('blocks picks beyond 7 years', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2033, round: '1st' }],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('7 years out');
    });
  });

  describe('second apron restrictions', () => {
    it('blocks second apron teams trading 7-year-out firsts', () => {
      const result = validateStepien(
        makeTeam({
          teamId: 'TEST',
          postTradeStatus: { isAtOrAboveSecondApron: true },
          outgoingPicks: [{ year: 2032, round: '1st', originalTeam: 'TEST' }],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('7-year-out first-round pick');
    });

    it('allows second apron teams trading other teams 7-year-out firsts', () => {
      const result = validateStepien(
        makeTeam({
          teamId: 'TEST',
          postTradeStatus: { isAtOrAboveSecondApron: true },
          outgoingPicks: [{ year: 2032, round: '1st', originalTeam: 'OTHER' }],
        })
      );
      expect(result.passed).toBe(true);
    });
  });

  /**
   * Phase 2: Swap year reservation tests (Option B: "Reserve Most")
   *
   * Rules:
   * - best_of swap reserves year for Stepien
   * - worst_of swap does NOT reserve year
   * - missing swapType defaults to best_of
   */
  describe('swap year reservation (Phase 2)', () => {
    it('best_of swap + adjacent unprotected 1st fails Stepien', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st', isSwap: true, swapType: 'best_of' },
            { year: 2027, round: '1st' },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('worst_of swap + adjacent unprotected 1st passes Stepien', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st', isSwap: true, swapType: 'worst_of' },
            { year: 2027, round: '1st' },
          ],
        })
      );
      // worst_of doesn't reserve year, so only 2027 is Stepien-relevant (single pick = OK)
      expect(result.passed).toBe(true);
    });

    it('missing swapType defaults to best_of (backward compat)', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st', isSwap: true }, // No swapType
            { year: 2027, round: '1st' },
          ],
        })
      );
      // Missing swapType = best_of = reserves year = consecutive violation
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('swap-only trade does NOT automatically fail Stepien', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st', isSwap: true, swapType: 'best_of' },
          ],
        })
      );
      // Single pick (swap or not) doesn't create consecutive violation
      expect(result.passed).toBe(true);
    });

    it('two non-consecutive swaps pass Stepien', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2026, round: '1st', isSwap: true, swapType: 'best_of' },
            { year: 2028, round: '1st', isSwap: true, swapType: 'best_of' },
          ],
        })
      );
      // Non-consecutive years = OK
      expect(result.passed).toBe(true);
    });
  });

  describe('second apron swap restrictions (Phase 2)', () => {
    it('blocks second apron teams trading own 7-year-out swap', () => {
      const result = validateStepien(
        makeTeam({
          teamId: 'TEST',
          postTradeStatus: { isAtOrAboveSecondApron: true },
          outgoingPicks: [
            { year: 2032, round: '1st', originalTeam: 'TEST', isSwap: true, swapType: 'best_of' },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('7-year-out first-round pick');
    });

    it('blocks second apron teams trading own 7-year-out worst_of swap', () => {
      // Even worst_of swaps are blocked by second apron frozen restriction
      const result = validateStepien(
        makeTeam({
          teamId: 'TEST',
          postTradeStatus: { isAtOrAboveSecondApron: true },
          outgoingPicks: [
            { year: 2032, round: '1st', originalTeam: 'TEST', isSwap: true, swapType: 'worst_of' },
          ],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('7-year-out first-round pick');
    });
  });
});
