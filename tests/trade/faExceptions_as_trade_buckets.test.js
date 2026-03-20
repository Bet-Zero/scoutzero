import { describe, it, expect } from 'vitest';
import { validateFaExceptionUsage } from '@/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage';
import { validationFlags } from '@/config/validationFlags.js';

const baseTeam = {
  context: {
    yearKey: 2025,
    capSettings: { firstApron: 172_000_000, secondApron: 182_000_000 },
  },
  team: { faExceptionBuckets: [] },
  incomingPlayers: [],
  outgoingPlayers: [],
  salaryOut: 0,
  salaryIn: 0,
  teamTotalSalary: 0,
  projectedSalary: 0,
};

const makePlayer = (salary, extra = {}) => ({
  name: 'Player',
  matchIncoming: salary,
  player_id: Math.random(),
  ...extra,
});

describe('FA exceptions as trade buckets', () => {
  it('allows eligible usage and hard-caps team', () => {
    validationFlags.faExceptionTrade = 'on';
    const team = {
      ...baseTeam,
      teamTotalSalary: 150_000_000,
      projectedSalary: 158_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [
        makePlayer(8_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          fromTeamId: 2,
        }),
      ],
    };
    const v = validateFaExceptionUsage(team);
    expect(v).toEqual([]);
    expect(team.team.faExceptionBuckets[0].remaining).toBe(2_000_000);
    expect(team.team.hardCapFirstApron.active).toBe(true);
  });

  it('rejects usage at or above first apron', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 172_000_000,
      projectedSalary: 180_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [
        makePlayer(8_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          fromTeamId: 2,
        }),
      ],
    };
    const v = validateFaExceptionUsage(team);
    expect(v[0]).toMatch(/First Apron/);
  });

  it('rejects when post-trade salary exceeds first apron', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 170_000_000,
      projectedSalary: 175_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [
        makePlayer(5_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          fromTeamId: 2,
        }),
      ],
    };
    const v = validateFaExceptionUsage(team);
    expect(v[0]).toMatch(/exceed First Apron/);
  });

  it('rejects usage for second apron teams', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 185_000_000,
      projectedSalary: 193_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [
        makePlayer(8_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          fromTeamId: 2,
        }),
      ],
    };
    const v = validateFaExceptionUsage(team);
    expect(v[0]).toMatch(/Second Apron/);
  });

  it('rejects aggregation with outgoing salary', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 150_000_000,
      projectedSalary: 158_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [
        makePlayer(8_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          fromTeamId: 2,
        }),
      ],
      outgoingPlayers: [{ toTeamId: 2, salary: 0 }],
    };
    const v = validateFaExceptionUsage(team);
    expect(v[0]).toMatch(/Cannot combine FA Exception/);
  });

  it('rejects splitting across buckets', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 150_000_000,
      projectedSalary: 158_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [
        makePlayer(8_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: ['NTMLE', 'BAE'],
          fromTeamId: 2,
        }),
      ],
    };
    const v = validateFaExceptionUsage(team);
    expect(v[0]).toMatch(/Cannot combine FA Exception/);
  });

  it('rejects when bucket is too small', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 150_000_000,
      projectedSalary: 158_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 5_000_000 }] },
      incomingPlayers: [
        makePlayer(8_000_000, {
          absorptionMode: 'FA_EXCEPTION',
          bucketType: 'NTMLE',
          fromTeamId: 2,
        }),
      ],
    };
    const v = validateFaExceptionUsage(team);
    expect(v[0]).toMatch(/Insufficient FA Exception balance/);
  });

  it('auto-selects bucket when enabled', () => {
    const team = {
      ...baseTeam,
      teamTotalSalary: 150_000_000,
      projectedSalary: 158_000_000,
      team: { faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }] },
      incomingPlayers: [makePlayer(8_000_000, { fromTeamId: 2 })],
    };
    const v = validateFaExceptionUsage(team);
    expect(v).toEqual([]);
    expect(team.incomingPlayers[0].absorptionMode).toBe('FA_EXCEPTION');
    expect(team.notes[0]).toMatch(/hard-capped/);
  });
});
