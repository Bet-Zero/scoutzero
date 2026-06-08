import { describe, it, expect } from 'vitest';
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

type RosterLegalityFixturePlayer = NormalizedPlayer &
  TradeExceptionPlayer &
  Record<string, unknown>;

const makePlayer = (
  name: string,
  salary: number,
  extra: Partial<RosterLegalityFixturePlayer> = {}
): RosterLegalityFixturePlayer => ({
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
  contract: { salariesByYear: [{ season, salary }] },
  ...extra,
});

const makeTeam = (
  name: string,
  totalSalary: number,
  players: RosterLegalityFixturePlayer[],
  extra: Partial<TradeTeam['team']> = {}
): TradeTeam['team'] => ({
  teamName: name,
  teamId: name,
  totalSalary,
  players,
  ...extra,
});

const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('roster legality via validateTrade', () => {
  it('does not block (advisory) a trade that pushes a team over max standard roster (15)', () => {
    const teamAPlayers = Array.from({ length: 15 }, (_, i) =>
      makePlayer(`A_Player_${i}`, 2_000_000)
    );
    const teamBPlayers = Array.from({ length: 14 }, (_, i) =>
      makePlayer(`B_Player_${i}`, 2_000_000)
    );

    const result = validateTrade({
      teams: [
        {
          team: makeTeam('TeamA', 30_000_000, teamAPlayers),
          sends: [teamAPlayers[0]],
          picksOut: [],
        },
        {
          team: makeTeam('TeamB', 28_000_000, teamBPlayers),
          sends: [teamBPlayers[0], teamBPlayers[1], teamBPlayers[2]],
          picksOut: [],
        },
      ],
      capProjections,
      currentYear,
    });

    // Team A: 15 - 1 sent + 3 received = 17 → over max, but roster size is
    // advisory (validationFlags.rosterEnforcement === 'warn'): it surfaces as a
    // warning and does not block the trade.
    const teamAResult = result.teamResults[0];
    expect(teamAResult.rules.rosterCount).toBeDefined();
    expect(teamAResult.rules.rosterCount.passed).toBe(true);
    expect(teamAResult.rules.rosterCount.warningsOnly).toBe(true);
    expect(teamAResult.rules.rosterCount.message).toContain('exceeds maximum');
    // The over-roster breach is NOT a blocking trade violation.
    expect(
      issueTexts(result.violations).some((v) => v.includes('exceeds maximum'))
    ).toBe(false);
  });

  it('does not block (advisory) a trade that drops a team below min standard roster (14)', () => {
    const teamAPlayers = Array.from({ length: 14 }, (_, i) =>
      makePlayer(`A_Player_${i}`, 2_000_000)
    );
    const teamBPlayers = Array.from({ length: 15 }, (_, i) =>
      makePlayer(`B_Player_${i}`, 2_000_000)
    );

    const result = validateTrade({
      teams: [
        {
          team: makeTeam('TeamA', 28_000_000, teamAPlayers),
          sends: [teamAPlayers[0], teamAPlayers[1], teamAPlayers[2]],
          picksOut: [],
        },
        {
          team: makeTeam('TeamB', 30_000_000, teamBPlayers),
          sends: [teamBPlayers[0]],
          picksOut: [],
        },
      ],
      capProjections,
      currentYear,
    });

    // Team A: 14 - 3 sent + 1 received = 12 → below min, advisory (warn) only.
    const teamAResult = result.teamResults[0];
    expect(teamAResult.rules.rosterCount).toBeDefined();
    expect(teamAResult.rules.rosterCount.passed).toBe(true);
    expect(teamAResult.rules.rosterCount.warningsOnly).toBe(true);
    expect(teamAResult.rules.rosterCount.message).toContain('below minimum');
    expect(
      issueTexts(result.violations).some((v) => v.includes('below minimum'))
    ).toBe(false);
  });

  it('blocks trade that exceeds two-way max (3)', () => {
    const teamAPlayers = Array.from({ length: 14 }, (_, i) =>
      makePlayer(`A_Player_${i}`, 2_000_000)
    );
    const teamATwoWay = Array.from({ length: 3 }, (_, i) =>
      makePlayer(`A_TW_${i}`, 500_000, { isTwoWay: true })
    );
    const teamBPlayers = Array.from({ length: 14 }, (_, i) =>
      makePlayer(`B_Player_${i}`, 2_000_000)
    );

    const twoWaySend = makePlayer('B_TW_new', 500_000, { isTwoWay: true });

    const result = validateTrade({
      teams: [
        {
          team: makeTeam('TeamA', 28_000_000, teamAPlayers, {
            twoWayPlayers: teamATwoWay,
          }),
          sends: [teamAPlayers[0]],
          picksOut: [],
        },
        {
          team: makeTeam('TeamB', 28_000_000, teamBPlayers),
          sends: [teamBPlayers[0], twoWaySend],
          picksOut: [],
        },
      ],
      capProjections,
      currentYear,
    });

    // Team A: 3 two-way + 1 incoming two-way = 4 → over max (3)
    const teamAResult = result.teamResults[0];
    expect(teamAResult.rules.rosterCount).toBeDefined();
    expect(teamAResult.rules.rosterCount.passed).toBe(false);
    expect(
      issueTexts(teamAResult.rules.rosterCount.violations).some((v) =>
        v.includes('Two-way')
      )
    ).toBe(true);
    expect(issueTexts(result.violations).some((v) => v.includes('Two-way'))).toBe(
      true
    );
    expect(result.legal).toBe(false);
  });
});
