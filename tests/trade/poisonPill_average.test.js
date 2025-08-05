import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '@/utils/architect/tradeMachine/tradeValidator.js';

const yearKey = 2025;

function makePoisonPill({ currentSalary, extensionYears }) {
  return {
    name: 'Poison Pill Player',
    isPoisonPill: true,
    currentSalary,
    contract_clean: {
      salaries_by_year: {
        [yearKey]: { salary: currentSalary },
      },
    },
    ...(extensionYears ? { extensionYears } : {}),
  };
}

describe('Poison Pill matching values', () => {
  it('averages current and extension years for incoming', () => {
    const player = makePoisonPill({
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

  it('falls back to current salary when extension years missing', () => {
    const player = makePoisonPill({ currentSalary: 5_000_000 });
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(5_000_000);
    expect(player.matchIncoming).toBe(5_000_000);
  });

  it('coexists with BYC on outgoing while using poison pill average for incoming', () => {
    const player = {
      name: 'BYC Poison Pill',
      isBYC: true,
      previousSalary: 8_000_000,
      isPoisonPill: true,
      currentSalary: 4_000_000,
      extensionYears: [
        { salary: 10_000_000 },
        { salary: 10_000_000 },
        { salary: 10_000_000 },
      ],
      contract_clean: {
        salaries_by_year: {
          [yearKey]: { salary: 30_000_000 },
        },
      },
    };
    computeMatchingValues({ teams: [{ sends: [player] }], yearKey });
    expect(player.matchOutgoing).toBe(15_000_000);
    expect(player.matchIncoming).toBe(8_500_000);
  });
});
