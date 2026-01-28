/**
 * FILE: src/shared/utils/routing/playerRouteUtils.js
 * PURPOSE: Utility functions for generating player profile URLs and slugs.
 * OWNERSHIP: Feature: scouting/player-table
 *
 * HISTORY:
 *  - 2026-01-28: Initial creation for click-to-profile navigation from /players table
 *
 * LINKS:
 *  - Return Package: docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2A_PROFILE_NAV_RP.md
 */

/**
 * Converts a player display name to a URL-safe slug.
 * @param {string} displayName - The player's display name (e.g., "LeBron James")
 * @returns {string} URL-safe slug (e.g., "lebron-james")
 *
 * Rules:
 * - Trim whitespace
 * - Lowercase
 * - Replace non-alphanumeric characters with spaces
 * - Collapse multiple spaces to single space
 * - Join words with hyphens
 */
export function toPlayerSlug(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    return '';
  }

  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .replace(/\s/g, '-'); // Join with hyphens
}

/**
 * Generates the URL for a player's profile page.
 * @param {Object} player - Player object with bio data
 * @returns {string} Profile URL in format `/profiles/<slug>?pid=<playerId>`
 *
 * Player ID resolution order:
 * 1. player?.bio?.playerId
 * 2. player?.id
 *
 * Display name resolution order:
 * 1. player?.bio?.displayName
 * 2. player?.name
 */
export function getPlayerProfileUrl(player) {
  if (!player) {
    return '/profiles';
  }

  // Determine playerId
  const playerId = player?.bio?.playerId || player?.id;

  // Determine displayName
  const displayName = player?.bio?.displayName || player?.name;

  // Generate slug
  const slug = toPlayerSlug(displayName);

  if (!slug) {
    return '/profiles';
  }

  // Return URL with pid query param if we have a playerId
  if (playerId) {
    return `/profiles/${slug}?pid=${encodeURIComponent(playerId)}`;
  }

  // Fallback: just the slug without pid
  return `/profiles/${slug}`;
}
