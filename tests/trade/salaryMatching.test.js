import { describe, it, expect } from 'vitest';
import { validateSalaryMatching } from '@/utils/architect/tradeMachine/rules/salary/salaryMatching.js';

describe('salary matching validation', () => {
  const makeTeam = (salaryOut, salaryIn, extra = {}) => ({
    teamName: 'Test Team',
    salaryOut,
    salaryIn,
    ...extra,
  });

  it('allows teams to take back less salary', () => {
    const result = validateSalaryMatching(makeTeam(10_000_000, 8_000_000));
    expect(result.passed).toBe(true);
  });

  it('enforces FA exception bucket limits', () => {
    const result = validateSalaryMatching(
      makeTeam(0, 12_000_000, {
        absorptionMode: 'FA_EXCEPTION',
        bucketType: 'NTMLE',
        team: {
          faExceptionBuckets: [{ type: 'NTMLE', remaining: 11_000_000 }],
        },
      })
    );
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/FA Exception bucket insufficient/);
  });

  it('validates allowable incoming margin', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 18_000_000, {
        teamTotalSalary: 150_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 172_346_000,
            secondApron: 182_794_000,
          },
        },
      })
    );
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/exceeds allowable amount/);
  });

  it('handles null/undefined team data', () => {
    expect(validateSalaryMatching(null).passed).toBe(false);
    expect(validateSalaryMatching(undefined).passed).toBe(false);
    expect(validateSalaryMatching({}).passed).toBe(false);
  });
});
