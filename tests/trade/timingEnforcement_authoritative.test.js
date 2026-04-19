import { afterEach, describe, expect, it } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections';
import { validationFlags } from '@/config/validationFlags';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const CURRENT_YEAR = 2025;
const SEASON = '2024-25';

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

const makePlayer = (name, salary, teamCode, extra = {}) => ({
  id: `${teamCode}_${name}`.toLowerCase().replace(/\s+/g, '-'),
  player_id: `${teamCode}_${name}`.toLowerCase().replace(/\s+/g, '-'),
  name,
  teamCode,
  contract: {
    salariesByYear: [
      {
        season: SEASON,
        salary,
        capHit: salary,
        guaranteed: true,
      },
    ],
  },
  ...extra,
});

const makeRoster = (teamCode, count, salary = 1_000_000) =>
  Array.from({ length: count }, (_, index) =>
    makePlayer(`filler_${index}`, salary, teamCode)
  );

const makeTeam = (teamCode, players) => {
  const totalSalary = players.reduce((sum, player) => {
    const row = player.contract?.salariesByYear?.[0] || {};
    return sum + Number(row.capHit ?? row.salary ?? 0);
  }, 0);

  return {
    id: teamCode,
    teamId: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    totalSalary,
    teamTotalSalary: totalSalary,
    players,
    roster: players.map((player) => player.player_id || player.id),
    capHolds: [],
    draftPicks: [],
    tradeExceptions: [],
  };
};

function buildTradeFixture({
  teamASends,
  teamBSends,
  teamAFillers = 13,
  teamBFillers = 13,
}) {
  const teamAPlayers = [...teamASends, ...makeRoster('A', teamAFillers)];
  const teamBPlayers = [...teamBSends, ...makeRoster('B', teamBFillers)];
  const teamA = makeTeam('A', teamAPlayers);
  const teamB = makeTeam('B', teamBPlayers);

  return {
    teams: [
      { team: teamA, sends: teamASends, entitlementsOut: [] },
      { team: teamB, sends: teamBSends, entitlementsOut: [] },
    ],
  };
}

describe('authoritative timing enforcement', () => {
  afterEach(() => {
    validationFlags.timingEnforcement = 'warn';
  });

  it('keeps moratorium timing in canonical warnings without blocking legality', () => {
    validationFlags.timingEnforcement = 'warn';

    const fixture = buildTradeFixture({
      teamASends: [makePlayer('A Out', 10_000_000, 'A', { tradeTo: 'B' })],
      teamBSends: [makePlayer('B Out', 10_000_000, 'B', { tradeTo: 'A' })],
    });

    const result = validateTrade({
      teams: fixture.teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: {
        asOfDate: '2024-07-03',
        tradeDate: '2024-07-03',
      },
    });

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');
    const topWarningTexts = issueTexts(result.warnings);
    const teamWarningTexts = issueTexts(teamAResult?.warnings);
    const ruleWarningTexts = issueTexts(
      teamAResult?.rules?.timingEnforcement?.warnings
    );

    expect(result.legal).toBe(true);
    expect(teamAResult?.legal).toBe(true);
    expect(teamAResult?.rules?.timingEnforcement?.passed).toBe(true);
    expect(teamAResult?.rules?.timingEnforcement?.violations).toHaveLength(0);
    expect(topWarningTexts).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(teamWarningTexts).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(ruleWarningTexts).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(issueTexts(result.violations)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
  });

  it('still blocks trades when timing enforcement is set to error', () => {
    validationFlags.timingEnforcement = 'error';

    const fixture = buildTradeFixture({
      teamASends: [makePlayer('A Out', 10_000_000, 'A', { tradeTo: 'B' })],
      teamBSends: [makePlayer('B Out', 10_000_000, 'B', { tradeTo: 'A' })],
    });

    const result = validateTrade({
      teams: fixture.teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: {
        asOfDate: '2024-07-03',
        tradeDate: '2024-07-03',
      },
    });

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');

    expect(result.legal).toBe(false);
    expect(teamAResult?.legal).toBe(false);
    expect(teamAResult?.rules?.timingEnforcement?.passed).toBe(false);
    expect(issueTexts(teamAResult?.rules?.timingEnforcement?.violations)).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(teamAResult?.rules?.timingEnforcement?.warnings).toHaveLength(0);
    expect(issueTexts(result.warnings)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
  });

  it('does not surface the retired 60-day aggregation message anywhere in authoritative timing output', () => {
    validationFlags.timingEnforcement = 'warn';

    const fixture = buildTradeFixture({
      teamASends: [
        makePlayer('Recent One', 6_000_000, 'A', {
          tradeTo: 'B',
          signedDate: '2024-01-20',
        }),
        makePlayer('Recent Two', 4_000_000, 'A', {
          tradeTo: 'B',
          signedDate: '2024-01-10',
        }),
      ],
      teamBSends: [
        makePlayer('Old One', 6_000_000, 'B', {
          tradeTo: 'A',
          signedDate: '2023-08-01',
        }),
        makePlayer('Old Two', 4_000_000, 'B', {
          tradeTo: 'A',
          signedDate: '2023-07-15',
        }),
      ],
      teamAFillers: 12,
      teamBFillers: 12,
    });

    const result = validateTrade({
      teams: fixture.teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: {
        asOfDate: '2024-02-15',
        tradeDate: '2024-02-15',
      },
    });

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');
    const activeTimingTexts = [
      ...issueTexts(result.warnings),
      ...issueTexts(result.violations),
      ...issueTexts(teamAResult?.warnings),
      ...issueTexts(teamAResult?.violations),
      ...issueTexts(teamAResult?.rules?.timingEnforcement?.warnings),
      ...issueTexts(teamAResult?.rules?.timingEnforcement?.violations),
    ].join(' | ');

    expect(activeTimingTexts).not.toMatch(/acquired within the last 60 days/i);
    expect(activeTimingTexts).not.toMatch(/recently acquired players for 2 months/i);
  });
});
