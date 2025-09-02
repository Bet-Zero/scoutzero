/**
 * Roster validation rules
 * Consolidated from: rosterWindow.js
 */

import { validationFlags } from '../validationFlags.js';

/**
 * Enforces roster window constraints
 * (Consolidated from rosterWindow.js)
 */
export function enforceRosterWindow(team, tradeCtx = {}, callbacks = {}) {
  const { warn = () => {}, reject = () => {} } = callbacks;

  // Calculate post-trade roster sizes
  const standardCount =
    (team.team.standardRoster?.length || 0) +
    team.receives.filter((p) => !p.isTwoWay).length -
    team.sends.filter((p) => !p.isTwoWay).length;

  const twoWayCount =
    (team.team.twoWayRoster?.length || 0) +
    team.receives.filter((p) => p.isTwoWay).length -
    team.sends.filter((p) => p.isTwoWay).length;

  // Two-way roster slots (usually max 3)
  if (twoWayCount > 3) {
    if (validationFlags.twoWayRoster === 'error') {
      reject(`Two-way slots exceeded (${twoWayCount}/3)`);
    } else if (validationFlags.twoWayRoster === 'warn') {
      warn(`Two-way slots exceeded (${twoWayCount}/3)`);
    }
  }

  // Standard roster slots (usually 14-15)
  if (standardCount < 14) {
    if (validationFlags.rosterEnforcement === 'error') {
      reject(`Standard roster below minimum (${standardCount}/14)`);
    } else if (validationFlags.rosterEnforcement === 'warn') {
      warn(`Standard roster below minimum (${standardCount}/14)`);
    }
  }

  // Allow going to 13 during grace period
  const isGracePeriod = tradeCtx.inRosterSizeGracePeriod;
  if (standardCount < 13 && !isGracePeriod) {
    reject(`Standard roster below hard minimum (${standardCount}/13)`);
  }

  if (standardCount > 15) {
    reject(`Standard roster exceeds maximum (${standardCount}/15)`);
  }
}