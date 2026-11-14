import type { GovernedContractState } from '@/schemas/governedContractState';
import type { LifecycleProjectionEvent } from '../../contractHistory';
import { GovernedTradeSalaryBasisEvidenceZ } from '@/schemas/governedTradeSalaryBasis';
import { GovernedExtensionLeagueEvidenceZ } from '@/schemas/governedExtension';
import { governingCalendarDate } from '../../governedSeason/governedTime';
import { toEndYear, toSeasonCode } from '../../seasonFormat';
import { calendarMonthsAfter } from './tradeAggregation';
import { isTwoWayTradePlayer } from './twoWayTradeSalary';

type Terms = GovernedContractState['terms'];
export type TradeTimingContext = {
  relatedContracts?: readonly Terms[];
  /** Existing accepted history supplies prior compensation only, never current rosters/books. */
  historicalContracts?: readonly { terms: Terms; effectiveAt: string }[];
};

/** Read-only eligibility views; immutable saved Contract states are not changed. */
export function projectAmendmentTimingTerms(
  current: Terms,
  consumedEvents: readonly LifecycleProjectionEvent[]
): Terms[] {
  const amendments = consumedEvents.filter(
    (event) =>
      event.eventKind === 'extension' || event.eventKind === 'renegotiation'
  );
  if (!amendments.length) return [current];
  return [
    consumedEvents[0].resultingState.terms,
    ...amendments.map((event): Terms => {
      const terms = event.resultingState.terms;
      const signingDate = {
        precision: 'instant' as const,
        value: event.executedAt,
        rawValue: event.executedAt,
      };
      if (event.eventKind === 'renegotiation')
        return { ...terms, signingDate, contractType: 'Renegotiation' };
      const predecessor = consumedEvents.find(
        (candidate) =>
          candidate.resultingContractVersion ===
          event.predecessorContractVersion
      );
      const originalEnd = toEndYear(
        predecessor?.resultingState.terms.endSeason
      );
      const firstYear = originalEnd ? originalEnd + 1 : null;
      return {
        ...terms,
        signingDate,
        isExtension: true,
        startSeason: firstYear ? toSeasonCode(firstYear) : null,
        salaries: firstYear
          ? terms.salaries.filter(
              (row) => Number(toEndYear(row.season)) >= firstYear
            )
          : [],
      };
    }),
  ];
}

const noBonuses = (terms: Terms) =>
  Number(terms.bonuses.tradeKickerPercent ?? 0) === 0 &&
  terms.salaries.every(
    (row) =>
      !Number(row.tradeBonus ?? 0) &&
      !Number(row.incentives.likely ?? 0) &&
      !Number(row.incentives.unlikely ?? 0)
  );
const money = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** A conflicting or malformed current row cannot be replaced by older evidence. */
function previousSalary(
  terms: Terms,
  context: TradeTimingContext
): { value: number | null; conflict: boolean } {
  const first = toEndYear(terms.startSeason);
  if (!first) return { value: null, conflict: false };
  const rows = (contracts: readonly Terms[]) =>
    contracts.flatMap((contract) =>
      contract.salaries.filter(
        (row) => toEndYear(row.season) === first - 1 && !row.voidedByExtension
      )
    );
  let candidates = rows([terms, ...(context.relatedContracts ?? [])]);
  if (!candidates.length)
    candidates = rows(
      (context.historicalContracts ?? [])
        .filter(
          (entry) =>
            entry.effectiveAt.slice(0, 10) <
            (terms.signingDate.value ?? '').slice(0, 10)
        )
        .map((entry) => entry.terms)
    );
  if (
    !candidates.length ||
    candidates.some(
      (row) =>
        !money(row.salary) ||
        Number(row.incentives.likely ?? 0) !== 0 ||
        Number(row.incentives.unlikely ?? 0) !== 0
    )
  )
    return { value: null, conflict: candidates.length > 0 };
  const values = new Set(candidates.map((row) => row.salary));
  return {
    value: values.size === 1 ? candidates[0].salary : null,
    conflict: values.size !== 1,
  };
}

function signedMinimumWithoutBonuses(terms: Terms): boolean {
  if (!noBonuses(terms) || !terms.salaries.length) return false;
  const evidence = GovernedTradeSalaryBasisEvidenceZ.safeParse(
    terms.tradeSalaryBasisEvidence
  );
  if (!evidence.success) return false;
  const start = toEndYear(terms.startSeason);
  return terms.salaries.every((row) => {
    const year = toEndYear(row.season);
    const cells =
      evidence.data.minimumSalaryAmounts?.filter(
        (cell) =>
          cell.salaryCapYear === year &&
          cell.contractStartSalaryCapYear === start &&
          cell.contractYear === Number(year) - Number(start) + 1
      ) ?? [];
    return cells.length === 1 && row.salary === cells[0].amount;
  });
}

/** Pinned CBA2-L03.16/.17/.18. The existing Two-Way gate handles that route. */
export function signingTradeRestrictions(
  terms: GovernedContractState['terms'],
  asOfDate: string,
  draftYear?: unknown,
  context: TradeTimingContext = {}
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
  // Establish a predicate that rules out the special bar, or retain the
  // missing facts. The ordinary signing bar above remains independently binding.
  const january15 = `${signingSeasonStart + 1}-01-15`;
  if (
    /^(?:early )?bird(?: exception)?$/i.test(terms.signedUsing ?? '') &&
    asOfDate >= december15 &&
    asOfDate < january15
  ) {
    const firstYear = toEndYear(terms.startSeason);
    const firstSalary = terms.salaries.find(
      (row) => toEndYear(row.season) === firstYear
    )?.salary;
    const evidence = GovernedTradeSalaryBasisEvidenceZ.safeParse(
      terms.tradeSalaryBasisEvidence
    );
    const retained = evidence.success
      ? evidence.data.signingEligibility
      : undefined;
    const matchingEvidence =
      retained && governingCalendarDate(retained.signingDate) === day
        ? retained
        : null;
    const prior = previousSalary(terms, context);
    const priorSalary =
      prior.value ?? matchingEvidence?.priorSeasonRegularSalary ?? null;
    const conflict =
      prior.conflict ||
      (retained &&
        (!matchingEvidence ||
          (prior.value !== null &&
            prior.value !== retained.priorSeasonRegularSalary)));
    const belowThreshold =
      money(firstSalary) &&
      money(priorSalary) &&
      firstSalary <= priorSalary * 1.2;
    const belowCap =
      matchingEvidence &&
      matchingEvidence.teamSalaryAfterSigning <=
        matchingEvidence.salaryCapAtSigning;
    const differentPriorTeam =
      matchingEvidence &&
      terms.signingTeam &&
      matchingEvidence.priorTeamId !== terms.signingTeam;
    if (conflict)
      reasons.push(
        'Bird signing eligibility evidence conflicts with its Contract date or prior salary (CBA2-L03.18).'
      );
    else if (
      !belowThreshold &&
      !belowCap &&
      !differentPriorTeam &&
      !signedMinimumWithoutBonuses(terms)
    )
      reasons.push(
        matchingEvidence &&
          terms.signingTeam === matchingEvidence.priorTeamId &&
          money(firstSalary) &&
          money(priorSalary)
          ? `This above-cap Bird re-signing increased salary by more than 20%; it cannot be traded before ${january15} or its three-month anniversary, whichever is later (CBA2-L03.18).`
          : 'Bird re-signing needs prior-Team salary, above-cap and minimum/no-bonus eligibility facts to rule out the January 15 trade bar (CBA2-L03.18).'
      );
  }
  return reasons;
}

/** A signed future extension can restrict today's original Contract. */
export function amendmentTradeRestrictions(
  terms: GovernedContractState['terms'],
  asOfDate: string,
  salaryCapYear: number,
  context: TradeTimingContext = {}
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
  const restricted = (why: string) => [
    `This ${why} bars trading for six calendar months, through ${end} unless exact anniversary timing is established (CBA2-A10.7).`,
  ];
  if (renegotiation || richTerm)
    return restricted(renegotiation ? 'renegotiation' : 'extension term');
  const firstYear = toEndYear(terms.startSeason);
  const lastYear = toEndYear(terms.endSeason);
  const rows = terms.salaries
    .filter(
      (row) =>
        !row.voidedByExtension &&
        Number(toEndYear(row.season)) >= Number(firstYear)
    )
    .sort((a, b) => String(a.season).localeCompare(String(b.season)));
  const complete =
    firstYear &&
    lastYear &&
    rows.length === lastYear - firstYear + 1 &&
    rows.every(
      (row, index) =>
        toEndYear(row.season) === firstYear + index && money(row.salary)
    );
  const needs = (detail: string) => [
    `This recent extension needs ${detail} before trading within six calendar months (${end}; CBA2-A10.7).`,
  ];
  if (!complete) return needs('complete extended-term salaries and Seasons');
  if (!noBonuses(terms))
    return needs('incentive/trade-bonus eligibility (post-V1)');
  // With zero incentives, the salary and Regular Salary raise tests coincide.
  const firstSalary = rows[0].salary!;
  if (
    rows
      .slice(1)
      .some(
        (row, index) =>
          Math.abs(row.salary! - rows[index].salary!) > firstSalary * 0.05
      )
  )
    return restricted('extension salary change above 5%');
  if (day < '2024-07-01')
    return needs('the historical extension-and-trade salary ceiling');
  const prior = previousSalary(terms, context);
  if (prior.conflict) return needs('unambiguous original-term Regular Salary');
  const league = GovernedExtensionLeagueEvidenceZ.safeParse(
    terms.extensionLeagueEvidence
  );
  const eaps =
    league.success &&
    ['known', 'derived'].includes(league.data.status) &&
    league.data.signingSalaryCapYear === signingYear &&
    league.data.firstExtendedSalaryCapYear === firstYear
      ? league.data.estimatedAveragePlayerSalary
      : null;
  // Either known arm of the greater-of limit can establish that salary fits.
  // Both are needed to establish that salary exceeds the limit.
  if (
    (prior.value !== null && firstSalary <= prior.value * 1.2) ||
    (eaps !== null && firstSalary <= eaps * 1.2)
  )
    return [];
  if (prior.value !== null && eaps !== null)
    return restricted('extension first-year salary above the permitted limit');
  return needs(
    'its original-term salary and/or the signing-season estimated average salary for the 120% limit'
  );
}
