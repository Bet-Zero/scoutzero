import type { GovernedContractState } from '@/schemas/governedContractState';
import { governingCalendarDate } from '../../governedSeason/governedTime';
import { toEndYear } from '../../seasonFormat';
import { calendarMonthsAfter } from './tradeAggregation';
import { isTwoWayTradePlayer } from './twoWayTradeSalary';

/** Pinned CBA2-L03.16/.17/.18. The existing Two-Way gate handles that route. */
export function signingTradeRestrictions(
  terms: GovernedContractState['terms'],
  asOfDate: string,
  draftYear?: unknown
): string[] {
  if (terms.isExtension || isTwoWayTradePlayer(terms)) return [];
  const signed = terms.signingDate;
  const day =
    signed.value && ['date', 'instant'].includes(signed.precision)
      ? governingCalendarDate(signed.value)
      : null;
  if (!day)
    return [
      'Signing trade eligibility needs the Contract signing date (CBA2-L03.16/.17).',
    ];
  if (day > asOfDate)
    return ['The Contract signing date is later than the trade date.'];
  const draft = Number(draftYear);
  const start = toEndYear(terms.startSeason);
  // The retained world bio identifies drafted rookies signed using another
  // exception (e.g. MLE). An undrafted ROOKIE CONTRACT label alone does not.
  const rookie =
    terms.isRookieScale === true ||
    /second round rookie/i.test(terms.signedUsing ?? '') ||
    (/rookie/i.test(terms.contractType ?? '') &&
      Number.isInteger(draft) &&
      draft >= 1947 &&
      start != null &&
      draft < start);
  if (rookie) {
    const end = new Date(Date.parse(day) + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return asOfDate <= end
      ? [
          `Draft Rookie cannot be traded during thirty days after signing; ${end} needs exact anniversary timing (CBA2-L03.16).`,
        ]
      : [];
  }
  const threeMonths = calendarMonthsAfter(day, 3)!;
  const signingSeasonStart =
    Number(day.slice(0, 4)) - (Number(day.slice(5, 7)) < 7 ? 1 : 0);
  const december15 = `${signingSeasonStart}-12-15`;
  const reasons: string[] = [];
  if (asOfDate < december15 || asOfDate <= threeMonths) {
    reasons.push(
      `Free-agent signing cannot be traded until the later of ${threeMonths} (three calendar months; the anniversary needs exact timing) and ${december15} (CBA2-L03.17).`
    );
  }
  // These source terms do not prove the prior-Team, above-cap, >120% and
  // minimum/no-bonus predicates. Do not silently clear a possible special bar.
  // All such signings are already blocked on the November starting date.
  const january15 = `${signingSeasonStart + 1}-01-15`;
  if (
    /^(?:early )?bird(?: exception)?$/i.test(terms.signedUsing ?? '') &&
    asOfDate >= december15 &&
    asOfDate < january15
  ) {
    reasons.push(
      `Bird re-signing needs prior-Team salary, above-cap and minimum/no-bonus eligibility facts to rule out the January 15 trade bar (CBA2-L03.18).`
    );
  }
  return reasons;
}

/** A signed future extension can restrict today's original Contract. */
export function amendmentTradeRestrictions(
  terms: GovernedContractState['terms'],
  asOfDate: string,
  salaryCapYear: number
): string[] {
  if (isTwoWayTradePlayer(terms)) return [];
  const renegotiation = /renegotiat/i.test(terms.contractType ?? '');
  if (!terms.isExtension && !renegotiation) return [];
  const day =
    terms.signingDate.value &&
    ['date', 'instant'].includes(terms.signingDate.precision)
      ? governingCalendarDate(terms.signingDate.value)
      : null;
  if (!day)
    return [
      'Extension/renegotiation trade eligibility needs its signing date (CBA2-A10.7).',
    ];
  if (day > asOfDate) return []; // Not signed at this world date.
  if (terms.isRookieScale && !renegotiation) {
    return (toEndYear(terms.startSeason) ?? salaryCapYear + 1) > salaryCapYear
      ? [
          'A signed future Rookie Scale Extension needs poison-pill inputs before the original Contract can be traded (CBA2-A03.5; post-V1).',
        ]
      : [];
  }
  const end = calendarMonthsAfter(day, 6)!;
  if (asOfDate > end) return [];
  const signingYear =
    Number(day.slice(0, 4)) + (Number(day.slice(5, 7)) >= 7 ? 1 : 0);
  const seasons = (toEndYear(terms.endSeason) ?? signingYear) - signingYear + 1;
  const richTerm = seasons >= (day < '2024-07-01' ? 4 : 5);
  return [
    renegotiation || richTerm
      ? `This ${renegotiation ? 'renegotiation' : 'extension term'} bars trading for six calendar months, through ${end} unless exact anniversary timing is established (CBA2-A10.7).`
      : `This recent extension needs its original-term salary and permitted extension-and-trade salary/raise eligibility before trading within six calendar months (${end}; CBA2-A10.7). The source label alone does not establish clearance.`,
  ];
}
