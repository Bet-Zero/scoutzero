import { describe, it, expect } from 'vitest';
import { enforceSecondApronHandcuffs } from '@/features/architect/utils/tradeMachine/rules/basicRules';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';

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
    // NOTE: Salary matching for second apron is now enforced by validateSalaryMatching (SSOT)
    // The enforceSecondApronHandcuffs function only handles other handcuffs (aggregation, cash, TPE)
    const capSettings = { salaryCap: 140000000, firstApron: 178000000, secondApron: 190000000 };
    
    const failTeam = {
      ...baseTeam,
      teamTotalSalary: 200000000, // Above second apron
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_001)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_001,
      context: { ...baseTeam.context, capSettings },
    };
    const okTeam = {
      ...baseTeam,
      teamTotalSalary: 200000000, // Above second apron
      outgoingPlayers: [makePlayer(10_000_000)],
      incomingPlayers: [makePlayer(10_000_000)],
      salaryOut: 10_000_000,
      salaryIn: 10_000_000,
      context: { ...baseTeam.context, capSettings },
    };
    
    // Test via validateSalaryMatching which is the SSOT for salary matching rules
    const failResult = validateSalaryMatching(failTeam, { capSettings });
    const okResult = validateSalaryMatching(okTeam, { capSettings });
    
    expect(failResult.violations.length).toBeGreaterThan(0);
    expect(failResult.violations[0]).toMatch(/second apron/i);
    expect(okResult.violations).toEqual([]);
  });
});