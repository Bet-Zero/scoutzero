import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/features/architect/utils/capProjections.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

const makePlayer = (name, salary, extra = {}) => ({
  name,
  player_id: name.toLowerCase().replace(/\s/g, '_'),
  contract: { salariesByYear: [{ season, salary }] },
  ...extra,
});

const makeTeam = (name, totalSalary, players, extra = {}) => ({
  teamName: name,
  teamId: name,
  totalSalary,
  players,
  ...extra,
});

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

describe('roster legality via validateTrade', () => {
  it('blocks trade that pushes a team over max standard roster (15)', () => {
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

    // Team A: 15 - 1 sent + 3 received = 17 → over max
    const teamAResult = result.teamResults[0];
    expect(teamAResult.rules.rosterCount).toBeDefined();
    expect(teamAResult.rules.rosterCount.passed).toBe(false);
    expect(
      issueTexts(teamAResult.rules.rosterCount.violations).some((v) =>
        v.includes('exceeds maximum')
      )
    ).toBe(true);
    expect(
      issueTexts(result.violations).some((v) => v.includes('exceeds maximum'))
    ).toBe(true);
    expect(result.legal).toBe(false);
  });

  it('blocks trade that drops a team below min standard roster (14)', () => {
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

    // Team A: 14 - 3 sent + 1 received = 12 → below min
    const teamAResult = result.teamResults[0];
    expect(teamAResult.rules.rosterCount).toBeDefined();
    expect(teamAResult.rules.rosterCount.passed).toBe(false);
    expect(
      issueTexts(teamAResult.rules.rosterCount.violations).some((v) =>
        v.includes('below minimum')
      )
    ).toBe(true);
    expect(
      issueTexts(result.violations).some((v) => v.includes('below minimum'))
    ).toBe(true);
    expect(result.legal).toBe(false);
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
