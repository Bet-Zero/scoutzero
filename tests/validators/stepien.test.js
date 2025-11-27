import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';

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
});
