import { validationFlags } from '@/config/validationFlags.js';

const MIN_ROSTER = 14;
const MAX_ROSTER = 15;
const MAX_TWO_WAY = 3;

export function enforceRosterWindow(
  team,
  context = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { enforcement, gracePeriod = false, graceMode = false } = context;
  
  // Use validationFlags.rosterEnforcement as default if enforcement not specified
  const effectiveEnforcement = enforcement || validationFlags.rosterEnforcement;
  const violations = [];

  // Calculate post-trade roster sizes
  const incomingPlayers = team.incomingPlayers || [];
  const outgoingPlayers = team.outgoingPlayers || [];
  
  // Try to get roster size from multiple sources
  let standardRosterSize;
  let twoWayRosterSize;
  
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
  if (!isGracePeriod && (standardRosterSize < 14 || standardRosterSize > 15)) {
    violations.push(
      `Post-trade roster size (${standardRosterSize}) must be between 14-15 players`
    );
  }

  // Check roster minimum during grace period (13 players)
  if (isGracePeriod && standardRosterSize < 13) {
    violations.push(`Roster cannot go below 13 players during grace period`);
  }

  // Check two-way roster limit (max 3 two-way players)
  if (twoWayRosterSize > 3) {
    violations.push(
      `Two-way slots exceeded (${twoWayRosterSize}/3)`
    );
  }

  violations.forEach((violation) => {
    // Use different enforcement for two-way violations vs standard roster violations
    const isTwoWayViolation = violation.includes('Two-way slots exceeded');
    const enforcementFlag = isTwoWayViolation ? 'twoWayRoster' : 'rosterEnforcement';
    const effectiveEnf = enforcement || validationFlags[enforcementFlag];
    
    if (effectiveEnf === 'warn') {
      warn(violation);
    } else {
      reject(violation);
    }
  });

  return violations;
}
