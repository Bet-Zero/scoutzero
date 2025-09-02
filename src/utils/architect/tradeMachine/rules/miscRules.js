/**
 * Miscellaneous validation rules
 * Consolidated from: validateAllNewRules.js, playerConsent.js, enforceTradeKicker.js, validateBYC.js
 */

import { validateTradeExceptions } from './validateTradeExceptions.js';
import { validateDraftPicks } from './validateDraftPicks.js';
import { validateCash } from './eligibilityRules.js';
import { validateSignAndTrade } from './validateSignAndTrade.js';
import { validateSecondApronRules } from './validateSecondApronRules.js';
import { BYC_PERCENT } from '@/utils/architect/cbaConstants.js';

/**
 * Validates Base Year Compensation (BYC) rules
 * (Consolidated from validateBYC.js)
 */
export function validateBYC(team, context = {}) {
  const violations = [];
  const { currentYear = 2025 } = context;

  // Check all outgoing players for BYC issues
  const outgoingPlayers = team.sends || [];

  outgoingPlayers.forEach((player) => {
    const currentSalary =
      player.contract_clean?.salaries_by_year?.[currentYear]?.salary || 0;
    const previousSalary =
      player.contract_clean?.salaries_by_year?.[currentYear - 1]?.salary || 0;

    // BYC applies if current salary > 120% of previous salary
    const isBYC = previousSalary > 0 && currentSalary > previousSalary * 1.2;

    if (isBYC) {
      // For BYC players, outgoing value is average of current and previous year
      const bycValue = (currentSalary + previousSalary) / 2;

      // Set the BYC matching values
      player.matchOutgoing = bycValue;
      player.isBYC = true;

      // No violations - BYC is just a calculation adjustment
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    warningsOnly: false,
  };
}

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