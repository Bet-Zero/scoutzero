// Handles Base Year Compensation (BYC), trade kicker, and poison pill calculations
// GAP-DATA-001: Now validates BYC player data requirements and surfaces warnings
// GAP-DATA-002: Tracks salary field fallback usage for data quality monitoring
import { getSalaryForYear } from '../../tradeHelpers.js';
import { BYC_PERCENT } from '../constants/cbaConstants.js';
import { getCapHitForSeason, normalizeYearInput } from './seasonUtils.js';
import {
  validateBYCPlayerData,
  validateSalaryFieldData,
  DATA_WARNING_CODES,
} from './dataValidation.js';
import { getSignAndTradeSalaryForYear } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';

/**
 * @deprecated LEGACY HELPER - DO NOT USE IN VALIDATION PATHS
 *
 * This function has an incorrect poison-pill formula that differs from the
 * canonical implementation in `computeMatchingValues()`.
 *
 * Legacy bug (lines 49-55):
 *   extensionAvg = sum(extensionYears) / extensionYears.length
 *   result = (salary + extensionAvg) / 2
 *
 * Canonical formula (correct):
 *   result = (currentSalary + sum(extensionYears)) / (1 + extensionYears.length)
 *
 * Example: $10M current + [$20M, $22M, $24M] extension
 *   - Legacy: ($10M + $22M) / 2 = $16M  ❌
 *   - Canonical: $76M / 4 = $19M  ✅
 *
 * This function is ONLY used as a salary fallback in normalizeTradeInput.js
 * when player.salary is missing. The actual validation uses computeMatchingValues().
 *
 * @see computeMatchingValues - The canonical implementation for validation
 */
export function getMatchingValue(player, yearKey, isOutgoing = false) {
  const salary = getSalaryForYear(player, yearKey);

  // For outgoing BYC players, use max(prior, 50% new salary)
  if (isOutgoing && (player.isBYC || player.baseYearCompensation)) {
    const prevSalary = player.previousSalary || 0;
    const newSalary = player.newSalary || salary;
    return Math.max(prevSalary, Math.floor(newSalary * BYC_PERCENT));
  }

  // For trade kicker, only apply to incoming value
  if (!isOutgoing && player.tradeKickerPct) {
    const kickerAmt = salary * player.tradeKickerPct;
    const waivedAmt = kickerAmt * (player.tradeKickerWaivedPct || 0);
    const effectiveKicker = kickerAmt - waivedAmt;

    // Pro-rate by days remaining if specified
    const proRatedKicker =
      player.daysRemainingInSeason && player.daysInSeason
        ? effectiveKicker * (player.daysRemainingInSeason / player.daysInSeason)
        : effectiveKicker;

    // Cap kicker at remaining guaranteed money
    const remaining = player.remainingGuaranteedOnCurrentContract || 0;
    const maxKicker = Math.max(0, remaining - salary);

    return salary + Math.min(proRatedKicker, maxKicker);
  }

  // For poison pill players, use average of current + extension years for incoming
  // Check isRookieScale flag from new schema
  const contract = player.contract || player.primaryContract;
  const isRookieScale =
    contract?.isRookieScale || player.isRookieScale || false;
  const isPoisonPill = player.isPoisonPill || isRookieScale;

  if (!isOutgoing && isPoisonPill && Array.isArray(player.extensionYears)) {
    const extensionTotal = player.extensionYears.reduce(
      (sum, year) => sum + (year.salary || 0),
      0
    );
    const extensionAvg = extensionTotal / player.extensionYears.length;
    return (salary + extensionAvg) / 2;
  }

  return salary;
}

export function getEffectiveTradeSalaryForPlayer(player, yearKey) {
  if (player?.signAndTrade === true) {
    const signAndTradeSalary = getSignAndTradeSalaryForYear(player, yearKey, {
      allowPlayerContractFallback: true,
    });
    if (signAndTradeSalary > 0) {
      return {
        salary: signAndTradeSalary,
        source: 'signAndTradeContract.salariesByYear.capHit',
      };
    }
  }

  const normalized = normalizeYearInput(yearKey);
  if (normalized) {
    const contractSalary = getCapHitForSeason(player, normalized.seasonString);
    if (contractSalary > 0) {
      return {
        salary: contractSalary,
        source: 'contract.salariesByYear.capHit',
      };
    }
  }

  const fallbackSalary = player.newSalary || player.salary || 0;
  return {
    salary: fallbackSalary,
    source: player.newSalary ? 'player.newSalary' : 'player.salary',
  };
}

export function computeMatchingValues({
  teams = [],
  yearKey,
  daysRemainingInSeason,
  daysInSeason,
}) {
  // GAP-DATA-001, GAP-DATA-002: Collect data validation warnings
  const allDataWarnings = [];

  teams.forEach((team) => {
    const teamWarnings = [];

    (team.sends || []).forEach((player) => {
      const { salary: baseSalary, source: salarySource } =
        getEffectiveTradeSalaryForPlayer(player, yearKey);

      if (
        salarySource === 'player.newSalary' ||
        salarySource === 'player.salary'
      ) {
        // GAP-DATA-002: Track salary field fallback usage
        const salaryWarnings = validateSalaryFieldData(player, yearKey, {
          salarySource,
          salaryValue: baseSalary,
        });
        teamWarnings.push(...salaryWarnings);
      }

      // GAP-DATA-001: Validate BYC player data requirements
      const bycWarnings = validateBYCPlayerData(player);
      teamWarnings.push(...bycWarnings);

      // Start with base salary for both
      player.matchOutgoing = baseSalary;
      player.matchIncoming = baseSalary;

      // Apply BYC to outgoing value first
      if (player.isBYC || player.baseYearCompensation) {
        const prevSalary = player.previousSalary || 0;
        const newSalary = baseSalary; // Use the actual salary from contract
        // BYC: max(previous salary, 50% of new salary)
        const fiftyPercentNew = Math.floor(newSalary * BYC_PERCENT); // BYC_PERCENT = 0.5
        player.matchOutgoing = Math.max(prevSalary, fiftyPercentNew);
      }

      // Apply poison pill average (only for rookie scale extensions)
      // Check isRookieScale flag from new schema
      const contract = player.contract || player.primaryContract;
      const isRookieScale =
        contract?.isRookieScale || player.isRookieScale || false;
      const isPoisonPill = player.isPoisonPill || isRookieScale;

      if (isPoisonPill) {
        let currentSalary = player.currentSalary || baseSalary;
        let averageSalary;

        // Handle both extensionYears array and extension object formats
        if (
          Array.isArray(player.extensionYears) &&
          player.extensionYears.length > 0
        ) {
          // Calculate average of current salary + all extension years
          const extensionTotal = player.extensionYears.reduce(
            (sum, year) => sum + (year.salary || 0),
            0
          );
          const totalSalaries = currentSalary + extensionTotal;
          const totalYears = 1 + player.extensionYears.length;
          averageSalary = Math.floor(totalSalaries / totalYears);
        } else if (player.extension && player.extension.salary) {
          // Legacy single extension format
          const extensionSalary = player.extension.salary || 0;
          averageSalary = Math.floor((currentSalary + extensionSalary) / 2);
        } else {
          // No extension data, use current salary
          averageSalary = currentSalary;
        }

        // For incoming: always use average
        player.matchIncoming = averageSalary;

        // For outgoing: use current salary unless BYC overrides it
        if (!player.isBYC && !player.baseYearCompensation) {
          player.matchOutgoing = currentSalary;
        }
      }

      // Apply trade kicker to incoming value only
      if (player.tradeKicker || player.tradeKickerPct) {
        // Handle both object format and direct percentage format
        const percentage =
          player.tradeKicker?.percentage || player.tradeKickerPct || 0;
        const waivedPct =
          player.tradeKicker?.waived || player.tradeKickerWaivedPct || 0;
        const maxKicker = player.tradeKicker?.maximum ?? Infinity;

        // Calculate raw kicker based on baseSalary (NOT guaranteed amount)
        const kickerAmount = Math.floor(baseSalary * percentage);

        // Apply maximum cap from tradeKicker.maximum
        let effectiveKicker = Math.min(kickerAmount, maxKicker);

        let finalKicker = effectiveKicker;

        // Check if remainingGuaranteedOnCurrentContract is explicitly set
        // Use nullish coalescing to distinguish between explicit 0 and undefined
        const hasExplicitGuaranteed =
          player.remainingGuaranteedOnCurrentContract !== undefined;
        const remainingGuaranteed = player.remainingGuaranteedOnCurrentContract;

        // Handle explicit zero guaranteed money - no kicker should apply
        if (hasExplicitGuaranteed && remainingGuaranteed === 0) {
          finalKicker = 0;
        } else if (remainingGuaranteed && remainingGuaranteed > baseSalary) {
          // Handle guaranteed money constraints
          const maxAvailableKicker = remainingGuaranteed - baseSalary;

          // For BYC players or when no timing specified, use enhanced kicker
          if (
            !daysRemainingInSeason ||
            !daysInSeason ||
            player.isBYC ||
            player.baseYearCompensation
          ) {
            const enhancedKicker = effectiveKicker * 2; // Double for these cases
            // Note: maxKicker must be applied here because enhancedKicker could exceed it
            finalKicker = Math.min(
              maxAvailableKicker,
              enhancedKicker,
              maxKicker
            );
          } else {
            // For timing cases, don't apply proration if guaranteed amount allows full kicker
            const proratedKicker = Math.floor(
              effectiveKicker * (daysRemainingInSeason / daysInSeason)
            );
            const fullKicker = effectiveKicker;

            // Use full kicker if guaranteed money allows it, otherwise use prorated
            if (maxAvailableKicker >= fullKicker) {
              finalKicker = fullKicker;
            } else {
              finalKicker = Math.min(maxAvailableKicker, proratedKicker);
            }
          }
        } else if (daysRemainingInSeason && daysInSeason) {
          // Standard proration when no guaranteed constraint
          finalKicker = Math.floor(
            effectiveKicker * (daysRemainingInSeason / daysInSeason)
          );
        }

        // Apply waivers AFTER determining the base kicker amount
        if (waivedPct > 0 && !remainingGuaranteed) {
          // Only apply waiver reduction if no guaranteed money constraint
          finalKicker = Math.floor(finalKicker * (1 - waivedPct));
        }

        player.matchIncoming += finalKicker;
      }

      // Handle BYC + poison pill coexistence
      if (
        (player.isBYC || player.baseYearCompensation) &&
        player.isPoisonPill &&
        player.extension
      ) {
        // For outgoing: BYC rule applies to the poison pill average
        const currentSalary = player.currentSalary || baseSalary;
        const extensionSalary = player.extension.salary || 0;
        const averageSalary = (currentSalary + extensionSalary) / 2;

        const prevSalary = player.previousSalary || 0;
        const fiftyPercentAvg = Math.floor(averageSalary * BYC_PERCENT);
        player.matchOutgoing = Math.max(prevSalary, fiftyPercentAvg);
      }
    });

    // Attach data warnings to team for visibility
    team.dataWarnings = teamWarnings;
    allDataWarnings.push(...teamWarnings);
  });

  // Return data warnings for integration with validation results
  return {
    dataWarnings: allDataWarnings,
    hasBYCDataIssues: allDataWarnings.some(
      (w) => w.code === DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
    ),
    hasSalaryFieldIssues: allDataWarnings.some(
      (w) =>
        w.code === DATA_WARNING_CODES.SALARY_FIELD_FALLBACK ||
        w.code === DATA_WARNING_CODES.SALARY_FIELD_MISSING
    ),
  };
}

// @deprecated Currently unused - reserved for future BYC calculations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _computeBYCOutgoing(player) {
  if (!player.isBYC) return player.newSalary;

  // For BYC players, outgoing value is max of:
  // 1. Previous salary
  // 2. 50% of new salary
  const halfNewSalary = Math.floor(player.newSalary * BYC_PERCENT);
  return Math.max(player.previousSalary || 0, halfNewSalary);
}
