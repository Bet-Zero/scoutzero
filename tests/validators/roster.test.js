import { describe, it, expect, beforeEach } from 'vitest';
import {
  enforceRosterWindow,
  validateRoster,
} from '@/features/architect/utils/tradeMachine/rules/validateRoster.ts';
import { validationFlags } from '@/config/validationFlags';

describe('validateRoster behavior', () => {
  const makeTeam = (params) => ({
    teamName: 'Test Team',
    team: {
      players: Array(14).fill({}),
      twoWayPlayers: [],
    },
    initialRosterCount: 14,
    projectedRosterCount: 14,
    incomingPlayers: [],
    outgoingPlayers: [],
    ...params,
  });

  beforeEach(() => {
    validationFlags.rosterEnforcement = 'error';
    validationFlags.twoWayRoster = 'error';
  });

  describe('standard roster spots', () => {
    it('allows valid 14-15 player rosters', () => {
      const result = validateRoster(
        makeTeam({
          projectedRosterCount: 14,
        })
      );
      expect(result.passed).toBe(true);
      expect(result.warningsOnly).toBe(false);

      const result15 = validateRoster(
        makeTeam({
          projectedRosterCount: 15,
        })
      );
      expect(result15.passed).toBe(true);
      expect(result15.warningsOnly).toBe(false);
    });

    it('fails when roster would be too small', () => {
      const result = validateRoster(
        makeTeam({
          projectedRosterCount: 13,
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toMatch(/Standard roster/);
      expect(result).toEqual({
        passed: false,
        violations: ['Standard roster must be 14–15'],
        message: 'Roster violation',
        details: 'Standard spots: 13, Two-way slots: 0',
        rosterCounts: {
          standard: 13,
          twoWay: 0,
          projected: 13,
          current: 14,
        },
        warningsOnly: false,
      });
    });

    it('fails when roster would be too large', () => {
      const result = validateRoster(
        makeTeam({
          projectedRosterCount: 16,
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toMatch(/Standard roster/);
    });
  });

  describe('two-way slots', () => {
    it('allows up to 3 two-way players', () => {
      const result = validateRoster(
        makeTeam({
          team: {
            players: Array(14).fill({}),
            twoWayPlayers: Array(2).fill({}),
          },
          incomingPlayers: [{ isTwoWay: true }],
        })
      );
      expect(result.passed).toBe(true);
    });

    it('fails when exceeding two-way limit', () => {
      const result = validateRoster(
        makeTeam({
          team: {
            players: Array(14).fill({}),
            twoWayPlayers: Array(3).fill({}),
          },
          incomingPlayers: [{ isTwoWay: true }],
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toMatch(/Two-way/);
    });
  });

  describe('warning mode', () => {
    it('allows roster violations in warn mode', () => {
      validationFlags.rosterEnforcement = 'warn';
      const result = validateRoster(
        makeTeam({
          projectedRosterCount: 13,
        })
      );
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual(['Standard roster must be 14–15']);
      expect(result.warningsOnly).toBe(true);
    });

    it('allows two-way violations in warn mode', () => {
      validationFlags.twoWayRoster = 'warn';
      const result = validateRoster(
        makeTeam({
          team: {
            players: Array(14).fill({}),
            twoWayPlayers: Array(3).fill({}),
          },
          incomingPlayers: [{ isTwoWay: true }],
        })
      );
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual(['Two-way slots cannot exceed 3']);
      expect(result.warningsOnly).toBe(true);
    });
  });

  describe('enforceRosterWindow', () => {
    it('preserves legacy enforcement behavior through the direct authority', () => {
      validationFlags.rosterEnforcement = 'error';
      validationFlags.twoWayRoster = 'warn';

      const warns = [];
      const rejects = [];
      const team = {
        projectedRosterCount: 13,
        postTradeTeam: {
          players: Array(13).fill({}),
          twoWayPlayers: Array(4).fill({}),
        },
      };

      const result = enforceRosterWindow(team, {}, {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      });

      expect(result).toEqual({
        passed: undefined,
        violations: [
          'Post-trade roster size (13) below minimum of 14 players',
          'Two-way slots exceeded (4/3)',
        ],
        warnings: [],
        message: 'Roster size requirements not met',
        details:
          'Post-trade roster size (13) below minimum of 14 players; Two-way slots exceeded (4/3)',
      });
      expect(warns).toEqual(['Two-way slots exceeded (4/3)']);
      expect(rejects).toEqual([
        'Post-trade roster size (13) below minimum of 14 players',
      ]);
    });

    it('preserves grace-mode pass behavior', () => {
      const warns = [];
      const rejects = [];

      const result = enforceRosterWindow(
        {
          postTradeTeam: {
            players: Array(13).fill({}),
            twoWayPlayers: [],
          },
        },
        { graceMode: true },
        {
          warn: (message) => warns.push(message),
          reject: (message) => rejects.push(message),
        }
      );

      expect(result).toEqual({
        passed: true,
        violations: ['Post-trade roster size (13) below minimum of 14 players'],
        warnings: [],
        message: 'Roster size validated',
        details: 'Post-trade roster size (13) below minimum of 14 players',
      });
      expect(warns).toEqual([]);
      expect(rejects).toEqual([]);
    });
  });
});
