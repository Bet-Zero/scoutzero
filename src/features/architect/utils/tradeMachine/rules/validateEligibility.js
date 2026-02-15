/**
 * Player eligibility validation functions
 * Handles re-acquisition restrictions after trades and waivers
 * GAP-MISS-005: Added two-way contract trade block per CBA rules
 */

import { validationFlags } from '@/config/validationFlags.js';

/**
 * Checks if a player has a two-way contract (cannot be traded per CBA)
 * GAP-MISS-005: Two-way players must be waived, not traded
 * @param {Object} player - Player object to check
 * @returns {boolean} True if player is on a two-way contract
 */
function isTwoWayPlayer(player) {
  if (!player) return false;

  // Check various possible field names for two-way status
  if (player.isTwoWay === true) return true;
  if (player.contractType?.toLowerCase() === 'two-way') return true;
  if (player.contract?.contractType?.toLowerCase() === 'two-way') return true;
  if (player.contract?.isTwoWay === true) return true;

  return false;
}

/**
 * Validates player eligibility based on re-acquisition restrictions
 *
 * @param {Object} team - The team context object with trade details
 * @param {Object} tradeCtx - Additional trade context including date
 * @returns {Object} Validation result with standard properties
 */
export function validateEligibility(team, tradeCtx = {}) {
  // Check cache first - include callback presence in cache key to avoid pollution
  // const hasCallback = typeof tradeCtx.wasTradedAwayWithinOneYear === 'function';
  // const cacheKey = `${team.teamId}-${tradeCtx.tradeDate || ''}-${hasCallback ? 'with-callback' : 'no-callback'}`;

  const violations = [];
  const { asOfDate = new Date().toISOString(), teams = [] } = tradeCtx;
  const tradeDate = new Date(asOfDate);

  // GAP-MISS-005: Check outgoing players for two-way contracts
  // CBA Rule: Two-way players cannot be traded, they must be waived first
  const outgoingPlayers = team.sends || team.outgoingPlayers || [];
  outgoingPlayers.forEach((player) => {
    if (isTwoWayPlayer(player)) {
      violations.push(
        `Two-way contract: ${player.name || 'Player'} cannot be traded. Two-way players must be waived, not traded.`
      );
    }
  });

  // Determine incoming players for this team
  let incomingPlayers = team.incomingPlayers || [];

  // If no explicit incoming players, derive from trade structure
  if (incomingPlayers.length === 0 && teams.length >= 2) {
    incomingPlayers = [];
    teams.forEach((otherTeam) => {
      if (otherTeam.teamId !== team.teamId) {
        // Players being sent by other teams are incoming to this team
        (otherTeam.sends || []).forEach((player) => {
          incomingPlayers.push(player);
        });
      }
    });
  }

  // Check each incoming player for reacquisition restrictions
  incomingPlayers.forEach((player) => {
    // Method 1: Use callback function if provided (for test cases)
    if (typeof tradeCtx.wasTradedAwayWithinOneYear === 'function') {
      const isViolation = tradeCtx.wasTradedAwayWithinOneYear(
        player.id || player.name,
        team.teamId
      );

      if (isViolation) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire ${player.name || 'player'} within one year of trade`
        );
        return; // Skip property-based checks if callback handled it
      }
    }

    // Method 2: Check player properties (fallback for real data)
    const lastTradedFrom = player.lastTradedFromTeamId || player.lastTradedFrom;

    if (lastTradedFrom === team.teamId) {
      // Handle different date formats and ensure valid date parsing
      let lastTradeDate;
      if (player.lastTradedDate || player.lastTradeDate) {
        const dateStr = player.lastTradedDate || player.lastTradeDate;
        lastTradeDate = new Date(dateStr);
        // If still invalid, try parsing as timestamp
        if (isNaN(lastTradeDate.getTime())) {
          lastTradeDate = new Date(parseInt(dateStr));
        }
      } else {
        lastTradeDate = new Date(); // Default to now if no date available
      }

      const daysSinceDeparture =
        (tradeDate - lastTradeDate) / (1000 * 60 * 60 * 24);

      if (daysSinceDeparture < 365) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire ${player.name || 'player'} within one year of trade (${Math.ceil(
            365 - daysSinceDeparture
          )} days remaining)`
        );
      }
    }

    // Check waived player reacquisition rule - handle multiple property name formats
    const waivedBy = player.wasWaivedByTeamId || player.waivedBy;

    if (waivedBy === team.teamId) {
      // Handle different date formats for contract end date
      let contractEndDate;
      if (player.contractEndDate) {
        contractEndDate = new Date(player.contractEndDate);
        if (isNaN(contractEndDate.getTime())) {
          contractEndDate = new Date(); // Default to now if invalid
        }
      } else {
        contractEndDate = new Date(); // Default to now if no date available
      }

      const contractEndYear = contractEndDate.getFullYear() + 1; // Next July 1st after contract ends
      const julyFirst = new Date(contractEndYear, 6, 1); // Month is 0-based

      if (tradeDate < julyFirst) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire waived ${player.name || 'player'} until July 1, ${contractEndYear}`
        );
      }
    }
  });

  const result = {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Player eligibility restrictions in effect'
      : 'Player eligibility validated',
    details: violations.join('; '),
  };

  // Cache the result

  return result;
}

/**
 * Enforces player eligibility rules based on validation flags
 *
 * @param {Object} team - The team context object
 * @param {Object} tradeCtx - Additional trade context
 * @param {Object} callbacks - Warning and rejection callbacks
 * @returns {Array} Array of violation messages
 */
export function enforceEligibility(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  const enforcement =
    validationFlags.reAcquisition || validationFlags.eligibility;

  // Get violations from validator
  const result = validateEligibility(team, tradeCtx);
  violations.push(...result.violations);

  // Handle enforcement based on validation flag
  violations.forEach((msg) => {
    if (enforcement === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}
