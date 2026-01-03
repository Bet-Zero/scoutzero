/**
 * FILE: src/features/architect/utils/tradeMachine/utils/hardCapStatus.js
 * PURPOSE: Canonical hard cap status detection for Trade Machine validation.
 *          Single source of truth for determining if a team is hard-capped.
 * OWNERSHIP: Feature: architect (Trade Machine - CBA Validation)
 *
 * HISTORY:
 *  - 2026-01-03: Created for P0 HARD_CAP_SKIP bug fix
 *
 * WHY THIS EXISTS:
 * Previously, hard cap detection was scattered across multiple code paths:
 * - team.hardCapped (from loadTeamCapSheet/hydrateBaseTeam)
 * - team.team.hardCapTriggered
 * - isHardCappedAtFirstApron() from hardCapUtils.js
 * 
 * This caused worldless mode to incorrectly flag teams as hard-capped when:
 * - hardCapped was a truthy string like "FirstApron" (not boolean true)
 * - hardCapTriggered was set but team hadn't triggered anything
 * 
 * WORLDLESS MODE RULE:
 * In worldless mode (no worldId), teams should NOT be hard-capped unless
 * explicit triggers exist in the base team data (which typically they don't).
 * Hard cap is triggered by runtime actions: S&T, NTMLE, BAE usage.
 */

/**
 * Determines if a team is hard-capped for trade validation purposes.
 * 
 * @param {Object} team - Team object from trade context
 * @param {Object} options - Optional configuration
 * @param {boolean} options.isWorldless - If true, applies stricter worldless mode rules
 * @returns {Object} Hard cap status:
 *   - isHardCapped {boolean} - Whether team is hard-capped
 *   - reason {string|null} - Human-readable reason if hard-capped
 *   - source {string} - Which field/check triggered the hard cap status
 *   - hardCapType {string|null} - 'FirstApron' or 'SecondApron' if applicable
 */
export function getHardCapStatus(team, options = {}) {
  const { isWorldless = false } = options;
  
  // Handle null/undefined team
  if (!team) {
    return {
      isHardCapped: false,
      reason: null,
      source: 'NO_TEAM_DATA',
      hardCapType: null,
    };
  }

  // Extract potential hard cap indicators
  const hardCappedField = team.hardCapped;
  const hardCapTriggeredField = team.team?.hardCapTriggered;
  const hardCapFirstApron = team.team?.hardCapFirstApron;
  const hardCapSecondApron = team.team?.hardCapSecondApron;

  // STRICT BOOLEAN CHECK for team.hardCapped
  // Only boolean true triggers hard cap, not truthy strings
  if (hardCappedField === true) {
    return {
      isHardCapped: true,
      reason: 'Team is hard-capped (explicit flag)',
      source: 'team.hardCapped === true',
      hardCapType: 'FirstApron', // Default assumption for boolean flag
    };
  }

  // STRICT BOOLEAN CHECK for team.team.hardCapTriggered
  // Only boolean true triggers hard cap
  if (hardCapTriggeredField === true) {
    return {
      isHardCapped: true,
      reason: 'Team triggered hard cap',
      source: 'team.team.hardCapTriggered === true',
      hardCapType: 'FirstApron',
    };
  }

  // Check for string enum values (e.g., "FirstApron", "SecondApron")
  // These are valid hard cap indicators from runtime actions
  if (hardCapTriggeredField === 'FirstApron') {
    return {
      isHardCapped: true,
      reason: 'Hard cap triggered at First Apron',
      source: 'team.team.hardCapTriggered === "FirstApron"',
      hardCapType: 'FirstApron',
    };
  }

  if (hardCapTriggeredField === 'SecondApron') {
    return {
      isHardCapped: true,
      reason: 'Hard cap triggered at Second Apron',
      source: 'team.team.hardCapTriggered === "SecondApron"',
      hardCapType: 'SecondApron',
    };
  }

  // Check hardCapFirstApron structure (from exception usage tracking)
  if (hardCapFirstApron?.active === true) {
    return {
      isHardCapped: true,
      reason: hardCapFirstApron.reason || 'First apron hard cap active',
      source: 'team.team.hardCapFirstApron.active === true',
      hardCapType: 'FirstApron',
    };
  }

  // Check hardCapSecondApron structure
  if (hardCapSecondApron?.active === true) {
    return {
      isHardCapped: true,
      reason: hardCapSecondApron.reason || 'Second apron hard cap active',
      source: 'team.team.hardCapSecondApron.active === true',
      hardCapType: 'SecondApron',
    };
  }

  // WORLDLESS MODE: Do not infer hard cap from other indicators
  // In worldless, if no explicit trigger exists, team is NOT hard-capped
  if (isWorldless) {
    // Log for debugging if a truthy-but-not-true value was found
    if (hardCappedField && hardCappedField !== false) {
      console.debug('[getHardCapStatus] Worldless mode: ignoring non-boolean hardCapped:', {
        value: hardCappedField,
        type: typeof hardCappedField,
      });
    }
    if (hardCapTriggeredField && hardCapTriggeredField !== false && 
        hardCapTriggeredField !== 'FirstApron' && hardCapTriggeredField !== 'SecondApron') {
      console.debug('[getHardCapStatus] Worldless mode: ignoring unexpected hardCapTriggered:', {
        value: hardCapTriggeredField,
        type: typeof hardCapTriggeredField,
      });
    }
  }

  // No hard cap detected
  return {
    isHardCapped: false,
    reason: null,
    source: 'NO_HARD_CAP_TRIGGER',
    hardCapType: null,
  };
}

/**
 * Quick check if team is hard-capped (boolean only).
 * 
 * @param {Object} team - Team object
 * @param {Object} options - Optional configuration  
 * @returns {boolean} True if team is hard-capped
 */
export function isTeamHardCapped(team, options = {}) {
  return getHardCapStatus(team, options).isHardCapped;
}

/**
 * Get hard cap status with context from trade validation.
 * Wrapper that determines worldless mode from context.
 * 
 * @param {Object} team - Team object
 * @param {Object} context - Validation context
 * @returns {Object} Hard cap status result
 */
export function getHardCapStatusFromContext(team, context = {}) {
  const isWorldless = !context.worldId;
  return getHardCapStatus(team, { isWorldless });
}

export default {
  getHardCapStatus,
  isTeamHardCapped,
  getHardCapStatusFromContext,
};
