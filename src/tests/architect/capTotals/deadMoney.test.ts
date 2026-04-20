import { describe, it, expect } from 'vitest';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

describe('computeTeamCapTotals - Dead Money Schema Compatibility', () => {
  const YEAR = 2025; // 2024-25 season
  
  // Helper: Create 14 players to avoid incomplete roster charges
  // When testing dead money, we don't want roster charge noise in totalCapAllocations
  function createFullRoster() {
    return Array.from({ length: 14 }, (_, i) => ({
      player_id: `roster-player-${i}`,
      displayName: `Roster Player ${i}`,
      contract: {
        contractType: 'Standard',
        salariesByYear: [], // No salary for this year - cap hit = 0
      },
    }));
  }

  it('Case A: Supports NEW schema (deadCap array with amountByYear array)', () => {
    const teamSheet = {
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [
            { season: '2024-25', amount: 5000000 },
            { season: '2025-26', amount: 2000000 },
          ],
        },
      ],
      players: createFullRoster(), // Use full roster to avoid incomplete roster charge
      capHolds: [],
    };

    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(5000000);
    // Total = deadMoney (5M) + players (0) + capHolds (0) + incompleteCharge (0)
    expect(totals.totalCapAllocations).toBe(5000000);
    expect(totals.incompleteChargesTotal).toBe(0);
  });

  it('Case B: Supports LEGACY schema (waivedContracts with amountByYear object)', () => {
    const teamSheet = {
      waivedContracts: [
        {
          playerId: 'p2',
          amountByYear: {
            2025: 3000000,
            2026: 1000000,
          },
        },
      ],
      players: [],
      capHolds: [],
    };

    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(3000000);
  });

  it('Case C: PRECEDENCE - deadCap overrides legacy sources if present for year', () => {
    const teamSheet = {
      // canonical source says 1M
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [{ season: '2024-25', amount: 1000000 }],
        },
      ],
      // legacy source says 2M
      waivedContracts: [
        {
          playerId: 'p2',
          amountByYear: { 2025: 2000000 },
        },
      ],
      players: [],
      capHolds: [],
    };

    const totals = computeTeamCapTotals(teamSheet, YEAR);
    // Should be 1M (deadCap), NOT 3M (sum)
    expect(totals.deadMoneyTotal).toBe(1000000);
  });

  it('Case D: FALLBACK - Uses legacy when deadCap is missing or has no entries for year', () => {
    const teamSheet = {
      deadCap: [], // Empty array
      waivedContracts: [
        {
          playerId: 'p2',
          amountByYear: { 2025: 3000000 },
        },
      ],
      players: [],
      capHolds: [],
    };
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(3000000);
  });

  it('Case D2: FALLBACK - stretchHistory contributes when deadCap has no coverage for year', () => {
    const teamSheet = {
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [{ season: '2025-26', amount: 9000000 }],
        },
      ],
      stretchHistory: [
        {
          playerId: 'p3',
          amountByYear: { 2025: 1500000 },
        },
      ],
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(1500000);
    expect(totals.totalCapAllocations).toBe(1500000);
  });

  it('Case D3: FALLBACK - flat deadMoney contributes when deadCap has no coverage for year', () => {
    const teamSheet = {
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [{ season: '2025-26', amount: 9000000 }],
        },
      ],
      deadMoney: {
        2025: 2750000,
      },
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(2750000);
    expect(totals.totalCapAllocations).toBe(2750000);
  });

  it('Case D4: FALLBACK - legacy sources sum together when canonical deadCap has no coverage', () => {
    const teamSheet = {
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [{ season: '2025-26', amount: 9000000 }],
        },
      ],
      waivedContracts: [
        {
          playerId: 'p2',
          amountByYear: { 2025: 3000000 },
        },
      ],
      stretchHistory: [
        {
          playerId: 'p3',
          amountByYear: { 2025: 1500000 },
        },
      ],
      deadMoney: {
        2025: 2750000,
      },
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(7250000);
    expect(totals.totalCapAllocations).toBe(7250000);
  });

  it('Case E: EXPLICIT ZERO - deadCap 0 entry overrides legacy non-zero', () => {
    const teamSheet = {
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [{ season: '2024-25', amount: 0 }],
        },
      ],
      waivedContracts: [
        {
          playerId: 'p2',
          amountByYear: { 2025: 5000000 },
        },
      ],
      players: [],
      capHolds: [],
    };
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    // Should be 0, because deadCap has an entry for this year
    expect(totals.deadMoneyTotal).toBe(0);
  });

  it('Handles missing or empty dead money fields gracefully', () => {
    const teamSheet = {
      deadCap: [],
      players: [],
      capHolds: [],
    };
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(0);
  });

  it('Handles no-match year correctly', () => {
    const teamSheet = {
      deadCap: [
        {
          playerId: 'p1',
          amountByYear: [{ season: '2025-26', amount: 5000000 }], // Next year only
        },
      ],
      players: [],
      capHolds: [],
    };
    // Requesting 2025 (2024-25)
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    expect(totals.deadMoneyTotal).toBe(0);
  });
});
