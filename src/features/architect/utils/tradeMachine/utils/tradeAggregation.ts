/** CBA2-A06.1/.2/.3: aggregation is distinct from an ordinary solo re-trade. */
import {
  TradeAggregationFactsZ,
  TradeAcquisitionHistoryZ,
  type TradeAggregationFacts,
} from '@/schemas/tradeAggregation';
import type { GovernedContractState } from '@/schemas/governedContractState';
import { GovernedTradeSalaryBasisEvidenceZ } from '@/schemas/governedTradeSalaryBasis';
import { toEndYear } from '../../seasonFormat';
import {
  governingCalendarDate,
  governingDayStartInstant,
  isDateOnly,
  isZonedDateTime,
  GOVERNING_TIME_ZONE,
} from '../../governedSeason/governedTime';

export const TRADE_AGGREGATION_LEAVES = [
  'CBA2-A06.1',
  'CBA2-A06.2',
  'CBA2-A06.3',
] as const;

/** Calendar months in the governing zone, not sixty days. Date-only stays a date. */
export function twoCalendarMonthsAfter(value: string): string | null {
  const day = governingCalendarDate(value);
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  const target = new Date(Date.UTC(year, month + 1, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(date, last));
  const targetDay = target.toISOString().slice(0, 10);
  if (isDateOnly(value)) return targetDay;
  if (!isZonedDateTime(value)) return null;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: GOVERNING_TIME_ZONE,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  const clock = formatter.format(new Date(value));
  const nextDay = new Date(Date.parse(targetDay) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  // A transition day's midnight offset need not apply at the target clock.
  // Try both offsets bordering that day; exactly one matching instant is safe.
  const offsets = new Set(
    [targetDay, nextDay]
      .map((date) => governingDayStartInstant(date)?.slice(-6))
      .filter((offset): offset is string => Boolean(offset))
  );
  const candidates = [...offsets]
    .map((offset) => `${targetDay}T${clock}${offset}`)
    .filter(
      (candidate) =>
        isZonedDateTime(candidate) &&
        governingCalendarDate(candidate) === targetDay &&
        formatter.format(new Date(candidate)) === clock
    );
  // Ambiguous/nonexistent wall-clock times require an exact eligibility input.
  return candidates.length === 1 ? candidates[0] : null;
}

export function evaluateTradeAggregation(input: {
  path: string;
  outgoing: readonly {
    playerId: string | null;
    playerName: string;
    aggregationFacts?: unknown;
  }[];
  replacementCount: number;
  transactionDate: string;
  salaryCapYear: number;
  deadline: string | null;
  regularSeasonEnd: string | null;
}) {
  const violations: string[] = [];
  const missingInputs: string[] = [];
  if (
    !['AGGREGATED_STANDARD_TPE', 'EXPANDED_TPE'].includes(input.path) ||
    input.outgoing.length < 2
  )
    return { violations, missingInputs };
  const day = governingCalendarDate(input.transactionDate);
  if (!day)
    return { violations, missingInputs: ['aggregation.transactionDate'] };
  const minimumYear =
    input.regularSeasonEnd && day > input.regularSeasonEnd
      ? input.salaryCapYear + 1
      : input.salaryCapYear;
  const stackingTrigger =
    input.outgoing.length >= 3 &&
    input.replacementCount < input.outgoing.length;
  const inStackingWindow =
    input.deadline !== null &&
    day >= `${input.salaryCapYear - 1}-12-15` &&
    day <= input.deadline;
  let minimumCount = 0;
  let unknownMinimumCount = 0;
  for (const player of input.outgoing) {
    const parsed = TradeAggregationFactsZ.safeParse(player.aggregationFacts);
    const facts = parsed.success ? parsed.data : null;
    const acquisition = facts?.acquisition;
    if (!acquisition || acquisition.status === 'unknown') {
      missingInputs.push(
        `${player.playerName}: acquisition date and exception method (CBA2-A06.1)`
      );
    } else if (acquisition.status === 'baseline-assumption') {
      if (day < acquisition.asOfDate)
        missingInputs.push(
          `${player.playerName}: acquisition history before the starting world`
        );
    } else {
      const acquiredDay = governingCalendarDate(acquisition.acquiredAt)!;
      const exactComparison =
        isZonedDateTime(acquisition.acquiredAt) &&
        isZonedDateTime(input.transactionDate);
      if (
        acquiredDay > day ||
        (exactComparison &&
          Date.parse(acquisition.acquiredAt) >
            Date.parse(input.transactionDate))
      ) {
        missingInputs.push(
          `${player.playerName}: acquisition is later than this trade`
        );
      } else if (acquisition.viaException) {
        const end = twoCalendarMonthsAfter(acquisition.acquiredAt);
        const endDay = twoCalendarMonthsAfter(acquiredDay)!;
        const uncertainBoundary =
          end !== null &&
          !exactComparison &&
          (isZonedDateTime(acquisition.acquiredAt) ||
            isZonedDateTime(input.transactionDate)) &&
          day === governingCalendarDate(end);
        const stillRestricted =
          (end === null && day <= endDay) ||
          uncertainBoundary ||
          (end !== null &&
            (exactComparison
              ? Date.parse(input.transactionDate) < Date.parse(end)
              : day < endDay));
        if (stillRestricted) {
          // The December acquisition must belong to this same Salary Cap Year.
          const december16 = `${input.salaryCapYear - 1}-12-16`;
          const beforeDecember17 =
            acquiredDay >= `${input.salaryCapYear - 1}-07-01` &&
            acquiredDay <= december16;
          const dayBeforeDeadline = input.deadline
            ? new Date(Date.parse(input.deadline) - 86_400_000)
                .toISOString()
                .slice(0, 10)
            : null;
          if (beforeDecember17 && !dayBeforeDeadline) {
            missingInputs.push('aggregation.tradeDeadline (CBA2-A06.2)');
          } else if (
            !(beforeDecember17 && dayBeforeDeadline && day >= dayBeforeDeadline)
          ) {
            if (!end || uncertainBoundary)
              missingInputs.push(
                `${player.playerName}: exact two-month eligibility instant`
              );
            else
              violations.push(
                `${player.playerName} cannot be aggregated until ${end}: acquired with an exception within two calendar months (CBA2-A06.1). A solo re-trade is not barred by this rule.`
              );
          }
        }
      }
    }
    if (stackingTrigger && !inStackingWindow) {
      if (
        !facts ||
        facts.minimumSalaryCapYear !== minimumYear ||
        facts.minimumTradedPlayer === null
      )
        unknownMinimumCount++;
      else if (facts.minimumTradedPlayer) minimumCount++;
    }
  }
  if (stackingTrigger && !inStackingWindow) {
    if (!input.deadline || !input.regularSeasonEnd)
      missingInputs.push('aggregation.minimumStackingCalendar (CBA2-A06.3)');
    else if (minimumCount > 1)
      violations.push(
        `Only one Minimum Traded Player is allowed in this ${input.outgoing.length}-out/${input.replacementCount}-in aggregation outside December 15 through the deadline; classification uses ${minimumYear - 1}-${String(minimumYear).slice(-2)} (CBA2-A06.3).`
      );
    else if (minimumCount + unknownMinimumCount > 1)
      missingInputs.push(
        `Minimum Traded Player classification for ${minimumYear - 1}-${String(minimumYear).slice(-2)} (CBA2-A06.3)`
      );
  }
  return { violations, missingInputs: [...new Set(missingInputs)] };
}

/** Latest saved acquisition wins, including a return to the original team. */
export function contractAggregationFacts(input: {
  state: GovernedContractState;
  teamId: string;
  asOfDate: string;
  salaryCapYear: number;
  regularSeasonEnd: string;
  history?: unknown;
}): TradeAggregationFacts {
  const { state, teamId, asOfDate, salaryCapYear } = input;
  const minimumSalaryCapYear =
    asOfDate > input.regularSeasonEnd ? salaryCapYear + 1 : salaryCapYear;
  const season = `${minimumSalaryCapYear - 1}-${String(minimumSalaryCapYear).slice(-2)}`;
  const row = state.terms.salaries.find(
    (r) => r.season === season && r.voidedByExtension !== true
  );
  // The retained Minimum signing method establishes minimum compensation in
  // each covered season (C13.22). It does not classify other signing methods.
  // A current-season minimum is never substituted for a missing next-year row.
  let minimumTradedPlayer =
    row &&
    /^minimum(?: player salary)?(?: exception)?$/i.test(
      state.terms.signedUsing ?? ''
    )
      ? true
      : null;
  const evidence = GovernedTradeSalaryBasisEvidenceZ.safeParse(
    state.terms.tradeSalaryBasisEvidence
  );
  const startYear = toEndYear(state.terms.startSeason);
  const cells = evidence.success
    ? (evidence.data.minimumSalaryAmounts?.filter(
        (cell) =>
          cell.salaryCapYear === minimumSalaryCapYear &&
          cell.contractStartSalaryCapYear === startYear &&
          cell.contractYear ===
            minimumSalaryCapYear - cell.contractStartSalaryCapYear + 1
      ) ?? [])
    : [];
  // The retained cell includes that season's service value. An unseasoned
  // Bird-rights service count must not stand in for next season's input.
  if (row && cells.length === 1 && row.salary !== null) {
    const exactMinimum = row.salary === cells[0].amount;
    // Conflicting retained Minimum terms are not affirmative nonminimum proof.
    minimumTradedPlayer =
      minimumTradedPlayer === true && !exactMinimum ? null : exactMinimum;
  }
  let acquisition: TradeAggregationFacts['acquisition'] = { status: 'unknown' };
  const parsed = TradeAcquisitionHistoryZ.safeParse(input.history);
  if (
    parsed.success &&
    parsed.data.entries.every((entry) => entry.teamCode === teamId)
  ) {
    const latest = parsed.data.entries
      .filter((entry) => entry.playerId === state.playerId)
      .at(-1);
    if (latest)
      acquisition = {
        status: 'known',
        acquiredAt: latest.acquiredAt,
        viaException: latest.viaException,
      };
    else if (
      parsed.data.baseline?.playerIds.includes(state.playerId) &&
      // Retained scraper polarity: true = may aggregate; false comes from
      // explicit "cannot be aggregated" text (parse_player.ts).
      state.terms.restrictions.aggregation !== false &&
      asOfDate >= parsed.data.baseline.asOfDate
    ) {
      acquisition = {
        status: 'baseline-assumption',
        asOfDate: parsed.data.baseline.asOfDate,
      };
    }
  }
  // A current Contract's known signing can be newer than the team's last
  // trade acquisition. It does not require starting-roster membership.
  // Do not use it to bypass malformed history or an explicit source restriction.
  const signed = state.terms.signingDate.value;
  const historyUsable =
    input.history == null ||
    (parsed.success &&
      parsed.data.entries.every((entry) => entry.teamCode === teamId));
  if (
    historyUsable &&
    state.terms.restrictions.aggregation !== false &&
    state.terms.signingTeam === teamId &&
    signed &&
    (isDateOnly(signed) || isZonedDateTime(signed))
  ) {
    const viaException = !/^(?:(?:cap )?space|room)$/i.test(
      state.terms.signedUsing ?? ''
    );
    const signedDay = governingCalendarDate(signed)!;
    const tradeDay =
      acquisition.status === 'known'
        ? governingCalendarDate(acquisition.acquiredAt)!
        : null;
    const exact =
      acquisition.status === 'known' &&
      isZonedDateTime(signed) &&
      isZonedDateTime(acquisition.acquiredAt);
    if (
      acquisition.status !== 'known' ||
      signedDay > tradeDay! ||
      (exact && Date.parse(signed) > Date.parse(acquisition.acquiredAt))
    ) {
      acquisition = { status: 'known', acquiredAt: signed, viaException };
    } else if (
      !exact &&
      signedDay === tradeDay &&
      viaException !== acquisition.viaException
    ) {
      // Date-only facts cannot order different acquisition methods on one day.
      acquisition = { status: 'unknown' };
    }
  }
  return { acquisition, minimumSalaryCapYear, minimumTradedPlayer };
}
