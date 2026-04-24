import { describe, it, expect } from 'vitest';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { ROSTER_REQUIREMENTS, CBA_THRESHOLDS } from '@/features/architect/utils/tradeMachine/constants/cbaConstants';

describe('computeTeamCapTotals - Incomplete Roster Charge (G0-1)', () => {
  const YEAR = 2025; // 2024-25 season
  const MIN_ROSTER = ROSTER_REQUIREMENTS.MIN_STANDARD_ROSTER; // 14
  const MIN_SALARY = CBA_THRESHOLDS['2024-25'].MIN_SALARY_ROOKIE; // 1,119,563

  /**
   * Creates a mock team cap sheet with the specified number of standard roster players.
   * @param {number} count - Number of standard roster players
   * @param {number} twoWayCount - Number of two-way players (defaults to 0)
   */
  function createTeamWithRoster(count: number, twoWayCount = 0) {
    const players = [];
    
    // Add standard roster players
    for (let i = 0; i < count; i++) {
      players.push({
        player_id: `player-${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            { season: '2024-25', salary: 2_000_000, capHit: 2_000_000 },
          ],
        },
      });
    }
    
    // Add two-way players
    for (let i = 0; i < twoWayCount; i++) {
      players.push({
        player_id: `twoway-${i}`,
        displayName: `Two-Way ${i}`,
        contract: {
          contractType: 'Two-Way',
          salariesByYear: [
            { season: '2024-25', salary: 500_000, capHit: 500_000 },
          ],
        },
      });
    }
    
    return {
      players,
      capHolds: [],
      deadCap: [],
    };
  }

  it('Case A: Team with >= MIN_ROSTER (14+) has incompleteChargesTotal = 0', () => {
    const teamSheet = createTeamWithRoster(14);
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    expect(totals.incompleteChargesTotal).toBe(0);
    expect(totals._meta.incompleteRosterCharge).toBeNull();
  });

  it('Case A2: Team with 15 players has incompleteChargesTotal = 0', () => {
    const teamSheet = createTeamWithRoster(15);
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    expect(totals.incompleteChargesTotal).toBe(0);
  });

  it('Case B: Team with MIN_ROSTER - 1 (13) has charge = 1 * MIN_SALARY', () => {
    const teamSheet = createTeamWithRoster(13);
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    expect(totals.incompleteChargesTotal).toBe(MIN_SALARY);
    expect(totals._meta.incompleteRosterCharge).toEqual({
      standardRosterCount: 13,
      minRoster: MIN_ROSTER,
      missingSlots: 1,
      chargePerSlot: MIN_SALARY,
    });
  });

  it('Case C: Team with 0 standard roster has charge = MIN_ROSTER * MIN_SALARY', () => {
    const teamSheet = createTeamWithRoster(0);
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    const expectedCharge = MIN_ROSTER * MIN_SALARY;
    expect(totals.incompleteChargesTotal).toBe(expectedCharge);
    expect(totals._meta.incompleteRosterCharge?.missingSlots).toBe(MIN_ROSTER);
  });

  it('Case D: incompleteChargesTotal is included in totalCapAllocations', () => {
    const teamSheet = createTeamWithRoster(10); // 4 missing slots
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    const expectedCharge = 4 * MIN_SALARY;
    const playersTotal = 10 * 2_000_000; // 10 players at $2M each
    
    expect(totals.incompleteChargesTotal).toBe(expectedCharge);
    expect(totals.playersTotal).toBe(playersTotal);
    expect(totals.totalCapAllocations).toBe(
      playersTotal + expectedCharge + totals.deadMoneyTotal + totals.capHoldsTotal
    );
  });

  it('Case E: Two-way contracts do NOT count toward standard roster', () => {
    // 12 standard + 2 two-way = should have 2 missing slots
    const teamSheet = createTeamWithRoster(12, 2);
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    const expectedCharge = 2 * MIN_SALARY;
    expect(totals.incompleteChargesTotal).toBe(expectedCharge);
    expect(totals._meta.incompleteRosterCharge?.standardRosterCount).toBe(12);
    expect(totals._meta.incompleteRosterCharge?.missingSlots).toBe(2);
  });

  it('Case F: Empty/missing players array is handled gracefully', () => {
    const teamSheet = {
      players: [],
      capHolds: [],
    };
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    expect(totals.incompleteChargesTotal).toBe(MIN_ROSTER * MIN_SALARY);
  });

  it('Case G: Null/undefined players is handled gracefully', () => {
    const teamSheet = {
      players: null,
      capHolds: [],
    };
    const totals = computeTeamCapTotals(teamSheet, YEAR);
    
    expect(totals.incompleteChargesTotal).toBe(MIN_ROSTER * MIN_SALARY);
  });

  it('Case H: Uses correct minimum salary for different years', () => {
    const teamSheet = createTeamWithRoster(13);
    
    // Test year 2025 (2024-25)
    const totals2025 = computeTeamCapTotals(teamSheet, 2025);
    expect(totals2025._meta.incompleteRosterCharge?.chargePerSlot).toBe(MIN_SALARY);
    
    // Test year 2026 (2025-26)
    // Now asserts that rookieMin IS resolved correctly
    const totals2026 = computeTeamCapTotals(teamSheet, 2026);
    expect(totals2026.incompleteChargesTotal).toBe(1_164_345); // 2025-26 rookie min
    expect(totals2026._meta.incompleteRosterCharge?.chargePerSlot).toBe(1_164_345);
  });
});
