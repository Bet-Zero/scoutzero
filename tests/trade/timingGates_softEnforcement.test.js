import { describe, it, expect, afterEach } from 'vitest';
import { enforceTiming } from '@/utils/architect/tradeMachine/rules/enforceTiming.js';
import { validationFlags } from '@/config/validationFlags.js';

const run = (team, tradeCtx) => {
  const warns = [];
  const rejects = [];
  enforceTiming(team, tradeCtx, {
    warn: (m) => warns.push(m),
    reject: (m) => rejects.push(m),
  });
  return { warns, rejects };
};

describe('timing gates soft enforcement', () => {
  afterEach(() => {
    validationFlags.timingEnforcement = 'warn';
  });

  it('moratorium rule respects flag', () => {
    const team = { outgoingPlayers: [{ name: 'P1' }] };
    const tradeCtx = { tradeDate: '2024-07-03' };
    validationFlags.timingEnforcement = 'error';
    let r = run(team, tradeCtx);
    expect(r.rejects).toHaveLength(1);
    expect(r.rejects[0]).toMatch(/moratorium/i);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
    expect(r.warns[0]).toMatch(/moratorium/i);
  });

  it('dec 15 / jan 15 eligibility respects flag', () => {
    const team = {
      outgoingPlayers: [{ name: 'P1', eligibleTradeDate: '2024-12-15' }],
    };
    const tradeCtx = { tradeDate: '2024-12-01' };
    validationFlags.timingEnforcement = 'error';
    let r = run(team, tradeCtx);
    expect(r.rejects).toHaveLength(1);
    expect(r.rejects[0]).toMatch(/eligible/i);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
  });

  it('30-day rule respects flag', () => {
    const team = {
      outgoingPlayers: [{ name: 'P1', signedDate: '2024-01-15' }],
    };
    const tradeCtx = { tradeDate: '2024-02-01' };
    validationFlags.timingEnforcement = 'error';
    let r = run(team, tradeCtx);
    expect(r.rejects).toHaveLength(1);
    expect(r.rejects[0]).toMatch(/30/);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
  });

  it('2-month aggregation rule respects flag', () => {
    const team = {
      outgoingPlayers: [
        { name: 'P1', signedDate: '2023-12-25' },
        { name: 'P2', signedDate: '2023-10-01' },
      ],
    };
    const tradeCtx = { tradeDate: '2024-02-01' };
    validationFlags.timingEnforcement = 'error';
    let r = run(team, tradeCtx);
    expect(r.rejects).toHaveLength(1);
    expect(r.rejects[0]).toMatch(/aggregate/i);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
  });
});
