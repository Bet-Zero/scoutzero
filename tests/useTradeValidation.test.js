import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import { normalizeValidationResult } from '@/hooks/tradeMachine/useTradeValidation.js';
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

describe('normalizeValidationResult', () => {
  it('passes valid trades', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 10_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const raw = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    const normalized = normalizeValidationResult(raw);
    expect(normalized.passed).toBe(true);
    expect(normalized.perTeam.A.passed).toBe(true);
    expect(normalized.perTeam.B.passed).toBe(true);
  });

  it('fails trades with violations', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 10_000_000, true);
    const extra = makePlayer('Aextra', 5_000_000);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat, extra);
    teamB.players.push(bPlayer);

    const raw = validateTrade({
      teams: [
        { team: teamA, sends: [sat, extra], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    const normalized = normalizeValidationResult(raw);
    const keys = Object.keys(normalized.perTeam);
    expect(normalized.passed).toBe(false);
    expect(normalized.perTeam[keys[0]].passed).toBe(false);
    expect(normalized.perTeam[keys[1]].passed).toBe(true);
  });
});
