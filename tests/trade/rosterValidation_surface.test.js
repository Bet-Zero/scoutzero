import { afterEach, describe, expect, it } from 'vitest';
import {
  enforceRosterRules,
  enforceRosterWindow,
  enforceRosterWindowAdvanced,
  enforceRosterWindowLegacy,
  validateRosterWindow,
  validateRosterWindowLegacy,
} from '@/features/architect/utils/tradeMachine/rules/rosterValidation.js';
import { enforceRosterWindow as tradeValidatorEnforceRosterWindow } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import { validationFlags } from '@/config/validationFlags.js';

const defaultRosterEnforcement = validationFlags.rosterEnforcement;
const defaultTwoWayRoster = validationFlags.twoWayRoster;

afterEach(() => {
  validationFlags.rosterEnforcement = defaultRosterEnforcement;
  validationFlags.twoWayRoster = defaultTwoWayRoster;
});

describe('rosterValidation surface', () => {
  it('preserves the postTradeTeam branch result exactly', () => {
    const result = validateRosterWindow({
      postTradeTeam: {
        players: Array(16).fill({}),
        twoWayPlayers: Array(4).fill({}),
      },
    });

    expect(result).toEqual({
      passed: false,
      violations: [
        'Post-trade roster size (16) exceeds maximum 15 players',
        'Two-way slots exceeded (4/3)',
      ],
      message: 'Roster size requirements not met',
      details:
        'Post-trade roster size (16) exceeds maximum 15 players; Two-way slots exceeded (4/3)',
      rosterCounts: {
        standard: 16,
        twoWay: 4,
      },
    });
  });

  it('preserves the projectedRosterCount branch result exactly', () => {
    const result = validateRosterWindow({
      projectedRosterCount: 13,
      incomingPlayers: [{ contractType: 'two-way' }],
      sends: [],
      team: {
        twoWayPlayers: Array(3).fill({}),
      },
    });

    expect(result).toEqual({
      passed: false,
      violations: [
        'Post-trade roster size (13) below minimum 14 players',
        'Two-way slots exceeded (4/3)',
      ],
      message: 'Roster size requirements not met',
      details:
        'Post-trade roster size (13) below minimum 14 players; Two-way slots exceeded (4/3)',
      rosterCounts: {
        standard: 13,
        twoWay: 4,
      },
    });
  });

  it('preserves the arithmetic fallback branch result exactly', () => {
    const result = validateRosterWindow({
      standardContracts: 14,
      twoWayContracts: 3,
      incomingPlayers: [],
      outgoingPlayers: [],
      receives: [{ isTwoWay: false }, { isTwoWay: true }],
      sends: [{ isTwoWay: false }, { isTwoWay: false }],
    });

    expect(result).toEqual({
      passed: false,
      violations: [
        'Post-trade roster size (13) below minimum 14 players',
        'Two-way slots exceeded (4/3)',
      ],
      message: 'Roster size requirements not met',
      details:
        'Post-trade roster size (13) below minimum 14 players; Two-way slots exceeded (4/3)',
      rosterCounts: {
        standard: 13,
        twoWay: 4,
      },
    });
  });

  it('preserves enforceRosterRules callback behavior and empty-array return contract', () => {
    const warns = [];
    const rejects = [];

    const result = enforceRosterRules(
      {
        projectedRosterCount: 13,
        incomingPlayers: Array(4).fill({ contractType: 'two-way' }),
      },
      { enforcement: 'error' },
      {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      }
    );

    expect(result).toEqual([]);
    expect(warns).toEqual([]);
    expect(rejects).toEqual([
      'Roster count (13) below minimum 14',
      'Two-way slots exceeded (4/3)',
    ]);
  });

  it('preserves enforceRosterWindowAdvanced non-grace warn behavior', () => {
    const warns = [];
    const rejects = [];

    const result = enforceRosterWindowAdvanced(
      {
        postTradeTeam: {
          players: Array(12).fill({}),
          twoWayPlayers: Array(4).fill({}),
        },
      },
      { enforcement: 'warn' },
      {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      }
    );

    expect(result).toEqual([
      'Post-trade roster size (12) must be between 14-15 players',
      'Two-way slots exceeded (4/3)',
    ]);
    expect(warns).toEqual([
      'Post-trade roster size (12) must be between 14-15 players',
      'Two-way slots exceeded (4/3)',
    ]);
    expect(rejects).toEqual([]);
  });

  it('preserves enforceRosterWindowAdvanced grace-period behavior', () => {
    const warns = [];
    const rejects = [];

    const result = enforceRosterWindowAdvanced(
      {
        postTradeTeam: {
          players: Array(12).fill({}),
          twoWayPlayers: [],
        },
      },
      { graceMode: true },
      {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      }
    );

    expect(result).toEqual([
      'Roster cannot go below 13 players during grace period',
    ]);
    expect(warns).toEqual([]);
    expect(rejects).toEqual([
      'Roster cannot go below 13 players during grace period',
    ]);
  });

  it('preserves legacy alias identity and tradeValidator re-export identity', () => {
    expect(validateRosterWindowLegacy).toBe(validateRosterWindow);
    expect(enforceRosterWindowLegacy).toBe(enforceRosterWindow);
    expect(tradeValidatorEnforceRosterWindow).toBe(enforceRosterWindow);
  });
});
