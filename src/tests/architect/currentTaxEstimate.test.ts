import { describe, expect, it } from 'vitest';
import { projectTaxPosition } from '@/features/architect/utils/capTotals/projectTaxPosition';
import { buildCapDeltaContext } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory.utils';
import type { SalaryBooksSnapshot } from '@/schemas/salaryBooks';

describe('2026–27 Tax Salary estimate and saved History', () => {
  const books: SalaryBooksSnapshot = {
    version: 1,
    status: 'needs-input',
    context: { asOfDate: '2026-11-14T00:00:00-05:00', salaryCapYear: 2027, teamId: 'CHI' },
    governedInputs: null,
    ledgers: {
      teamSalary: { kind: 'team-salary', status: 'complete', total: 201_000_000, lineItems: [] },
      apronTeamSalary: { kind: 'apron-team-salary', status: 'not-evaluated', total: null, lineItems: [], reason: 'Unavailable in scenario' },
      taxSalary: { kind: 'tax-salary', status: 'needs-input', total: null, lineItems: [], reason: 'Start of last regular-season game', missingInputs: ['baseline'] },
    },
  };

  it('compares current Team Salary with the official $200,428,000 Tax Level in November', () => {
    expect(projectTaxPosition(books)).toEqual({
      date: '2026-11-14', teamSalary: 201_000_000, distanceFromTaxLevel: 572_000,
    });
    expect(books.ledgers.taxSalary.total).toBeNull();
  });

  it('requires a dated Team Salary before the last regular season date', () => {
    expect(projectTaxPosition({ ...books, context: null })).toBeNull();
    expect(projectTaxPosition({
      ...books, context: { ...books.context!, asOfDate: '2027-04-11T00:00:00-04:00' },
    })).toBeNull();
    expect(projectTaxPosition({
      ...books, ledgers: {
        ...books.ledgers,
        taxSalary: { kind: 'tax-salary', status: 'complete', total: 200_100_000, lineItems: [] },
      },
    })).toBeNull();
  });

  it('preserves Team and Apron changes with an unavailable final tax amount', () => {
    const result = buildCapDeltaContext({
      beforeTotalsByTeam: { CHI: { teamSalary: 201_000_000, apronTeamSalary: 205_000_000, taxSalary: null } },
      afterTotalsByTeam: { CHI: { teamSalary: 202_000_000, apronTeamSalary: 206_000_000, taxSalary: null } },
      teamsInvolved: ['CHI'],
      activeTeamCode: 'CHI',
    });
    expect(result.capDelta).toBe(1_000_000);
    expect(result.lines).toEqual([
      'CHI Team Salary: +$1,000,000',
      'CHI Apron Team Salary: +$1,000,000',
      'CHI final Tax Salary needs last-game inputs',
    ]);
  });
});
