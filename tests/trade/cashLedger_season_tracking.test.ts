import { describe, expect, it } from 'vitest';
import { validateCash } from '@/features/architect/utils/tradeMachine/rules/validateCash';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  TradeExceptionPlayer,
  TradeTeam,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  GovernedCashLedger,
  GovernedCashLedgerEntry,
} from '@/schemas/governedCashConsideration';

const currentYear = 2027;
const season = '2026-27';
const tradeDate = '2026-10-20T12:00:00-04:00';

type FixturePlayer = NormalizedPlayer & TradeExceptionPlayer;

const makePlayer = (name: string, salary: number): FixturePlayer => ({
  name,
  salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: { salariesByYear: [{ season, salary }] },
});

const proof = {
  canonCandidateCommit: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17' as const,
  canonSha256:
    '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76' as const,
  salaryCapCents: 16_496_100_000,
  annualLimitCents: 849_549_150,
  seasonInputManifest: {},
};

function cashLedger(
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

function paidEntry(): GovernedCashLedgerEntry {
  return {
    entryVersion: 1,
    entryId: 'prior-paid:ATL:PAID',
    transactionId: 'prior-paid',
    worldId: 'WORLD-CASH',
    teamId: 'ATL',
    counterpartyTeamId: 'BOS',
    direction: 'PAID',
    amountCents: 749_549_150,
    salaryCapYear: currentYear,
    transactionAt: tradeDate,
    recordedAt: tradeDate,
    canonLeafIds: ['CBA2-A08.1', 'CBA2-A08.4'],
    proof,
  };
}

function makeTeam(teamId: string, ledger: GovernedCashLedger) {
  return {
    id: teamId,
    teamCode: teamId,
    teamName: teamId,
    totalSalary: 100_000_000,
    teamTotalSalary: 100_000_000,
    cashLedger: ledger,
    players: Array.from({ length: 14 }, (_, index) =>
      makePlayer(`${teamId}${index}`, 1_000_000)
    ),
    picks: [],
  };
}

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('governed cash ledger tracking', () => {
  it('fails closed instead of treating the legacy totalOut field as authority', () => {
    const team: TradeTeam = {
      teamId: 'ATL',
      cashSent: 1,
      cashReceived: 0,
      team: {
        id: 'ATL',
        teamCode: 'ATL',
        cashLedger: { totalOut: 0 } as never,
      },
    };

    const result = validateCash(team, {
      worldId: 'WORLD-CASH',
      tradeDate,
      currentYear,
    });

    expect(issueTexts(result.violations)).toEqual([
      expect.stringContaining('complete governed cash ledger'),
    ]);
    expect(result.details).toMatchObject({
      status: 'NEEDS_INPUT',
      missingInputs: ['cashLedger.schema'],
    });
  });

  it('rejects one cent beyond the exact governed 5.15% limit in live validation', () => {
    const teamA = makeTeam('ATL', cashLedger('ATL', [paidEntry()]));
    const teamB = makeTeam('BOS', cashLedger('BOS'));
    const outgoingA = makePlayer('ATL-OUT', 2_000_000);
    const outgoingB = makePlayer('BOS-OUT', 2_000_000);
    outgoingA.toTeamId = 'BOS';
    outgoingB.toTeamId = 'ATL';
    teamA.players.push(outgoingA);
    teamB.players.push(outgoingB);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [outgoingA],
          entitlementsOut: [],
          cashSent: 1_000_000.01,
        },
        {
          team: teamB,
          sends: [outgoingB],
          entitlementsOut: [],
        },
      ],
      capProjections,
      currentYear,
      tradeCtx: {
        worldId: 'WORLD-CASH',
        tradeDate,
        asOfDate: tradeDate,
      },
    });

    const teamAResult = result.teamResults.find(
      (entry) => entry.teamId === 'ATL'
    );
    expect(result.legal).toBe(false);
    expect(issueTexts(teamAResult?.rules.cash.violations)).toEqual([
      expect.stringContaining('exceeds the annual limit by $0.01'),
    ]);
  });
});
