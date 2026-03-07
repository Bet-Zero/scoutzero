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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .replace(/\s/g, '-'); // Join with hyphens
}

export function getPlayerRouteId(player) {
  return player?.id || player?.bio?.playerId || player?.player_id || '';
}

export function getPlayerDisplayName(player) {
  return (
    player?.bio?.displayName ||
    player?.bio?.name ||
    player?.name ||
    player?.playerName ||
    ''
  );
}

const matchesRouteIdentifier = (player, identifier) => {
  if (!identifier) return false;
  return [player?.id, player?.bio?.playerId, player?.player_id].includes(
    identifier
  );
};

export function resolvePlayerProfileTarget(
  players,
  { pid = '', legacyPlayer = '', slug = '' } = {}
) {
  const playerList = Array.isArray(players) ? players : [];

  if (pid) {
    const match = playerList.find((player) => matchesRouteIdentifier(player, pid));
    if (match) {
      return { player: match, source: 'pid', status: 'matched' };
    }
  }

  if (legacyPlayer) {
    const match = playerList.find((player) =>
      matchesRouteIdentifier(player, legacyPlayer)
    );
    if (match) {
      return { player: match, source: 'legacyPlayer', status: 'matched' };
    }
  }

  if (slug) {
    const matches = playerList.filter(
      (player) => toPlayerSlug(getPlayerDisplayName(player)) === slug
    );

    if (matches.length === 1) {
      return { player: matches[0], source: 'slug', status: 'matched' };
    }

    if (matches.length > 1) {
      return { player: null, source: 'slug', status: 'ambiguous' };
    }

    return { player: null, source: 'slug', status: 'missing' };
  }

  return { player: null, source: null, status: 'none' };
}

/**
 * Generates the URL for a player's profile page.
 * @param {Object} player - Player object with bio data
 * @returns {string} Profile URL in format `/profiles/<slug>?pid=<playerDocId>`
 *
 * Display name resolution order:
 * 1. player?.bio?.displayName
 * 2. player?.name
 */
export function getPlayerProfileUrl(player) {
  if (!player) {
    return '/profiles';
  }

  const playerId = getPlayerRouteId(player);
  const displayName = getPlayerDisplayName(player);

  // Generate slug
  const slug = toPlayerSlug(displayName);

  // Return URL with pid query param if we have a playerId
  if (slug && playerId) {
    return `/profiles/${slug}?pid=${encodeURIComponent(playerId)}`;
  }

  if (slug) {
    return `/profiles/${slug}`;
  }

  if (playerId) {
    return `/profiles?pid=${encodeURIComponent(playerId)}`;
  }

  return '/profiles';
}
