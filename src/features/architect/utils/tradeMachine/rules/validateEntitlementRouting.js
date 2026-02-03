/**
 * FILE: src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js
 * PURPOSE: Validate entitlement routing correctness for trades - uniqueness, routing, ownership.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 17)
 *
 * HISTORY:
 *   - 2026-02-03: Created for Phase 17 - Entitlement Routing Closure
 *
 * LINKS:
 *   - Audit: docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md
 *   - Plan: docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md#7-verdict
 */

/**
 * Normalize team identifier to a consistent format for comparison.
 * Handles teamCode (3 letters), full team ID, or team object.
 *
 * @param {string|object} teamIdLike - Team identifier or object
 * @returns {string|null} - Normalized team code or null
 */
function normalizeTeamCode(teamIdLike) {
  if (!teamIdLike) return null;

  // If it's a string of 3 chars, assume it's already a team code
  if (typeof teamIdLike === 'string') {
    if (teamIdLike.length === 3) return teamIdLike.toUpperCase();
    return teamIdLike;
  }

  // If it's an object, try to extract teamCode or id
  if (typeof teamIdLike === 'object') {
    return (
      teamIdLike.teamCode ||
      teamIdLike.id ||
      teamIdLike.code ||
      teamIdLike.abbreviation ||
      null
    );
  }

  return null;
}

/**
 * Validate entitlement routing for a trade.
 *
 * Checks:
 * 1. UNIQUENESS: Same entitlementId cannot appear in multiple teams' outgoing lists
 * 2. ROUTING: In 3+ team trades, every outgoing entitlement must have a valid toTeamId
 * 3. DESTINATION: toTeamId must reference a team that is part of the trade
 * 4. OWNERSHIP: fromTeamId team must actually own the entitlement (team.entitlementIds includes it)
 *
 * @param {object} params - Validation parameters
 * @param {Array} params.teams - Array of trade team slots with team, entitlementsOut, etc.
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateEntitlementRouting({ teams }) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(teams) || teams.length === 0) {
    return { valid: true, errors, warnings };
  }

  // Count active teams (teams with a selected team object)
  const activeTeams = teams.filter((t) => t.team);
  const activeTeamCount = activeTeams.length;

  if (activeTeamCount < 2) {
    return { valid: true, errors, warnings };
  }

  // Build set of valid team IDs in this trade
  const tradeTeamIds = new Set();
  for (const slot of activeTeams) {
    const teamId = normalizeTeamCode(slot.team?.id || slot.team?.teamCode);
    if (teamId) tradeTeamIds.add(teamId);
  }

  // Track all outgoing entitlement IDs to detect duplicates
  const seenEntitlementIds = new Map(); // entitlementId → fromTeamId

  for (const slot of teams) {
    if (!slot.team) continue;

    const fromTeamId = normalizeTeamCode(slot.team.id || slot.team.teamCode);
    const teamEntitlementIds = slot.team.entitlementIds || [];
    const entitlementsOut = slot.entitlementsOut || [];

    for (const ent of entitlementsOut) {
      const entitlementId = ent.entitlementId || ent.id;
      if (!entitlementId) {
        warnings.push(
          `Entitlement from ${fromTeamId} has no id/entitlementId field`
        );
        continue;
      }

      // CHECK 1: Uniqueness - same entitlementId cannot be in multiple outgoing lists
      if (seenEntitlementIds.has(entitlementId)) {
        const otherTeam = seenEntitlementIds.get(entitlementId);
        errors.push(
          `Entitlement "${entitlementId}" is selected by both ${otherTeam} and ${fromTeamId} — same asset cannot be traded by multiple teams`
        );
      } else {
        seenEntitlementIds.set(entitlementId, fromTeamId);
      }

      // CHECK 2: Routing - in 3+ team trades, toTeamId is required
      const toTeamId = normalizeTeamCode(ent.toTeamId);
      if (activeTeamCount > 2 && !toTeamId) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} has no destination (toTeamId required in ${activeTeamCount}-team trade)`
        );
      }

      // CHECK 3: Destination validity - toTeamId must be in the trade
      if (toTeamId && !tradeTeamIds.has(toTeamId)) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} has invalid destination "${toTeamId}" — not a team in this trade`
        );
      }

      // CHECK 4: Cannot route to self
      if (toTeamId && toTeamId === fromTeamId) {
        errors.push(
          `Entitlement "${entitlementId}" from ${fromTeamId} cannot be routed to the same team`
        );
      }

      // CHECK 5: Ownership - fromTeamId must own the entitlement
      if (!teamEntitlementIds.includes(entitlementId)) {
        errors.push(
          `Entitlement "${entitlementId}" is not owned by ${fromTeamId} — cannot trade asset you don't own`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check for entitlement routing issues that would block trade validation.
 * Designed to integrate into the trade validator pipeline.
 *
 * @param {object} ctx - Validation context with teams array
 * @returns {object} - { pass: boolean, errors: string[] }
 */
export function enforceEntitlementRouting(ctx) {
  const { teams } = ctx;
  const result = validateEntitlementRouting({ teams });

  return {
    pass: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export default validateEntitlementRouting;
