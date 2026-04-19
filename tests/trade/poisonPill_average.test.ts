import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues';

const yearKey = 2025;
const season = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

const makePlayer = ({
  currentSalary,
  extensionYears = [],
  isBYC = false,
  previousSalary,
  newSalary,
}) => ({
  name: 'PP Player',
  isPoisonPill: true,
  currentSalary,
  extensionYears,
  isBYC,
  previousSalary,
  contract: {
    salariesByYear: [
      { season, salary: newSalary ?? extensionYears[0]?.salary ?? currentSalary },
    ],
  },
});

describe('Poison Pill matching values', () => {
  it('uses average of current plus extension for incoming', () => {
    const player = makePlayer({
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(4_000_000);
    expect(player.matchIncoming).toBe(8_500_000);
  });

  it('defaults to current salary when no extension years', () => {
    const player = makePlayer({ currentSalary: 4_000_000 });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(4_000_000);
    expect(player.matchIncoming).toBe(4_000_000);
  });

  it('coexists with BYC for outgoing', () => {
    const player = makePlayer({
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
      isBYC: true,
      previousSalary: 4_000_000,
      newSalary: 10_000_000,
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(5_000_000); // BYC max(prior, 50% new)
    expect(player.matchIncoming).toBe(8_500_000);
  });
});
