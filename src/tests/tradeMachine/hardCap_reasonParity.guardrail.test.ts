import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { capProjections } from '@/features/architect/utils/capProjections';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const CURRENT_YEAR = 2025;
const SEASON = '2024-25';

function makePlayer(name: string, salary: number): NormalizedPlayer {
  return {
    id: name.toLowerCase().replace(/\s/g, '_'),
    name,
    player_id: name.toLowerCase().replace(/\s/g, '_'),
    salary,
    matchIncoming: salary,
    matchOutgoing: salary,
    isTwoWay: false,
    absorptionMode: 'MATCH',
    signAndTrade: false,
    contractYears: 1,
    firstYearGuaranteed: true,
    contract: {
      salariesByYear: [{ season: SEASON, salary }],
    },
  };
}

type HardCapPlayerFixture = ReturnType<typeof makePlayer>;

function makeTeam(
  code: string,
  totalSalary: number,
  players: HardCapPlayerFixture[] = []
) {
  return {
    id: code,
    teamCode: code,
    teamName: code,
    totalSalary,
    teamSalary: totalSalary,
    apronTeamSalary: totalSalary,
    taxSalary: totalSalary,
    teamTotalSalary: totalSalary,
    players,
  };
}

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('Hard Cap Reason Parity Guardrail', () => {
  it('uses hard-cap incoming ceiling language when hard cap is the active limiter', () => {
    const aOutgoing = makePlayer('A Out', 10_000_000);
    const bOutgoing = makePlayer('B Out', 13_000_000);

    const teamA = makeTeam('A', 177_000_000, [aOutgoing]);
    const teamB = makeTeam('B', 140_000_000, [bOutgoing]);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aOutgoing], hardCapped: true, entitlementsOut: [] },
        { team: teamB, sends: [bOutgoing], entitlementsOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');

    expect(result.legal).toBe(false);
    expect(teamAResult?.rules?.salaryMatching?.passed).toBe(true);
    expect(teamAResult?.rules?.hardCap?.passed).toBe(false);
    expect(issueTexts(teamAResult?.rules?.hardCap?.violations)[0]).toContain(
      'hard-cap incoming ceiling'
    );
    expect(result.reason).toContain('hard-cap incoming ceiling');
  });
});
