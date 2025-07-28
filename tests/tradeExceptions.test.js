import { describe, it, expect } from 'vitest';
import { validateTradeExceptions } from '../src/utils/architect/tradeMachine/tradeValidatorNewRules.js';

const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString();
};

const pastDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return d.toISOString();
};

const makePlayer = (salary, tpeId) => ({
  name: 'Player',
  salary,
  acquiredViaTPE: true,
  tpeId,
});

const makeTeam = (tpe) => ({
  incomingPlayers: [makePlayer(4_000_000, tpe.id)],
  tradeExceptions: [tpe],
});

describe('validateTradeExceptions', () => {
  it('allows valid TPE usage and marks it used', () => {
    const tpe = { id: '1', amount: 5_000_000, remaining: 5_000_000, expiry: futureDate() };
    const team = makeTeam(tpe);
    const result = validateTradeExceptions(team);
    expect(result).toEqual([]);
    expect(team.tradeExceptions[0].isUsed).toBe(true);
    expect(team.tradeExceptions[0].remaining).toBe(1_000_000);
  });

  it('detects expired TPE', () => {
    const tpe = { id: '1', amount: 5_000_000, remaining: 5_000_000, expiry: pastDate() };
    const team = makeTeam(tpe);
    const result = validateTradeExceptions(team);
    expect(result[0]).toMatch(/expired/);
    expect(team.tradeExceptions[0].isUsed).toBeUndefined();
  });

  it('detects insufficient TPE amount', () => {
    const tpe = { id: '1', amount: 3_000_000, remaining: 3_000_000, expiry: futureDate() };
    const team = makeTeam(tpe);
    const result = validateTradeExceptions(team);
    expect(result[0]).toMatch(/TPE too small/);
    expect(team.tradeExceptions[0].isUsed).toBeUndefined();
  });
});
