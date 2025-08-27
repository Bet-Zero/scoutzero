import { describe, it, expect } from 'vitest';
import { validateRosterMove } from '../src/utils/architect/rosterMoveValidator.js';

describe('Roster Move Validator', () => {
  // Create a realistic team roster with minimum 14 players
  const createMockRoster = () => {
    const players = [];
    for (let i = 0; i < 14; i++) {
      players.push({
        name: `Player ${i + 1}`,
        contract_clean: {
          salaries_by_year: {
            2025: { salary: 2000000 + (i * 100000) }
          }
        }
      });
    }
    return players;
  };

  const mockTeamCapSheet = {
    players: createMockRoster(),
    waivedContracts: []
  };

  const mockPlayer = {
    name: 'Test Player',
    contract_clean: {
      salaries_by_year: {
        2025: { salary: 10000000, option: 'Player Option' },
        2026: { salary: 11000000 }
      }
    }
  };

  it('should validate option acceptance', () => {
    const moveData = {
      action: 'accept',
      player: mockPlayer,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(true);
    expect(result.capImpact).toBe(0); // Option already counted
  });

  it('should validate option decline', () => {
    const moveData = {
      action: 'decline',
      player: mockPlayer,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(true);
    expect(result.capImpact).toBe(-10000000); // Frees up option salary
  });

  it('should validate free agent signing', () => {
    const freeAgent = {
      name: 'Free Agent',
      free_agency_year: 2024,
      cap_hold: 5000000,
      birdRights: 'Full Bird',
      askingSalary: 8000000, // Add asking salary for canSignFreeAgent function
      previousSalary: 7000000
    };

    const moveData = {
      action: 'resign',
      player: freeAgent,
      contractDetails: {
        years: 2,
        salaries: [8000000, 8500000],
        contractType: 'Standard',
        useException: false
      },
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(true);
    expect(result.capImpact).toBe(3000000); // New salary minus cap hold
  });

  it('should validate player waiving', () => {
    const moveData = {
      action: 'waive',
      player: mockPlayer,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(true);
    expect(result.capImpact).toBe(21000000); // Total remaining salary as dead cap
  });

  it('should validate waive and stretch', () => {
    const moveData = {
      action: 'waiveStretch',
      player: mockPlayer,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0); // Should have stretch warning
  });

  it('should validate cap hold renouncing', () => {
    const capHoldPlayer = {
      name: 'Cap Hold Player',
      cap_hold: 3000000
    };

    const moveData = {
      action: 'renounce',
      player: capHoldPlayer,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(true);
    expect(result.capImpact).toBe(-3000000); // Frees up cap hold
  });

  it('should reject invalid moves', () => {
    const moveData = {
      action: 'invalid_action',
      player: mockPlayer,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unknown action');
  });

  it('should reject moves with missing data', () => {
    const moveData = {
      action: 'accept',
      player: null,
      contractDetails: {},
      teamCapSheet: mockTeamCapSheet,
      currentYear: 2024
    };

    const result = validateRosterMove(moveData);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Missing required data');
  });
});