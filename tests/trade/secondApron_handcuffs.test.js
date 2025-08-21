import { describe, it, expect } from 'vitest';
import { enforceSecondApronHandcuffs } from '@/utils/architect/tradeMachine/rules/enforceSecondApronHandcuffs.js';

const baseTeam = {
  context: { yearKey: 2025 },
  postTradeStatus: { isAtOrAboveSecondApron: true },
  tradeExceptions: [],
  cashSent: 0,
  cashReceived: 0,
};

const makePlayer = (salary = 0, extra = {}) => ({ salary, ...extra });

describe('second apron handcuffs', () => {
  it('rejects aggregation into one slot', () => {
    const team = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000), makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(20_000_000)],
      salaryOut: 20_000_000,
      salaryIn: 20_000_000,
    };
    const v = enforceSecondApronHandcuffs(team, {});
    expect(v[0]).toMatch(/aggregate/);
  });

  it('rejects cash inclusion', () => {
    const team = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_000)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_000,
      cashSent: 1,
    };
    const v = enforceSecondApronHandcuffs(team, {});
    expect(v[0]).toMatch(/cash/);
  });

  it('rejects prior-year TPE usage', () => {
    const team = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000), makePlayer(5_000_000)],
      incomingPlayers: [
        makePlayer(10_000_000),
        makePlayer(5_000_000, { acquiredViaTPE: true, tpeId: 'old' }),
      ],
      salaryOut: 15_000_000,
      salaryIn: 15_000_000,
      tradeExceptions: [{ id: 'old', amount: 5_000_000, createdSeason: 2024 }],
    };
    const v = enforceSecondApronHandcuffs(team, {});
    expect(v[0]).toMatch(/prior-year/);
  });

  it('enforces 100% salary matching', () => {
    const failTeam = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_001)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_001,
    };
    const okTeam = {
      ...baseTeam,
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_000)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_000,
    };
    expect(enforceSecondApronHandcuffs(failTeam, {}).length).toBeGreaterThan(0);
    expect(enforceSecondApronHandcuffs(okTeam, {})).toEqual([]);
  });
});
