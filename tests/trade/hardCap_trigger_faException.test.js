import { describe, it, expect } from 'vitest';
import { validateFaExceptionUsage } from '@/utils/architect/tradeMachine/tradeValidator.js';
import { isHardCappedAtFirstApron, wouldExceedHardCap } from '@/utils/architect/hardCapUtils.js';

const teamBase = {
  context: {
    yearKey: 2025,
    capSettings: { firstApron: 172_000_000, secondApron: 182_000_000 },
  },
  team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
  incomingPlayers: [
    {
      name: 'Player',
      matchIncoming: 8_000_000,
      absorptionMode: 'FA_EXCEPTION',
      bucketType: 'NTMLE',
      fromTeamId: 2,
    },
  ],
  outgoingPlayers: [],
  salaryOut: 0,
  salaryIn: 8_000_000,
  teamTotalSalary: 150_000_000,
  projectedSalary: 158_000_000,
};

describe('hard cap trigger via FA exception', () => {
  it('marks team hard-capped at first apron', () => {
    const team = JSON.parse(JSON.stringify(teamBase));
    const v = validateFaExceptionUsage(team);
    expect(v).toEqual([]);
    expect(isHardCappedAtFirstApron(team.team, 2025)).toBe(true);
    expect(
      wouldExceedHardCap(team.team, 173_000_000, team.context.capSettings)
    ).toBe(true);
  });
});
