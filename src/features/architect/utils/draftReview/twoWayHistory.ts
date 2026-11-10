import { DraftSimulationTwoWayHistoryZ } from '@/schemas/draftSimulationTwoWayHistory';
import type { GovernedTradeSalaryBasis } from '@/schemas/governedTradeSalaryBasis';

/** An explicit premise in the existing protected simulator, never NBA authority.
 * The world document is loaded independently and fenced through atomic commit.
 * Earlier years need complete coverage; every assignment during this Salary Cap
 * Year adds the same current year, so repeated trades cannot erase a held year.
 * A later Salary Cap Year needs refreshed history rather than an assumed zero.
 */

export function requireTwoWayAssignmentHistory(
  history: unknown,
  basis: GovernedTradeSalaryBasis,
  destination: string
) {
  const parsed = DraftSimulationTwoWayHistoryZ.safeParse(history);
  const matching = parsed.success
    ? parsed.data.records.filter(
        (row) => row.playerId === basis.playerId && row.teamId === destination
      )
    : [];
  if (
    !parsed.success ||
    parsed.data.worldId !== basis.worldId ||
    parsed.data.salaryCapYear !== basis.salaryCapYear ||
    matching.length !== 1 ||
    basis.twoWayContractEndYear == null ||
    matching[0].priorSalaryCapYears.some(
      (year) => year >= basis.salaryCapYear
    ) ||
    new Set(matching[0].priorSalaryCapYears).size !==
      matching[0].priorSalaryCapYears.length
  )
    throw new Error(
      'Two-Way assignment needs complete governed prior same-team Salary Cap Year history (CBA2-C20.16).'
    );
  const years = new Set(matching[0].priorSalaryCapYears);
  for (
    let year = basis.salaryCapYear;
    year <= basis.twoWayContractEndYear;
    year++
  )
    years.add(year);
  if (years.size > 3)
    throw new Error(
      'Two-Way assignment would exceed three Salary Cap Years with the same team (CBA2-C20.16).'
    );
}
