/**
 * Comprehensive roster validation and enforcement
 * Consolidated from: rosterRules.js + enforceRosterRules.js + enforceRosterWindow.js + validateRosterWindow.js
 */

import { validationFlags } from '@/config/validationFlags.js';
import { ROSTER_LIMITS } from './validateRoster';

// Aliases for local readability — source of truth is ROSTER_LIMITS in validateRoster.ts.
const MIN_ROSTER = ROSTER_LIMITS.MIN_STANDARD;
const MAX_ROSTER = ROSTER_LIMITS.MAX_STANDARD;
const GRACE_MIN_ROSTER = ROSTER_LIMITS.GRACE_MIN_STANDARD;
const MAX_TWO_WAY = ROSTER_LIMITS.MAX_TWO_WAY;

type RosterValidationFlag = 'rosterEnforcement' | 'twoWayRoster';

interface RosterValidationPlayerLike {
  contractType?: string | null;
  isTwoWay?: boolean | null;
  [key: string]: unknown;
}

interface RosterValidationPostTradeTeamLike {
  players?: RosterValidationPlayerLike[] | null;
  twoWayPlayers?: RosterValidationPlayerLike[] | null;
  [key: string]: unknown;
}

interface RosterValidationTeamDataLike {
  standardRoster?: RosterValidationPlayerLike[] | null;
  twoWayRoster?: RosterValidationPlayerLike[] | null;
  twoWayPlayers?: RosterValidationPlayerLike[] | null;
  [key: string]: unknown;
}

interface RosterValidationTeamLike {
  postTradeTeam?: RosterValidationPostTradeTeamLike | null;
  projectedRosterCount?: number | null;
  incomingPlayers?: RosterValidationPlayerLike[] | null;
  outgoingPlayers?: RosterValidationPlayerLike[] | null;
  receives?: RosterValidationPlayerLike[] | null;
  sends?: RosterValidationPlayerLike[] | null;
  standardContracts?: number | null;
  twoWayContracts?: number | null;
  team?: RosterValidationTeamDataLike | null;
  [key: string]: unknown;
}

interface RosterValidationContext {
  graceMode?: boolean;
  gracePeriod?: boolean;
  enforcement?: string;
  [key: string]: unknown;
}

interface RosterValidationCallbacks {
  warn?: (message: string) => void;
  reject?: (message: string) => void;
}

interface RosterValidationResult {
  passed: boolean;
  violations: string[];
  message: string;
  details: string;
  rosterCounts: {
    standard: number;
    twoWay: number;
  };
}

/**
 * Core roster validation logic
 * Validates both standard and two-way roster constraints
 */
export function validateRosterWindow(
  team: RosterValidationTeamLike,
  ctx: RosterValidationContext = {}
): RosterValidationResult {
  const violations: string[] = [];
  const { graceMode, gracePeriod } = ctx;
  const isGracePeriod = graceMode || gracePeriod;

  // Calculate post-trade roster sizes using multiple fallback methods
  let standardRosterSize: number;
  let twoWayRosterSize: number;

  // Method 1: Use postTradeTeam data if available (test format)
  if (team.postTradeTeam) {
    standardRosterSize = (team.postTradeTeam.players || []).length;
    twoWayRosterSize = (team.postTradeTeam.twoWayPlayers || []).length;
  }
  // Method 2: Use projectedRosterCount if available
  else if (team.projectedRosterCount !== undefined) {
    standardRosterSize = team.projectedRosterCount || 0;
    twoWayRosterSize =
      (team.incomingPlayers || []).filter(
        (p) => p.contractType === 'two-way'
      ).length -
      (team.sends || []).filter((p) => p.contractType === 'two-way').length +
      ((team.team?.twoWayPlayers || []).length || 0);
  }
  // Method 3: Calculate from current roster + trades
  else {
    const incomingPlayers = team.incomingPlayers || [];
    const outgoingPlayers = team.outgoingPlayers || [];
    const receives = team.receives || [];
    const sends = team.sends || [];

    // Use either incoming/outgoing or receives/sends format
    const incomingStandard =
      incomingPlayers.filter((p) => !p.isTwoWay).length ||
      receives.filter((p) => !p.isTwoWay).length;
    const outgoingStandard =
      outgoingPlayers.filter((p) => !p.isTwoWay).length ||
      sends.filter((p) => !p.isTwoWay).length;
    const incomingTwoWay =
      incomingPlayers.filter((p) => p.isTwoWay).length ||
      receives.filter((p) => p.isTwoWay).length;
    const outgoingTwoWay =
      outgoingPlayers.filter((p) => p.isTwoWay).length ||
      sends.filter((p) => p.isTwoWay).length;

    standardRosterSize =
      (team.standardContracts || team.team?.standardRoster?.length || 0) +
      incomingStandard -
      outgoingStandard;
    twoWayRosterSize =
      (team.twoWayContracts || team.team?.twoWayRoster?.length || 0) +
      incomingTwoWay -
      outgoingTwoWay;
  }

  // Validate standard roster size
  const minRoster = isGracePeriod ? GRACE_MIN_ROSTER : MIN_ROSTER;
  if (standardRosterSize < minRoster) {
    violations.push(
      `Post-trade roster size (${standardRosterSize}) below minimum ${minRoster} players${isGracePeriod ? ' (grace period)' : ''}`
    );
  }

  if (standardRosterSize > MAX_ROSTER) {
    violations.push(
      `Post-trade roster size (${standardRosterSize}) exceeds maximum ${MAX_ROSTER} players`
    );
  }

  // Validate two-way roster size
  if (twoWayRosterSize > MAX_TWO_WAY) {
    violations.push(`Two-way slots exceeded (${twoWayRosterSize}/${MAX_TWO_WAY})`);
  }

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length === 0
        ? 'Roster size validated'
        : 'Roster size requirements not met',
    details: violations.join('; '),
    rosterCounts: {
      standard: standardRosterSize,
      twoWay: twoWayRosterSize,
    },
  };
}

/**
 * Enforces roster window constraints with configurable enforcement levels
 * (Consolidated from rosterRules.js)
 */
export function enforceRosterWindow(
  team: RosterValidationTeamLike,
  tradeCtx: RosterValidationContext = {},
  callbacks: RosterValidationCallbacks = {}
): string[] {
  const { warn = () => {}, reject = () => {} } = callbacks;

  // Get validation result
  const result = validateRosterWindow(team, tradeCtx);
  const violations = result.violations;

  // Handle enforcement based on validation flags
  violations.forEach((violation) => {
    const isTwoWayViolation = violation.includes('Two-way slots exceeded');
    const enforcementFlag: RosterValidationFlag = isTwoWayViolation
      ? 'twoWayRoster'
      : 'rosterEnforcement';
    const enforcement = validationFlags[enforcementFlag] || 'warn';

    if (enforcement === 'error') {
      reject(violation);
    } else {
      warn(violation);
    }
  });

  return violations;
}

/**
 * Enhanced roster rules enforcement with multiple enforcement levels
 * (Consolidated from enforceRosterRules.js)
 */
export function enforceRosterRules(
  team: RosterValidationTeamLike,
  ctx: RosterValidationContext = {},
  notifier: RosterValidationCallbacks = {}
): string[] {
  const { warn = () => {}, reject = () => {} } = notifier;
  const { enforcement } = ctx;

  // Use enforcement from context or fall back to validation flags
  const rosterMode = enforcement || validationFlags.rosterEnforcement || 'warn';
  const twoWayMode = enforcement || validationFlags.twoWayRoster || 'warn';

  const projected = team.projectedRosterCount || 0;
  const twoWaySlots = (team.incomingPlayers || []).filter(
    (p) => p.contractType === 'two-way'
  ).length;

  // Standard roster validation
  if (projected < MIN_ROSTER) {
    const msg = `Roster count (${projected}) below minimum ${MIN_ROSTER}`;
    if (rosterMode === 'error') {
      reject(msg);
    } else {
      warn(msg);
    }
  }

  if (projected > MAX_ROSTER) {
    const msg = `Roster count (${projected}) exceeds maximum ${MAX_ROSTER}`;
    if (rosterMode === 'error') {
      reject(msg);
    } else {
      warn(msg);
    }
  }

  // Two-way roster validation
  if (twoWaySlots > MAX_TWO_WAY) {
    const msg = `Two-way slots exceeded (${twoWaySlots}/${MAX_TWO_WAY})`;
    if (twoWayMode === 'error') {
      reject(msg);
    } else {
      warn(msg);
    }
  }

  return [];
}

/**
 * Enhanced roster window enforcement with detailed context
 * (Consolidated from enforceRosterWindow.js)
 */
export function enforceRosterWindowAdvanced(
  team: RosterValidationTeamLike,
  context: RosterValidationContext = {},
  { warn = () => {}, reject = () => {} }: RosterValidationCallbacks = {}
): string[] {
  const { enforcement, gracePeriod = false, graceMode = false } = context;

  const violations: string[] = [];

  // Calculate post-trade roster sizes
  const incomingPlayers = team.incomingPlayers || [];
  const outgoingPlayers = team.outgoingPlayers || [];

  // Try to get roster size from multiple sources
  let standardRosterSize: number;
  let twoWayRosterSize: number;

  // Method 1: Use postTradeTeam data if available (test format)
  if (team.postTradeTeam) {
    standardRosterSize = (team.postTradeTeam.players || []).length;
    twoWayRosterSize = (team.postTradeTeam.twoWayPlayers || []).length;
  }
  // Method 2: Calculate from current + incoming - outgoing
  else {
    standardRosterSize =
      (team.standardContracts || 0) +
      incomingPlayers.filter((p) => !p.isTwoWay).length -
      outgoingPlayers.filter((p) => !p.isTwoWay).length;

    twoWayRosterSize =
      (team.twoWayContracts || 0) +
      incomingPlayers.filter((p) => p.isTwoWay).length -
      outgoingPlayers.filter((p) => p.isTwoWay).length;
  }

  // Check standard roster size (14-15 players)
  const isGracePeriod = gracePeriod || graceMode;
  if (
    !isGracePeriod &&
    (standardRosterSize < MIN_ROSTER || standardRosterSize > MAX_ROSTER)
  ) {
    violations.push(
      `Post-trade roster size (${standardRosterSize}) must be between ${MIN_ROSTER}-${MAX_ROSTER} players`
    );
  }

  // Check roster minimum during grace period (13 players)
  if (isGracePeriod && standardRosterSize < GRACE_MIN_ROSTER) {
    violations.push(
      `Roster cannot go below ${GRACE_MIN_ROSTER} players during grace period`
    );
  }

  // Check two-way roster limit (max 3 two-way players)
  if (twoWayRosterSize > MAX_TWO_WAY) {
    violations.push(`Two-way slots exceeded (${twoWayRosterSize}/${MAX_TWO_WAY})`);
  }

  violations.forEach((violation) => {
    // Use different enforcement for two-way violations vs standard roster violations
    const isTwoWayViolation = violation.includes('Two-way slots exceeded');
    const enforcementFlag: RosterValidationFlag = isTwoWayViolation
      ? 'twoWayRoster'
      : 'rosterEnforcement';
    const effectiveEnf = enforcement || validationFlags[enforcementFlag];

    if (effectiveEnf === 'warn') {
      warn(violation);
    } else {
      reject(violation);
    }
  });

  return violations;
}

// Legacy exports for backward compatibility
export { enforceRosterWindow as enforceRosterWindowLegacy };
export { validateRosterWindow as validateRosterWindowLegacy };
