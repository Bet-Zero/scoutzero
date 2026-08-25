import { describe, expect, it } from 'vitest';
import {
  GovernedCashEvaluationZ,
  type GovernedCashLedger,
  type GovernedCashLedgerEntry,
} from '@/schemas/governedCashConsideration';
import {
  evaluateGovernedCashConsideration,
  parseGovernedCashLedger,
} from '@/features/architect/utils/tradeMachine/utils/governedCashConsideration';
import { resolveTradeCashRouting } from '@/features/architect/utils/tradeMachine/utils/tradeCashRouting';
import { evaluateTradeApronRestriction } from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import type {
  TradeTeam,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type { TradeSalaryPathEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';

const WORLD_ID = 'WORLD-CASH';
const TRANSACTION_AT = '2026-10-20T12:00:00-04:00';
const SALARY_CAP_YEAR = 2027;
const SALARY_CAP_CENTS = 16_496_100_000;
const ANNUAL_LIMIT_CENTS = 849_549_150;
const SECOND_APRON = 221_686_000;

const context: TradeValidatorContext = {
  worldId: WORLD_ID,
  tradeDate: TRANSACTION_AT,
  asOfDate: TRANSACTION_AT,
  currentYear: SALARY_CAP_YEAR,
  yearKey: SALARY_CAP_YEAR,
};

function proof() {
  return {
    canonCandidateCommit: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17' as const,
    canonSha256:
      '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76' as const,
    salaryCapCents: SALARY_CAP_CENTS,
    annualLimitCents: ANNUAL_LIMIT_CENTS,
    seasonInputManifest: {},
  };
}

function ledgerEntry({
  teamId,
  counterpartyTeamId,
  direction,
  amountCents,
  transactionId,
  salaryCapYear = SALARY_CAP_YEAR,
}: {
  teamId: string;
  counterpartyTeamId: string;
  direction: 'PAID' | 'RECEIVED';
  amountCents: number;
  transactionId: string;
  salaryCapYear?: number;
}): GovernedCashLedgerEntry {
  return {
    entryVersion: 1,
    entryId: `${transactionId}:${teamId}:${direction}`,
    transactionId,
    worldId: WORLD_ID,
    teamId,
    counterpartyTeamId,
    direction,
    amountCents,
    salaryCapYear,
    transactionAt: TRANSACTION_AT,
    recordedAt: TRANSACTION_AT,
    canonLeafIds: ['CBA2-A08.1', 'CBA2-A08.4'],
    proof: proof(),
  };
}

function ledger(
  teamId: string,
  entries: GovernedCashLedgerEntry[] = []
): GovernedCashLedger {
  return {
    ledgerId: `cash-ledger:${teamId}`,
    ledgerVersion: entries.length,
    teamId,
    entries,
  };
}

function team(
  teamId: string,
  cashLedger: GovernedCashLedger,
  cashSent = 0,
  cashReceived = 0
): TradeTeam {
  return {
    teamId,
    team: { id: teamId, teamCode: teamId, cashLedger },
    cashSent,
    cashReceived,
  };
}

describe('governed cash consideration', () => {
  it('derives exact two-Team routing and rejects conflicting mirrors', () => {
    const routed = resolveTradeCashRouting([
      { teamId: 'ATL', team: { id: 'ATL' }, cashSent: 1_000_000.01 },
      { teamId: 'BOS', team: { id: 'BOS' } },
    ]);
    expect(routed).toMatchObject({
      ok: true,
      teams: [
        { cashSent: 1_000_000.01, cashToTeamId: 'BOS', cashReceived: 0 },
        { cashSent: 0, cashToTeamId: null, cashReceived: 1_000_000.01 },
      ],
    });

    expect(
      resolveTradeCashRouting([
        { teamId: 'ATL', team: { id: 'ATL' }, cashSent: 1 },
        { teamId: 'BOS', team: { id: 'BOS' }, cashReceived: 2 },
      ])
    ).toMatchObject({ ok: false });
  });

  it('fails malformed, ambiguous, self-routed, and unsupported lifecycle cash', () => {
    expect(
      resolveTradeCashRouting([
        {
          teamId: 'ATL',
          team: { id: 'ATL' },
          cashSent: 0.001,
        },
        { teamId: 'BOS', team: { id: 'BOS' } },
      ])
    ).toMatchObject({ ok: false });
    expect(
      resolveTradeCashRouting([
        { teamId: 'ATL', team: { id: 'ATL' }, cashSent: 1 },
        { teamId: 'BOS', team: { id: 'BOS' } },
        { teamId: 'DET', team: { id: 'DET' } },
      ])
    ).toMatchObject({ ok: false });
    expect(
      resolveTradeCashRouting([
        {
          teamId: 'ATL',
          team: { id: 'ATL' },
          cashSent: 1,
          cashToTeamId: 'ATL',
        },
        { teamId: 'BOS', team: { id: 'BOS' } },
      ])
    ).toMatchObject({ ok: false });
    expect(
      resolveTradeCashRouting([
        {
          teamId: 'ATL',
          team: { id: 'ATL' },
          cashSent: 1,
          conditionalCash: { predicate: 'pick conveys' },
        } as TradeTeam,
        { teamId: 'BOS', team: { id: 'BOS' } },
      ])
    ).toMatchObject({ ok: false });
  });

  it('accepts the exact 5.15% paid boundary and rejects one cent over', () => {
    const prior = ledgerEntry({
      teamId: 'ATL',
      counterpartyTeamId: 'BOS',
      direction: 'PAID',
      amountCents: 749_549_150,
      transactionId: 'prior-paid',
    });
    const exact = evaluateGovernedCashConsideration({
      team: team('ATL', ledger('ATL', [prior]), 1_000_000),
      context,
    });
    expect(GovernedCashEvaluationZ.parse(exact)).toMatchObject({
      status: 'PASS',
      projectedPaidCents: ANNUAL_LIMIT_CENTS,
      annualLimitCents: ANNUAL_LIMIT_CENTS,
    });

    const over = evaluateGovernedCashConsideration({
      team: team('ATL', ledger('ATL', [prior]), 1_000_000.01),
      context,
    });
    expect(over.status).toBe('FAIL');
    expect(over.violations).toEqual([
      expect.stringContaining('exceeds the annual limit by $0.01'),
    ]);
  });

  it('tracks received cash separately without netting or cross-year leakage', () => {
    const entries = [
      ledgerEntry({
        teamId: 'ATL',
        counterpartyTeamId: 'BOS',
        direction: 'PAID',
        amountCents: 849_000_000,
        transactionId: 'paid-near-limit',
      }),
      ledgerEntry({
        teamId: 'ATL',
        counterpartyTeamId: 'DET',
        direction: 'RECEIVED',
        amountCents: 849_549_150,
        transactionId: 'received-at-limit',
      }),
      ledgerEntry({
        teamId: 'ATL',
        counterpartyTeamId: 'BOS',
        direction: 'RECEIVED',
        amountCents: 800_000_000,
        transactionId: 'prior-year-received',
        salaryCapYear: 2026,
      }),
    ];
    const result = evaluateGovernedCashConsideration({
      team: team('ATL', ledger('ATL', entries), 0, 0.01),
      context,
    });
    expect(result).toMatchObject({
      status: 'FAIL',
      priorPaidCents: 849_000_000,
      priorReceivedCents: 849_549_150,
      projectedPaidCents: 849_000_000,
      projectedReceivedCents: 849_549_151,
    });
  });

  it('fails closed for legacy ledgers and the post-Regular-Season window', () => {
    expect(parseGovernedCashLedger({ totalOut: 0 })).toEqual({ valid: false });
    expect(
      evaluateGovernedCashConsideration({
        team: {
          teamId: 'ATL',
          team: { id: 'ATL', cashLedger: { totalOut: 0 } } as never,
          cashSent: 1,
        },
        context,
      })
    ).toMatchObject({
      status: 'NEEDS_INPUT',
      missingInputs: ['cashLedger.schema'],
    });
    expect(
      evaluateGovernedCashConsideration({
        team: team('ATL', ledger('ATL'), 1),
        context: {
          ...context,
          tradeDate: '2027-04-12T12:00:00-04:00',
          asOfDate: '2027-04-12T12:00:00-04:00',
        },
      })
    ).toMatchObject({
      status: 'NEEDS_INPUT',
      missingInputs: [
        'subsequentSalaryCapYear.systemLevels',
        'subsequentSalaryCapYear.A05.17Assumptions',
      ],
    });
  });

  it('attaches current-year Row I only to the cash-paying Team', () => {
    const pathEvaluation = (postSalary: number): TradeSalaryPathEvaluation => ({
      status: 'PASS',
      passed: true,
      electedPath: 'ROOM',
      ruleLabel: 'Room path',
      formula: 'room',
      allowance: 0,
      postAssignmentApronTeamSalary: postSalary,
      firstApron: 209_015_000,
      maximumIncoming: 1,
      actualIncoming: 0,
      margin: 1,
      components: [],
      missingInputs: [],
      violations: [],
      canonLeafIds: ['CBA2-A02.9'],
      election: {
        version: 1,
        path: 'ROOM',
        postAssignmentApronTeamSalary: postSalary,
      },
    });
    const atBoundary = evaluateTradeApronRestriction({
      team: {
        teamId: 'ATL',
        team: { id: 'ATL', teamCode: 'ATL' },
        cashSent: 1,
        projectedSalary: SECOND_APRON,
      },
      teamCode: 'ATL',
      pathEvaluation: pathEvaluation(SECOND_APRON),
      context,
    });
    expect(atBoundary).toMatchObject({
      status: 'PASS',
      restrictionRow: 'I',
      apronLevel: 'SECOND_APRON',
      margin: 0,
      hardCapWillPersist: true,
    });
    expect(atBoundary.attachedRestrictions[0]).toMatchObject({
      restrictionRow: 'I',
      componentKind: 'CASH',
      cashAmountCents: 100,
    });

    expect(
      evaluateTradeApronRestriction({
        team: {
          teamId: 'ATL',
          team: { id: 'ATL', teamCode: 'ATL' },
          cashSent: 1,
          projectedSalary: SECOND_APRON + 0.01,
        },
        teamCode: 'ATL',
        pathEvaluation: pathEvaluation(SECOND_APRON + 0.01),
        context,
      }).status
    ).toBe('FAIL');
    expect(
      evaluateTradeApronRestriction({
        team: {
          teamId: 'ATL',
          team: { id: 'ATL', teamCode: 'ATL' },
          cashReceived: 1,
          projectedSalary: SECOND_APRON + 1,
        },
        teamCode: 'ATL',
        pathEvaluation: pathEvaluation(SECOND_APRON + 1),
        context,
      }).status
    ).toBe('NOT_APPLICABLE');
  });
});
