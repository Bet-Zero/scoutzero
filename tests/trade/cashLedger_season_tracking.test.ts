import { describe, it, expect } from 'vitest';
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

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

type CashLedgerFixturePlayer = NormalizedPlayer & TradeExceptionPlayer;

const makePlayer = (
  name: string,
  salary: number,
  extra: Partial<CashLedgerFixturePlayer> = {}
): CashLedgerFixturePlayer => ({
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
  ...extra,
});

type CashLedgerFixtureTeam = NonNullable<TradeTeam['team']> & {
  players: CashLedgerFixturePlayer[];
  cashLedger?: {
    totalOut?: number;
  };
};

const makeTeam = (
  name: string,
  totalSalary: number,
  rosterSize = 14
): CashLedgerFixtureTeam => ({
  id: name,
  teamName: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('seasonal cash ledger tracking', () => {
  it('flags the helper rule when cashSent exceeds the seasonal cap', () => {
    const team: TradeTeam = {
      teamId: '1',
      cashSent: 500_000,
      cashReceived: 0,
      team: {
        cashLedger: {
          totalOut: 7_000_000,
        },
      },
      postTradeStatus: {},
    };

    const res = validateCash(team, { season: 2025, capSettings: {} });

    expect(issueTexts(res.violations)[0]).toMatch(
      /Cash sent.*would exceed.*seasonal limit/
    );
  });

  it('rejects seasonal cash-limit overflow through live validateTrade using cashSent', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const outgoingA = makePlayer('A1', 2_000_000, { toTeamId: 'B' });
    const outgoingB = makePlayer('B1', 2_000_000, { toTeamId: 'A' });

    teamA.players.push(outgoingA);
    teamA.cashLedger = { totalOut: 5_600_000 };
    teamB.players.push(outgoingB);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [outgoingA],
          entitlementsOut: [],
          cashSent: 500_000,
        },
        {
          team: teamB,
          sends: [outgoingB],
          entitlementsOut: [],
        },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate: '2025-07-10T00:00:00.000Z' },
    });

    const teamAResult = result.teamResults.find((entry) => entry.teamId === 'A');
    expect(result.legal).toBe(false);
    expect(teamAResult).toBeDefined();
    if (!teamAResult) {
      throw new Error('Expected Team A validation result');
    }
    expect(issueTexts(teamAResult.rules.cash.violations)).toEqual(
      expect.arrayContaining([expect.stringMatching(/seasonal limit/i)])
    );
  });
});
