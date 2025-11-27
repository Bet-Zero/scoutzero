// Handles Base Year Compensation (BYC), trade kicker, and poison pill calculations
import { getSalaryForYear } from '../../tradeHelpers.js';
import { BYC_PERCENT } from '../constants/cbaConstants.js';
import { getCapHitForSeason, yearToSeason, normalizeYearInput } from './seasonUtils.js';

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
  const isRookieScale = contract?.isRookieScale || player.isRookieScale || false;
  const isPoisonPill = player.isPoisonPill || isRookieScale;
  
  if (
    !isOutgoing &&
    isPoisonPill &&
    Array.isArray(player.extensionYears)
  ) {
    const extensionTotal = player.extensionYears.reduce(
      (sum, year) => sum + (year.salary || 0),
      0
    );
    const extensionAvg = extensionTotal / player.extensionYears.length;
    return (salary + extensionAvg) / 2;
  }

  return salary;
}

export function computeMatchingValues({
  teams = [],
  yearKey,
  daysRemainingInSeason,
  daysInSeason,
}) {
  teams.forEach((team) => {
    (team.sends || []).forEach((player) => {
      // Normalize yearKey to get season string for new schema
      const normalized = normalizeYearInput(yearKey);
      
      // Get base salary from new contract schema (using capHit)
      let baseSalary = 0;
      if (normalized) {
        baseSalary = getCapHitForSeason(player, normalized.seasonString);
      }
      
      // Fallback to direct player properties if contract data missing
      if (baseSalary === 0) {
        baseSalary = player.newSalary || player.salary || 0;
      }

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
      const isRookieScale = contract?.isRookieScale || player.isRookieScale || false;
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

        const kickerAmount = Math.floor(baseSalary * percentage);
        let effectiveKicker = kickerAmount;

        let finalKicker = effectiveKicker;

        // Handle guaranteed money constraints
        const remainingGuaranteed = player.remainingGuaranteedOnCurrentContract;
        if (remainingGuaranteed && remainingGuaranteed > baseSalary) {
          const maxAvailableKicker = remainingGuaranteed - baseSalary;

          // For BYC players or when no timing specified, use enhanced kicker
          if (
            !daysRemainingInSeason ||
            !daysInSeason ||
            player.isBYC ||
            player.baseYearCompensation
          ) {
            const enhancedKicker = effectiveKicker * 2; // Double for these cases
            finalKicker = Math.min(maxAvailableKicker, enhancedKicker);
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
  });
}

function computeBYCOutgoing(player) {
  if (!player.isBYC) return player.newSalary;

  // For BYC players, outgoing value is max of:
  // 1. Previous salary
  // 2. 50% of new salary
  const halfNewSalary = Math.floor(player.newSalary * 0.5);
  return Math.max(player.previousSalary || 0, halfNewSalary);
}
