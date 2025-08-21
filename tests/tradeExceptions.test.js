import { describe, it, expect, beforeEach } from 'vitest';
import { validateTradeExceptions } from '@/utils/architect/tradeMachine/rules/validateTradeExceptions.js';

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
  name: `Player ${Math.random().toString(36).substring(7)}`,
  salary,
  acquiredViaTPE: true,
  tpeId,
});

const makeTeam = (tpe, playerSalary = 4_000_000) => ({
  incomingPlayers: [makePlayer(playerSalary, tpe.id)],
  tradeExceptions: [tpe],
  currentRoster: Array(14).fill({}), // Minimum roster size
});

describe('Trade Exception Validation', () => {
  it('allows valid TPE usage and updates remaining balance', () => {
    const tpe = { id: '1', amount: 5_000_000, expiryDate: futureDate() };
    const team = makeTeam(tpe);

    const result = validateTradeExceptions(team);

    expect(result.violations).toEqual([]);
    expect(team.tradeExceptions[0].remaining).toBe(1_000_000);
    expect(team.tradeExceptions[0].isUsed).toBe(false);
  });

  it('fully consumes TPE when salary matches exactly', () => {
    const tpe = { id: '1', amount: 4_000_000, expiryDate: futureDate() };
    const team = makeTeam(tpe);

    validateTradeExceptions(team);

    expect(team.tradeExceptions[0].remaining).toBe(0);
    expect(team.tradeExceptions[0].isUsed).toBe(true);
  });

  it('blocks expired TPEs', () => {
    const tpe = { id: '1', amount: 5_000_000, expiryDate: pastDate() };
    const team = makeTeam(tpe);

    const result = validateTradeExceptions(team);

    expect(result.violations[0]).toMatch(/expired/);
    expect(team.tradeExceptions[0].isUsed).toBeUndefined();
  });

  it('blocks insufficient TPEs', () => {
    const tpe = { id: '1', amount: 3_000_000, expiryDate: futureDate() };
    const team = makeTeam(tpe);

    const result = validateTradeExceptions(team);

    expect(result.violations[0]).toMatch(/too small/);
    expect(team.tradeExceptions[0].isUsed).toBeUndefined();
  });

  it('prevents concurrent TPE usage', () => {
    const tpe = {
      id: '1',
      amount: 5_000_000,
      expiryDate: futureDate(),
      isBeingUsed: true, // Simulate concurrent usage
    };
    const team = makeTeam(tpe);

    const result = validateTradeExceptions(team);

    expect(result.violations[0]).toMatch(/already being processed/);
  });

  it('handles missing expiration date', () => {
    const tpe = { id: '1', amount: 5_000_000 }; // No expiry
    const team = makeTeam(tpe);

    const result = validateTradeExceptions(team);

    expect(result.violations).toEqual([]);
    expect(team.tradeExceptions[0].remaining).toBe(1_000_000);
  });

  it('processes multiple TPEs correctly', () => {
    const team = {
      incomingPlayers: [
        makePlayer(2_000_000, 'tpe1'),
        makePlayer(3_000_000, 'tpe2'),
      ],
      tradeExceptions: [
        { id: 'tpe1', amount: 2_000_000, expiryDate: futureDate() },
        { id: 'tpe2', amount: 3_000_000, expiryDate: futureDate() },
      ],
      currentRoster: Array(14).fill({}),
    };

    const result = validateTradeExceptions(team);

    expect(result.violations).toEqual([]);
    expect(team.tradeExceptions[0].remaining).toBe(0);
    expect(team.tradeExceptions[1].remaining).toBe(0);
  });
});
