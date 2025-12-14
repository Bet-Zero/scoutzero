import { validationFlags } from '@/config/validationFlags.js';

/**
 * Validates roster requirements including:
 * - Standard roster spots (min 14, max 15)
 * - Two-way slots (max 3)
 */
export function validateRoster(team) {
  const violations = [];
  const {
    projectedRosterCount = 0,
    incomingPlayers = [],
    outgoingPlayers = [],
  } = team;

  // Calculate two-way player counts
  const currentTwoWay = team.team?.twoWayPlayers?.length || 0;
  const outgoingTwoWay = (outgoingPlayers || []).filter(
    (p) => p.isTwoWay
  ).length;
  const incomingTwoWay = (incomingPlayers || []).filter(
    (p) => p.isTwoWay
  ).length;
  const projectedTwoWay = currentTwoWay - outgoingTwoWay + incomingTwoWay;

  // Validate standard roster size (14-15 players)
  let standardViolation = null;
  if (projectedRosterCount < 14) {
    standardViolation = 'Standard roster must be 14–15';
  } else if (projectedRosterCount > 15) {
    standardViolation = 'Standard roster must be 14–15';
  }

  // Validate two-way slots (max 3)
  let twoWayViolation = null;
  if (projectedTwoWay > 3) {
    twoWayViolation = 'Two-way slots cannot exceed 3';
  }

  // Check if violations should cause failure based on enforcement mode
  const standardPass =
    !standardViolation || validationFlags.rosterEnforcement === 'warn';
  const twoWayPass =
    !twoWayViolation || validationFlags.twoWayRoster === 'warn';

  // Always add violations to array for reporting (even in warn mode)
  if (standardViolation) violations.push(standardViolation);
  if (twoWayViolation) violations.push(twoWayViolation);

  // The validation passes if both standard and two-way checks pass
  const passed = standardPass && twoWayPass;

  const result = {
    passed,
    violations,
    message: passed ? 'Roster requirements satisfied' : 'Roster violation',
    details: `Standard spots: ${projectedRosterCount}, Two-way slots: ${projectedTwoWay}`,
    rosterCounts: {
      standard: projectedRosterCount,
      twoWay: projectedTwoWay,
      projected: projectedRosterCount,
      current: team.initialRosterCount || 0,
    },
    // In warn mode, violations are present but don't fail validation
    warningsOnly:
      (standardViolation && validationFlags.rosterEnforcement === 'warn') ||
      (twoWayViolation && validationFlags.twoWayRoster === 'warn'),
  };

  return result;
}

export function enforceRosterWindow(team, context = {}, { warn, reject } = {}) {
  const violations = [];
  const warnings = [];

  // Extract roster count from various possible sources
  let projectedRosterCount = team.projectedRosterCount || 0;

  // If no projected count, calculate from postTradeTeam structure
  if (!projectedRosterCount && team.postTradeTeam?.players) {
    projectedRosterCount = team.postTradeTeam.players.length;
  }

  // Extract two-way player count from postTradeTeam structure
  let projectedTwoWayCount = 0;
  if (team.postTradeTeam?.twoWayPlayers) {
    projectedTwoWayCount = team.postTradeTeam.twoWayPlayers.length;
  }

  const enforcement = validationFlags.rosterEnforcement || 'error';
  const twoWayEnforcement = validationFlags.twoWayRoster || 'error';
  const isGraceMode = context.graceMode;

  // Check maximum roster size (typically 15)
  if (projectedRosterCount > 15) {
    violations.push(
      `Post-trade roster size (${projectedRosterCount}) exceeds maximum of 15 players`
    );
  }

  // Check minimum roster size (typically 14)
  if (projectedRosterCount < 14) {
    violations.push(
      `Post-trade roster size (${projectedRosterCount}) below minimum of 14 players`
    );
  }

  // Check two-way slots (max 3)
  if (projectedTwoWayCount > 3) {
    const twoWayViolation = `Two-way slots exceeded (${projectedTwoWayCount}/3)`;
    violations.push(twoWayViolation);
  }

  // Handle enforcement mode and grace mode
  if (!isGraceMode) {
    violations.forEach((violation) => {
      // Check if this is a two-way violation
      const isTwoWayViolation = violation.includes('Two-way slots exceeded');
      const currentEnforcement = isTwoWayViolation
        ? twoWayEnforcement
        : enforcement;

      if (currentEnforcement === 'warn' && typeof warn === 'function') {
        warn(violation);
      } else if (
        currentEnforcement === 'error' &&
        typeof reject === 'function'
      ) {
        reject(violation);
      }
    });
  }

  // Handle soft enforcement via callbacks
  if (typeof warn === 'function') {
    warnings.forEach((w) => warn(w));
  }

  return {
    passed: violations.length === 0 || isGraceMode,
    violations,
    warnings,
    message:
      violations.length > 0 && !isGraceMode
        ? 'Roster size requirements not met'
        : 'Roster size validated',
    details: [...violations, ...warnings].join('; '),
  };
}
