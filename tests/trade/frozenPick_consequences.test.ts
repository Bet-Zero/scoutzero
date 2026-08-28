import { describe, expect, it } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';
import type {
  NormalizedPlayer,
  NormalizedTeamPick,
  TradeTeam,
} from '@/features/architect/utils/tradeMachine/constants/types';

type TradeTeamDocument = NonNullable<TradeTeam['team']>;

const makePlayer = (name: string, year: number): NormalizedPlayer => ({
  id: name,
  playerId: name,
  name,
  salary: 1_000_000,
  matchIncoming: 1_000_000,
  matchOutgoing: 1_000_000,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: {
    salariesByYear: [
      { season: `${year - 1}-${String(year).slice(-2)}`, salary: 1_000_000 },
    ],
  },
});

const makeTeam = (
  id: string,
  totalSalary: number,
  year: number
): TradeTeamDocument => ({
  id,
  teamId: id,
  teamName: id,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: 14 }, (_, i) => makePlayer(`${id}${i}`, year)),
  picks: [],
});

function runPickTrade(pick: NormalizedTeamPick, currentYear: number) {
  return validateTrade({
    teams: [
      {
        team: makeTeam('1', 220_000_000, currentYear),
        sends: [],
        picksOut: [pick],
      },
      {
        team: makeTeam('2', 100_000_000, currentYear),
        sends: [],
        picksOut: [],
      },
    ],
    capProjections,
    currentYear,
  });
}

describe('frozen-pick authority boundary', () => {
  it.each([
    ['seven-year-out', { year: 2032, round: 1, teamId: '1' }, 2025],
    [
      'protected seven-year-out',
      { year: 2032, round: 1, teamId: '1', protection: 'top 10' },
      2025,
    ],
    ['different season window', { year: 2033, round: 1, teamId: '1' }, 2027],
  ])('reports Needs input for %s first-round asset', (_name, pick, year) => {
    const result = runPickTrade(pick, year);
    const stepien = result.teamResults[0].rules.stepienRule;

    expect(result.teamResults[0].legal).toBe(false);
    expect(stepien).toMatchObject({
      passed: false,
      status: 'NEEDS_INPUT',
      evaluated: false,
    });
  });

  it('continues to permit the supported second-round control', () => {
    const result = runPickTrade({ year: 2032, round: 2, teamId: '1' }, 2025);

    expect(result.teamResults[0].rules.stepienRule.passed).toBe(true);
  });
});
