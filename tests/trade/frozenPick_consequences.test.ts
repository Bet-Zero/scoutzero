import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  NormalizedTeamPick,
  TradeTeam,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

type TradeTeamDocument = NonNullable<TradeTeam['team']>;

const makePlayer = (
  name: string,
  salary: number,
  year: number
): NormalizedPlayer => ({
  id: name,
  playerId: name,
  name,
  salary,
  matchIncoming: salary,
  matchOutgoing: salary,
  isTwoWay: false,
  absorptionMode: 'MATCH',
  signAndTrade: false,
  contractYears: 1,
  firstYearGuaranteed: true,
  contract: {
    salariesByYear: [
      { season: `${year - 1}-${String(year).slice(-2)}`, salary },
    ],
  },
});

const makeTeam = (
  id: string,
  name: string,
  totalSalary: number,
  year: number,
  rosterSize = 14
): TradeTeamDocument => ({
  id,
  teamId: id,
  teamName: name,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000, year)
  ),
  picks: [],
});

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

function runPickTrade(pick: NormalizedTeamPick, currentYear: number) {
  const teamA = makeTeam('1', 'A', 220_000_000, currentYear); // Above 2025 second apron threshold
  const teamB = makeTeam('2', 'B', 100_000_000, currentYear);
  return validateTrade({
    teams: [
      { team: teamA, sends: [], picksOut: [pick] },
      { team: teamB, sends: [], picksOut: [] },
    ],
    capProjections,
    currentYear,
  });
}

describe('frozen pick consequences', () => {
  it('rejects 2032 first for second apron team', () => {
    const pick = { year: 2032, round: 1, teamId: '1' };
    const res = runPickTrade(pick, 2025);
    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Second apron team cannot trade its own 7-year-out first-round pick.'
    );
  });

  it('rejects protected 2032 first for second apron team', () => {
    const pick = { year: 2032, round: 1, teamId: '1', protection: 'top 10' };
    const res = runPickTrade(pick, 2025);
    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Second apron team cannot trade its own 7-year-out first-round pick.'
    );
  });

  it('allows 2031 first for second apron team', () => {
    const pick = { year: 2031, round: 1, teamId: '1' };
    const res = runPickTrade(pick, 2025);
    expect(res.teamResults[0].legal).toBe(true);
  });

  it('allows 2033 first for second apron team', () => {
    const pick = { year: 2033, round: 1, teamId: '1' };
    const res = runPickTrade(pick, 2027);
    expect(res.teamResults[0].legal).toBe(true);
  });
});
