/**
 * FILE: src/tests/architect/capTotals/leagueViewSsot.test.js
 * PURPOSE: Regression tests for LeagueView SSOT compliance (Phase 29).
 * OWNERSHIP: Feature: architect/cap-sheet validation
 *
 * HISTORY:
 *  - 2026-01-21: Created as part of Phase 29 LeagueView SSOT Fix
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Return Package: docs/architect/return_packages/PHASE_29_LEAGUEVIEW_SSOT_FIX_RETURN_PACKAGE.md
 */

import { describe, it, expect, vi } from 'vitest';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { MINIMUM_SALARY_SCALES } from '@/features/architect/data/minimumSalaryScales';

describe('LeagueView SSOT Compliance (Phase 29)', () => {
  const YEAR = 2026; // 2025-26 season

  // Helper: Create a roster with specified count of standard players
  function createRoster(count: number, salaryPerPlayer = 10000000) {
    return Array.from({ length: count }, (_, i) => ({
      player_id: `player-${i}`,
      displayName: `Player ${i}`,
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          {
            season: '2025-26',
            salary: salaryPerPlayer,
            capHit: salaryPerPlayer,
          },
        ],
      },
    }));
  }

  /**
   * Test 1: computeTeamCapTotals is the canonical function used for totals.
   * This test validates that the SSOT function exists and returns expected structure.
   */
  it('computeTeamCapTotals returns canonical totalCapAllocations field', () => {
    const mockCapSheet = {
      players: createRoster(14, 10000000),
      capHolds: [],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    // Verify canonical structure
    expect(totals).toHaveProperty('totalCapAllocations');
    expect(totals).toHaveProperty('playersTotal');
    expect(totals).toHaveProperty('deadMoneyTotal');
    expect(totals).toHaveProperty('capHoldsTotal');
    expect(totals).toHaveProperty('incompleteChargesTotal');
  });

  /**
   * Test 2: totalCapAllocations equals sum of all components.
   * LeagueView uses totalCapAllocations which must include all cap charges.
   */
  it('totalCapAllocations equals sum of players + deadMoney + capHolds + incompleteCharges', () => {
    const mockCapSheet = {
      players: createRoster(14, 10000000), // 14 players × $10M = $140M
      capHolds: [],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    // With 14 players, no incomplete roster charge
    const expectedTotal =
      totals.playersTotal +
      totals.deadMoneyTotal +
      totals.capHoldsTotal +
      totals.incompleteChargesTotal;

    expect(totals.totalCapAllocations).toBe(expectedTotal);
    expect(totals.playersTotal).toBe(140000000);
  });

  /**
   * Test 3: Dead money is included in totalCapAllocations.
   */
  it('includes dead money in totalCapAllocations', () => {
    const mockCapSheet = {
      players: createRoster(14, 10000000),
      capHolds: [],
      deadCap: [
        {
          playerId: 'waived-player-1',
          amountByYear: [{ season: '2025-26', amount: 5000000 }],
        },
      ],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    expect(totals.deadMoneyTotal).toBe(5000000);
    expect(totals.totalCapAllocations).toBe(140000000 + 5000000); // players + dead money
  });

  /**
   * Test 4: Cap holds are included in totalCapAllocations.
   */
  it('includes cap holds in totalCapAllocations', () => {
    const mockCapSheet = {
      players: createRoster(14, 10000000),
      capHolds: [
        {
          playerId: 'hold-1',
          playerName: 'Free Agent Hold',
          amount: 8000000,
          season: '2025-26',
          type: 'FA Cap Hold',
          active: true,
          isSigned: false,
        },
      ],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    expect(totals.capHoldsTotal).toBe(8000000);
    expect(totals.totalCapAllocations).toBe(140000000 + 8000000); // players + cap holds
  });

  /**
   * Test 5: Incomplete roster charges are included when slots < 14.
   */
  it('includes incomplete roster charges when standard roster < 14', () => {
    const mockCapSheet = {
      players: createRoster(12, 10000000), // Only 12 standard players
      capHolds: [],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    // 2 missing slots × rookieMin (varies by year, but should be > 0)
    expect(totals.incompleteChargesTotal).toBeGreaterThan(0);
    expect(totals.totalCapAllocations).toBe(
      totals.playersTotal + totals.incompleteChargesTotal
    );
  });

  /**
   * Test 6: Null/empty cap sheet safely returns 0 without crashing.
   */
  it('handles null/empty cap sheet safely, returning 0 totals', () => {
    // Test null
    expect(() => computeTeamCapTotals(null, YEAR)).not.toThrow();
    const nullResult = computeTeamCapTotals(null, YEAR);
    expect(nullResult.playersTotal).toBe(0);
    expect(nullResult.deadMoneyTotal).toBe(0);
    expect(nullResult.capHoldsTotal).toBe(0);

    // Test empty object
    expect(() => computeTeamCapTotals({}, YEAR)).not.toThrow();
    const emptyResult = computeTeamCapTotals({}, YEAR);
    expect(emptyResult.playersTotal).toBe(0);

    // Test undefined players
    const noPlayersResult = computeTeamCapTotals({ players: undefined }, YEAR);
    expect(noPlayersResult.playersTotal).toBe(0);
  });

  /**
   * Test 7: Two-way contracts are excluded from standard roster count.
   * This ensures incomplete roster charge is calculated correctly.
   */
  it('excludes two-way contracts from standard roster count', () => {
    const mockCapSheet = {
      players: [
        ...createRoster(12, 10000000), // 12 standard players
        {
          player_id: 'two-way-1',
          displayName: 'Two-Way Player 1',
          contract: {
            contractType: 'Two-Way',
            salariesByYear: [
              { season: '2025-26', salary: 500000, capHit: 500000 },
            ],
          },
        },
        {
          player_id: 'two-way-2',
          displayName: 'Two-Way Player 2',
          contract: {
            contractType: 'two-way', // lowercase variant
            salariesByYear: [
              { season: '2025-26', salary: 500000, capHit: 500000 },
            ],
          },
        },
      ],
      capHolds: [],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    // Should still have incomplete roster charge (only 12 standard players)
    expect(totals.incompleteChargesTotal).toBeGreaterThan(0);
  });

  it('excludes non-zero stored two-way salaries from playersTotal', () => {
    const mockCapSheet = {
      players: [
        ...createRoster(12, 10000000), // 12 standard players = $120M
        {
          player_id: 'two-way-1',
          displayName: 'Two-Way Nested Type',
          contract: {
            contractType: 'Two-Way',
            salariesByYear: [
              { season: '2025-26', salary: 500000, capHit: 500000 },
            ],
          },
        },
        {
          player_id: 'two-way-2',
          displayName: 'Two-Way Top-Level Type',
          contractType: 'two-way',
          contract: {
            salariesByYear: [
              { season: '2025-26', salary: 750000, capHit: 750000 },
            ],
          },
        },
      ],
      capHolds: [],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    expect(totals.playersTotal).toBe(120000000);
    expect(totals.incompleteChargesTotal).toBeGreaterThan(0);
    expect(totals.totalCapAllocations).toBe(
      totals.playersTotal + totals.incompleteChargesTotal
    );
  });

  it('applies veteran-minimum cap-hit treatment while still excluding two-way salary', () => {
    const mockCapSheet = {
      players: [
        ...createRoster(13, 1000000), // 13 standard players = $13M
        {
          player_id: 'vet-min-1',
          displayName: 'Veteran Minimum Wing',
          isMinimum: true,
          yearsOfService: 4,
          contract: {
            contractType: 'Standard',
            salariesByYear: [
              { season: '2025-26', salary: 2390000, capHit: 2390000 },
            ],
          },
        },
        {
          player_id: 'two-way-1',
          displayName: 'Two-Way Prospect',
          contractType: 'two-way',
          contract: {
            contractType: 'Two-Way',
            salariesByYear: [
              { season: '2025-26', salary: 500000, capHit: 500000 },
            ],
          },
        },
      ],
      capHolds: [],
      deadCap: [],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    // Veteran minimum cap-hit treatment uses the selected season's 2-year
    // minimum; the two-way row contributes $0 to playersTotal.
    const selectedSeasonTwoYearMinimum = MINIMUM_SALARY_SCALES['2025-26'][2];
    const expectedPlayersTotal =
      13_000_000 + selectedSeasonTwoYearMinimum;

    expect(selectedSeasonTwoYearMinimum).toBe(2_176_096);
    expect(totals.playersTotal).toBe(expectedPlayersTotal);
    expect(totals.incompleteChargesTotal).toBe(0);
    expect(totals.totalCapAllocations).toBe(expectedPlayersTotal);
  });

  /**
   * Test 8: Combined scenario - all components contribute to total.
   */
  it('combines all components correctly in a realistic scenario', () => {
    const mockCapSheet = {
      players: createRoster(13, 10000000), // 13 standard players = 1 incomplete slot
      capHolds: [
        {
          playerId: 'hold-1',
          playerName: 'Bird Rights Hold',
          amount: 3000000,
          season: '2025-26',
          type: 'FA Cap Hold',
          active: true,
          isSigned: false,
        },
      ],
      deadCap: [
        {
          playerId: 'waived-player-1',
          amountByYear: [{ season: '2025-26', amount: 2000000 }],
        },
      ],
    };

    const totals = computeTeamCapTotals(mockCapSheet, YEAR);

    // Verify all components are non-zero and contribute
    expect(totals.playersTotal).toBe(130000000);
    expect(totals.capHoldsTotal).toBe(3000000);
    expect(totals.deadMoneyTotal).toBe(2000000);
    expect(totals.incompleteChargesTotal).toBeGreaterThan(0);

    // Total should be sum of all
    expect(totals.totalCapAllocations).toBe(
      totals.playersTotal +
        totals.capHoldsTotal +
        totals.deadMoneyTotal +
        totals.incompleteChargesTotal
    );
  });
});
