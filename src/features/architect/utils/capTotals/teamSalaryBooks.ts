import {
  SalaryBooksSnapshotZ,
  TeamSalaryBookInputsZ,
} from '@/schemas/salaryBooks';
import type { SalaryBooksSnapshot } from '@/schemas/salaryBooks';
import { evaluateGovernedDatedSalaryLedgers } from './governedDatedSalaryLedgers';
import type {
  SalaryLedgerInput,
  SalaryLedgerKind,
  SalaryLedgerLineItem,
} from './datedSalaryLedgers';
import { evaluateDatedSalaryLedgers } from './datedSalaryLedgers';
import type { IncompleteRosterResolution } from './governedIncompleteRosterCharge';

type UnknownRecord = Record<string, unknown>;

export const APRON_SALARY_ADJUSTMENT_LEAVES = Object.freeze([
  'CBA2-C07.2',
  'CBA2-C07.3',
  'CBA2-C07.4',
  'CBA2-C07.5',
  'CBA2-C07.6',
  'CBA2-C07.7',
  'CBA2-C07.8',
  'CBA2-C07.9',
  'CBA2-C07.10',
  'CBA2-C07.11',
]);

export const TAX_SALARY_LEAVES = Object.freeze([
  'CBA2-C08.1',
  'CBA2-C08.2',
  'CBA2-C08.3',
  'CBA2-C08.4',
  'CBA2-C08.5',
  'CBA2-C08.6',
  'CBA2-C08.7',
  'CBA2-C08.8',
]);

interface TeamSalaryBookTeamLike extends UnknownRecord {
  id?: unknown;
  teamId?: unknown;
  teamCode?: unknown;
  salaryBookInputs?: unknown;
}

export interface TeamSalaryBookComponentTotals {
  playersTotal: number;
  deadMoneyTotal: number;
  capHoldsTotal: number;
  incompleteChargesTotal: number;
  incompleteRosterResolution?: IncompleteRosterResolution;
  outstandingOfferSheetTotal?: number;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isValidCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function normalizeSalaryBookAsOfDate(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isValidCalendarDate(value) ? `${value}T00:00:00Z` : null;
  }
  return isValidCalendarDate(value.slice(0, 10)) &&
    /(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function requiredLeafCoverage<K extends SalaryLedgerKind>(
  input: SalaryLedgerInput<K>,
  requiredLeaves: readonly string[],
  path: string
): SalaryLedgerInput<K> {
  if (input.status !== 'ready') return input;
  const covered = new Set(
    input.lineItems.flatMap((lineItem) => lineItem.canonLeafIds)
  );
  const missing = requiredLeaves.filter((leafId) => !covered.has(leafId));
  if (missing.length === 0) return input;
  return {
    status: 'needs-input',
    missingInputs: missing.map((leafId) => `${path}.${leafId}`),
    reason: `${path} does not evidence every required governed adjustment.`,
  };
}

const NONNEGATIVE_ADJUSTMENT_LEAVES = new Set([
  'CBA2-C07.2',
  'CBA2-C07.3',
  'CBA2-C07.4',
  'CBA2-C07.6',
  'CBA2-C07.8',
  'CBA2-C07.10',
  'CBA2-C08.1',
  'CBA2-C08.4',
  'CBA2-C08.7',
]);

const NONPOSITIVE_ADJUSTMENT_LEAVES = new Set([
  'CBA2-C07.5',
  'CBA2-C07.7',
  'CBA2-C07.9',
  'CBA2-C07.11',
  'CBA2-C08.3',
  'CBA2-C08.8',
]);

function validateAdjustmentDirections<K extends SalaryLedgerKind>(
  input: SalaryLedgerInput<K>,
  path: string
): SalaryLedgerInput<K> {
  if (input.status !== 'ready') return input;
  const invalid: string[] = [];
  input.lineItems.forEach((lineItem, index) => {
    lineItem.canonLeafIds.forEach((leafId) => {
      if (
        (NONNEGATIVE_ADJUSTMENT_LEAVES.has(leafId) && lineItem.amount < 0) ||
        (NONPOSITIVE_ADJUSTMENT_LEAVES.has(leafId) && lineItem.amount > 0)
      ) {
        invalid.push(`${path}.lineItems[${index}].amount`);
      }
    });
  });
  return invalid.length === 0
    ? input
    : {
        status: 'needs-input',
        missingInputs: invalid,
        reason: `${path} contains a signed adjustment that conflicts with its governed book rule.`,
      };
}

function validateTaxBaseline(
  input: SalaryLedgerInput<'tax-salary'>,
  asOfDate: string | null
): SalaryLedgerInput<'tax-salary'> {
  if (input.status !== 'ready') return input;
  const baselineRows = input.lineItems.filter((lineItem) =>
    lineItem.canonLeafIds.includes('CBA2-C08.1')
  );
  if (baselineRows.length !== 1) {
    return {
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.taxSalary.baseline'],
      reason:
        'Tax Salary requires exactly one governed start-of-last-Regular-Season-game baseline.',
    };
  }
  const baselineAt = Date.parse(baselineRows[0].effectiveFrom);
  if (!asOfDate || !Number.isFinite(baselineAt)) return input;
  if (Date.parse(asOfDate) < baselineAt) {
    return {
      status: 'not-evaluated',
      reason:
        'Tax Salary is not evaluated before the governed last-Regular-Season-game baseline instant.',
    };
  }
  const hasPreBaselineAdjustment = input.lineItems.some(
    (lineItem) =>
      !lineItem.canonLeafIds.includes('CBA2-C08.1') &&
      Date.parse(lineItem.effectiveFrom) < baselineAt
  );
  if (hasPreBaselineAdjustment) {
    return {
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.taxSalary.adjustments.effectiveFrom'],
      reason:
        'Tax Salary contains an adjustment dated before its governed baseline.',
    };
  }
  return input;
}

function teamSalaryInput(
  totals: TeamSalaryBookComponentTotals,
  asOfDate: string | null,
  teamId: string | null,
  incompleteRosterCharge: SalaryLedgerLineItem<SalaryLedgerKind> | undefined
): SalaryLedgerInput<'team-salary'> {
  if (!asOfDate || !teamId) {
    return {
      status: 'needs-input',
      missingInputs: [
        ...(!asOfDate ? ['context.asOfDate'] : []),
        ...(!teamId ? ['context.team.teamId'] : []),
      ],
      reason: 'Team Salary requires the saved-world date and team identity.',
    };
  }

  if (!totals.incompleteRosterResolution) {
    return {
      status: 'needs-input',
      missingInputs: ['totals.incompleteRosterResolution'],
      reason: 'Team Salary requires the governed incomplete-roster result.',
    };
  }
  if (totals.incompleteRosterResolution.status !== 'complete') {
    return {
      status: 'needs-input',
      missingInputs: totals.incompleteRosterResolution.missingInputs,
      reason: totals.incompleteRosterResolution.reason,
    };
  }
  if (
    totals.incompleteRosterResolution.mode === 'legacy-compatibility' &&
    totals.incompleteChargesTotal > 0 &&
    !incompleteRosterCharge
  ) {
    return {
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.incompleteRosterCharge'],
      reason:
        'The legacy roster is short of its compatibility threshold, but no dated compatibility input is available.',
    };
  }

  const component = (
    id: string,
    label: string,
    amount: number,
    reference: string
  ): SalaryLedgerLineItem<'team-salary'> => ({
    id: `team-salary:${teamId}:${id}`,
    ledger: 'team-salary',
    label,
    amount,
    effectiveFrom: asOfDate,
    canonLeafIds: ['CBA2-A01.1'],
    source: { authority: 'team-state', reference },
  });

  const governedIncompleteCharge: SalaryLedgerLineItem<'team-salary'> =
    totals.incompleteRosterResolution.mode === 'legacy-compatibility' &&
    incompleteRosterCharge
      ? {
          ...incompleteRosterCharge,
          ledger: 'team-salary',
        }
      : {
          id: `team-salary:${teamId}:incomplete-roster`,
          ledger: 'team-salary',
          label: 'Governed incomplete-roster charges',
          amount: totals.incompleteRosterResolution.amount ?? 0,
          effectiveFrom: asOfDate,
          canonLeafIds: ['CBA2-C03.1', 'CBA2-C03.2'],
          source: {
            authority: 'canon',
            reference: 'derived-from:governed-incomplete-roster-resolution',
          },
        };

  // The old editable line is retained only as a compatibility field. It is
  // never authoritative and may not disagree with the governed derivation.
  if (
    totals.incompleteRosterResolution.mode === 'governed' &&
    incompleteRosterCharge &&
    incompleteRosterCharge.amount !== governedIncompleteCharge.amount
  ) {
    return {
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.incompleteRosterCharge'],
      reason:
        'The legacy incomplete-roster input conflicts with the governed dated result and must not be used.',
    };
  }

  return {
    status: 'ready',
    lineItems: [
      component(
        'players',
        'Standard contracts',
        totals.playersTotal,
        'team.players'
      ),
      component(
        'dead-money',
        'Dead money',
        totals.deadMoneyTotal,
        'team.deadCap'
      ),
      component(
        'cap-holds',
        'Free Agent Amounts',
        totals.capHoldsTotal,
        'team.capHolds'
      ),
      component(
        'offer-sheets',
        'Outstanding Offer Sheet reservations',
        totals.outstandingOfferSheetTotal ?? 0,
        'team.offerSheets'
      ),
      governedIncompleteCharge,
    ],
  };
}

function apronSalaryInput(
  rawInput: SalaryLedgerInput<SalaryLedgerKind> | undefined,
  teamInput: SalaryLedgerInput<'team-salary'>,
  asOfDate: string | null,
  teamId: string | null,
  incompleteRosterResolution: IncompleteRosterResolution | undefined
): SalaryLedgerInput<'apron-team-salary'> {
  if (
    teamInput.status !== 'ready' ||
    !asOfDate ||
    !teamId ||
    !incompleteRosterResolution
  ) {
    return {
      status: 'needs-input',
      missingInputs:
        teamInput.status === 'needs-input'
          ? teamInput.missingInputs
          : ['ledgers.teamSalary'],
      reason:
        'Apron Team Salary cannot be evaluated until Team Salary is complete.',
    };
  }
  if (!rawInput) {
    return {
      status: 'needs-input',
      missingInputs: ['salaryBookInputs.apronAdjustments'],
      reason: 'The ten governed Apron Team Salary adjustments are required.',
    };
  }

  const typedInput = rawInput as SalaryLedgerInput<'apron-team-salary'>;
  const covered = validateAdjustmentDirections(
    requiredLeafCoverage(
      typedInput,
      APRON_SALARY_ADJUSTMENT_LEAVES,
      'salaryBookInputs.apronAdjustments'
    ),
    'salaryBookInputs.apronAdjustments'
  );
  if (covered.status !== 'ready') return covered;

  const teamSalary = teamInput.lineItems.reduce(
    (sum, lineItem) => sum + lineItem.amount,
    0
  );
  return {
    status: 'ready',
    lineItems: [
      {
        id: `apron-team-salary:${teamId}:team-salary-baseline`,
        ledger: 'apron-team-salary',
        label: 'Team Salary baseline',
        amount: teamSalary,
        effectiveFrom: asOfDate,
        canonLeafIds: ['CBA2-C07.1'],
        source: {
          authority: 'canon',
          reference: 'derived-from:team-salary',
        },
      },
      ...covered.lineItems.map((lineItem) =>
        incompleteRosterResolution.mode === 'governed' &&
        lineItem.canonLeafIds.includes('CBA2-C07.11')
          ? {
              ...lineItem,
              amount: -(incompleteRosterResolution.amount ?? 0),
              effectiveFrom: asOfDate,
              source: {
                authority: 'canon' as const,
                reference:
                  'derived-from:governed-incomplete-roster-resolution',
              },
            }
          : lineItem
      ),
    ],
  };
}

function parseInputs(team: TeamSalaryBookTeamLike, salaryCapYear: number) {
  const parsed = TeamSalaryBookInputsZ.safeParse(team.salaryBookInputs);
  return parsed.success && parsed.data.salaryCapYear === salaryCapYear
    ? parsed.data
    : null;
}

export function computeTeamSalaryBooks(
  team: TeamSalaryBookTeamLike | null | undefined,
  totals: TeamSalaryBookComponentTotals,
  salaryCapYear: number,
  asOfDateValue: string | null | undefined
): SalaryBooksSnapshot {
  const teamId = nonEmptyString(team?.teamCode ?? team?.teamId ?? team?.id);
  const teamCode = nonEmptyString(team?.teamCode);
  const asOfDate = normalizeSalaryBookAsOfDate(asOfDateValue);
  const inputs = team ? parseInputs(team, salaryCapYear) : null;
  const incompleteRosterResolution =
    totals.incompleteRosterResolution ??
    ({
      mode: 'legacy-compatibility',
      status: 'complete',
      activeWindow: null,
      window: null,
      counts: {
        underContract: 0,
        veteranFreeAgentAmounts: 0,
        offerSheets: 0,
        unsignedFirstRoundPicks: 0,
        total: 0,
      },
      threshold: 0,
      missingSlots: 0,
      chargePerSlot: 0,
      amount: totals.incompleteChargesTotal,
      canonLeafIds: ['CBA2-A01.1'],
      missingInputs: [],
      reason: 'Legacy compatibility result.',
    } satisfies IncompleteRosterResolution);
  const teamInput = teamSalaryInput(
    { ...totals, incompleteRosterResolution },
    asOfDate,
    teamId,
    inputs?.incompleteRosterCharge as
      | SalaryLedgerLineItem<SalaryLedgerKind>
      | undefined
  );
  const apronInput = apronSalaryInput(
    inputs?.apronAdjustments,
    teamInput,
    asOfDate,
    teamId,
    incompleteRosterResolution
  );
  const taxInput = inputs
    ? validateTaxBaseline(
        validateAdjustmentDirections(
          requiredLeafCoverage(
            inputs.taxSalary as SalaryLedgerInput<'tax-salary'>,
            TAX_SALARY_LEAVES,
            'salaryBookInputs.taxSalary'
          ),
          'salaryBookInputs.taxSalary'
        ),
        asOfDate
      )
    : ({
        status: 'needs-input',
        missingInputs: ['salaryBookInputs.taxSalary'],
        reason:
          'Tax Salary requires its governed last-game baseline and dated adjustments.',
      } satisfies SalaryLedgerInput<'tax-salary'>);

  const evaluation = evaluateGovernedDatedSalaryLedgers({
    context: {
      asOfDate,
      salaryCapYear,
      requiredAuthority: 'official',
      team: {
        teamId: teamId ?? undefined,
        ...(teamCode ? { teamCode } : {}),
      },
    },
    ledgers: {
      teamSalary: teamInput,
      apronTeamSalary: apronInput,
      taxSalary: taxInput,
    },
  });

  // Team Salary is a team-state ledger. A complete roster does not need the
  // season's authenticated system-level package merely to total its dated
  // contracts, dead money, holds, and Offer Sheet reservations. Apron and Tax
  // remain behind the official governed-season envelope because those books
  // consume separately authenticated adjustments and/or dated baselines.
  const teamEvaluation = evaluateDatedSalaryLedgers({
    context: {
      asOfDate: asOfDate ?? undefined,
      salaryCapYear,
      team: teamId
        ? {
            teamId,
            ...(teamCode ? { teamCode } : {}),
          }
        : undefined,
    },
    ledgers: {
      teamSalary: teamInput,
      apronTeamSalary: {
        status: 'not-evaluated',
        reason:
          'Apron Team Salary is evaluated by the governed season envelope.',
      },
      taxSalary: {
        status: 'not-evaluated',
        reason: 'Tax Salary is evaluated by the governed season envelope.',
      },
    },
  });
  const ledgers = {
    teamSalary: teamEvaluation.ledgers.teamSalary,
    apronTeamSalary: evaluation.ledgers.apronTeamSalary,
    taxSalary: evaluation.ledgers.taxSalary,
  };
  const statuses = Object.values(ledgers).map((ledger) => ledger.status);
  const status = statuses.every((value) => value === 'complete')
    ? 'complete'
    : statuses.some((value) => value === 'needs-input')
      ? 'needs-input'
      : 'not-evaluated';

  return SalaryBooksSnapshotZ.parse({
    version: 1,
    status,
    context:
      asOfDate && teamId
        ? {
            asOfDate,
            salaryCapYear,
            teamId,
          }
        : null,
    ledgers,
    governedInputs: evaluation.governedInputs
      ? JSON.parse(JSON.stringify(evaluation.governedInputs))
      : null,
  });
}
