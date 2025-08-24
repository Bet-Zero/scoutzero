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

  // For TPE usage, Team A should not send out any players - just use the TPE to acquire
  return validateTrade({
    teams: [
      { team: teamA, sends: [], picksOut: [], appliedTPEs }, // No outgoing players when using TPE
      { team: teamB, sends: [bPlayer], picksOut: [] },
    ],
    capProjections,
    currentYear,
  });
}

describe('second apron prior-year TPE usage', () => {
  it('rejects prior-year TPEs for second-apron teams', () => {
    const res = runTrade(
      [{ amount: 5_000_000, createdSeason: currentYear - 1 }],
      220_000_000 // Above 2025 second apron threshold of ~207.8M
    );
    expect(res.teamResults[0].legal).toBe(false);
    expect(res.teamResults[0].violations).toContain(
      'Second apron: prior-year TPEs cannot be used.'
    );
  });

  it('rejects current-year TPEs for second-apron teams', () => {
    const res = runTrade(
      [{ amount: 5_000_000, createdSeason: currentYear }],
      220_000_000 // Above 2025 second apron threshold of ~207.8M
    );
    expect(res.teamResults[0].legal).toBe(false);
    expect(res.teamResults[0].violations).toContain(
      'Second apron team cannot use trade exceptions'
    );
  });

  it('allows prior-year TPEs for teams below the apron', () => {
    const res = runTrade(
      [{ amount: 5_000_000, createdSeason: currentYear - 1 }],
      100_000_000
    );
    expect(res.teamResults[0].legal).toBe(true);
  });
});
