/**
 * Comprehensive hard cap validation
 * Consolidated from: hardCap.js + validateHardCap.js
 * Phase 4: Explicit cap settings - no silent defaults
 */

import { formatCurrency } from '@/features/architect/utils/tradeHelpers.js';
import {
  getHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus.js';

/**
 * Core hard cap validation logic
 * Supports both first apron and second apron hard cap scenarios
 * Phase 4: Cap settings must be explicitly provided via context
 */
export function validateHardCap(team, context = {}) {
  const violations = [];
  const warnings = [];

  // Handle missing team data
  if (!team) {
    return {
      passed: false,
      violations: ['Missing team data'],
      warnings: [],
      hardCapType: null,
    };
  }

  // Extract data from multiple possible team formats
  const teamData = team.team || team;
  const teamTotalSalary =
    team.teamTotalSalary ??
    teamData?.teamTotalSalary ??
    teamData?.totalSalary ??
    0;

  // Calculate incoming and outgoing salary
  const incomingSalary = (team.receives || team.incomingPlayers || []).reduce(
    (sum, p) => sum + (p.newSalary || p.salary || 0),
    0
  );
  const outgoingSalary = (team.sends || team.outgoingPlayers || []).reduce(
    (sum, p) => sum + (p.newSalary || p.salary || 0),
    0
  );

  // Calculate projected salary
  const salaryIn = team.salaryIn || incomingSalary;
  const salaryOut = team.salaryOut || outgoingSalary;
  const projectedSalary =
    team.projectedSalary ??
    context.projectedSalary ??
    teamTotalSalary + salaryIn - salaryOut;

  // Extract cap settings from team or context
  const teamCapSettings = team.capSettings || {};
  const contextCapSettings = context.capSettings || {};
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  // Phase 4: Use explicit cap settings, warn if missing
  const { firstApron = 0, apron = 0, secondApron = 0 } = capSettings;

  // Check if cap settings are missing
  const hasFirstApron = firstApron > 0 || apron > 0;
  const hasSecondApron = secondApron > 0;

  if (!hasFirstApron || !hasSecondApron) {
    // Log warning in development mode
    if (process.env.NODE_ENV === 'development' || import.meta?.env?.DEV) {
      console.warn(
        '[validateHardCap] Missing cap settings:',
        { firstApron, apron, secondApron },
        'source:',
        context.capSettingsSource || 'unknown'
      );
    }
    warnings.push(
      `Hard cap validation may be inaccurate - cap settings incomplete (firstApron: ${hasFirstApron}, secondApron: ${hasSecondApron})`
    );
  }

  // Use firstApron if available, otherwise fall back to apron
  const actualFirstApron = firstApron || apron;

  // Determine hard cap status from canonical hard-cap resolver
  const hardCapStatus = getHardCapStatus(team, {
    isWorldless: !context.worldId,
    capSettings: {
      firstApron: actualFirstApron,
      secondApron,
    },
  });
  let hardCapTypeCanonical = hardCapStatus.isHardCapped
    ? hardCapStatus.hardCapType
    : null;

  if (!hardCapStatus.isHardCapped) {
    return {
      passed: true,
      violations,
      warnings, // Phase 4: Include cap settings warnings
      hardCapType: null,
      hardCapTypeCanonical: null,
      hardCapStatus,
      projectedSalary,
      capLimits: {
        firstApron: actualFirstApron,
        secondApron,
      },
    };
  }

  const isUnknownFailClosed =
    hardCapTypeCanonical === HARD_CAP_TYPES.UNKNOWN;
  const hardCapTypeForCeiling = isUnknownFailClosed
    ? HARD_CAP_TYPES.FIRST_APRON
    : hardCapTypeCanonical;
  const hardCapType =
    hardCapTypeForCeiling === HARD_CAP_TYPES.SECOND_APRON
      ? 'SecondApron'
      : hardCapTypeForCeiling === HARD_CAP_TYPES.FIRST_APRON
        ? 'FirstApron'
        : null;

  let hardCapLimit = null;
  let hardCapLabel = null;

  if (hardCapTypeForCeiling === HARD_CAP_TYPES.SECOND_APRON) {
    hardCapLimit = secondApron > 0 ? secondApron : actualFirstApron;
    hardCapLabel = secondApron > 0 ? '2nd Apron' : '1st Apron (fallback)';
  } else if (hardCapTypeForCeiling === HARD_CAP_TYPES.FIRST_APRON) {
    hardCapLimit = actualFirstApron > 0 ? actualFirstApron : secondApron;
    hardCapLabel = actualFirstApron > 0 ? '1st Apron' : '2nd Apron (fallback)';
  }

  if (hardCapLimit !== null) {
    if (projectedSalary > hardCapLimit) {
      const hardCapRoom = Math.max(0, hardCapLimit - teamTotalSalary);
      const hardCapIncomingCeiling = salaryOut + hardCapRoom;
      const incomingOverage = Math.max(0, salaryIn - hardCapIncomingCeiling);

      const baseMessage =
        incomingOverage > 0
          ? `${hardCapLabel} hard cap violation: Incoming salary exceeds hard-cap incoming ceiling by ${formatCurrency(incomingOverage)} (incoming ${formatCurrency(salaryIn)} vs ceiling ${formatCurrency(hardCapIncomingCeiling)}).`
          : `${hardCapLabel} hard cap violation: Trade would exceed hard-cap by ${formatCurrency(projectedSalary - hardCapLimit)}`;

      violations.push(
        isUnknownFailClosed
          ? `${baseMessage} [fail-closed UNKNOWN hard cap type]`
          : baseMessage
      );
    }
  }

  // Additional sign-and-trade hard-cap warning when already above second apron.
  if (hardCapTypeForCeiling === HARD_CAP_TYPES.SECOND_APRON) {
    const hasIncomingSignAndTrade = (team.incomingPlayers || team.receives || [])
      .some((p) => p.signAndTrade === true);
    if (hasIncomingSignAndTrade) {
      violations.push(`Team would exceed hard-cap after receiving sign-and-trade player`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings, // Phase 4: Include cap settings warnings
    hardCapType,
    hardCapTypeCanonical: hardCapTypeCanonical || null,
    hardCapStatus,
    projectedSalary,
    capLimits: {
      firstApron: actualFirstApron,
      secondApron,
    },
  };
}

/**
 * Legacy hard cap validation (from hardCap.js)
 * Maintains compatibility with older calling patterns
 */
export function validateHardCapLegacy(team, capSettings) {
  if (!team?.team || !capSettings) {
    return {
      passed: false,
      violations: ['Missing team or cap settings data'],
      hardCapType: null,
    };
  }

  const violations = [];
  let hardCapType = null;

  // Get total salary after trade
  const incomingSalary = (team.receives || []).reduce(
    (sum, p) => sum + p.newSalary,
    0
  );
  const outgoingSalary = (team.sends || []).reduce(
    (sum, p) => sum + p.newSalary,
    0
  );
  const teamTotalSalary = team.team?.totalSalary || 0;
  const projectedSalary = teamTotalSalary - outgoingSalary + incomingSalary;

  // Check first apron hard cap
  if (team.team.hardCapFirstApron?.active) {
    hardCapType = 'FirstApron';
    if (projectedSalary > capSettings.firstApron) {
      violations.push(
        `Trade would exceed 1st Apron hard cap by ${(projectedSalary - capSettings.firstApron).toLocaleString()}`
      );
    }
  }

  // Check second apron hard cap
  if (team.team.hardCapSecondApron?.active) {
    hardCapType = 'SecondApron';
    if (projectedSalary > capSettings.secondApron) {
      violations.push(
        `Trade would exceed 2nd Apron hard cap by ${(projectedSalary - capSettings.secondApron).toLocaleString()}`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    hardCapType,
  };
}

/**
 * Check if a team would exceed hard cap after a trade
 * Utility function for quick hard cap checks
 */
export function wouldExceedHardCapAfterTrade(
  team,
  incomingSalary,
  outgoingSalary,
  capSettings
) {
  const result = validateHardCap({
    ...team,
    salaryIn: incomingSalary,
    salaryOut: outgoingSalary,
    capSettings,
  });

  return !result.passed;
}

/**
 * Get the active hard cap limit for a team
 * Returns the applicable hard cap amount or null if no hard cap
 * Phase 4: Requires explicit cap settings - no hardcoded fallbacks
 */
export function getActiveHardCapLimit(team, capSettings = {}) {
  const result = validateHardCap(team, { capSettings });

  if (result.hardCapType === 'SecondApron') {
    // Phase 4: Use provided cap settings only, no fallback
    return capSettings.secondApron || null;
  } else if (result.hardCapType === 'FirstApron') {
    return capSettings.firstApron || capSettings.apron || null;
  }

  return null;
}

// Export legacy function for backward compatibility
export { validateHardCap as hardCapValidation };
export { validateHardCapLegacy as hardCapValidationLegacy };
