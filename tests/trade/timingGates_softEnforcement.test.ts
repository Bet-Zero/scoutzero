import { describe, it, expect, afterEach } from 'vitest';
import { enforceTiming } from '@/features/architect/utils/tradeMachine/rules/timingValidation';
import { validationFlags } from '@/config/validationFlags';

const run = (team, tradeCtx) => {
  const warns = [];
  const rejects = [];
  const result = enforceTiming(team, tradeCtx, {
    warn: (m) => warns.push(m),
    reject: (m) => rejects.push(m),
  });
  return { warns, rejects, result };
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
    expect(r.result.violations).toHaveLength(1);
    expect(r.result.warnings).toHaveLength(0);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
    expect(r.warns[0]).toMatch(/moratorium/i);
    expect(r.result.passed).toBe(true);
    expect(r.result.violations).toHaveLength(0);
    expect(r.result.warnings).toHaveLength(1);
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
    expect(r.result.violations).toHaveLength(1);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
    expect(r.result.passed).toBe(true);
    expect(r.result.warnings).toHaveLength(1);
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
    expect(r.result.violations).toHaveLength(1);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns).toHaveLength(1);
    expect(r.result.passed).toBe(true);
    expect(r.result.warnings).toHaveLength(1);
  });

  it('does not surface the retired 2-month aggregation rule', () => {
    const team = {
      outgoingPlayers: [
        { name: 'P1', signedDate: '2024-01-20' },
        { name: 'P2', signedDate: '2024-01-10' },
      ],
    };
    const tradeCtx = { tradeDate: '2024-02-15' };
    validationFlags.timingEnforcement = 'error';
    let r = run(team, tradeCtx);
    expect(r.rejects.length).toBeGreaterThanOrEqual(1);
    expect(r.rejects.some((m) => /aggregate/i.test(m))).toBe(false);
    expect(
      r.result.violations.some((issue) =>
        /acquired within the last 60 days/i.test(issue.message)
      )
    ).toBe(false);
    validationFlags.timingEnforcement = 'warn';
    r = run(team, tradeCtx);
    expect(r.warns.length).toBeGreaterThanOrEqual(1);
    expect(r.warns.some((m) => /aggregate/i.test(m))).toBe(false);
    expect(
      r.result.warnings.some((issue) =>
        /acquired within the last 60 days/i.test(issue.message)
      )
    ).toBe(false);
  });
});
