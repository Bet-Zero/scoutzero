import { describe, it, expect, beforeEach } from 'vitest';
import { validateRoster } from '@/utils/architect/tradeMachine/validators/validateRoster.js';
import { validationFlags } from '@/config/validationFlags.js';

describe('validateRoster', () => {
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

      const result15 = validateRoster(
        makeTeam({
          projectedRosterCount: 15,
        })
      );
      expect(result15.passed).toBe(true);
    });

    it('fails when roster would be too small', () => {
      const result = validateRoster(
        makeTeam({
          projectedRosterCount: 13,
        })
      );
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toMatch(/Standard roster/);
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
    });
  });
});
