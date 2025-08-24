import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (name, salary) => ({
  name,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (name, totalSalary, rosterSize = 14) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

function runTrade(appliedTPEs, teamSalary, otherTeamSalary = 100_000_000) {
  const teamA = makeTeam('A', teamSalary);
  const teamB = makeTeam('B', otherTeamSalary);
  const bPlayer = makePlayer('Bstar', 5_000_000);
  teamB.players.push(bPlayer);

  return validateTrade({
    teams: [
      { team: teamA, sends: [], picksOut: [], appliedTPEs },
      { team: teamB, sends: [bPlayer], picksOut: [] },
    ],
    capProjections,
    currentYear,
  });
}

describe('debug second apron detection', () => {
  it('should detect team with 250M salary as second apron', () => {
    const res = runTrade(
      [{ amount: 5_000_000, createdSeason: currentYear - 1 }],
      250_000_000 // Way above any second apron threshold
    );
    
    console.log('Team 250M - Legal:', res.teamResults[0].legal);
    console.log('Team 250M - Violations:', res.teamResults[0].violations);
    
    expect(res.teamResults[0].legal).toBe(false);
  });

  it('should allow team with 150M salary to use TPEs', () => {
    const res = runTrade(
      [{ amount: 5_000_000, createdSeason: currentYear - 1 }],
      150_000_000 // Below second apron
    );
    
    console.log('Team 150M - Legal:', res.teamResults[0].legal);
    console.log('Team 150M - Violations:', res.teamResults[0].violations);
    
    expect(res.teamResults[0].legal).toBe(true);
  });
});