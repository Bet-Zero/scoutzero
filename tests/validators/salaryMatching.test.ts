import { describe, it, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';

describe('validateSalaryMatching', () => {
  const makeTeam = (params) => ({
    teamName: 'Test Team',
    salaryOut: 0,
    salaryIn: 0,
    teamTotalSalary: 100_000_000,
    context: {
      capSettings: {
        salaryCap: 141_000_000,
        firstApron: 172_346_000,
        secondApron: 182_794_000,
      },
    },
    ...params,
  });

  describe('basic validations', () => {
    it('allows taking back less salary', () => {
      const result = validateSalaryMatching(
        makeTeam({
          salaryOut: 10_000_000,
          salaryIn: 8_000_000,
        })
      );
      expect(result.passed).toBe(true);
    });

    it('enforces outgoing matching rules when over cap', () => {
      // Band 2 (10M outgoing): allowable = 10M + $9.096M (expanded TPE) = $19.096M
      // Testing with 20M incoming which exceeds the $19.096M allowable
      const result = validateSalaryMatching(
        makeTeam({
          teamTotalSalary: 150_000_000,
          salaryOut: 10_000_000,
          salaryIn: 20_000_000, // exceeds allowable (10M + $9.096M = $19.096M)
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('exceeds allowable amount');
    });

    it('handles invalid input', () => {
      expect(validateSalaryMatching(null).passed).toBe(false);
      expect(validateSalaryMatching(undefined).passed).toBe(false);
    });
  });

  describe('cap status specific rules', () => {
    it('enforces first apron restrictions', () => {
      const result = validateSalaryMatching(
        makeTeam({
          teamTotalSalary: 175_000_000,
          salaryOut: 10_000_000,
          salaryIn: 10_500_000,
          context: {
            capSettings: {
              firstApron: 172_346_000,
            },
          },
        })
      );
      expect(result.passed).toBe(false);
    });

    it('enforces second apron restrictions', () => {
      const result = validateSalaryMatching(
        makeTeam({
          teamTotalSalary: 185_000_000,
          salaryOut: 10_000_000,
          salaryIn: 10_000_001,
          context: {
            capSettings: {
              secondApron: 182_794_000,
            },
          },
        })
      );
      expect(result.passed).toBe(false);
    });

    it('allows trades under cap', () => {
      const result = validateSalaryMatching(
        makeTeam({
          teamTotalSalary: 100_000_000,
          salaryOut: 10_000_000,
          salaryIn: 15_000_000,
          context: {
            capSettings: {
              salaryCap: 141_000_000,
            },
          },
        })
      );
      expect(result.passed).toBe(true);
    });
  });

  describe('trade exceptions', () => {
    it('handles FA exception buckets', () => {
      const result = validateSalaryMatching(
        makeTeam({
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          salaryIn: 12_000_000,
          team: {
            faExceptionBuckets: [
              {
                type: 'NTMLE',
                remaining: 11_000_000,
              },
            ],
          },
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain(
        'FA Exception bucket insufficient'
      );
    });
  });
});
