/**
 * Integration tests for mixed schema scenarios
 * Ensures validators work correctly when teams use different contract schemas
 */

import { describe, it, expect } from 'vitest';
import { getSalaryForYear } from '../src/utils/architect/tradeHelpers';
import { computeMatchingValues } from '../src/utils/architect/tradeMachine/utils/matchingValues';
import { getCapHitForSeason, normalizeYearInput } from '../src/utils/architect/tradeMachine/utils/seasonUtils';

// Old schema player fixture
const oldSchemaPlayer = {
  id: 'old-player-1',
  displayName: 'Old Schema Player',
  contract_clean: {
    salaries_by_year: {
      2025: {
        salary: 6000000,
        guaranteed: true,
        option: null,
        likely_bonus: 100000
      },
      2026: {
        salary: 6500000,
        guaranteed: true,
        option: null
      }
    }
  }
};

// New schema player fixture
const newSchemaPlayer = {
  id: 'new-player-1',
  displayName: 'New Schema Player',
  contract: {
    salariesByYear: [
      {
        season: '2024-25',
        salary: 5000000,
        capHit: 5000000,
        guaranteed: true,
        option: null,
        incentives: {
          likely: 0,
          unlikely: 0
        }
      },
      {
        season: '2025-26',
        salary: 5500000,
        capHit: 5500000,
        guaranteed: true,
        option: null
      }
    ],
    isRookieScale: false,
    contractType: 'Standard'
  }
};

describe('Mixed Schema Integration Tests', () => {
  describe('Salary extraction with mixed schemas', () => {
    it('should extract salary from old schema player with numeric year', () => {
      const salary = getSalaryForYear(oldSchemaPlayer, 2025);
      expect(salary).toBeGreaterThan(0);
      expect(salary).toBe(6100000); // 6M + 100k likely bonus
    });

    it('should extract salary from new schema player with numeric year', () => {
      const salary = getSalaryForYear(newSchemaPlayer, 2025);
      expect(salary).toBe(5000000);
    });

    it('should extract salary from old schema player with season string', () => {
      const salary = getSalaryForYear(oldSchemaPlayer, '2024-25');
      expect(salary).toBe(6100000); // Should convert "2024-25" to end-year 2025
    });

    it('should extract salary from new schema player with season string', () => {
      const salary = getSalaryForYear(newSchemaPlayer, '2024-25');
      expect(salary).toBe(5000000);
    });

    it('should use capHit for new schema player', () => {
      const capHit = getCapHitForSeason(newSchemaPlayer, '2024-25');
      expect(capHit).toBe(5000000);
    });

    it('should fall back to salary for old schema player', () => {
      const capHit = getCapHitForSeason(oldSchemaPlayer, '2024-25');
      expect(capHit).toBe(6000000); // No capHit field, uses salary
    });
  });

  describe('Matching values with mixed schemas', () => {
    it('should compute matching values for trade with mixed schema players', () => {
      const teams = [
        {
          sends: [{ ...oldSchemaPlayer }]
        },
        {
          sends: [{ ...newSchemaPlayer }]
        }
      ];

      computeMatchingValues({ teams, yearKey: 2025 });

      const oldPlayer = teams[0].sends[0];
      const newPlayer = teams[1].sends[0];

      // Both should have matching values set
      expect(oldPlayer.matchOutgoing).toBeGreaterThan(0);
      expect(oldPlayer.matchIncoming).toBeGreaterThan(0);
      expect(newPlayer.matchOutgoing).toBeGreaterThan(0);
      expect(newPlayer.matchIncoming).toBeGreaterThan(0);

      // Old schema uses salary (capHit not available, bonus not included in matching)
      expect(oldPlayer.matchOutgoing).toBe(6000000);
      expect(oldPlayer.matchIncoming).toBe(6000000);

      // New schema uses capHit
      expect(newPlayer.matchOutgoing).toBe(5000000);
      expect(newPlayer.matchIncoming).toBe(5000000);
    });

    it('should compute matching values with season string yearKey', () => {
      const teams = [
        {
          sends: [{ ...oldSchemaPlayer }]
        },
        {
          sends: [{ ...newSchemaPlayer }]
        }
      ];

      computeMatchingValues({ teams, yearKey: '2024-25' });

      const oldPlayer = teams[0].sends[0];
      const newPlayer = teams[1].sends[0];

      // Both should have matching values with season string input
      expect(oldPlayer.matchOutgoing).toBe(6000000);
      expect(newPlayer.matchOutgoing).toBe(5000000);
    });
  });

  describe('Year normalization consistency', () => {
    it('should produce same results with different year formats', () => {
      // Extract with numeric year
      const oldNumeric = getSalaryForYear(oldSchemaPlayer, 2025);
      const newNumeric = getSalaryForYear(newSchemaPlayer, 2025);

      // Extract with season string
      const oldSeason = getSalaryForYear(oldSchemaPlayer, '2024-25');
      const newSeason = getSalaryForYear(newSchemaPlayer, '2024-25');

      // Should be identical
      expect(oldNumeric).toBe(oldSeason);
      expect(newNumeric).toBe(newSeason);
    });

    it('should normalize years consistently across both schemas', () => {
      const numericNorm = normalizeYearInput(2025);
      const seasonNorm = normalizeYearInput('2024-25');

      expect(numericNorm.endYear).toBe(seasonNorm.endYear);
      expect(numericNorm.seasonString).toBe(seasonNorm.seasonString);

      // Extract using normalized values
      const oldSalary = getSalaryForYear(oldSchemaPlayer, numericNorm.endYear);
      const newSalary = getSalaryForYear(newSchemaPlayer, seasonNorm.seasonString);

      expect(oldSalary).toBe(6100000);
      expect(newSalary).toBe(5000000);
    });
  });

  describe('Array of mixed schema players', () => {
    it('should sum salaries correctly for array with mixed schemas', () => {
      const players = [oldSchemaPlayer, newSchemaPlayer];
      const totalSalary = getSalaryForYear(players, 2025);

      expect(totalSalary).toBe(11100000); // 6.1M + 5M
    });

    it('should handle array with season string', () => {
      const players = [oldSchemaPlayer, newSchemaPlayer];
      const totalSalary = getSalaryForYear(players, '2024-25');

      expect(totalSalary).toBe(11100000);
    });
  });

  describe('Edge cases with mixed schemas', () => {
    it('should handle player with both schemas (new takes precedence)', () => {
      const hybridPlayer = {
        ...newSchemaPlayer,
        contract_clean: oldSchemaPlayer.contract_clean
      };

      // Should prefer new schema
      const salary = getSalaryForYear(hybridPlayer, 2025);
      expect(salary).toBe(5000000); // New schema value, not old schema
    });

    it('should fall back to old schema when new schema has no data', () => {
      const partialNewPlayer = {
        id: 'partial-1',
        displayName: 'Partial Player',
        contract: {
          salariesByYear: []  // Empty array
        },
        contract_clean: oldSchemaPlayer.contract_clean
      };

      const salary = getSalaryForYear(partialNewPlayer, 2025);
      expect(salary).toBe(6100000); // Falls back to old schema
    });

    it('should return 0 when season not found in either schema', () => {
      const salary = getSalaryForYear(newSchemaPlayer, '2030-31');
      expect(salary).toBe(0);

      const oldSalary = getSalaryForYear(oldSchemaPlayer, 2030);
      expect(oldSalary).toBe(0);
    });

    it('should handle null/undefined contracts gracefully', () => {
      const emptyPlayer = {
        id: 'empty-1',
        displayName: 'Empty Player'
      };

      expect(getSalaryForYear(emptyPlayer, 2025)).toBe(0);
      expect(getCapHitForSeason(emptyPlayer, '2024-25')).toBe(0);
    });
  });

  describe('BYC with mixed schemas', () => {
    it('should detect BYC for new schema player with previous salary', () => {
      const bycNewPlayer = {
        ...newSchemaPlayer,
        isBYC: true,
        previousSalary: 2000000
      };

      const teams = [{ sends: [bycNewPlayer] }];
      computeMatchingValues({ teams, yearKey: 2025 });

      const player = teams[0].sends[0];
      
      // BYC outgoing: max(previousSalary, 50% of current)
      // max(2M, 2.5M) = 2.5M
      expect(player.matchOutgoing).toBe(2500000);
      // Incoming should be full salary
      expect(player.matchIncoming).toBe(5000000);
    });

    it('should detect BYC for old schema player with previous salary', () => {
      const bycOldPlayer = {
        ...oldSchemaPlayer,
        isBYC: true,
        previousSalary: 3000000
      };

      const teams = [{ sends: [bycOldPlayer] }];
      computeMatchingValues({ teams, yearKey: 2025 });

      const player = teams[0].sends[0];
      
      // BYC outgoing: max(previousSalary, 50% of current)
      // max(3M, 3M) = 3M (50% of 6M = 3M)
      expect(player.matchOutgoing).toBe(3000000);
      // Incoming uses full salary (not bonus)
      expect(player.matchIncoming).toBe(6000000);
    });
  });
});
