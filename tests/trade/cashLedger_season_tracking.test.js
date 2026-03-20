import { describe, it, expect } from 'vitest';
import { validateCash } from '@/features/architect/utils/tradeMachine/rules/validateCash';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/features/architect/utils/capProjections.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

const makePlayer = (name, salary, extra = {}) => ({
  name,
  contract: { salariesByYear: [{ season, salary }] },
  ...extra,
});

const makeTeam = (name, totalSalary, rosterSize = 14) => ({
  id: name,
  teamName: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

const issueTexts = (issues = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('seasonal cash ledger tracking', () => {
  it('flags the helper rule when cashSent exceeds the seasonal cap', () => {
    const team = {
      teamId: 1,
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
    expect(issueTexts(teamAResult?.rules?.cash?.violations)).toEqual(
      expect.arrayContaining([expect.stringMatching(/seasonal limit/i)])
    );
  });
});
