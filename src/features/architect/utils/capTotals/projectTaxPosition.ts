import type { SalaryBooksSnapshot } from '@/schemas/salaryBooks';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason/governedSeasonEnvelope';

/**
 * CBA2-C08.1 starts the final book at the last regular-season game's tipoff.
 * Before that date, compare today's complete Team Salary to the official Tax
 * Level under a fixed-payroll assumption, before any Tax Salary adjustments.
 */
export function projectTaxPosition(books: SalaryBooksSnapshot) {
  if (
    !books.context ||
    books.ledgers.teamSalary.status !== 'complete' ||
    books.ledgers.taxSalary.status === 'complete'
  ) return null;

  const { asOfDate, salaryCapYear, teamId } = books.context;
  const date = asOfDate.slice(0, 10);
  const { calendar, systemLevels } = resolveGovernedSeasonEnvelope({
    asOfDate,
    salaryCapYear,
    team: { teamId },
    requiredAuthority: 'official',
  });
  const regularSeasonClose = calendar.regularSeasonClosing?.value;
  const taxLevel = systemLevels['tax-level'].amount;
  if (!regularSeasonClose || date >= regularSeasonClose || taxLevel === null) {
    return null;
  }

  return {
    date,
    teamSalary: books.ledgers.teamSalary.total,
    distanceFromTaxLevel: books.ledgers.teamSalary.total - taxLevel,
  };
}
