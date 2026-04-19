/**
 * Smoke check for draft picks swap partner parsing and via hygiene fixes
 * 
 * Validates:
 * 1. Via hygiene: no redundant (via TEAM) when via === originalTeam
 * 2. Swap partner extraction from swapDetails.swapWith and swapId
 * 3. formatPick and formatSwapInfo produce correct output
 */

import { describe, it, expect } from 'vitest';
import { formatPick, formatSwapInfo } from '@/features/architect/utils/tradeHelpers';

describe('Draft Picks Smoke Check', () => {
  describe('Via Hygiene', () => {
    it('should not show (via DAL) for DAL own pick', () => {
      const pick = {
        year: 2029,
        round: 1,
        originalTeam: 'DAL',
        owner: 'DAL',
        via: 'DAL', // Redundant via
      };
      const formatted = formatPick(pick);
      expect(formatted).not.toContain('(via DAL)');
      expect(formatted).toBe('2029 1 Round');
    });

    it('should show (via LAL) when via differs from originalTeam and owner', () => {
      const pick = {
        year: 2029,
        round: 1,
        originalTeam: 'PHI',
        owner: 'DAL',
        via: 'LAL', // via differs from both originalTeam and owner
      };
      const formatted = formatPick(pick);
      expect(formatted).toContain('(via LAL)');
    });

    it('should not show via when via === originalTeam even if owner differs', () => {
      const pick = {
        year: 2028,
        round: 1,
        originalTeam: 'DAL',
        owner: 'OKC',
        via: 'DAL', // Same as originalTeam, should be suppressed
      };
      const formatted = formatPick(pick);
      expect(formatted).not.toContain('(via DAL)');
    });
  });

  describe('Swap Partner Extraction', () => {
    it('should extract partner from swapDetails.swapWith', () => {
      const pick = {
        isSwap: true,
        swapType: 'best_of',
        swapDetails: {
          swapWith: ['OKC'],
        },
      };
      const formatted = formatSwapInfo(pick);
      expect(formatted).toBe('Swap (Best of) vs OKC');
    });

    it('should extract partner from swapId as fallback', () => {
      const pick = {
        isSwap: true,
        swapType: 'best_of',
        swapId: 'DAL_2028_1st_swap_HOU',
      };
      const formatted = formatSwapInfo(pick);
      expect(formatted).toBe('Swap (Best of) vs HOU');
    });

    it('should prioritize swapWithTeamId over swapDetails', () => {
      const pick = {
        isSwap: true,
        swapType: 'best_of',
        swapWithTeamId: 'BKN',
        swapDetails: {
          swapWith: ['OKC'],
        },
      };
      const formatted = formatSwapInfo(pick);
      expect(formatted).toBe('Swap (Best of) vs BKN');
    });

    it('should handle worst_of swap type', () => {
      const pick = {
        isSwap: true,
        swapType: 'worst_of',
        swapDetails: {
          swapWith: ['NYK'],
        },
      };
      const formatted = formatSwapInfo(pick);
      expect(formatted).toBe('Swap (Worst of) vs NYK');
    });

    it('should show swap without partner if none available', () => {
      const pick = {
        isSwap: true,
        swapType: 'best_of',
      };
      const formatted = formatSwapInfo(pick);
      expect(formatted).toBe('Swap (Best of)');
    });
  });

  describe('Format Pick Integration', () => {
    it('should format pick with swap info correctly', () => {
      const pick = {
        year: 2028,
        round: 1,
        originalTeam: 'DAL',
        owner: 'DAL',
        isSwap: true,
        swapType: 'best_of',
        swapDetails: {
          swapWith: ['OKC'],
        },
      };
      const formatted = formatPick(pick);
      expect(formatted).toContain('2028 1 Round');
      expect(formatted).toContain('Swap (Best of) vs OKC');
      expect(formatted).not.toContain('(via DAL)');
    });

    it('should format pick with protection and swap', () => {
      const pick = {
        year: 2027,
        round: 1,
        originalTeam: 'DET',
        owner: 'DET',
        protection: 'top-4 protected',
        isSwap: true,
        swapType: 'best_of',
        swapDetails: {
          swapWith: ['WAS'],
        },
      };
      const formatted = formatPick(pick);
      expect(formatted).toContain('2027 1 Round');
      expect(formatted).toContain('Protected: top-4 protected');
      expect(formatted).toContain('Swap (Best of) vs WAS');
    });
  });
});
