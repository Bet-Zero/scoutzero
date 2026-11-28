import { minimumSigningSeasonDays } from './minimumSigningProration';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import {
  CANON_GOVERNED_SEASON_REGISTRY,
  resolveGovernedSeasonEnvelope,
} from '@/features/architect/utils/governedSeason';
import { simulationTradeDeadline } from '@/features/architect/utils/governedSeason/simulationTradeDeadline';
import { normalizeSalaryBookAsOfDate } from '@/features/architect/utils/capTotals';
import {
  governingCalendarDate,
  isDateOnly,
  isDateOnlyWithinSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
} from '@/features/architect/utils/governedSeason/governedTime';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import type {
  ArchitectMutationContract,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline.types';

const GOVERNED_SIGNING_BASE_CANON_LEAVES = Object.freeze([
  'CBA2-L01.1',
  'CBA2-L01.3',
  'CBA2-C04.1',
  'CBA2-C04.2',
  'CBA2-C04.3',
  'CBA2-C13.19',
  'CBA2-C13.20',
  'CBA2-L02.1',
]);

const METHOD_CANON_LEAVES: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    CAP_SPACE_OR_RIGHTS: Object.freeze([]),
    MINIMUM: Object.freeze([
      'CBA2-C13.4',
      'CBA2-C13.6',
      'CBA2-C13.21',
      'CBA2-C13.22',
      'CBA2-C13.23',
    ]),
    FULL_MLE: Object.freeze([
      'CBA2-C13.8',
      'CBA2-C13.9',
      'CBA2-C13.35',
      'CBA2-C13.37',
      'CBA2-C13.38',
      'CBA2-C13.39',
    ]),
    TPMLE: Object.freeze([
      'CBA2-C13.10',
      'CBA2-C13.11',
      'CBA2-C13.24',
      'CBA2-C13.25',
      'CBA2-C13.26',
      'CBA2-A05.13',
      'CBA2-A05.14',
    ]),
    ROOM_MLE: Object.freeze([
      'CBA2-C13.12',
      'CBA2-C13.27',
      'CBA2-C13.28',
      'CBA2-C13.29',
      'CBA2-C13.30',
      'CBA2-C13.40',
    ]),
    BAE: Object.freeze([
      'CBA2-C13.13',
      'CBA2-C13.14',
      'CBA2-C13.31',
      'CBA2-C13.32',
      'CBA2-C13.33',
      'CBA2-C13.34',
    ]),
  });

export type GovernedSigningAuthority = Readonly<{
  worldDate: string;
  effectiveAt: string;
  salaryCapYear: number;
  seasonKey: string;
  firstYearSalary: number;
  firstYearCapHit: number;
  exceptionCharge: number;
  january10UnusedAmount?: number;
  canonLeafIds: readonly string[];
  seasonInputManifest: NonNullable<
    ReturnType<typeof resolveGovernedSeasonEnvelope>['inputManifest']
  >;
}>;

const datePart = (value: string) => value.slice(0, 10);

/** Reuse the accepted BZE-285 saved-world normalization; never consult runtime time. */
export function signingEventInstant(worldDate: string): string | null {
  return normalizeSalaryBookAsOfDate(worldDate);
}

function exactMoney(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** Existing ordinary signing routes pause where the conservative authority lacks proration. */
export function ordinarySigningProrationUnavailable(
  date: string,
  salaryCapYear: number,
  mechanism: string
): string | null {
  if (
    mechanism === 'MINIMUM' &&
    date >= `${salaryCapYear - 1}-10-01` &&
    !minimumSigningSeasonDays(date, salaryCapYear)
  ) {
    return (
      'This Regular Season Minimum signing needs the exact Regular Season-day proration record.'
    );
  }
  return null;
}

/**
 * Ordinary signing uses the dated allowance under CBA2-C13.3 and C13.5.
 * The nominal balance remains the shared owner for other acquisition paths.
 */
export function resolveOrdinaryExceptionSigningProration(
  team: Parameters<typeof getCanonicalExceptionAvailability>[0],
  mechanism: string,
  worldDate: string | null | undefined,
  salaryCapYear: number
): {
  remaining: number;
  january10UnusedAmount?: number;
  tradeDeadlineDate: string;
} | { reason: string } | null {
  const key = getCanonicalExceptionKeyForSigningMechanism(mechanism);
  const date = governingCalendarDate(worldDate);
  const cutoff = `${salaryCapYear}-01-10`;
  if (!key || !date || date < cutoff) return null;
  const days = minimumSigningSeasonDays(date, salaryCapYear);
  const deadline = simulationTradeDeadline(salaryCapYear);
  const balance = getCanonicalExceptionAvailability(team, key);
  if (!days) {
    const closing = CANON_GOVERNED_SEASON_REGISTRY.calendars.find(
      (entry) => entry.salaryCapYear === salaryCapYear && entry.authority === 'official'
    )?.regularSeasonClosing.value;
    return {
      reason: closing && date > closing
        ? `Dated exception signings are supported through ${closing}, the end of the regular season.`
        : 'The signing allowance needs a confirmed regular-season calendar for this date.',
    };
  }
  if (!deadline) {
    return { reason: 'The signing allowance needs the confirmed trade deadline for this season.' };
  }
  if (!balance.entry) {
    return { reason: 'The saved team has no balance recorded for the selected signing exception.' };
  }
  if (!balance.enabled) {
    return { reason: 'The selected signing exception is unavailable to this team. Choose an available signing method.' };
  }
  const lastUse = governingCalendarDate(balance.entry.lastUsedAt);
  const retained =
    balance.entry.january10Proration?.salaryCapYear === salaryCapYear
      ? balance.entry.january10Proration.unusedAmount
      : undefined;
  const january10UnusedAmount = retained ?? (
    balance.usedAmount === 0 || (lastUse && lastUse <= cutoff)
      ? balance.remainingAmount
      : null
  );
  const hasJanuaryBasis =
    january10UnusedAmount !== null &&
    Number.isSafeInteger(january10UnusedAmount) &&
    january10UnusedAmount >= balance.remainingAmount &&
    january10UnusedAmount <= balance.totalAmount;
  if (lastUse && lastUse > date) {
    return { reason: 'The saved exception has spending dated after this signing.' };
  }

  // The date-only world convention treats the deadline day as in-window.
  const afterDeadline = date > deadline.date || (
    date === deadline.date && isZonedDateTime(worldDate) &&
    Date.parse(worldDate) > Date.parse(deadline.instant)
  );
  if (!afterDeadline) {
    return {
      remaining: balance.remainingAmount,
      tradeDeadlineDate: deadline.date,
      ...(hasJanuaryBasis ? { january10UnusedAmount } : {}),
    };
  }
  if (!hasJanuaryBasis) {
    return { reason: 'This signing needs the unused January 10 exception balance.' };
  }

  // January 11 completes the first reduction day under CBA2-C13.3.
  const elapsed = (Date.parse(date) - Date.parse(cutoff)) / 86_400_000;
  return {
    remaining: Math.max(0, Math.floor(balance.remainingAmount - january10UnusedAmount * elapsed / days.total)),
    january10UnusedAmount,
    tradeDeadlineDate: deadline.date,
  };
}

export function resolveGovernedSigningAuthority({
  team,
  contract,
  mechanism,
  worldDate,
  salaryCapYear,
}: {
  team: ArchitectMutationTeamRecord;
  contract: ArchitectMutationContract | null | undefined;
  mechanism: string;
  worldDate: string | null | undefined;
  salaryCapYear: number;
}):
  | { status: 'complete'; authority: GovernedSigningAuthority }
  | { status: 'needs-input' | 'blocked'; reasons: readonly string[] } {
  const reasons: string[] = [];
  const exactDate =
    typeof worldDate === 'string' &&
    (isDateOnly(worldDate) || isZonedDateTime(worldDate))
      ? worldDate
      : null;
  const effectiveAt = exactDate ? signingEventInstant(exactDate) : null;
  if (!exactDate || !effectiveAt) {
    reasons.push(
      'Signing requires an exact saved-world date; runtime-clock fallback is not permitted.'
    );
  } else if (
    !(isDateOnly(exactDate)
      ? isDateOnlyWithinSalaryCapYear(exactDate, salaryCapYear)
      : isWithinSalaryCapYear(exactDate, salaryCapYear))
  ) {
    reasons.push('The saved-world date and Salary Cap Year do not agree.');
  }

  const rows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const years = Number(
    contract?.contractYears ?? contract?.years ?? rows.length
  );
  if (!Number.isInteger(years) || years < 1 || rows.length !== years) {
    reasons.push('Contract length and exact annual salary rows must agree.');
  }
  rows.forEach((row, index) => {
    if (row.season !== toSeasonCode(salaryCapYear + index)) {
      reasons.push(
        `Salary row ${index + 1} is assigned to the wrong Contract Season.`
      );
    }
    if (exactMoney(row.salary) === null || exactMoney(row.capHit) === null) {
      reasons.push(
        `Salary row ${index + 1} needs exact whole-dollar Salary and Cap Hit.`
      );
    }
  });
  const firstYearSalary = exactMoney(rows[0]?.salary);
  const firstYearCapHit = exactMoney(rows[0]?.capHit);
  const totalSalary = rows.reduce(
    (sum, row) => sum + (exactMoney(row.salary) ?? 0),
    0
  );
  if (
    contract?.totalValue != null &&
    exactMoney(contract.totalValue) !== totalSalary
  ) {
    reasons.push('Contract total value conflicts with its annual Salary rows.');
  }
  if (!(mechanism in METHOD_CANON_LEAVES)) {
    reasons.push(
      mechanism === 'CONFLICT'
        ? 'The selected signing route conflicts with the Contract signing route.'
        : 'The selected compensation route is unsupported for ordinary signings. Choose a supported signing method.'
    );
  }

  const contractType = String(contract?.contractType || '').toLowerCase();
  const date = exactDate ? datePart(exactDate) : '';
  const moratoriumEndDate = `${salaryCapYear - 1}-07-07`;
  const moratoriumException =
    mechanism === 'MINIMUM' ||
    contractType === 'two-way' ||
    contractType === 'twoway' ||
    contract?.isRookieScale === true;
  if (date && date <= moratoriumEndDate && !moratoriumException) {
    reasons.push(
      'This signing method is closed during the July Moratorium. Choose an eligible Moratorium method or a lawful signing date.'
    );
  }
  const unavailableRoute = ordinarySigningProrationUnavailable(
    date,
    salaryCapYear,
    mechanism
  );
  if (unavailableRoute) reasons.push(unavailableRoute);
  const exceptionProration = resolveOrdinaryExceptionSigningProration(
    team,
    mechanism,
    exactDate,
    salaryCapYear
  );
  if (exceptionProration && 'reason' in exceptionProration) {
    reasons.push(exceptionProration.reason);
  }
  if (
    years > 1 &&
    ((mechanism === 'MINIMUM' &&
      minimumSigningSeasonDays(exactDate, salaryCapYear)?.inRegularSeason) ||
      (exceptionProration && 'remaining' in exceptionProration))
  ) {
    reasons.push(
      'This prorated signing with future years needs governed Contract terms for those seasons.'
    );
  }

  const envelope = effectiveAt
    ? resolveGovernedSeasonEnvelope({
        asOfDate: effectiveAt,
        salaryCapYear,
        requiredAuthority: 'official',
        team: {
          teamId: String(team.teamCode || ''),
          teamCode: String(team.teamCode || ''),
        },
      })
    : null;
  if (!envelope || envelope.status !== 'complete' || !envelope.inputManifest) {
    reasons.push(
      envelope?.unavailableReasons[0] ||
        'Official governed season and calendar inputs are unavailable.'
    );
  }

  if (reasons.length || firstYearSalary === null || firstYearCapHit === null) {
    return {
      status: 'needs-input',
      reasons: Object.freeze([...new Set(reasons)]),
    };
  }
  if (
    exceptionProration &&
    'remaining' in exceptionProration &&
    firstYearSalary > exceptionProration.remaining
  ) {
    return {
      status: 'blocked',
      reasons: [
        `The first-year salary exceeds the dated signing exception balance of $${exceptionProration.remaining.toLocaleString('en-US')}.`,
      ],
    };
  }
  return {
    status: 'complete',
    authority: Object.freeze({
      worldDate: exactDate!,
      effectiveAt: effectiveAt!,
      salaryCapYear,
      seasonKey: toSeasonCode(salaryCapYear),
      firstYearSalary,
      firstYearCapHit,
      exceptionCharge: firstYearSalary,
      ...(exceptionProration && 'remaining' in exceptionProration && exceptionProration.january10UnusedAmount !== undefined
        ? { january10UnusedAmount: exceptionProration.january10UnusedAmount }
        : {}),
      canonLeafIds: Object.freeze([
        ...GOVERNED_SIGNING_BASE_CANON_LEAVES,
        ...(METHOD_CANON_LEAVES[mechanism] || []),
        ...(exceptionProration ? ['CBA2-C13.3', 'CBA2-C13.5'] : []),
      ]),
      seasonInputManifest: envelope!.inputManifest!,
    }),
  };
}
