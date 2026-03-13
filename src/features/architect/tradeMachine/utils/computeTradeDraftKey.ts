/**
 * FILE: computeTradeDraftKey.ts
 * PURPOSE: Compute a deterministic key for the current trade draft configuration.
 *          Used to determine if validation result is "current" for the active trade setup.
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *   - Jan 2026: Created for stale validation state fix
 *   - Jan 2026: Updated to use canonical pick IDs (Phase 1 - SSOT)
 *   - Feb 2026: Phase 14.2 - Removed picksOut, now uses entitlementsOut only
 *   - Mar 2026: E77 - Migrated authoritative implementation to TypeScript
 */

type UnknownRecord = Record<string, any>;

interface TradeDraftPlayerLike extends UnknownRecord {
  id?: any;
  player_id?: any;
}

interface TradeDraftEntitlementLike extends UnknownRecord {
  draftKey?: any;
  id?: any;
  entitlementId?: any;
}

interface TradeDraftTeamLike extends UnknownRecord {
  team?: (UnknownRecord & { id?: any }) | null;
  sends?: TradeDraftPlayerLike[] | null;
  entitlementsOut?: TradeDraftEntitlementLike[] | null;
}

interface TradeDraftKeyParams {
  yearKey: any;
  teams?: TradeDraftTeamLike[];
}

/**
 * Computes a deterministic "draft key" that represents the current trade configuration.
 *
 * This key is used to ensure validation state is only shown as "Validated"
 * when the result matches the current trade draft. If the trade configuration
 * changes (teams, players, entitlements), the key changes, invalidating stale results.
 *
 * @param {Object} params - Trade configuration
 * @param {number|string} params.yearKey - Season year key (e.g., 2025)
 * @param {Array} params.teams - Array of team objects from trade machine state
 * @returns {string} Deterministic key representing current draft configuration
 */
export function computeTradeDraftKey({
  yearKey,
  teams = [],
}: TradeDraftKeyParams) {
  // Build a stable key from trade configuration
  // Phase 14.2: Format changed to use entitlementsOut instead of picksOut
  // Format: "yearKey|team1Id:player1,player2:ent1,ent2|team2Id:..."

  const teamParts = teams
    .filter((t) => t.team) // Only include selected teams
    .map((t) => {
      const teamId = t.team?.id || 'unknown';

      // Sort player IDs for deterministic ordering
      const playerIds = (t.sends || [])
        .map((p) => p.id || p.player_id || 'unknown')
        .sort()
        .join(',');

      // Phase 14.2: Use entitlement IDs instead of pick IDs
      const entitlementIds = (t.entitlementsOut || [])
        .map((e) => e.draftKey || e.id || e.entitlementId || 'unknown')
        .sort()
        .join(',');

      return `${teamId}:${playerIds}:${entitlementIds}`;
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
export function isValidationCurrent(
  currentDraftKey: string,
  lastValidatedDraftKey: string | null
) {
  if (!lastValidatedDraftKey) return false;
  if (!currentDraftKey) return false;
  return currentDraftKey === lastValidatedDraftKey;
}
