/**
 * FILE: resolveValidationEntitlements.js
 * PURPOSE: Read-only entitlement resolution wrapper for validation pipeline.
 *          Provides batch resolution with per-run caching.
 * OWNERSHIP: Trade Machine / Stepien Validation
 * HISTORY:
 *   - 2026-01-30: Created for Phase 12.2 - Stepien Entitlement Baseline Migration
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.2)
 *   - src/features/architect/utils/entitlements/entitlementResolver.ts
 */

import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';

/**
 * Resolves entitlements for multiple teams in a single validation run.
 * Uses per-call caching to avoid duplicate Firestore reads for the same team.
 *
 * @param {Object} params - Resolution parameters
 * @param {string|null} params.worldId - The world ID (null for real-world/base)
 * @param {string[]} params.teamCodes - Array of 3-letter team codes to resolve
 * @returns {Promise<Map<string, Array>>} Map of teamCode → EffectiveEntitlement[]
 *
 * RULES:
 * - Read-only: No writes to Firestore
 * - Emulator + prod safe: Uses same resolver as UI
 * - Cached per call: Same teamCode won't be resolved twice in one batch
 */
export async function resolveEntitlementsForValidation({ worldId, teamCodes }) {
  if (!Array.isArray(teamCodes) || teamCodes.length === 0) {
    return new Map();
  }

  // Deduplicate team codes
  const uniqueCodes = [...new Set(teamCodes.filter(Boolean))];

  // Resolve all teams in parallel with per-call deduplication
  const results = await Promise.all(
    uniqueCodes.map(async (teamCode) => {
      try {
        const entitlements = await resolveEntitlementsForTeam(
          worldId,
          teamCode
        );
        return { teamCode, entitlements };
      } catch (error) {
        // Log but don't fail entire validation if one team fails
        console.warn(
          `[resolveEntitlementsForValidation] Failed for ${teamCode}:`,
          error
        );
        return { teamCode, entitlements: [] };
      }
    })
  );

  // Build map from results
  const entitlementMap = new Map();
  for (const { teamCode, entitlements } of results) {
    entitlementMap.set(teamCode, entitlements);
  }

  return entitlementMap;
}

/**
 * Creates a cached resolver function for use within a single validation run.
 * Useful when entitlements may be requested multiple times during validation.
 *
 * @param {string|null} worldId - The world ID
 * @returns {Function} Async function that resolves entitlements with caching
 */
export function createCachedResolver(worldId) {
  const cache = new Map();

  return async function resolveWithCache(teamCode) {
    if (!teamCode) return [];

    if (cache.has(teamCode)) {
      return cache.get(teamCode);
    }

    try {
      const entitlements = await resolveEntitlementsForTeam(worldId, teamCode);
      cache.set(teamCode, entitlements);
      return entitlements;
    } catch (error) {
      console.warn(`[createCachedResolver] Failed for ${teamCode}:`, error);
      cache.set(teamCode, []);
      return [];
    }
  };
}

/**
 * Pre-resolves entitlements for all teams in a trade payload.
 * Call this at the hook level BEFORE calling validateTrade().
 *
 * @param {Object} params - Parameters
 * @param {string|null} params.worldId - The world ID
 * @param {Array} params.teams - Array of team objects from trade machine
 * @returns {Promise<Map<string, Array>>} Map of teamCode → EffectiveEntitlement[]
 */
export async function preResolveTradeEntitlements({ worldId, teams }) {
  if (!Array.isArray(teams) || teams.length === 0) {
    return new Map();
  }

  // Extract team codes from various possible shapes
  const teamCodes = teams
    .map((t) => {
      // Try various paths to get team code
      return t.teamCode || t.team?.teamCode || t.team?.id || t.teamId || null;
    })
    .filter((code) => typeof code === 'string' && code.length === 3);

  return resolveEntitlementsForValidation({ worldId, teamCodes });
}
