import { describe, it, expect } from 'vitest';
import { validateHardCap } from '@/utils/architect/tradeMachine/rules/salary/hardCap.js';

describe('validateHardCap', () => {
  const makeTeam = (params) => ({
    team: {
      totalSalary: 100_000_000,
    },
    projectedSalary: 100_000_000,
    capSettings: {
      firstApron: 172_346_000,
      secondApron: 182_794_000,
    },
    ...params,
  });

  describe('first apron hard cap', () => {
    it('allows trades under first apron hard cap', () => {
      const result = validateHardCap(
        makeTeam({
          hardCapped: true,
          projectedSalary: 170_000_000,
        })
      );
      expect(result.passed).toBe(true);
      expect(result.hardCapType).toBe('FirstApron');
    });

    it('blocks trades exceeding first apron hard cap', () => {
      const result = validateHardCap(
        makeTeam({
          hardCapped: true,
          projectedSalary: 175_000_000,
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('1st Apron');
    });
  });

  describe('second apron hard cap', () => {
    it('allows trades under second apron hard cap', () => {
      const result = validateHardCap(
        makeTeam({
          team: { hardCapTriggered: 'SecondApron' },
          projectedSalary: 180_000_000,
        })
      );
      expect(result.passed).toBe(true);
    });

    it('blocks trades exceeding second apron hard cap', () => {
      const result = validateHardCap(
        makeTeam({
          team: { hardCapTriggered: 'SecondApron' },
          projectedSalary: 185_000_000,
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('2nd Apron');
    });
  });

  describe('no hard cap', () => {
    it('allows trades when no hard cap is triggered', () => {
      const result = validateHardCap(
        makeTeam({
          hardCapped: false,
          projectedSalary: 190_000_000,
        })
      );
      expect(result.passed).toBe(true);
      expect(result.hardCapType).toBeNull();
    });
  });
});
