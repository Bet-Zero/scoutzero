/**
 * FILE: src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js
 * PURPOSE: Validate player routing correctness for trades - uniqueness, routing, destinations.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase A5-E1)
 *
 * HISTORY:
 *   - 2026-02-14: Created for A5-F3/A5-F1 - Player Routing Closure + Duplicate Prevention
 *
 * LINKS:
 *   - Audit: docs/architect/audits/TM_AUDIT_WORKBOOK.md (Sections 2 & 9)
 *   - Related: validateEntitlementRouting.js (same pattern for entitlements)
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

function resolveTeamId(slot, index) {
  return (
    normalizeTeamCode(slot?.team?.id) ||
    normalizeTeamCode(slot?.team?.teamId) ||
    normalizeTeamCode(slot?.team?.teamCode) ||
    normalizeTeamCode(slot?.teamId) ||
    normalizeTeamCode(slot?.teamCode) ||
    `team-${index}`
  );
}

function resolvePlayerDestination(player) {
  return normalizeTeamCode(player?.tradeTo || player?.toTeamId || player?.destTeamId);
}

/**
 * Get a unique identifier for a player.
 * Uses playerId if available, or falls back to name + fromTeamId combination.
 *
 * @param {object} player - Player object
 * @param {string} fromTeamId - Team the player is being sent from
 * @returns {string} - Unique player identifier
 */
function getPlayerKey(player, fromTeamId) {
  // Prefer playerId for uniqueness
  if (player.playerId) return player.playerId;
  if (player.id) return player.id;

  // Fallback to name + team (less reliable but covers legacy cases)
  const name = player.name || player.displayName || 'unknown';
  return `${name}__${fromTeamId}`;
}

/**
 * Validate player routing for a trade.
 *
 * Checks:
 * 1. UNIQUENESS: Same player cannot appear in multiple teams' sends
 * 2. NO_DUPLICATE_WITHIN_TEAM: Same player cannot appear twice in same team's sends
 * 3. ROUTING: In 3+ team trades, every sent player must have a valid tradeTo
 * 4. DESTINATION: tradeTo must reference a team that is part of the trade
 * 5. NO_SELF_ROUTE: tradeTo cannot be the same as the team sending the player
 *
 * @param {object} params - Validation parameters
 * @param {Array} params.teams - Array of trade team slots with team, sends, etc.
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validatePlayerRouting({ teams }) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(teams) || teams.length === 0) {
    return { valid: true, errors, warnings };
  }

  // Count active teams (teams with a selected team object)
  const activeTeams = teams
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.team)
    .map(({ slot, index }) => ({
      slot,
      index,
      teamId: resolveTeamId(slot, index),
    }));
  const activeTeamCount = activeTeams.length;

  if (activeTeamCount < 2) {
    return { valid: true, errors, warnings };
  }

  // Build set of valid team IDs in this trade
  const tradeTeamIds = new Set();
  for (const activeTeam of activeTeams) {
    tradeTeamIds.add(activeTeam.teamId);
  }

  // Track all sent players across all teams to detect duplicates
  const seenPlayerKeys = new Map(); // playerKey → fromTeamId

  for (const [index, slot] of teams.entries()) {
    if (!slot.team) continue;

    const fromTeamId = resolveTeamId(slot, index);
    const sends = slot.sends || [];

    // Track players within this team to detect same-team duplicates
    const playersInThisTeam = new Set();

    for (const player of sends) {
      const playerKey = getPlayerKey(player, fromTeamId);
      const playerName = player.name || player.displayName || 'Unknown Player';

      // CHECK 1: Uniqueness across teams - same player cannot be in multiple teams' sends
      if (seenPlayerKeys.has(playerKey)) {
        const otherTeam = seenPlayerKeys.get(playerKey);
        errors.push(
          `Player "${playerName}" is selected by both ${otherTeam} and ${fromTeamId} — same player cannot be traded by multiple teams`
        );
      } else {
        seenPlayerKeys.set(playerKey, fromTeamId);
      }

      // CHECK 2: No duplicate within same team's sends
      if (playersInThisTeam.has(playerKey)) {
        errors.push(
          `Player "${playerName}" appears multiple times in ${fromTeamId}'s sends`
        );
      } else {
        playersInThisTeam.add(playerKey);
      }

      // CHECK 3: Routing - in 3+ team trades, tradeTo is required
      const tradeTo = resolvePlayerDestination(player);
      if (activeTeamCount > 2 && !tradeTo) {
        errors.push(
          `Player "${playerName}" from ${fromTeamId} has no destination (tradeTo required in ${activeTeamCount}-team trade)`
        );
      }

      // CHECK 4: Destination validity - tradeTo must be in the trade
      if (tradeTo && !tradeTeamIds.has(tradeTo)) {
        errors.push(
          `Player "${playerName}" from ${fromTeamId} has invalid destination "${tradeTo}" — not a team in this trade`
        );
      }

      // CHECK 5: Cannot route to self
      if (tradeTo && tradeTo === fromTeamId) {
        errors.push(
          `Player "${playerName}" from ${fromTeamId} cannot be routed to the same team`
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
 * Check for player routing issues that would block trade validation.
 * Designed to integrate into the trade validator pipeline.
 *
 * @param {object} ctx - Validation context with teams array
 * @returns {object} - { pass: boolean, errors: string[], warnings: string[] }
 */
export function enforcePlayerRouting(ctx) {
  const { teams } = ctx;
  const result = validatePlayerRouting({ teams });

  return {
    pass: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export default validatePlayerRouting;
