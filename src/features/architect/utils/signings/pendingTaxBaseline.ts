import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import {
  governingCalendarDate,
  governingDayStartInstant,
  isWithinSalaryCapYear,
  resolveGovernedSeasonEnvelope,
} from '../governedSeason';

/** CBA2-C08.1/.2: current-season signing uses current Team/Apron Salary.
 * A missing future last-game Tax baseline is neither a signing restriction nor
 * permission to invent a tax amount. Other missing inputs, an already supplied
 * baseline and the closing day itself retain the existing fail-closed path.
 */
export function hasPendingSeasonTaxBaseline(
  inputs: TeamSalaryBookInputs | null | undefined,
  salaryCapYear: number,
  asOfDate: string | null | undefined,
  teamCode: unknown
): boolean {
  const tax = inputs?.taxSalary;
  if (
    inputs?.salaryCapYear !== salaryCapYear ||
    tax?.status !== 'needs-input' ||
    tax.missingInputs.length !== 1 ||
    tax.missingInputs[0] !== 'salaryBookInputs.taxSalary.baseline'
  )
    return false;
  const day = governingCalendarDate(asOfDate);
  const instant = governingDayStartInstant(asOfDate);
  if (
    !day ||
    !instant ||
    !isWithinSalaryCapYear(instant, salaryCapYear) ||
    typeof teamCode !== 'string' ||
    !/^[A-Z]{3}$/.test(teamCode)
  )
    return false;
  const envelope = resolveGovernedSeasonEnvelope({
    salaryCapYear,
    asOfDate: instant,
    requiredAuthority: 'official',
    team: { teamId: teamCode, teamCode },
  });
  return (
    envelope.calendar.state === 'available' &&
    Boolean(
      envelope.calendar.regularSeasonClosing?.value &&
        day < envelope.calendar.regularSeasonClosing.value
    )
  );
}
