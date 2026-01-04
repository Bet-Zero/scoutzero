/**
 * Pick ID Utilities
 * 
 * Canonical utilities for draft pick identification and normalization.
 * These utilities ensure stable, deterministic pick IDs across the trade machine.
 * 
 * Phase 1 Implementation - Trade Machine Draft Picks SSOT
 * 
 * @file src/features/architect/utils/tradeMachine/utils/pickIdUtils.js
 */

/**
 * Normalizes round input to canonical format (1 or 2)
 * 
 * @param {number|string} input - Round in any format: 1, 2, "1st", "2nd", "first", "second"
 * @returns {1|2|null} - Normalized round number, or null if invalid
 * 
 * @example
 * normalizeRound(1)        // => 1
 * normalizeRound("1st")    // => 1
 * normalizeRound("first")  // => 1
 * normalizeRound("2nd")    // => 2
 * normalizeRound("second") // => 2
 */
export function normalizeRound(input) {
  if (input == null) return null;
  
  // Handle numeric input
  if (typeof input === 'number') {
    if (input === 1 || input === 2) return input;
    return null;
  }
  
  // Handle string input
  const str = String(input).toLowerCase().trim();
  
  // Match first round variations
  if (str === '1' || str === '1st' || str === 'first') {
    return 1;
  }
  
  // Match second round variations
  if (str === '2' || str === '2nd' || str === 'second') {
    return 2;
  }
  
  return null;
}

/**
 * Generates a canonical pick ID from pick properties.
 * Format: "{originalTeam}_{year}_{round}"
 * 
 * @param {Object} pick - Pick object
 * @param {string} [pick.originalTeam] - Team that originally owned the pick
 * @param {number} [pick.year] - Draft year
 * @param {number|string} [pick.round] - Draft round
 * @returns {string} - Canonical pick ID (e.g., "PHI_2026_1")
 * 
 * @example
 * generatePickId({ originalTeam: 'PHI', year: 2026, round: '1st' })
 * // => "PHI_2026_1"
 */
export function generatePickId(pick) {
  if (!pick) return 'UNK_????_?';
  
  const team = pick.originalTeam || 'UNK';
  const year = pick.year || '????';
  const round = normalizeRound(pick.round);
  const roundStr = round != null ? round : '?';
  
  return `${team}_${year}_${roundStr}`;
}

/**
 * Regex pattern for valid pick IDs.
 * Format: {2-4 char team code}_{4 digit year}_{1 or 2}
 * 
 * Team codes can be 2-4 characters:
 * - 3 chars: Most NBA teams (PHI, LAL, GSW, MIA, etc.)
 * - 4 chars: Utah Jazz (UTAH), Oklahoma City (OKC is 3 but OKLA could be used)
 * - 2 chars: Reserved for edge cases
 * 
 * Examples: "PHI_2026_1", "LAL_2028_2", "GSW_2025_1", "UTAH_2027_2"
 */
const VALID_PICK_ID_PATTERN = /^[A-Z]{2,4}_\d{4}_[12]$/;

/**
 * Ensures a pick has a valid canonical ID.
 * If the pick already has a valid ID matching the expected format, it's preserved.
 * Otherwise, generates a new ID from pick properties.
 * 
 * This function does NOT mutate the input - it returns a new object if changes are needed.
 * 
 * @param {Object} pick - Pick object (may or may not have an id)
 * @returns {Object} - Pick object with guaranteed id property
 * 
 * @example
 * // Pick without ID - generates one
 * ensurePickId({ originalTeam: 'PHI', year: 2026, round: 1 })
 * // => { originalTeam: 'PHI', year: 2026, round: 1, id: 'PHI_2026_1' }
 * 
 * // Pick with valid ID - preserves it
 * ensurePickId({ id: 'LAL_2025_2', year: 2025, round: 2 })
 * // => { id: 'LAL_2025_2', year: 2025, round: 2 }
 * 
 * // Pick with missing fields - generates fallback + warning
 * ensurePickId({ year: 2026, round: 1 })
 * // => { year: 2026, round: 1, id: 'UNK_2026_1', pickIdWarning: 'Missing originalTeam' }
 */
export function ensurePickId(pick) {
  if (!pick) {
    return { id: 'UNK_????_?', pickIdWarning: 'Null or undefined pick' };
  }
  
  // Check if pick already has a valid ID
  if (pick.id && typeof pick.id === 'string' && VALID_PICK_ID_PATTERN.test(pick.id)) {
    return pick;
  }
  
  // Generate ID from properties
  const id = generatePickId(pick);
  
  // Build warning messages for missing fields
  const missingFields = [];
  if (!pick.originalTeam) missingFields.push('originalTeam');
  if (!pick.year) missingFields.push('year');
  if (normalizeRound(pick.round) == null) missingFields.push('round');
  
  // Create new object with ID (don't mutate original)
  const result = { ...pick, id };
  
  // Add warning if any fields were missing
  if (missingFields.length > 0) {
    result.pickIdWarning = `Missing ${missingFields.join(', ')}`;
    // Also log a warning in dev mode for visibility
    // Using import.meta.env for Vite compatibility (modern build tools)
    if (typeof console !== 'undefined' && import.meta?.env?.MODE !== 'production') {
      console.warn(`[pickIdUtils] Pick ID generated with missing fields: ${missingFields.join(', ')}`, pick);
    }
  }
  
  return result;
}

/**
 * Compares two picks by their canonical IDs.
 * Both picks are normalized via ensurePickId before comparison.
 * 
 * @param {Object} a - First pick
 * @param {Object} b - Second pick
 * @returns {boolean} - True if picks have the same canonical ID
 * 
 * @example
 * areSamePickById(
 *   { originalTeam: 'PHI', year: 2026, round: '1st' },
 *   { originalTeam: 'PHI', year: 2026, round: 1 }
 * )
 * // => true (both normalize to PHI_2026_1)
 */
export function areSamePickById(a, b) {
  if (!a || !b) return false;
  
  const idA = ensurePickId(a).id;
  const idB = ensurePickId(b).id;
  
  return idA === idB;
}
