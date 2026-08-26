import {
  GovernedCashLedgerZ,
  GovernedCashProofZ,
  type GovernedCashEvaluation,
  type GovernedCashLedger,
} from '@/schemas/governedCashConsideration';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';
import type { TeamContext, TradeTeam } from '../constants/types';
import { cashDollarsToCents } from './tradeCashRouting';

const CASH_CANON_COMMIT = '6cf8aaf358c158a88e630e8a7336f7e9c3febc17';
const CASH_CANON_SHA256 =
  '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76';

function teamCode(team: TradeTeam): string {
  return String(
    team.teamId ||
      team.team?.teamCode ||
      team.team?.teamId ||
      team.team?.id ||
      'UNK'
  )
    .trim()
    .toUpperCase();
}

function isZonedInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) &&
    Number.isFinite(Date.parse(value))
  );
}

function evaluation(
  values: Partial<GovernedCashEvaluation> &
    Pick<GovernedCashEvaluation, 'status' | 'teamId'>
): GovernedCashEvaluation {
  return {
    evaluationVersion: 1,
    status: values.status,
    passed: values.status === 'PASS' || values.status === 'NOT_APPLICABLE',
    teamId: values.teamId,
    salaryCapYear: values.salaryCapYear ?? null,
    transactionAt: values.transactionAt ?? null,
    cashSentCents: values.cashSentCents ?? null,
    cashReceivedCents: values.cashReceivedCents ?? null,
    priorPaidCents: values.priorPaidCents ?? null,
    priorReceivedCents: values.priorReceivedCents ?? null,
    projectedPaidCents: values.projectedPaidCents ?? null,
    projectedReceivedCents: values.projectedReceivedCents ?? null,
    annualLimitCents: values.annualLimitCents ?? null,
    regularSeasonClosing: values.regularSeasonClosing ?? null,
    ledgerVersion: values.ledgerVersion ?? null,
    canonLeafIds: values.canonLeafIds ?? [],
    missingInputs: values.missingInputs ?? [],
    violations: values.violations ?? [],
    proof: values.proof ?? null,
  };
}

function annualCashLimitCents(salaryCapCents: number): number {
  return Math.floor((salaryCapCents * 515) / 10_000);
}

export function parseGovernedCashLedger(
  value: unknown
): { valid: true; ledger: GovernedCashLedger } | { valid: false } {
  const parsed = GovernedCashLedgerZ.safeParse(value);
  return parsed.success
    ? { valid: true, ledger: parsed.data }
    : { valid: false };
}

export function evaluateGovernedCashConsideration({
  team,
  context,
}: {
  team: TradeTeam;
  context: TeamContext;
}): GovernedCashEvaluation {
  const resolvedTeamCode = teamCode(team);
  const cashSentCents = cashDollarsToCents(team.cashSent);
  const cashReceivedCents = cashDollarsToCents(team.cashReceived);
  if (cashSentCents === null || cashReceivedCents === null) {
    const malformed = [
      ...(cashSentCents === null ? ['cashSent'] : []),
      ...(cashReceivedCents === null ? ['cashReceived'] : []),
    ];
    return evaluation({
      status: 'NEEDS_INPUT',
      teamId: resolvedTeamCode,
      missingInputs: malformed,
      violations: ['Trade cash must be expressed as nonnegative whole cents.'],
    });
  }
  if (cashSentCents === 0 && cashReceivedCents === 0) {
    return evaluation({
      status: 'NOT_APPLICABLE',
      teamId: resolvedTeamCode,
      cashSentCents,
      cashReceivedCents,
      canonLeafIds: ['CBA2-A05.11'],
    });
  }

  const transactionAt = context.tradeDate ?? context.asOfDate ?? null;
  const salaryCapYear = context.currentYear ?? context.yearKey ?? null;
  const missingInputs: string[] = [];
  if (!context.worldId?.trim()) missingInputs.push('worldId');
  if (!isZonedInstant(transactionAt)) missingInputs.push('transactionAt');
  if (!Number.isInteger(salaryCapYear)) missingInputs.push('salaryCapYear');
  if (!/^[A-Z0-9]{2,5}$/.test(resolvedTeamCode)) {
    missingInputs.push('teamId');
  }
  if (missingInputs.length > 0) {
    return evaluation({
      status: 'NEEDS_INPUT',
      teamId: resolvedTeamCode,
      salaryCapYear:
        typeof salaryCapYear === 'number' && Number.isInteger(salaryCapYear)
          ? salaryCapYear
          : null,
      transactionAt: isZonedInstant(transactionAt) ? transactionAt : null,
      cashSentCents,
      cashReceivedCents,
      missingInputs,
      violations: [
        `Cash consideration needs governed input: ${missingInputs.join(', ')}.`,
      ],
    });
  }

  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate: transactionAt as string,
    salaryCapYear: salaryCapYear as number,
    requiredAuthority: 'official',
    team: {
      teamId: resolvedTeamCode,
      teamCode: resolvedTeamCode,
      worldId: context.worldId,
    },
  });
  const salaryCap = envelope.systemLevels['salary-cap'];
  const salaryCapCents = cashDollarsToCents(salaryCap.amount);
  const regularSeasonClosing =
    envelope.calendar.regularSeasonClosing?.value ?? null;
  if (
    envelope.status !== 'complete' ||
    !envelope.inputManifest ||
    salaryCap.state !== 'available' ||
    salaryCapCents === null ||
    !regularSeasonClosing
  ) {
    return evaluation({
      status: 'NEEDS_INPUT',
      teamId: resolvedTeamCode,
      salaryCapYear: salaryCapYear as number,
      transactionAt: transactionAt as string,
      cashSentCents,
      cashReceivedCents,
      missingInputs: ['governedSeasonEnvelope'],
      violations: [
        'The official Salary Cap or Season calendar is unavailable.',
      ],
    });
  }
  if ((transactionAt as string).slice(0, 10) > regularSeasonClosing) {
    return evaluation({
      status: 'NEEDS_INPUT',
      teamId: resolvedTeamCode,
      salaryCapYear: salaryCapYear as number,
      transactionAt: transactionAt as string,
      cashSentCents,
      cashReceivedCents,
      regularSeasonClosing,
      canonLeafIds: ['CBA2-A05.15', 'CBA2-A05.16', 'CBA2-A05.17'],
      missingInputs: [
        'subsequentSalaryCapYear.systemLevels',
        'subsequentSalaryCapYear.A05.17Assumptions',
      ],
      violations: [
        'Post-Regular-Season cash consideration needs complete subsequent-year authority.',
      ],
    });
  }

  const parsedLedger = GovernedCashLedgerZ.safeParse(team.team?.cashLedger);
  if (!parsedLedger.success || parsedLedger.data.teamId !== resolvedTeamCode) {
    return evaluation({
      status: 'NEEDS_INPUT',
      teamId: resolvedTeamCode,
      salaryCapYear: salaryCapYear as number,
      transactionAt: transactionAt as string,
      cashSentCents,
      cashReceivedCents,
      regularSeasonClosing,
      missingInputs: ['cashLedger.schema'],
      violations: [
        'Cash consideration needs the Team’s complete governed cash ledger.',
      ],
    });
  }
  const ledger = parsedLedger.data;
  const ledgerAuthorityMissing = ledger.entries.some(
    (entry) => entry.worldId !== context.worldId
  );
  const transactionDirectionKeys = ledger.entries.map(
    (entry) =>
      `${entry.transactionId}:${entry.direction}:${entry.counterpartyTeamId}`
  );
  if (
    ledgerAuthorityMissing ||
    new Set(transactionDirectionKeys).size !== transactionDirectionKeys.length
  ) {
    return evaluation({
      status: 'NEEDS_INPUT',
      teamId: resolvedTeamCode,
      salaryCapYear: salaryCapYear as number,
      transactionAt: transactionAt as string,
      cashSentCents,
      cashReceivedCents,
      regularSeasonClosing,
      ledgerVersion: ledger.ledgerVersion,
      missingInputs: ['cashLedger.authority'],
      violations: ['The governed cash ledger has conflicting authority.'],
    });
  }

  const annualLimitCents = annualCashLimitCents(salaryCapCents);
  const proof = GovernedCashProofZ.parse({
    canonCandidateCommit: CASH_CANON_COMMIT,
    canonSha256: CASH_CANON_SHA256,
    salaryCapCents,
    annualLimitCents,
    seasonInputManifest: envelope.inputManifest,
  });
  const currentEntries = ledger.entries.filter(
    (entry) => entry.salaryCapYear === salaryCapYear
  );
  const priorPaidCents = currentEntries
    .filter((entry) => entry.direction === 'PAID')
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const priorReceivedCents = currentEntries
    .filter((entry) => entry.direction === 'RECEIVED')
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const projectedPaidCents = priorPaidCents + cashSentCents;
  const projectedReceivedCents = priorReceivedCents + cashReceivedCents;
  const violations: string[] = [];
  if (projectedPaidCents > annualLimitCents) {
    violations.push(
      `Cash paid exceeds the annual limit by $${((projectedPaidCents - annualLimitCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`
    );
  }
  if (projectedReceivedCents > annualLimitCents) {
    violations.push(
      `Cash received exceeds the annual limit by $${((projectedReceivedCents - annualLimitCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`
    );
  }
  const canonLeafIds = [
    ...(cashSentCents > 0 ? ['CBA2-A08.1'] : []),
    ...(cashReceivedCents > 0 ? ['CBA2-A08.2'] : []),
    'CBA2-A08.4',
    'CBA2-A08.5',
    'CBA2-A08.6',
  ];
  return evaluation({
    status: violations.length > 0 ? 'FAIL' : 'PASS',
    teamId: resolvedTeamCode,
    salaryCapYear: salaryCapYear as number,
    transactionAt: transactionAt as string,
    cashSentCents,
    cashReceivedCents,
    priorPaidCents,
    priorReceivedCents,
    projectedPaidCents,
    projectedReceivedCents,
    annualLimitCents,
    regularSeasonClosing,
    ledgerVersion: ledger.ledgerVersion,
    canonLeafIds,
    violations,
    proof,
  });
}
