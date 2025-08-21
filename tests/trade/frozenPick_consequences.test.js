import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const makePlayer = (name, salary, year) => ({
  name,
  contract_clean: { salaries_by_year: { [year]: { salary } } },
});

const makeTeam = (id, name, totalSalary, year, rosterSize = 14) => ({
  id,
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000, year)
  ),
  picks: [],
});

function runPickTrade(pick, currentYear) {
  const teamA = makeTeam(1, 'A', 190_000_000, currentYear);
  const teamB = makeTeam(2, 'B', 100_000_000, currentYear);
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
    const pick = { year: 2032, round: 1, teamId: 1 };
    const res = runPickTrade(pick, 2025);
    expect(res.teamResults[0].legal).toBe(false);
    expect(res.teamResults[0].violations).toContain(
      'Second apron team cannot trade its own 7-year-out first-round pick.'
    );
  });

  it('rejects protected 2032 first for second apron team', () => {
    const pick = { year: 2032, round: 1, teamId: 1, protection: 'top 10' };
    const res = runPickTrade(pick, 2025);
    expect(res.teamResults[0].legal).toBe(false);
    expect(res.teamResults[0].violations).toContain(
      'Second apron team cannot trade its own 7-year-out first-round pick.'
    );
  });

  it('allows 2031 first for second apron team', () => {
    const pick = { year: 2031, round: 1, teamId: 1 };
    const res = runPickTrade(pick, 2025);
    console.log('Team A salary:', res.teamResults[0].team?.totalSalary);
    console.log('Team A violations:', res.teamResults[0].violations);
    console.log('Team A legal:', res.teamResults[0].legal);
    console.log('Cap settings:', res.capSettings);
    expect(res.teamResults[0].legal).toBe(true);
  });

  it('allows 2033 first for second apron team', () => {
    const pick = { year: 2033, round: 1, teamId: 1 };
    const res = runPickTrade(pick, 2027);
    expect(res.teamResults[0].legal).toBe(true);
  });
});
