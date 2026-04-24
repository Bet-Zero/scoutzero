import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues';

const yearKey = 2025;
const season = `${yearKey - 1}-${String(yearKey).slice(-2)}`;

type BycTestPlayer = {
  name: string;
  isBYC: boolean;
  previousSalary: number;
  matchOutgoing?: number;
  matchIncoming?: number;
  contract: {
    salariesByYear: Array<{ season: string; salary: number }>;
  };
};

function makePlayer({
  previousSalary,
  newSalary,
}: {
  previousSalary: number;
  newSalary: number;
}): BycTestPlayer {
  return {
    name: 'BYC Guy',
    isBYC: true,
    previousSalary,
    contract: {
      salariesByYear: [{ season, salary: newSalary }],
    },
  };
}

describe('BYC outgoing uses max(prior, 50% of new)', () => {
  it('uses prior salary when larger', () => {
    const player = makePlayer({
      previousSalary: 12_000_000,
      newSalary: 20_000_000,
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(12_000_000);
    expect(player.matchIncoming).toBe(20_000_000);
  });

  it('uses 50% of new salary when larger', () => {
    const player = makePlayer({
      previousSalary: 10_000_000,
      newSalary: 30_000_000,
    });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(15_000_000);
    expect(player.matchIncoming).toBe(30_000_000);
  });
});
