/**
 * FILE: tests/architect/capHolds.test.ts
 * PURPOSE: Unit tests for cap holds utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  getActiveUnsignedCapHolds,
  getActiveUnsignedCapHoldsTotal,
  getActiveUnsignedCapHoldsByEndYear,
  getActiveUnsignedCapHoldsTotalByEndYear,
  endYearToStartYear,
} from '@/features/architect/utils/capHolds';

describe('capHolds utility', () => {
  const mockCapHolds = [
    {
      playerId: 'player1',
      playerName: 'Player One',
      amount: 5000000,
      season: '2024-25',
      type: 'FA Cap Hold',
      active: true,
      isSigned: false,
    },
    {
      playerId: 'player2',
      playerName: 'Player Two',
      amount: 3000000,
      season: '2024-25',
      type: 'FA Cap Hold',
      active: true,
      isSigned: false,
    },
    {
      playerId: 'player3',
      playerName: 'Player Three',
      amount: 2000000,
      season: '2024-25',
      type: 'FA Cap Hold',
      active: false, // inactive
      isSigned: false,
    },
    {
      playerId: 'player4',
      playerName: 'Player Four',
      amount: 4000000,
      season: '2024-25',
      type: 'FA Cap Hold',
      active: true,
      isSigned: true, // signed
    },
    {
      playerId: 'player5',
      playerName: 'Player Five',
      amount: 6000000,
      season: '2025-26', // different season
      type: 'FA Cap Hold',
      active: true,
      isSigned: false,
    },
  ];

  describe('endYearToStartYear', () => {
    it('converts end year to start year', () => {
      expect(endYearToStartYear(2025)).toBe(2024);
      expect(endYearToStartYear(2026)).toBe(2025);
    });
  });

  describe('getActiveUnsignedCapHolds', () => {
    it('returns empty array for null/undefined input', () => {
      expect(getActiveUnsignedCapHolds(null, 2024)).toEqual([]);
      expect(getActiveUnsignedCapHolds(undefined, 2024)).toEqual([]);
    });

    it('filters by active and not signed', () => {
      const result = getActiveUnsignedCapHolds(mockCapHolds, 2024);
      // Should include player1 and player2 (active, not signed, season 2024-25)
      // Should exclude player3 (inactive), player4 (signed), player5 (different season)
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.playerId)).toEqual(['player1', 'player2']);
    });

    it('treats missing active as active for staged unsigned holds', () => {
      const result = getActiveUnsignedCapHolds(
        [
          {
            playerId: 'staged_hold',
            playerName: 'Staged Hold',
            amount: 7_500_000,
            season: '2024-25',
            type: 'UFA',
            isSigned: false,
          } as (typeof mockCapHolds)[number],
        ],
        2024
      );

      expect(result).toHaveLength(1);
      expect(result[0].playerId).toBe('staged_hold');
    });

    it('filters by season start year matching yearKey', () => {
      const result = getActiveUnsignedCapHolds(mockCapHolds, 2025);
      // Should only include player5 (season 2025-26, yearKey = 2025)
      expect(result).toHaveLength(1);
      expect(result[0].playerId).toBe('player5');
    });

    it('handles invalid season format gracefully', () => {
      const holdsWithBadSeason = [
        {
          playerId: 'bad1',
          playerName: 'Bad Season',
          amount: 1000000,
          season: 'invalid', // no dash
          type: 'FA Cap Hold',
          active: true,
          isSigned: false,
        },
        {
          playerId: 'bad2',
          playerName: 'No Season',
          amount: 1000000,
          season: null as unknown as string, // null season
          type: 'FA Cap Hold',
          active: true,
          isSigned: false,
        },
      ];
      const result = getActiveUnsignedCapHolds(holdsWithBadSeason, 2024);
      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveUnsignedCapHoldsTotal', () => {
    it('sums amounts of active unsigned holds', () => {
      const total = getActiveUnsignedCapHoldsTotal(mockCapHolds, 2024);
      // player1 (5M) + player2 (3M) = 8M
      expect(total).toBe(8000000);
    });

    it('returns 0 for empty or no matching holds', () => {
      expect(getActiveUnsignedCapHoldsTotal([], 2024)).toBe(0);
      expect(getActiveUnsignedCapHoldsTotal(mockCapHolds, 2020)).toBe(0);
    });

    it('handles missing amount gracefully', () => {
      const holdsWithMissingAmount = [
        {
          playerId: 'player1',
          playerName: 'Player One',
          amount: undefined as unknown as number,
          season: '2024-25',
          type: 'FA Cap Hold',
          active: true,
          isSigned: false,
        },
      ];
      const total = getActiveUnsignedCapHoldsTotal(
        holdsWithMissingAmount,
        2024
      );
      expect(total).toBe(0);
    });
  });

  describe('getActiveUnsignedCapHoldsByEndYear', () => {
    it('converts end year to start year and filters', () => {
      // selectedYear 2025 means season "2024-25", start year = 2024
      const result = getActiveUnsignedCapHoldsByEndYear(mockCapHolds, 2025);
      expect(result).toHaveLength(2);
      expect(result.map((h) => h.playerId)).toEqual(['player1', 'player2']);
    });

    it('selectedYear 2026 matches season 2025-26', () => {
      const result = getActiveUnsignedCapHoldsByEndYear(mockCapHolds, 2026);
      expect(result).toHaveLength(1);
      expect(result[0].playerId).toBe('player5');
    });
  });

  describe('getActiveUnsignedCapHoldsTotalByEndYear', () => {
    it('returns total using end year conversion', () => {
      // selectedYear 2025 -> start year 2024 -> player1 + player2 = 8M
      const total = getActiveUnsignedCapHoldsTotalByEndYear(mockCapHolds, 2025);
      expect(total).toBe(8000000);
    });
  });
});
