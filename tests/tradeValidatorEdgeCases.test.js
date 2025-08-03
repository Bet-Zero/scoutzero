import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (name, salary, signAndTrade = false, contractYears = 4) => ({
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

describe('tradeValidator edge cases', () => {
  it('allows 3-team trade mixing players, picks and cash when below aprons', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const teamC = makeTeam('C', 100_000_000);
    const aPlayer = makePlayer('A1', 8_000_000);
    const bPlayer = makePlayer('B1', 5_000_000);
    const cPlayer = makePlayer('C1', 7_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);
    teamC.players.push(cPlayer);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [aPlayer],
          picksOut: [{ year: 2027, round: '2nd' }],
          cashSent: 1_000_000,
        },
        { team: teamB, sends: [bPlayer], picksOut: [] },
        { team: teamC, sends: [cPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(true);
    expect(result.reason).toBe('Valid trade');
  });

  it('fails when a team trades consecutive unprotected firsts in a 3-team deal', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const teamC = makeTeam('C', 100_000_000);

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
        { team: teamC, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    expect(result.teamResults[0].violations[0]).toContain('Stepien');
  });

  it('allows protected picks to avoid Stepien violations', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const teamC = makeTeam('C', 100_000_000);

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
        { team: teamC, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(true);
  });

  it('blocks second apron teams aggregating salary from multiple clubs', () => {
    const teamA = makeTeam('A', 210_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const teamC = makeTeam('C', 100_000_000);
    const a = makePlayer('A1', 10_000_000);
    const b = makePlayer('B1', 8_000_000);
    const c = makePlayer('C1', 6_000_000);
    teamA.players.push(a);
    teamB.players.push(b);
    teamC.players.push(c);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [a], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
        { team: teamC, sends: [c], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toMatch(/aggregate/);
  });

  it('disallows cash from teams over the second apron', () => {
    const teamA = makeTeam('A', 210_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const a = makePlayer('A1', 2_000_000);
    const b = makePlayer('B1', 2_000_000);
    teamA.players.push(a);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [a], picksOut: [], cashSent: 1_000_000 },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain('cash');
  });

  it('permits cash when all teams are below the second apron', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const a = makePlayer('A1', 2_000_000);
    const b = makePlayer('B1', 2_000_000);
    teamA.players.push(a);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [a], picksOut: [], cashSent: 500_000 },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(true);
  });
});
