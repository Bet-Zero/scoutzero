import { afterEach, describe, expect, it } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections';
import { validationFlags } from '@/config/validationFlags.js';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { validateTiming } from '@/features/architect/utils/tradeMachine/rules/timingValidation';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const CURRENT_YEAR = 2025;
const SEASON = '2024-25';

const makePlayer = (name, salary, extra = {}) => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  player_id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  signAndTrade: false,
  contractYears: 4,
  firstYearGuaranteed: true,
  contract: {
    salariesByYear: [{ season: SEASON, salary, capHit: salary, guaranteed: true }],
  },
  ...extra,
});

const makeTeam = (id, players, totalSalary = 100_000_000) => ({
  id,
  teamId: id,
  teamCode: id,
  teamName: id,
  totalSalary,
  teamTotalSalary: totalSalary,
  players,
  roster: players.map((player) => player.player_id || player.id),
  picks: [],
  capHolds: [],
  draftPicks: [],
  tradeExceptions: [],
});

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

function buildSignAndTradeFixture() {
  const satPlayer = makePlayer('SAT Player', 15_000_000, {
    signAndTrade: true,
    originTeamId: 'A',
  });
  const counterPlayer = makePlayer('Counter Player', 15_000_000, {
    originTeamId: 'B',
  });
  const teamA = makeTeam('A', [satPlayer]);
  const teamB = makeTeam('B', [counterPlayer]);

  return {
    satPlayer,
    counterPlayer,
    teams: [
      { team: teamA, sends: [satPlayer], picksOut: [] },
      { team: teamB, sends: [counterPlayer], picksOut: [] },
    ],
  };
}

describe('Jan 15 S&T / timing ownership', () => {
  afterEach(() => {
    validationFlags.timingEnforcement = 'warn';
  });

  it('no longer applies the S&T Jan 15 gate inside generic timing validation', () => {
    const result = validateTiming(
      {
        outgoingPlayers: [{ name: 'S&T Player', signAndTrade: true }],
      },
      { tradeDate: '2025-01-10' }
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('routes pre-Jan 15 S&T blockers through signAndTrade, not timingEnforcement', () => {
    const { teams } = buildSignAndTradeFixture();

    const result = validateTrade({
      teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { offseason: true, asOfDate: '2024-10-01' },
    });

    const teamAResult = result.teamResults[0];

    expect(teamAResult.rules.signAndTrade.passed).toBe(false);
    expect(issueTexts(teamAResult.rules.signAndTrade.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
    expect(issueTexts(teamAResult.rules.timingEnforcement.violations)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
  });

  it('clears the S&T Jan 15 blocker after Jan 15 when offseason is explicitly overridden for the fixture', () => {
    const { teams } = buildSignAndTradeFixture();

    const result = validateTrade({
      teams,
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { offseason: true, asOfDate: '2025-01-20' },
    });

    const teamAResult = result.teamResults[0];

    expect(issueTexts(teamAResult.rules.signAndTrade.violations)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
  });

  it('routes recent-extension Jan 15 blockers through timingEnforcement, not signAndTrade', () => {
    validationFlags.timingEnforcement = 'error';

    const extendedPlayer = makePlayer('Extended Player', 12_000_000, {
      isRecentlyExtended: true,
      originTeamId: 'A',
    });
    const counterPlayer = makePlayer('Counter Player', 12_000_000, {
      originTeamId: 'B',
    });
    const teamA = makeTeam('A', [extendedPlayer]);
    const teamB = makeTeam('B', [counterPlayer]);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [extendedPlayer], picksOut: [] },
        { team: teamB, sends: [counterPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { asOfDate: '2025-01-10' },
    });

    const teamAResult = result.teamResults[0];

    expect(teamAResult.rules.timingEnforcement.passed).toBe(false);
    expect(issueTexts(teamAResult.rules.timingEnforcement.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15 \(recent extension\)/i),
      ])
    );
    expect(teamAResult.rules.signAndTrade.passed).toBe(true);
  });
});
