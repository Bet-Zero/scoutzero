/**
 * Tests for new architect schema support in trade validation
 * Ensures validators work correctly with contract.salariesByYear data
 */

import { describe, it, expect } from 'vitest';
import { computeMatchingValues } from '../src/utils/architect/tradeMachine/utils/computeMatchingValues';
import { getSalaryForYear, playerFitsInTPE } from '../src/utils/architect/tradeHelpers';
import { getCapHitForSeason, getSalaryForSeason, yearToSeason } from '../src/utils/architect/tradeMachine/utils/seasonUtils';
import {
  newSchemaPlayer,
  newSchemaRookiePlayer,
  newSchemaBYCPlayer,
  newSchemaTradeKickerPlayer
} from './fixtures/newSchemaPlayer';

describe('New Schema Player Salary Extraction', () => {
  it('should extract salary from contract.salariesByYear using season string', () => {
    const salary = getSalaryForSeason(newSchemaPlayer, '2024-25');
    expect(salary).toBe(5000000);
  });

  it('should extract capHit from contract.salariesByYear', () => {
    const capHit = getCapHitForSeason(newSchemaPlayer, '2024-25');
    expect(capHit).toBe(5000000);
  });

  it('should work with yearToSeason conversion', () => {
    const season = yearToSeason(2025); // 2025 -> "2024-25"
    const salary = getSalaryForSeason(newSchemaPlayer, season);
    expect(salary).toBe(5000000);
  });

  it('should extract salary using getSalaryForYear with numeric year', () => {
    const salary = getSalaryForYear(newSchemaPlayer, 2025);
    expect(salary).toBe(5000000);
  });

  it('should extract salary using getSalaryForYear with season string', () => {
    const salary = getSalaryForYear(newSchemaPlayer, '2024-25');
    expect(salary).toBe(5000000);
  });

  it('should return 0 for non-existent season', () => {
    const salary = getSalaryForSeason(newSchemaPlayer, '2030-31');
    expect(salary).toBe(0);
  });
});

describe('computeMatchingValues with New Schema Players', () => {
  it('should compute non-zero matching values for standard new schema player', () => {
    const teams = [{
      sends: [{ ...newSchemaPlayer }]
    }];
    
    computeMatchingValues({ teams, yearKey: 2025 });
    
    const player = teams[0].sends[0];
    expect(player.matchOutgoing).toBeGreaterThan(0);
    expect(player.matchIncoming).toBeGreaterThan(0);
    expect(player.matchOutgoing).toBe(5000000);
    expect(player.matchIncoming).toBe(5000000);
  });

  it('should compute BYC matching values correctly for new schema player', () => {
    const teams = [{
      sends: [{ ...newSchemaBYCPlayer }]
    }];
    
    computeMatchingValues({ teams, yearKey: 2025 });
    
    const player = teams[0].sends[0];
    expect(player.matchOutgoing).toBeGreaterThan(0);
    expect(player.matchIncoming).toBeGreaterThan(0);
    
    // BYC outgoing should be max(previousSalary, 50% of current)
    // max(2,000,000, 5,000,000) = 5,000,000
    expect(player.matchOutgoing).toBe(5000000);
    // Incoming should be full salary
    expect(player.matchIncoming).toBe(10000000);
  });

  it('should compute trade kicker matching values for new schema player', () => {
    const teams = [{
      sends: [{ ...newSchemaTradeKickerPlayer }]
    }];
    
    computeMatchingValues({ teams, yearKey: 2025 });
    
    const player = teams[0].sends[0];
    expect(player.matchOutgoing).toBeGreaterThan(0);
    expect(player.matchIncoming).toBeGreaterThan(0);
    
    // Outgoing should be base salary
    expect(player.matchOutgoing).toBe(8000000);
    // Incoming should include 15% trade kicker
    // But capped by remaining guaranteed
    expect(player.matchIncoming).toBeGreaterThan(8000000);
  });

  it('should identify rookie scale flag for poison pill logic', () => {
    const rookie = {
      ...newSchemaRookiePlayer,
      extensionYears: [
        { salary: 15000000 },
        { salary: 16000000 }
      ]
    };
    
    const teams = [{
      sends: [rookie]
    }];
    
    computeMatchingValues({ teams, yearKey: 2025 });
    
    const player = teams[0].sends[0];
    // Should apply poison pill averaging since isRookieScale = true
    expect(player.matchIncoming).toBeGreaterThan(0);
  });
});

describe('TPE Validation with New Schema', () => {
  it('should validate TPE fit using new schema salary', () => {
    const tpe = {
      amount: 6000000,
      expirationDate: '2025-12-31',
      isUsed: false
    };
    
    const fits = playerFitsInTPE(newSchemaPlayer, 2025, tpe);
    expect(fits).toBe(true);
  });

  it('should reject player that exceeds TPE amount', () => {
    const tpe = {
      amount: 3000000,
      expirationDate: '2025-12-31',
      isUsed: false
    };
    
    const fits = playerFitsInTPE(newSchemaPlayer, 2025, tpe);
    expect(fits).toBe(false);
  });

  it('should work with season string format', () => {
    const tpe = {
      amount: 6000000,
      expirationDate: '2025-12-31',
      isUsed: false
    };
    
    const fits = playerFitsInTPE(newSchemaPlayer, '2024-25', tpe);
    expect(fits).toBe(true);
  });
});

describe('Mixed Schema Trade Validation', () => {
  it('should handle trades with both new and old schema players', () => {
    const oldSchemaPlayer = {
      id: 'old-player',
      displayName: 'Old Player',
      contract_clean: {
        salaries_by_year: {
          2025: {
            salary: 4000000,
            guaranteed: true
          }
        }
      }
    };
    
    const teams = [{
      sends: [{ ...newSchemaPlayer }, oldSchemaPlayer]
    }];
    
    computeMatchingValues({ teams, yearKey: 2025 });
    
    // Both players should have matching values computed
    expect(teams[0].sends[0].matchOutgoing).toBe(5000000); // new schema
    expect(teams[0].sends[1].matchOutgoing).toBe(4000000); // old schema
  });
});
