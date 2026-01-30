/**
 * FILE: src/shared/utils/getPlayerId.js
 * PURPOSE: Single source of truth for extracting a player's unique ID.
 *          Ensures consistent ID lookups across table rows, drawer, and expand logic.
 *
 * OWNERSHIP: Shared utility
 *
 * HISTORY:
 *  - 2026-01-29: Created for Phase 2C row perf + ID consistency work
 */

/**
 * Returns the canonical player ID from a player object.
 * Handles both normalized players (player.id) and raw Firestore docs (player.bio?.playerId).
 *
 * @param {Object} player - The player object
 * @returns {string|null} - The player ID or null if not found
 */
export function getPlayerId(player) {
  if (!player) return null;
  return player.id || player.bio?.playerId || null;
}

export default getPlayerId;
