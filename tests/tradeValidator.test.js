import { describe, it, expect } from 'vitest';
import { validateTrade } from '../src/utils/architect/tradeMachine/tradeValidator.js';
import capProjections from '../src/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (name, salary, signAndTrade = false) => ({
  name,
  signAndTrade,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (name, totalSalary, rosterSize = 14) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
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

  it('detects Stepien Rule violations', () => {
    const teamA = makeTeam('A', 100_000_000);
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
