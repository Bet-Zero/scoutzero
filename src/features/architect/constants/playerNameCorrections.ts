/**
 * Player Name Corrections
 *
 * This module provides corrections for player names that cannot be
 * automatically derived from snake_case player IDs, particularly
 * for hyphenated names where the hyphen position is ambiguous.
 *
 * @file src/features/architect/constants/playerNameCorrections.ts
 * @purpose Centralized source of truth for hyphenated player name mappings
 * @ownership Architect feature
 */

/**
 * Map of player IDs (snake_case) to their correctly formatted display names.
 *
 * This handles cases where:
 * - Names contain hyphens (e.g., "Finney-Smith", "Gilgeous-Alexander")
 * - Names have unusual capitalization
 * - The snake_case ID doesn't clearly indicate hyphen placement
 *
 * Keys: player_id in snake_case format (e.g., "dorian_finney_smith")
 * Values: Correctly formatted display name (e.g., "Dorian Finney-Smith")
 *
 * When adding new entries:
 * - Add in alphabetical order by last name
 * - Include players where hyphen position is non-obvious from the ID
 */
export const HYPHENATED_NAMES: Record<string, string> = {
  // A
  // B
  keita_bates_diop: 'Keita Bates-Diop',
  // C
  kentavious_caldwell_pope: 'Kentavious Caldwell-Pope',
  michael_carter_williams: 'Michael Carter-Williams',
  willie_cauley_stein: 'Willie Cauley-Stein',
  // D
  // E
  // F
  dorian_finney_smith: 'Dorian Finney-Smith',
  // G
  shai_gilgeous_alexander: 'Shai Gilgeous-Alexander',
  // H
  rondae_hollis_jefferson: 'Rondae Hollis-Jefferson',
  talen_horton_tucker: 'Talen Horton-Tucker',
  // I-J-K-L-M-N-O-P-Q-R-S
  lebron_james: 'LeBron James',
  // T
  karl_anthony_towns: 'Karl-Anthony Towns',
  // U-V-W
  nickeil_alexander_walker: 'Nickeil Alexander-Walker',
  // X-Y-Z
};

/**
 * Convert a snake_case player ID to a properly formatted display name.
 *
 * Resolution order:
 * 1. Check HYPHENATED_NAMES for known corrections
 * 2. Fall back to converting snake_case to Title Case
 *
 * @param playerId - The player ID in snake_case format (e.g., "lebron_james")
 * @returns The formatted display name (e.g., "LeBron James")
 *
 * @example
 * normalizePlayerName('lebron_james') // => 'LeBron James'
 * normalizePlayerName('shai_gilgeous_alexander') // => 'Shai Gilgeous-Alexander'
 * normalizePlayerName('unknown_player') // => 'Unknown Player'
 */
export function normalizePlayerName(
  playerId: string | undefined | null
): string {
  if (!playerId) {
    return 'Unknown';
  }

  // Check for known hyphenated name corrections first
  const knownName = HYPHENATED_NAMES[playerId];
  if (knownName) {
    return knownName;
  }

  // Fall back to converting snake_case to Title Case
  return playerId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolve a player's display name from various possible sources.
 *
 * This function handles the common pattern where a player object may have:
 * - A valid name field
 * - "Player Not Found" or "Unknown" placeholder
 * - An ID that can be converted to a display name
 *
 * @param name - The existing name field (may be placeholder or undefined)
 * @param playerId - The player ID to use as fallback
 * @returns The best available display name
 *
 * @example
 * resolvePlayerDisplayName('LeBron James', 'lebron_james') // => 'LeBron James'
 * resolvePlayerDisplayName('Player Not Found', 'lebron_james') // => 'LeBron James'
 * resolvePlayerDisplayName(undefined, 'shai_gilgeous_alexander') // => 'Shai Gilgeous-Alexander'
 */
export function resolvePlayerDisplayName(
  name: string | undefined | null,
  playerId: string | undefined | null
): string {
  // If we have a valid name that's not a placeholder, use it
  if (name && name !== 'Player Not Found' && name !== 'Unknown') {
    return name;
  }

  // Otherwise, derive from player ID
  return normalizePlayerName(playerId);
}
