import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/utils/architect/tradeMachine/utils/matchingValues.js';

const yearKey = 2025;

function makePlayer({ previousSalary, newSalary }) {
  return {
    name: 'BYC Guy',
    isBYC: true,
    previousSalary,
    contract_clean: {
      salaries_by_year: {
        [yearKey]: { salary: newSalary },
      },
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
