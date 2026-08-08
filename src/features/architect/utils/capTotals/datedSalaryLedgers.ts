/**
 * FILE: src/features/architect/utils/capTotals/datedSalaryLedgers.ts
 * PURPOSE: Governed, dated spine for independent Team, Apron, and Tax Salary ledgers.
 * OWNERSHIP: Feature: architect/cap totals
 *
 * BZE-268 intentionally stops at the ledger boundary. Callers must supply
 * independently derived line items for each ledger; this module does not infer
 * missing CBA adjustments, borrow another ledger's total, or fall back to the
 * runtime date or a different Salary Cap Year.
 */

export const SALARY_LEDGER_KINDS = [
  'team-salary',
  'apron-team-salary',
  'tax-salary',
] as const;

const SALARY_LEDGER_SOURCE_AUTHORITIES = [
  'canon',
  'team-state',
  'external-determination',
] as const;

export type SalaryLedgerKind = (typeof SALARY_LEDGER_KINDS)[number];
export type SalaryLedgerStatus = 'complete' | 'needs-input' | 'not-evaluated';
type SalaryLedgerSourceAuthority =
  (typeof SALARY_LEDGER_SOURCE_AUTHORITIES)[number];

export interface SalaryLedgerTeamContext {
  teamId: string;
  teamCode?: string;
}

export interface DatedSalaryLedgerContext {
  /** ISO-8601 date/time with an explicit Z or UTC offset. */
  asOfDate: string;
  /** End year of the Salary Cap Year, e.g. 2026 for 2025-26. */
  salaryCapYear: number;
  team: SalaryLedgerTeamContext;
}

export interface SalaryLedgerLineItem<K extends SalaryLedgerKind> {
  id: string;
  ledger: K;
  label: string;
  /** Signed dollars: additions are positive and subtractions are negative. */
  amount: number;
  /** Inclusive effective instant. */
  effectiveFrom: string;
  /** Exclusive effective instant. Omit for an open-ended line. */
  effectiveUntil?: string | null;
  canonLeafIds: readonly string[];
  source: {
    authority: SalaryLedgerSourceAuthority;
    reference: string;
  };
}

export type SalaryLedgerInput<K extends SalaryLedgerKind> =
  | {
      status: 'ready';
      lineItems: readonly SalaryLedgerLineItem<K>[];
    }
  | {
      status: 'needs-input';
      missingInputs: readonly string[];
      reason: string;
    }
  | {
      status: 'not-evaluated';
      reason: string;
    };

export type EvaluatedSalaryLedgerLineItem<K extends SalaryLedgerKind> =
  SalaryLedgerLineItem<K> & {
    included: boolean;
    exclusionReason: 'not-yet-effective' | 'no-longer-effective' | null;
  };

export type SalaryLedgerResult<K extends SalaryLedgerKind> =
  | {
      kind: K;
      status: 'complete';
      total: number;
      lineItems: EvaluatedSalaryLedgerLineItem<K>[];
    }
  | {
      kind: K;
      status: 'needs-input';
      total: null;
      lineItems: [];
      missingInputs: string[];
      reason: string;
    }
  | {
      kind: K;
      status: 'not-evaluated';
      total: null;
      lineItems: [];
      reason: string;
    };

export interface DatedSalaryLedgerRequest {
  context?: Partial<DatedSalaryLedgerContext> | null;
  ledgers?: {
    teamSalary?: SalaryLedgerInput<'team-salary'>;
    apronTeamSalary?: SalaryLedgerInput<'apron-team-salary'>;
    taxSalary?: SalaryLedgerInput<'tax-salary'>;
  } | null;
}

export interface DatedSalaryLedgerEvaluation {
  status: SalaryLedgerStatus;
  context: DatedSalaryLedgerContext | null;
  ledgers: {
    teamSalary: SalaryLedgerResult<'team-salary'>;
    apronTeamSalary: SalaryLedgerResult<'apron-team-salary'>;
    taxSalary: SalaryLedgerResult<'tax-salary'>;
  };
}

/**
 * Request property name that owns each ledger kind. Missing-input paths are
 * built from this map so a caller can navigate a returned path directly on the
 * request object. Typing it against the request interface makes the two drift
 * apart a compile error rather than a silently unnavigable path.
 */
const SALARY_LEDGER_REQUEST_KEYS: Record<
  SalaryLedgerKind,
  keyof NonNullable<DatedSalaryLedgerRequest['ledgers']>
> = {
  'team-salary': 'teamSalary',
  'apron-team-salary': 'apronTeamSalary',
  'tax-salary': 'taxSalary',
};

function ledgerRequestPath(kind: SalaryLedgerKind): string {
  return `ledgers.${SALARY_LEDGER_REQUEST_KEYS[kind]}`;
}

const ZONED_ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

function isZonedDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    ZONED_ISO_DATE_TIME.test(value) &&
    hasValidCalendarDate(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isSalaryLedgerSourceAuthority(
  value: unknown
): value is SalaryLedgerSourceAuthority {
  return SALARY_LEDGER_SOURCE_AUTHORITIES.some(
    (authority) => authority === value
  );
}

function resolveContext(
  context: DatedSalaryLedgerRequest['context']
):
  | { context: DatedSalaryLedgerContext; missingInputs: [] }
  | { context: null; missingInputs: string[] } {
  const missingInputs: string[] = [];

  if (!isZonedDateTime(context?.asOfDate)) {
    missingInputs.push('context.asOfDate');
  }
  if (!Number.isInteger(context?.salaryCapYear)) {
    missingInputs.push('context.salaryCapYear');
  }
  if (!isNonEmptyString(context?.team?.teamId)) {
    missingInputs.push('context.team.teamId');
  }

  if (missingInputs.length > 0) {
    return { context: null, missingInputs };
  }

  const teamCode = isNonEmptyString(context?.team?.teamCode)
    ? context.team.teamCode.trim()
    : undefined;

  return {
    context: {
      asOfDate: context!.asOfDate!,
      salaryCapYear: context!.salaryCapYear!,
      team: {
        teamId: context!.team!.teamId!.trim(),
        ...(teamCode ? { teamCode } : {}),
      },
    },
    missingInputs: [],
  };
}

function validateLineItems<K extends SalaryLedgerKind>(
  kind: K,
  lineItems: readonly SalaryLedgerLineItem<K>[]
): string[] {
  const missingInputs: string[] = [];
  const seenIds = new Set<string>();
  const ledgerPath = ledgerRequestPath(kind);

  lineItems.forEach((item, index) => {
    const path = `${ledgerPath}.lineItems[${index}]`;
    if (!isNonEmptyString(item.id) || seenIds.has(item.id)) {
      missingInputs.push(`${path}.id`);
    } else {
      seenIds.add(item.id);
    }
    if (item.ledger !== kind) missingInputs.push(`${path}.ledger`);
    if (!isNonEmptyString(item.label)) missingInputs.push(`${path}.label`);
    if (!Number.isFinite(item.amount)) missingInputs.push(`${path}.amount`);
    if (!isZonedDateTime(item.effectiveFrom)) {
      missingInputs.push(`${path}.effectiveFrom`);
    }
    if (item.effectiveUntil != null && !isZonedDateTime(item.effectiveUntil)) {
      missingInputs.push(`${path}.effectiveUntil`);
    }
    if (
      isZonedDateTime(item.effectiveFrom) &&
      isZonedDateTime(item.effectiveUntil) &&
      Date.parse(item.effectiveUntil) <= Date.parse(item.effectiveFrom)
    ) {
      missingInputs.push(`${path}.effectiveUntil`);
    }
    if (
      !Array.isArray(item.canonLeafIds) ||
      item.canonLeafIds.length === 0 ||
      item.canonLeafIds.some((leafId) => !isNonEmptyString(leafId))
    ) {
      missingInputs.push(`${path}.canonLeafIds`);
    }
    if (!isSalaryLedgerSourceAuthority(item.source?.authority)) {
      missingInputs.push(`${path}.source.authority`);
    }
    if (!isNonEmptyString(item.source?.reference)) {
      missingInputs.push(`${path}.source.reference`);
    }
  });

  return missingInputs;
}

function incompleteLedger<K extends SalaryLedgerKind>(
  kind: K,
  missingInputs: readonly string[],
  reason: string
): SalaryLedgerResult<K> {
  return {
    kind,
    status: 'needs-input',
    total: null,
    lineItems: [],
    missingInputs: [...missingInputs],
    reason,
  };
}

function evaluateLedger<K extends SalaryLedgerKind>(
  kind: K,
  asOfDate: string,
  input: SalaryLedgerInput<K> | undefined
): SalaryLedgerResult<K> {
  const ledgerPath = ledgerRequestPath(kind);

  if (!input) {
    return incompleteLedger(
      kind,
      [ledgerPath],
      `No ${kind} input was supplied.`
    );
  }
  if (input.status === 'needs-input') {
    return incompleteLedger(kind, input.missingInputs, input.reason);
  }
  if (input.status === 'not-evaluated') {
    return {
      kind,
      status: 'not-evaluated',
      total: null,
      lineItems: [],
      reason: input.reason,
    };
  }

  // A ready ledger with nothing in it is unevaluated input, not a $0 total.
  // A real zero must be carried by an evidenced zero-dollar line item so the
  // amount keeps its own Canon traceability and source authority.
  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
    return incompleteLedger(
      kind,
      [`${ledgerPath}.lineItems`],
      `The ${kind} ledger was marked ready with no line items; a zero total must be supplied as an evidenced zero-dollar line item.`
    );
  }

  const missingInputs = validateLineItems(kind, input.lineItems);
  if (missingInputs.length > 0) {
    return incompleteLedger(
      kind,
      missingInputs,
      `The ${kind} line items are incomplete or invalid.`
    );
  }

  const asOfTime = Date.parse(asOfDate);
  const lineItems = input.lineItems.map((item) => {
    const effectiveFrom = Date.parse(item.effectiveFrom);
    const effectiveUntil = item.effectiveUntil
      ? Date.parse(item.effectiveUntil)
      : null;
    const exclusionReason: EvaluatedSalaryLedgerLineItem<K>['exclusionReason'] =
      asOfTime < effectiveFrom
        ? 'not-yet-effective'
        : effectiveUntil != null && asOfTime >= effectiveUntil
          ? 'no-longer-effective'
          : null;

    return {
      ...item,
      canonLeafIds: [...item.canonLeafIds],
      source: { ...item.source },
      included: exclusionReason === null,
      exclusionReason,
    };
  });

  return {
    kind,
    status: 'complete',
    total: lineItems.reduce(
      (sum, lineItem) => sum + (lineItem.included ? lineItem.amount : 0),
      0
    ),
    lineItems,
  };
}

function aggregateStatus(
  results: readonly SalaryLedgerResult<SalaryLedgerKind>[]
): SalaryLedgerStatus {
  if (results.some((result) => result.status === 'needs-input')) {
    return 'needs-input';
  }
  if (results.some((result) => result.status === 'not-evaluated')) {
    return 'not-evaluated';
  }
  return 'complete';
}

/**
 * Evaluate the three salary meanings without substituting one for another.
 * Missing governed context makes every ledger unavailable; no runtime or
 * season fallback is consulted.
 */
export function evaluateDatedSalaryLedgers(
  request: DatedSalaryLedgerRequest
): DatedSalaryLedgerEvaluation {
  const contextResult = resolveContext(request.context);
  if (!contextResult.context) {
    const reason =
      'Dated salary ledgers require an explicit zoned asOfDate, Salary Cap Year, and team.';
    const ledgers = {
      teamSalary: incompleteLedger(
        'team-salary',
        contextResult.missingInputs,
        reason
      ),
      apronTeamSalary: incompleteLedger(
        'apron-team-salary',
        contextResult.missingInputs,
        reason
      ),
      taxSalary: incompleteLedger(
        'tax-salary',
        contextResult.missingInputs,
        reason
      ),
    };

    return { status: 'needs-input', context: null, ledgers };
  }

  const ledgers = {
    teamSalary: evaluateLedger(
      'team-salary',
      contextResult.context.asOfDate,
      request.ledgers?.teamSalary
    ),
    apronTeamSalary: evaluateLedger(
      'apron-team-salary',
      contextResult.context.asOfDate,
      request.ledgers?.apronTeamSalary
    ),
    taxSalary: evaluateLedger(
      'tax-salary',
      contextResult.context.asOfDate,
      request.ledgers?.taxSalary
    ),
  };

  return {
    status: aggregateStatus(Object.values(ledgers)),
    context: contextResult.context,
    ledgers,
  };
}
