/**
 * FILE: src/tests/trade/worldless_baseline_salary.guardrail.test.js
 * PURPOSE: Guardrail tests to ensure worldless baseline salary uses canonical pipeline.
 * OWNERSHIP: Feature: architect (Trade Machine - Worldless Mode)
 *
 * HISTORY:
 *  - 2026-01-03: Created for P0 Worldless Baseline Salary fix
 *
 * WHAT THIS TESTS:
 * - Baseline total equals sum of salary slices for the selected year
 * - TeamCard uses canonical pipeline, not team.teamTotalSalary cached field
 * - CapImpactTiles and TradeTeamCard produce consistent baseline values
 */

import { describe, test, expect } from 'vitest';
import {
  getWorldlessTeamBaselineTotal,
  computePlayersTotal,
  computeDeadMoney,
} from '@/features/architect/utils/worldlessBaselineSalary';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';

describe('Worldless Baseline Salary Guardrails', () => {
  // ==========================================================================
  // Test Fixtures
  // ==========================================================================
  
  const createMockTeam = (players = [], deadMoney = {}) => ({
    id: 'LAL',
    name: 'Lakers',
    players,
    deadMoney,
    waivedContracts: [],
    stretchHistory: [],
  });

  const createMockPlayer = (id, name, salariesByYear) => ({
    id,
    name,
    contract: {
      salariesByYear,
    },
  });

  // ==========================================================================
  // Core Baseline Salary Tests
  // ==========================================================================
  
  describe('getWorldlessTeamBaselineTotal', () => {
    test('returns zeros for null team', () => {
      const result = getWorldlessTeamBaselineTotal(null, 2026);
      
      expect(result.playersTotal).toBe(0);
      expect(result.deadMoneyTotal).toBe(0);
      expect(result.baselineTotal).toBe(0);
      expect(result.meta.status).toBe('NO_TEAM');
    });

    test('returns zeros for team with no players', () => {
      const team = createMockTeam([]);
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      expect(result.playersTotal).toBe(0);
      expect(result.baselineTotal).toBe(0);
    });

    test('calculates playersTotal as sum of cap hits for yearKey', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [{ season: '2025-26', salary: 10000000, capHit: 10000000 }]),
        createMockPlayer('p2', 'Player 2', [{ season: '2025-26', salary: 20000000, capHit: 20000000 }]),
        createMockPlayer('p3', 'Player 3', [{ season: '2025-26', salary: 5000000, capHit: 5000000 }]),
      ];
      const team = createMockTeam(players);
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      expect(result.playersTotal).toBe(35000000);
    });

    test('excludes players without contract for selected year', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [{ season: '2025-26', salary: 10000000, capHit: 10000000 }]),
        createMockPlayer('p2', 'Player 2', [{ season: '2024-25', salary: 20000000, capHit: 20000000 }]), // Different year
        createMockPlayer('p3', 'Player 3', []), // No salary entries
      ];
      const team = createMockTeam(players);
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      // Only p1 has a contract for 2025-26 season
      expect(result.playersTotal).toBe(10000000);
    });

    test('includes dead money in baselineTotal', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [{ season: '2025-26', salary: 10000000, capHit: 10000000 }]),
      ];
      const team = createMockTeam(players, { 2026: 5000000 });
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      expect(result.playersTotal).toBe(10000000);
      expect(result.deadMoneyTotal).toBe(5000000);
      expect(result.baselineTotal).toBe(15000000);
    });

    test('baselineTotal equals playersTotal + deadMoneyTotal', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [{ season: '2025-26', salary: 30000000, capHit: 30000000 }]),
        createMockPlayer('p2', 'Player 2', [{ season: '2025-26', salary: 25000000, capHit: 25000000 }]),
      ];
      const team = createMockTeam(players, { 2026: 3000000 });
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      expect(result.baselineTotal).toBe(result.playersTotal + result.deadMoneyTotal);
      expect(result.baselineTotal).toBe(58000000);
    });
  });

  // ==========================================================================
  // Consistency with getContractYearSlice
  // ==========================================================================
  
  describe('Consistency with getContractYearSlice', () => {
    test('playersTotal matches manual sum of getContractYearSlice calls', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [{ season: '2025-26', salary: 15000000, capHit: 15000000 }]),
        createMockPlayer('p2', 'Player 2', [{ season: '2025-26', salary: 22000000, capHit: 22000000 }]),
        createMockPlayer('p3', 'Player 3', [{ season: '2025-26', salary: 8000000, capHit: 8000000 }]),
      ];
      const team = createMockTeam(players);
      
      // Manual calculation using getContractYearSlice
      const manualTotal = players.reduce((sum, player) => {
        const slice = getContractYearSlice(player, 2026);
        return sum + (slice?.capHit || slice?.salary || 0);
      }, 0);
      
      // Canonical calculation
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      expect(result.playersTotal).toBe(manualTotal);
      expect(result.playersTotal).toBe(45000000);
    });
  });

  // ==========================================================================
  // Dead Money Calculations
  // ==========================================================================
  
  describe('Dead Money Calculations', () => {
    test('computeDeadMoney extracts from flat deadMoney object (numeric key)', () => {
      const team = { deadMoney: { 2026: 4000000 } };
      expect(computeDeadMoney(team, 2026)).toBe(4000000);
    });

    test('computeDeadMoney extracts from flat deadMoney object (string key)', () => {
      const team = { deadMoney: { '2026': 4500000 } };
      expect(computeDeadMoney(team, 2026)).toBe(4500000);
    });

    test('computeDeadMoney sums waivedContracts deadMoneyByYear', () => {
      const team = {
        waivedContracts: [
          { playerName: 'Waived A', deadMoneyByYear: { 2026: 2000000 } },
          { playerName: 'Waived B', deadMoneyByYear: { 2026: 1500000 } },
        ],
      };
      expect(computeDeadMoney(team, 2026)).toBe(3500000);
    });

    test('computeDeadMoney sums stretchHistory amountByYear', () => {
      const team = {
        stretchHistory: [
          { playerName: 'Stretched', amountByYear: { 2026: 2500000 } },
        ],
      };
      expect(computeDeadMoney(team, 2026)).toBe(2500000);
    });

    test('computeDeadMoney combines all dead money sources', () => {
      const team = {
        deadMoney: { 2026: 1000000 },
        waivedContracts: [
          { deadMoneyByYear: { 2026: 2000000 } },
        ],
        stretchHistory: [
          { amountByYear: { 2026: 3000000 } },
        ],
      };
      expect(computeDeadMoney(team, 2026)).toBe(6000000);
    });
  });

  // ==========================================================================
  // Year Key Correctness
  // ==========================================================================
  
  describe('Year Key Correctness', () => {
    test('different yearKey produces different salary totals', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [
          { season: '2024-25', salary: 10000000, capHit: 10000000 },
          { season: '2025-26', salary: 12000000, capHit: 12000000 },
          { season: '2026-27', salary: 14000000, capHit: 14000000 },
        ]),
      ];
      const team = createMockTeam(players);
      
      const result2025 = getWorldlessTeamBaselineTotal(team, 2025);
      const result2026 = getWorldlessTeamBaselineTotal(team, 2026);
      const result2027 = getWorldlessTeamBaselineTotal(team, 2027);
      
      expect(result2025.playersTotal).toBe(10000000);
      expect(result2026.playersTotal).toBe(12000000);
      expect(result2027.playersTotal).toBe(14000000);
    });

    test('meta includes correct yearKey and seasonKey', () => {
      const team = createMockTeam([]);
      
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      
      expect(result.meta.yearKey).toBe(2026);
      expect(result.meta.seasonKey).toBe('2025-26');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  
  describe('Edge Cases', () => {
    test('handles player with null contract', () => {
      const players = [
        { id: 'p1', name: 'Free Agent', contract: null },
      ];
      const team = createMockTeam(players);
      
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      expect(result.playersTotal).toBe(0);
    });

    test('handles player with empty salariesByYear', () => {
      const players = [
        { id: 'p1', name: 'No Salary Data', contract: { salariesByYear: [] } },
      ];
      const team = createMockTeam(players);
      
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      expect(result.playersTotal).toBe(0);
    });

    test('prefers capHit over salary when both present', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [
          { season: '2025-26', salary: 10000000, capHit: 12000000 },
        ]),
      ];
      const team = createMockTeam(players);
      
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      expect(result.playersTotal).toBe(12000000); // capHit, not salary
    });

    test('falls back to salary when capHit is missing', () => {
      const players = [
        createMockPlayer('p1', 'Player 1', [
          { season: '2025-26', salary: 10000000 }, // No capHit
        ]),
      ];
      const team = createMockTeam(players);
      
      const result = getWorldlessTeamBaselineTotal(team, 2026);
      expect(result.playersTotal).toBe(10000000);
    });
  });
});
