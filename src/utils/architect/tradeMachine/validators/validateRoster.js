import { passesRosterWindow } from '@/utils/architect/rosterUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import { validationCache } from './validationCache.js';

/**
 * Validates roster requirements including:
 * - Standard roster spots (min 14, max 15)
 * - Two-way slots (max 3)
 */
export function validateRoster(team) {
  // Check cache first
  const cacheKey = `${team.teamId}-${team.projectedRosterCount || 0}-${team.team?.twoWayPlayers?.length || 0}`;
  const cached = validationCache.getCachedRosterValidation(cacheKey);
  if (cached) {
    return cached;
  }

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

  // Add violations based on enforcement mode
  const standardPass =
    !standardViolation || validationFlags.rosterEnforcement === 'warn';
  const twoWayPass =
    !twoWayViolation || validationFlags.twoWayRoster === 'warn';

  // Add violations to array for reporting (even in warn mode)
  if (standardViolation) violations.push(standardViolation);
  if (twoWayViolation) violations.push(twoWayViolation);

  const result = {
    passed: standardPass && twoWayPass,
    violations,
    message:
      standardPass && twoWayPass
        ? 'Roster requirements satisfied'
        : 'Roster violation',
    details: `Standard spots: ${projectedRosterCount}, Two-way slots: ${projectedTwoWay}`,
    rosterCounts: {
      standard: projectedRosterCount,
      twoWay: projectedTwoWay,
      projected: projectedRosterCount,
      current: team.initialRosterCount || 0,
    },
  };

  // Cache the result
  validationCache.cacheRosterValidation(cacheKey, result);

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

  const initialRosterCount = team.initialRosterCount || 0;
  const enforcement = validationFlags.rosterEnforcement || 'error';
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

  // Check two-way slots
  const twoWayPlayersIn = (team.incomingPlayers || []).filter(
    (p) => p.contractType === 'two-way'
  );
  const twoWayPlayersOut = (team.sends || []).filter(
    (p) => p.contractType === 'two-way'
  );
  const netTwoWayChange = twoWayPlayersIn.length - twoWayPlayersOut.length;

  if (team.team?.twoWaySlots + netTwoWayChange > 2) {
    violations.push('Post-trade two-way slots exceed maximum of 2');
  }

  // Handle enforcement mode and grace mode
  if (!isGraceMode) {
    violations.forEach((violation) => {
      if (enforcement === 'warn' && typeof warn === 'function') {
        warn(violation);
      } else if (enforcement === 'error' && typeof reject === 'function') {
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
