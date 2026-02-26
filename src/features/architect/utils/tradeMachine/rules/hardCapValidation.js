/**
 * Comprehensive hard cap validation
 * Consolidated from: hardCap.js + validateHardCap.js
 * Phase 4: Explicit cap settings - no silent defaults
 */

import { formatCurrency } from '@/features/architect/utils/tradeHelpers.js';
import { isSecondApronTeam } from '../utils/capUtils.js';

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

  // Determine hard cap status
  const isHardCappedFirstApron =
    team.hardCapped === true || teamData?.hardCapFirstApron?.active;
  const isHardCappedSecondApron =
    teamData?.hardCapTriggered === 'SecondApron' ||
    teamData?.hardCapSecondApron?.active;
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const isAboveSecondApron = isSecondApronTeam(
    { totalSalary: teamTotalSalary },
    capSettings
  );

  let hardCapType = null;

  // Check second apron hard cap (highest priority)
  if (isHardCappedSecondApron) {
    hardCapType = 'SecondApron';
    if (projectedSalary > secondApron) {
      const hardCapRoom = Math.max(0, secondApron - teamTotalSalary);
      const hardCapIncomingCeiling = salaryOut + hardCapRoom;
      const incomingOverage = Math.max(0, salaryIn - hardCapIncomingCeiling);

      violations.push(
        incomingOverage > 0
          ? `2nd Apron hard cap violation: Incoming salary exceeds hard-cap incoming ceiling by ${formatCurrency(incomingOverage)} (incoming ${formatCurrency(salaryIn)} vs ceiling ${formatCurrency(hardCapIncomingCeiling)}).`
          : `2nd Apron hard cap violation: Trade would exceed second apron hard-cap by ${formatCurrency(projectedSalary - secondApron)}`
      );
    }
  }
  // Teams above second apron are automatically hard-capped
  else if (isAboveSecondApron) {
    hardCapType = 'SecondApron';
    if (projectedSalary > teamTotalSalary) {
      // Check if this is due to sign-and-trade
      const hasIncomingSignAndTrade = (
        team.incomingPlayers ||
        team.receives ||
        []
      ).some((p) => p.signAndTrade === true);
      if (hasIncomingSignAndTrade) {
        violations.push(
          `Team would exceed hard-cap after receiving sign-and-trade player`
        );
      }
      // NOTE: Salary mismatch message removed - validateSalaryMatching is the SSOT for this
      // Hard cap validation focuses on ceiling violations, not salary matching
    }
  }
  // Check first apron hard cap
  else if (isHardCappedFirstApron) {
    hardCapType = 'FirstApron';
    if (projectedSalary > actualFirstApron) {
      const hardCapRoom = Math.max(0, actualFirstApron - teamTotalSalary);
      const hardCapIncomingCeiling = salaryOut + hardCapRoom;
      const incomingOverage = Math.max(0, salaryIn - hardCapIncomingCeiling);

      violations.push(
        incomingOverage > 0
          ? `1st Apron hard cap violation: Incoming salary exceeds hard-cap incoming ceiling by ${formatCurrency(incomingOverage)} (incoming ${formatCurrency(salaryIn)} vs ceiling ${formatCurrency(hardCapIncomingCeiling)}).`
          : `1st Apron hard cap violation: Trade would exceed first apron hard-cap by ${formatCurrency(projectedSalary - actualFirstApron)}`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings, // Phase 4: Include cap settings warnings
    hardCapType,
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
