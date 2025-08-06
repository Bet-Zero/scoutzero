import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (name, salary) => ({
  name,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (name, totalSalary = 100_000_000, rosterSize = 14) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

describe('order of operations: conversions before matching', () => {
  it('BYC conversion runs before matching', () => {
    const bycPlayer = {
      name: 'BYC Guy',
      isBYC: true,
      previousSalary: 9_000_000,
      matchOutgoing: 5_000_000,
      contract_clean: {
        salaries_by_year: { [currentYear]: { salary: 10_000_000 } },
      },
    };

    const teamA = makeTeam('A');
    const teamB = makeTeam('B');
    teamA.players.push(bycPlayer);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [bycPlayer], picksOut: [] },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(bycPlayer.matchOutgoing).toBe(9_000_000);
    expect(res.teamResults[0].salaryOut).toBe(9_000_000);
  });

  it('poison pill average runs before matching', () => {
    const ppPlayer = {
      name: 'PP Player',
      isPoisonPill: true,
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
      matchIncoming: 4_000_000,
      contract_clean: {
        salaries_by_year: { [currentYear]: { salary: 10_000_000 } },
      },
    };

    const teamA = makeTeam('A');
    const teamB = makeTeam('B');
    teamB.players.push(ppPlayer);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [ppPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(ppPlayer.matchIncoming).toBe(8_500_000);
    expect(res.teamResults[0].salaryIn).toBe(8_500_000);
  });
});
