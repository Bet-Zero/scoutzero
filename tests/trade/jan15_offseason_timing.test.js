import { describe, it, expect } from 'vitest';
import { validateTiming } from '@/features/architect/utils/tradeMachine/rules/timingValidation.js';

describe('Jan 15 gate for offseason sign-and-trades', () => {
  it('should reject offseason sign-and-trade before next season Jan 15', () => {
    // Sign-and-trade happens in October 2024 (offseason)
    // Player should not be tradeable until Jan 15, 2025 (next season)
    const team = {
      outgoingPlayers: [
        {
          name: 'Offseason S&T Player',
          signAndTrade: true,
        },
      ],
    };

    // Try to trade on October 1, 2024 (offseason)
    const result = validateTiming(team, { tradeDate: '2024-10-01' });
    
    // This should fail because the player can't be traded until Jan 15, 2025
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('January 15'))).toBe(true);
  });

  it('should allow offseason sign-and-trade after next season Jan 15', () => {
    // Sign-and-trade happens in July 2024 (offseason)
    // Player should be tradeable after Jan 15, 2025 (next season)
    const team = {
      outgoingPlayers: [
        {
          name: 'Offseason S&T Player',
          signAndTrade: true,
        },
      ],
    };

    // Try to trade on January 20, 2025 (after Jan 15, 2025)
    const result = validateTiming(team, { tradeDate: '2025-01-20' });
    
    // This should pass
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should reject recently extended player before next season Jan 15 in offseason', () => {
    // Extension happens in August 2024 (offseason)
    // Player should not be tradeable until Jan 15, 2025 (next season)
    const team = {
      outgoingPlayers: [
        {
          name: 'Recently Extended Player',
          isRecentlyExtended: true,
        },
      ],
    };

    // Try to trade on November 15, 2024 (offseason)
    const result = validateTiming(team, { tradeDate: '2024-11-15' });
    
    // This should fail because the player can't be traded until Jan 15, 2025
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('January 15'))).toBe(true);
  });

  it('should allow in-season trades after same-year Jan 15', () => {
    // For trades happening in the regular season (after Jan 15),
    // the Jan 15 restriction should use the same year
    const team = {
      outgoingPlayers: [
        {
          name: 'In-Season S&T Player',
          signAndTrade: true,
        },
      ],
    };

    // Try to trade on February 1, 2025 (after Jan 15, 2025)
    const result = validateTiming(team, { tradeDate: '2025-02-01' });
    
    // This should pass
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should reject in-season trades before same-year Jan 15', () => {
    // For trades happening before Jan 15 in the season
    const team = {
      outgoingPlayers: [
        {
          name: 'In-Season S&T Player',
          signAndTrade: true,
        },
      ],
    };

    // Try to trade on January 10, 2025 (before Jan 15, 2025)
    const result = validateTiming(team, { tradeDate: '2025-01-10' });
    
    // This should fail
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('January 15'))).toBe(true);
  });
});
