/**
 * Schema Adapter Tests
 * 
 * Unit tests for schemaAdapter.js covering buildTradeTeamInput
 * and buildTradeInput functions.
 * 
 * @file tests/architect/schemaAdapter.test.js
 */

import { describe, it, expect } from 'vitest';
import { buildTradeTeamInput, buildTradeInput } from '@/features/architect/utils/schemaAdapter';
import { createMockTeam } from '../helpers/architectTestHelpers.js';

describe('Schema Adapter', () => {
  describe('buildTradeTeamInput', () => {
    it('structures team state correctly', () => {
      const teamState = createMockTeam({
        teamCode: 'LAL',
        roster: ['lebron_james', 'anthony_davis'],
      });

      const result = buildTradeTeamInput(teamState);

      expect(result).toBeDefined();
      expect(result.team).toBeDefined();
      expect(result.team.teamCode).toBe('LAL');
      expect(result.team.roster).toEqual(['lebron_james', 'anthony_davis']);
    });

    it('merges trade data (sends, picksOut)', () => {
      const teamState = createMockTeam({
        teamCode: 'LAL',
      });

      const tradeData = {
        sends: [
          {
            player_id: 'lebron_james',
            id: 'lebron_james',
          },
        ],
        picksOut: [
          {
            id: 'lal_2026_1',
            year: 2026,
            round: 1,
          },
        ],
        cashSent: 1_000_000,
      };

      const result = buildTradeTeamInput(teamState, tradeData);

      expect(result.sends).toEqual(tradeData.sends);
      expect(result.picksOut).toEqual(tradeData.picksOut);
      expect(result.cashSent).toBe(1_000_000);
    });

    it('handles missing trade data', () => {
      const teamState = createMockTeam({
        teamCode: 'LAL',
      });

      const result = buildTradeTeamInput(teamState);

      expect(result).toBeDefined();
      expect(result.team).toBeDefined();
      // When tradeData is not provided (defaults to {}), fields are set to empty arrays/zeros
      expect(Array.isArray(result.sends)).toBe(true);
      expect(Array.isArray(result.picksOut)).toBe(true);
      expect(result.sends.length).toBe(0);
      expect(result.picksOut.length).toBe(0);
    });

    it('handles teamState with existing team structure', () => {
      const teamState = {
        team: {
          teamCode: 'LAL',
          roster: ['lebron_james'],
        },
        sends: [],
      };

      const result = buildTradeTeamInput(teamState, {
        sends: [{ player_id: 'anthony_davis' }],
      });

      expect(result.team.teamCode).toBe('LAL');
      expect(result.sends).toEqual([{ player_id: 'anthony_davis' }]);
    });

    it('returns null for null teamState', () => {
      const result = buildTradeTeamInput(null);

      expect(result).toBeNull();
    });
  });

  describe('buildTradeInput', () => {
    it('builds complete trade input structure', () => {
      const tradeInput = {
        teams: [
          {
            teamState: createMockTeam({ teamCode: 'LAL' }),
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamState: createMockTeam({ teamCode: 'GSW' }),
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
      };

      const result = buildTradeInput(tradeInput);

      expect(result).toBeDefined();
      expect(result.teams).toBeDefined();
      expect(result.teams.length).toBe(2);
      expect(result.teams[0].team.teamCode).toBe('LAL');
      expect(result.teams[1].team.teamCode).toBe('GSW');
    });

    it('includes capProjections and currentYear', () => {
      const capProjections = {
        '2025-26': {
          cap: 141_000_000,
          firstApron: 178_132_000,
        },
      };

      const tradeInput = {
        teams: [
          {
            teamState: createMockTeam({ teamCode: 'LAL' }),
            sends: [],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections,
        currentYear: 2025,
      };

      const result = buildTradeInput(tradeInput);

      expect(result.capProjections).toEqual(capProjections);
      expect(result.currentYear).toBe(2025);
    });

    it('handles empty teams array', () => {
      const tradeInput = {
        teams: [],
        capProjections: {},
        currentYear: 2025,
      };

      const result = buildTradeInput(tradeInput);

      expect(result).toBeDefined();
      expect(result.teams).toEqual([]);
    });

    it('handles teams without teamState property', () => {
      const tradeInput = {
        teams: [
          createMockTeam({ teamCode: 'LAL' }),
          createMockTeam({ teamCode: 'GSW' }),
        ],
      };

      const result = buildTradeInput(tradeInput);

      // Should still build structure using team directly
      expect(result).toBeDefined();
      expect(result.teams.length).toBe(2);
    });
  });
});

