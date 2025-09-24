/**
 * Consolidated Trade Rules
 * Combines small rule files for better maintainability
 * 
 * Consolidated from:
 * - enforceEligibility.js (71 lines)
 * - tradeExceptions.js (71 lines) 
 * - draftRules.js (74 lines)
 */

import { validationFlags } from '@/config/validationFlags.js';
import { isSecondApronTeam } from '../utils/capUtils.js';
import { isMeaningfulProtection } from '../utils/tradeUtilities.js';
import { CBA_THRESHOLDS } from '../constants/cbaConstants.js';

// ========================================
// PLAYER ELIGIBILITY RULES
// ========================================

/**
 * Enforces player re-acquisition rules:
 * - Cannot reacquire a player within same season after trading them
 * - Cannot reacquire a waived player until after season + July 1
 */
export function enforceEligibility(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { incomingPlayers = [] } = team;
  const violations = [];

  // Check re-acquisition restrictions
  incomingPlayers.forEach((player) => {
    // Check for traded players (support multiple property names)
    const lastTradedFromTeam = player.lastTradedFrom || player.lastTradedFromTeamId;
    if (lastTradedFromTeam === team.teamId) {
      const lastTradeDate = player.lastTradeDate
        ? new Date(player.lastTradeDate)
        : null;
      const tradeDate = tradeCtx.asOfDate
        ? new Date(tradeCtx.asOfDate)
        : new Date();

      // One year from trade date
      if (
        lastTradeDate &&
        tradeDate.getTime() - lastTradeDate.getTime() < 365 * 24 * 60 * 60 * 1000
      ) {
        const violation = `Cannot reacquire ${player.name} - traded away less than 1 year ago (${lastTradeDate.toLocaleDateString()})`;
        violations.push(violation);
        reject(violation);
      }
    }

    // Check for waived players
    if (player.lastWaivedFromTeamId === team.teamId) {
      const lastWaivedDate = player.lastWaivedDate
        ? new Date(player.lastWaivedDate)
        : null;
      if (lastWaivedDate) {
        const nextJuly1 = new Date(lastWaivedDate.getFullYear() + 1, 6, 1);
        const tradeDate = tradeCtx.asOfDate
          ? new Date(tradeCtx.asOfDate)
          : new Date();

        if (tradeDate < nextJuly1) {
          const violation = `Cannot reacquire ${player.name} - waived less than 1 year ago (eligible after ${nextJuly1.toLocaleDateString()})`;
          violations.push(violation);
          reject(violation);
        }
      }
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations[0] : 'Player eligibility validated',
  };
}

// ========================================
// TRADE EXCEPTION RULES
// ========================================

export function validateTradeExceptions(team, tradeCtx = {}) {
  const violations = [];

  // Check for existing TPE usage
  const usesTPE = team.receives?.some((p) => p.absorptionMode === 'TPE');
  if (!usesTPE) {
    return {
      passed: true,
      violations: [],
      message: 'Trade exceptions validated',
      details: '',
    };
  }

  // Check if team is over second apron
  if (isSecondApronTeam(team.team, tradeCtx.capSettings)) {
    violations.push('Teams above the Second Apron cannot use TPEs');
    return {
      passed: false,
      violations,
      message: violations[0],
    };
  }

  // Check TPE validity and sufficiency
  team.receives.forEach((player) => {
    if (player.absorptionMode === 'TPE') {
      const tpe = team.team.tradeExceptions?.find((t) => t.id === player.tpeId);
      
      if (!tpe) {
        violations.push(`TPE ${player.tpeId} not found on team ${team.teamId}`);
        return;
      }

      if (tpe.remaining < player.salary) {
        violations.push(
          `TPE ${tpe.id} insufficient: needs ${player.salary}, has ${tpe.remaining}`
        );
      }

      // Check expiration
      const now = tradeCtx.asOfDate ? new Date(tradeCtx.asOfDate) : new Date();
      const expiration = new Date(tpe.expirationDate);
      if (now > expiration) {
        violations.push(`TPE ${tpe.id} expired on ${expiration.toLocaleDateString()}`);
      }
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations[0] : 'Trade exceptions validated',
  };
}

// ========================================
// DRAFT PICK RULES
// ========================================

/**
 * Checks if a set of outgoing picks violates the Stepien Rule
 * (No consecutive future first round picks without protection)
 */
export function hasStepienViolation(picks = []) {
  const years = picks
    .filter(
      (p) =>
        (p.round === 1 || p.round === '1st') &&
        !p.isSwap &&
        !isMeaningfulProtection(p.protection) &&
        !p.via
    )
    .map((p) => parseInt(p.year, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) return true;
  }
  return false;
}

/**
 * Validates all draft pick related rules
 */
export function validateDraftPickRules(team, tradeCtx = {}) {
  const violations = [];
  const { outgoingPicks = [] } = team;

  // Stepien Rule check
  if (hasStepienViolation(outgoingPicks)) {
    violations.push('Stepien Rule violation: Cannot trade consecutive unprotected first round picks');
  }

  // Second apron teams cannot trade picks more than 7 years out
  if (isSecondApronTeam(team.team, tradeCtx.capSettings)) {
    const currentYear = new Date().getFullYear();
    const farFuturePicks = outgoingPicks.filter(
      (p) => parseInt(p.year, 10) > currentYear + 7
    );
    
    if (farFuturePicks.length > 0) {
      violations.push('Second apron teams cannot trade picks more than 7 years in the future');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations[0] : 'Draft pick rules validated',
  };
}

/**
 * Validates pick swap rules
 */
export function validatePickSwapRules(picks = []) {
  const violations = [];
  const swaps = picks.filter(p => p.isSwap);

  swaps.forEach(swap => {
    // Swaps must be for same year
    const matchingPick = picks.find(p => 
      !p.isSwap && 
      p.year === swap.year && 
      p.round === swap.round
    );

    if (!matchingPick) {
      violations.push(`Pick swap for ${swap.year} ${swap.round} round requires corresponding pick`);
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations[0] : 'Pick swap rules validated',
  };
}