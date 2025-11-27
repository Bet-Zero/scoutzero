/**
 * Miscellaneous validation rules
 * Consolidated from: validateAllNewRules.js, playerConsent.js, enforceTradeKicker.js, validateBYC.js
 */

import { validateTradeExceptions } from './validateTradeExceptions.js';
import { validateDraftPicks } from './validateDraftPicks.js';
import { validateCash } from './eligibilityRules.js';
import { validateSignAndTrade } from './validateSignAndTrade.js';
import { validateSecondApronRules } from './validateSecondApronRules.js';
import { BYC_PERCENT } from '@/features/architect/utils/cbaConstants.js';
import { getCapHitForSeason, yearToSeason, seasonToYear } from '../utils/seasonUtils.js';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers.js';

/**
 * Validates Base Year Compensation (BYC) rules
 * Auto-detects BYC eligibility by comparing current vs previous season salary
 * (Consolidated from validateBYC.js)
 */
export function validateBYC(team, context = {}) {
  const violations = [];
  const { currentYear = 2025, yearKey = currentYear, normalizedYear } = context;
  
  // Use pre-normalized year from context if available, otherwise normalize here
  let currentSeason, currentEndYear, prevEndYear;
  
  if (normalizedYear) {
    currentSeason = normalizedYear.seasonString;
    currentEndYear = normalizedYear.endYear;
    prevEndYear = currentEndYear - 1;
  } else {
    // Fallback: do conversion locally if normalizedYear not provided
    currentSeason = typeof yearKey === 'string' && yearKey.includes('-')
      ? yearKey
      : yearToSeason(yearKey);
    currentEndYear = typeof yearKey === 'number' ? yearKey : seasonToYear(currentSeason) + 1;
    prevEndYear = currentEndYear - 1;
  }
  
  // Previous season string
  const previousSeason = yearToSeason(prevEndYear);

  // Check all outgoing players for BYC issues
  const outgoingPlayers = team.sends || [];

  outgoingPlayers.forEach((player) => {
    // Get current season salary (prefer capHit for cap calculations)
    let currentSalary = 0;
    if (currentSeason) {
      currentSalary = getCapHitForSeason(player, currentSeason);
    }
    
    // Fallback to old extraction methods
    if (currentSalary === 0) {
      currentSalary = getSalaryForYear(player, yearKey);
    }
    
    // Get previous season salary
    let previousSalary = 0;
    if (previousSeason) {
      previousSalary = getCapHitForSeason(player, previousSeason);
    }
    
    // Fallback to old extraction methods
    // getSalaryForYear expects numeric end-year input (e.g., 2024 for "2023-24")
    // For season strings: seasonToYear("2024-25") returns 2024 (start year of current season)
    //   which equals the end year of previous season "2023-24", so getSalaryForYear(2024) correctly looks up "2023-24"
    // For numeric years: yearKey - 1 is already the end year of the previous season
    if (previousSalary === 0) {
      const prevYear = typeof yearKey === 'number' ? yearKey - 1 : seasonToYear(yearKey);
      previousSalary = getSalaryForYear(player, prevYear);
    }

    // BYC applies if current salary > 120% of previous salary
    const isBYC = previousSalary > 0 && currentSalary > previousSalary * 1.2;

    if (isBYC) {
      // For BYC players, outgoing value is max(previous salary, 50% of new salary)
      const bycValue = Math.max(previousSalary, Math.floor(currentSalary * BYC_PERCENT));

      // Set the BYC matching values
      player.matchOutgoing = bycValue;
      player.isBYC = true;
      player.previousSalary = previousSalary; // Store for use in matching calculations

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