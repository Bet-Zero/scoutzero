import { describe, it, expect } from 'vitest';
import {
  getAllowableIncomingMargin,
  getIncomingCeilingForTeam,
} from '@/features/architect/utils/tradeMachine/utils/salaryMargin.js';

describe('Salary Margin Utilities', () => {
  describe('getAllowableIncomingMargin', () => {
    const capSettings = {
      secondApron: 188_938_000,
      firstApron: 178_132_000,
      salaryCap: 140_588_000,
    };

    it('returns zero for teams above second apron', () => {
      const team = {
        teamTotalSalary: 190_000_000,
        context: {
          capSettings,
        },
      };

      const margin = getAllowableIncomingMargin(team);
      expect(margin).toBe(0);
    });

    it('returns cap space for under-cap teams', () => {
      const team = {
        teamTotalSalary: 130_000_000,
        context: {
          capSettings,
        },
      };

      const margin = getAllowableIncomingMargin(team);
      expect(margin).toBe(10_588_000); // 140_588_000 - 130_000_000
    });

    it('applies appropriate trading bands for over-cap teams', () => {
      const team = {
        teamTotalSalary: 150_000_000, // Over cap but under aprons
        salaryOut: 10_000_000,
        incomingPlayers: [],
        context: {
          capSettings,
          yearKey: 2025,
        },
      };

      // This should return something based on the simplified 120% rule
      // that's implemented in the test environment
      const margin = getAllowableIncomingMargin(team);
      expect(margin).toBeGreaterThan(0);
    });

    it('uses wrapped team extraction and resolvePayroll priority before computing cap-room margin', () => {
      const wrappedTeam = {
        team: {
          id: 'LAL',
          teamTotalSalary: 150_000_000,
          context: {
            capSettings,
          },
          postTradeStatus: {
            projectedSalary: 130_000_000,
          },
        },
      };

      expect(getAllowableIncomingMargin(wrappedTeam)).toBe(10_588_000);
    });

    it('clamps to zero when post-trade first apron status is already flagged', () => {
      const team = {
        teamTotalSalary: 130_000_000,
        context: {
          capSettings,
        },
        postTradeStatus: {
          isAtOrAboveFirstApron: true,
        },
      };

      expect(getAllowableIncomingMargin(team)).toBe(0);
    });

    it('clamps to zero when post-trade second apron status is already flagged', () => {
      const team = {
        teamTotalSalary: 130_000_000,
        context: {
          capSettings,
        },
        postTradeStatus: {
          isAtOrAboveSecondApron: true,
        },
      };

      expect(getAllowableIncomingMargin(team)).toBe(0);
    });

    it('adds only used TPE and FA exception amounts on top of the base margin', () => {
      const team = {
        teamTotalSalary: 150_000_000,
        salaryOut: 10_000_000,
        incomingPlayers: [
          { absorptionMode: 'TPE', matchIncoming: 3_000_000, tpeAmount: 9_000_000 },
          { absorptionMode: 'TPE', tpeAmount: 2_000_000 },
          { absorptionMode: 'FA_EXCEPTION', matchIncoming: 1_500_000 },
          { absorptionMode: 'MATCH', matchIncoming: 99_000_000 },
        ],
        context: {
          capSettings,
          yearKey: 2025,
        },
      };

      expect(getAllowableIncomingMargin(team)).toBe(14_000_000);
    });
  });

  describe('getIncomingCeilingForTeam', () => {
    it('limits second apron teams to 100% matching', () => {
      const team = {
        teamTotalSalary: 190_000_000,
        salaryOut: 10_000_000,
        context: {
          capSettings: {
            secondApron: 188_938_000,
            firstApron: 178_132_000,
            salaryCap: 140_588_000,
          },
        },
      };

      const ceiling = getIncomingCeilingForTeam(team);
      expect(ceiling).toBe(10_000_000); // Equal to salaryOut
    });

    it('limits first apron teams to 100% matching', () => {
      const team = {
        teamTotalSalary: 180_000_000,
        salaryOut: 10_000_000,
        context: {
          capSettings: {
            secondApron: 188_938_000,
            firstApron: 178_132_000,
            salaryCap: 140_588_000,
          },
        },
      };

      const ceiling = getIncomingCeilingForTeam(team);
      expect(ceiling).toBe(10_000_000); // Equal to salaryOut
    });

    it('allows up to cap for under-cap teams', () => {
      const team = {
        teamTotalSalary: 130_000_000,
        salaryOut: 10_000_000,
        context: {
          capSettings: {
            secondApron: 188_938_000,
            firstApron: 178_132_000,
            salaryCap: 140_588_000,
          },
        },
      };

      const ceiling = getIncomingCeilingForTeam(team);
      expect(ceiling).toBe(10_588_000); // Cap space: 140_588_000 - 130_000_000
    });

    it('applies trading bands for over-cap teams under first apron', () => {
      const team = {
        teamTotalSalary: 150_000_000,
        salaryOut: 10_000_000,
        context: {
          capSettings: {
            secondApron: 188_938_000,
            firstApron: 178_132_000,
            salaryCap: 140_588_000,
          },
        },
      };

      const ceiling = getIncomingCeilingForTeam(team);
      // The result should be salaryOut (10M) plus some margin based on the bands
      expect(ceiling).toBeGreaterThan(10_000_000);
    });
  });
});
