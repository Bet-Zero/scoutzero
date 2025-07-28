// tradeValidator.test.js
import { describe, it, expect } from 'vitest';
import { validateTrade } from '../src/utils/architect/tradeMachine/tradeValidator.js';
import capProjections from '../src/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (
  name,
  salary,
  signAndTrade = false,
  contractYears = 4
) => ({
  name,
  signAndTrade,
  contractYears,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (name, totalSalary, rosterSize = 14, picks = []) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks,
});

describe('tradeValidator', () => {
  it('enforces salary matching when a team is over the cap', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 20_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    expect(result.teamResults[0].reason).toMatch(/Incoming salary exceeds/);
    expect(result.teamResults[0].checks.salaryMatching).toBe(false);
  });

  it('flags trades that would violate a hard cap', () => {
    const teamA = makeTeam('A', 190_000_000);
    const teamB = makeTeam('B', 150_000_000);
    const incoming = makePlayer('Bstar', 10_000_000);
    teamB.players.push(incoming);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [], hardCapped: true },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    expect(result.teamResults[0].reason).toContain(
      'Hard cap exceeded (1st Apron)'
    );
    expect(result.teamResults[0].checks.hardCap).toBe(false);
  });

  it('enforces sign-and-trade restrictions', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 10_000_000, true);
    const extra = makePlayer('Aextra', 5_000_000);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat, extra);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat, extra], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    expect(result.teamResults[0].reason).toContain(
      'Sign-and-trade player must be traded alone.'
    );
    expect(result.teamResults[0].checks.signAndTrade).toBe(false);
    expect(result.teamResults[1].legal).toBe(true);
    expect(result.teamResults[1].checks.signAndTrade).toBe(true);
  });

  it('allows valid sign-and-trade deals', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 20_000_000, true, 4);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(true);
  });

  it('blocks sign-and-trade hard cap violations', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 195_500_000);
    const sat = makePlayer('Astar', 20_000_000, true, 4);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.reason).toContain('hard-cap');
  });

  it('requires sign-and-trade contracts to be 3-4 years', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 10_000_000, true, 2);
    const bPlayer = makePlayer('Bstar', 10_000_000);
    teamA.players.push(sat);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.reason).toContain('must be 3-4 years');
  });

  it('detects Stepien Rule violations', () => {
    const teamA = makeTeam('A', 100_000_000, 14, [
      { year: 2027, round: '1st' },
      { year: 2028, round: '1st' },
    ]);
    const teamB = makeTeam('B', 100_000_000);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [],
          picksOut: [
            { year: 2027, round: '1st' },
            { year: 2028, round: '1st' },
          ],
        },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    expect(result.teamResults[0].reason).toContain(
      'Violates Stepien Rule (consecutive future 1sts).'
    );
    expect(result.teamResults[0].checks.stepien).toBe(false);
    expect(result.teamResults[1].checks.stepien).toBe(true);
  });

  it('allows protected picks to bypass Stepien Rule', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [],
          picksOut: [
            { year: 2027, round: '1st', protection: 'Top 5' },
            { year: 2028, round: '1st' },
          ],
        },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(true);
  });

  it('enforces second apron restrictions', () => {
    const teamA = makeTeam('A', 190_000_000); // Above 2nd apron
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer1 = makePlayer('A1', 10_000_000);
    const aPlayer2 = makePlayer('A2', 5_000_000);
    const bPlayer = makePlayer('B1', 15_000_000);
    teamA.players.push(aPlayer1, aPlayer2);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer1, aPlayer2], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.reason).toContain('Second apron team cannot aggregate salaries');
  });

  it('prevents second apron teams from taking back more salary', () => {
    const teamA = makeTeam('A', 190_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('A1', 10_000_000);
    const bPlayer = makePlayer('B1', 12_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.reason).toContain(
      'Second apron team cannot receive more salary than sent'
    );
  });

  it('blocks cash considerations for second apron teams', () => {
    const teamA = makeTeam('A', 190_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('A1', 1_000_000);
    const bPlayer = makePlayer('B1', 1_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [], cashSent: 1_000_000 },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.reason).toContain(
      'Second apron team cannot include cash in trades'
    );
  });

  it('restricts trading picks more than 7 years out', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [],
          picksOut: [{ year: 2033, round: '1st' }],
        },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(false);
    expect(result.reason).toContain('Cannot trade picks beyond');
  });

  it('handles 3-team trades correctly', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const teamC = makeTeam('C', 100_000_000);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [makePlayer('A1', 10_000_000)], picksOut: [] },
        { team: teamB, sends: [makePlayer('B1', 5_000_000)], picksOut: [] },
        { team: teamC, sends: [makePlayer('C1', 5_000_000)], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.overallLegal).toBe(true);
    expect(result.summaryByTeamIndex[0].playersIn.length).toBe(2);
    expect(result.summaryByTeamIndex[1].playersIn.length).toBe(1);
  });

  it('provides summary and financial deltas', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 5_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    const summaryA = result.summaryByTeamIndex[0];
    const summaryB = result.summaryByTeamIndex[1];

    expect(summaryA.playersOut).toContain('Astar');
    expect(summaryA.playersIn).toContain('Bstar');
    expect(summaryA.capDelta).toBe(-5_000_000);

    expect(summaryB.capDelta).toBe(5_000_000);
    expect(result.teamResults[0]).toHaveProperty('totalSalary');
    expect(result.teamResults[0]).toHaveProperty('capRoom');
  });
});
