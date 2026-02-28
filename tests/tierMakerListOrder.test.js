/**
 * FILE: tests/tierMakerListOrder.test.js
 * PURPOSE: Validates TierMakerBoard preserves ranked list order when seeding pool
 * OWNERSHIP: TierMaker feature
 *
 * DESCRIPTION:
 * Tests the ordered ID selection logic used when importing a saved list into
 * TierMaker/Tieramid boards. Verifies that:
 * - playerOrder is used when present and non-empty
 * - playerIds is used as fallback when playerOrder is empty/missing
 */

import { describe, it, expect } from 'vitest';

/**
 * Extracts the ordered ID selection logic from TierMakerBoard/TieramidBoard's handleAddList.
 * This mirrors the actual implementation in:
 * - src/features/tierMaker/TierMakerBoard.jsx (handleAddList)
 * - src/features/tierMaker/TieramidBoard.jsx (handleAddList)
 *
 * @param {Object} list - A list document with playerIds and playerOrder arrays
 * @param {Object} playersMap - Map of playerId -> player object
 * @returns {Array} Array of player objects in correct order
 */
const getOrderedPlayersFromList = (list, playersMap) => {
  const orderedIds =
    list.playerOrder && list.playerOrder.length > 0
      ? list.playerOrder
      : list.playerIds;
  return orderedIds.map((id) => playersMap[id]).filter(Boolean);
};

describe('TierMaker List Order Preservation', () => {
  // Mock players map
  const playersMap = {
    player_a: { id: 'player_a', name: 'Alice' },
    player_b: { id: 'player_b', name: 'Bob' },
    player_c: { id: 'player_c', name: 'Charlie' },
    player_d: { id: 'player_d', name: 'Diana' },
    player_e: { id: 'player_e', name: 'Eve' },
  };

  describe('playerOrder precedence', () => {
    it('uses playerOrder when present and non-empty', () => {
      const list = {
        id: 'list1',
        name: 'Ranked List',
        // playerOrder defines the explicit ranking
        playerOrder: ['player_c', 'player_a', 'player_e'],
        // playerIds contains all players but in a different order
        playerIds: ['player_a', 'player_b', 'player_c', 'player_d', 'player_e'],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      // Should follow playerOrder, not playerIds
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('player_c');
      expect(result[1].id).toBe('player_a');
      expect(result[2].id).toBe('player_e');
    });

    it('preserves exact order from playerOrder', () => {
      const list = {
        id: 'list2',
        name: 'Custom Order',
        playerOrder: [
          'player_e',
          'player_d',
          'player_c',
          'player_b',
          'player_a',
        ],
        playerIds: ['player_a', 'player_b', 'player_c', 'player_d', 'player_e'],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      expect(result.map((p) => p.id)).toEqual([
        'player_e',
        'player_d',
        'player_c',
        'player_b',
        'player_a',
      ]);
    });
  });

  describe('playerIds fallback', () => {
    it('falls back to playerIds when playerOrder is empty', () => {
      const list = {
        id: 'list3',
        name: 'Unranked List',
        playerOrder: [],
        playerIds: ['player_a', 'player_b', 'player_c'],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('player_a');
      expect(result[1].id).toBe('player_b');
      expect(result[2].id).toBe('player_c');
    });

    it('falls back to playerIds when playerOrder is undefined', () => {
      const list = {
        id: 'list4',
        name: 'Legacy List',
        playerOrder: undefined,
        playerIds: ['player_d', 'player_e'],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('player_d');
      expect(result[1].id).toBe('player_e');
    });

    it('falls back to playerIds when playerOrder is null', () => {
      const list = {
        id: 'list5',
        name: 'Null Order List',
        playerOrder: null,
        playerIds: ['player_a'],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('player_a');
    });
  });

  describe('missing player handling', () => {
    it('filters out players not found in playersMap', () => {
      const list = {
        id: 'list6',
        name: 'Partial List',
        playerOrder: ['player_a', 'nonexistent_player', 'player_b'],
        playerIds: [],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      // Should skip nonexistent player
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('player_a');
      expect(result[1].id).toBe('player_b');
    });
  });

  describe('edge cases', () => {
    it('handles empty list gracefully', () => {
      const list = {
        id: 'list7',
        name: 'Empty List',
        playerOrder: [],
        playerIds: [],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      expect(result).toHaveLength(0);
    });

    it('handles single player list', () => {
      const list = {
        id: 'list8',
        name: 'Single Player',
        playerOrder: ['player_c'],
        playerIds: ['player_a', 'player_b', 'player_c'],
      };

      const result = getOrderedPlayersFromList(list, playersMap);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('player_c');
    });
  });
});
