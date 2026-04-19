import { describe, it, expect } from 'vitest';
import { getIncomingCeilingForTeam } from '@/features/architect/utils/tradeMachine/utils/salaryMargin';

const capSettings = {
  salaryCap: 141_000_000,
  firstApron: 172_346_000,
  secondApron: 182_794_000,
};

describe('apron matching ceiling', () => {
  const base = {
    salaryOut: 20_000_000,
    incomingPlayers: [],
    tradeExceptions: [],
    context: { capSettings, yearKey: 2025 },
  };

  it('clamps first-apron teams to outgoing salary', () => {
    const team = {
      ...base,
      teamTotalSalary: capSettings.firstApron,
      postTradeStatus: {
        isAtOrAboveFirstApron: true,
        isAtOrAboveSecondApron: false,
      },
    };
    expect(getIncomingCeilingForTeam(team)).toBe(20_000_000);
  });

  it('clamps second-apron teams to outgoing salary', () => {
    const team = {
      ...base,
      teamTotalSalary: capSettings.secondApron,
      postTradeStatus: {
        isAtOrAboveFirstApron: true,
        isAtOrAboveSecondApron: true,
      },
    };
    expect(getIncomingCeilingForTeam(team)).toBe(20_000_000);
  });
});
