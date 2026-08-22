import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';
import { normalizeSalaryBookAsOfDate } from '@/features/architect/utils/capTotals';
import {
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
  | { status: 'needs-input'; reasons: readonly string[] } {
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
        : 'Signing requires one supported, explicit compensation route.'
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
      'This ordinary signing is inside the Moratorium and does not identify an enumerated signing branch.'
    );
  }
  if (
    date >= `${salaryCapYear}-01-10` &&
    ['FULL_MLE', 'TPMLE', 'ROOM_MLE', 'BAE'].includes(mechanism)
  ) {
    reasons.push(
      'This post-January 10 exception signing needs the January 10 unused amount and exact daily-proration record.'
    );
  }
  if (date >= `${salaryCapYear - 1}-10-01` && mechanism === 'MINIMUM') {
    reasons.push(
      'This Regular Season Minimum signing needs the exact Regular Season-day proration record.'
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
      canonLeafIds: Object.freeze([
        ...GOVERNED_SIGNING_BASE_CANON_LEAVES,
        ...(METHOD_CANON_LEAVES[mechanism] || []),
      ]),
      seasonInputManifest: envelope!.inputManifest!,
    }),
  };
}
