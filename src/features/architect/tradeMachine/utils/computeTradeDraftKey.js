/**
 * FILE: computeTradeDraftKey.js
 * PURPOSE: Compute a deterministic key for the current trade draft configuration.
 *          Used to determine if validation result is "current" for the active trade setup.
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *   - Jan 2026: Created for stale validation state fix
 *   - Jan 2026: Updated to use canonical pick IDs (Phase 1 - SSOT)
 */

import { ensurePickId } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils.js';

/**
 * Computes a deterministic "draft key" that represents the current trade configuration.
 * 
 * This key is used to ensure validation state is only shown as "Validated" 
 * when the result matches the current trade draft. If the trade configuration
 * changes (teams, players, picks), the key changes, invalidating stale results.
 * 
 * @param {Object} params - Trade configuration
 * @param {number|string} params.yearKey - Season year key (e.g., 2025)
 * @param {Array} params.teams - Array of team objects from trade machine state
 * @returns {string} Deterministic key representing current draft configuration
 */
export function computeTradeDraftKey({ yearKey, teams = [] }) {
  // Build a stable key from trade configuration
  // Format: "yearKey|team1Id:player1,player2:pick1,pick2|team2Id:..."
  
  const teamParts = teams
    .filter(t => t.team) // Only include selected teams
    .map(t => {
      const teamId = t.team?.id || 'unknown';
      
      // Sort player IDs for deterministic ordering
      const playerIds = (t.sends || [])
        .map(p => p.id || p.player_id || 'unknown')
        .sort()
        .join(',');
      
      // Sort picks for deterministic ordering
      // Use ensurePickId to get stable pick.id (Phase 1 T4 fix)
      // This preserves existing valid IDs and only generates fallbacks for missing fields
      const pickKeys = (t.picksOut || [])
        .map(p => ensurePickId(p).id)
        .sort()
        .join(',');
      
      return `${teamId}:${playerIds}:${pickKeys}`;
    })
    .sort() // Sort team parts for consistency regardless of order
    .join('|');
  
  return `${yearKey}|${teamParts}`;
}

/**
 * Checks if the current trade draft matches the last validated configuration.
 * 
 * @param {string} currentDraftKey - Current trade configuration key
 * @param {string|null} lastValidatedDraftKey - Key that was validated
 * @returns {boolean} True if validation is current for this draft
 */
export function isValidationCurrent(currentDraftKey, lastValidatedDraftKey) {
  if (!lastValidatedDraftKey) return false;
  if (!currentDraftKey) return false;
  return currentDraftKey === lastValidatedDraftKey;
}
