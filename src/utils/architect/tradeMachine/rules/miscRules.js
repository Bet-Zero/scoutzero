/**
 * Miscellaneous validation rules
 * Consolidated from: validateAllNewRules.js, playerConsent.js, enforceTradeKicker.js
 */

import { validateTradeExceptions } from './validateTradeExceptions.js';
import { validateDraftPicks } from './validateDraftPicks.js';
import { validateCash } from './validateCash.js';
import { validateSignAndTrade } from './validateSignAndTrade.js';
import { validateBYC } from './validateBYC.js';
import { validateSecondApronRules } from './validateSecondApronRules.js';

// All new rules validation (from validateAllNewRules.js)
export function validateAllNewRules(team, allTeams, tradeCtx = {}) {
  return [
    ...validateTradeExceptions(team),
    ...validateDraftPicks(team, allTeams),
    ...validateCash(team),
    ...validateSignAndTrade(team, tradeCtx),
    ...validateBYC(team),
    ...validateSecondApronRules(team),
  ];
}

// Player consent validation (from playerConsent.js)
export function validatePlayerConsent(team) {
  const violations = [];

  team.sends?.forEach((player) => {
    // Full NTC check
    if (player.hasNoTradeClause && !player.hasProvidedConsent) {
      violations.push('Player NTC — consent required');
    }

    // Limited NTC check
    if (player.limitedNTCTeams?.length > 0) {
      const canBeTraded = !player.limitedNTCTeams.includes(team.teamId);
      if (!canBeTraded && !player.hasProvidedConsent) {
        violations.push('Player NTC — consent required');
      }
    }

    // Bird rights veto check
    if (player.hasBirdRights && !player.hasProvidedConsent) {
      violations.push('1-yr Bird veto — consent required');
    }
  });

  return violations;
}

// Trade kicker enforcement (from enforceTradeKicker.js)
export function enforceTradeKicker(player, ctx = {}) {
  const { daysRemainingInSeason, daysInSeason } = ctx;
  const kickerPct = player.tradeKickerPct || 0;

  if (kickerPct === 0) return 0;

  const baseSalary = player.salary || 0;
  const baseKicker = baseSalary * kickerPct;
  const waivedPct = player.tradeKickerWaivedPct || 0;
  const kickerAmount = baseKicker * (1 - waivedPct);

  // Check remaining guaranteed money for kicker cap
  const remainingGuaranteed = player.remainingGuaranteedOnCurrentContract || 0;
  const maxKicker = Math.max(0, remainingGuaranteed - baseSalary);

  // Prorate based on days remaining if provided
  if (daysRemainingInSeason && daysInSeason) {
    const prorationFactor = daysRemainingInSeason / daysInSeason;
    return Math.min(kickerAmount * prorationFactor, maxKicker);
  }

  return Math.min(kickerAmount, maxKicker);
}