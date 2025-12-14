/**
 * Comprehensive hard cap validation
 * Consolidated from: hardCap.js + validateHardCap.js
 */

import { formatCurrency } from '@/features/architect/utils/tradeHelpers.js';

// Fallback implementations for hard cap utilities (import directly if needed)
const wouldExceedHardCap = () => false;
const isFirstApronTeam = (team) => team?.hardCapped === true;
const isSecondApronTeam = (team) => team?.hardCapTriggered === 'SecondApron';
const getTeamSalary = (team) => team?.totalSalary || 0;

/**
 * Core hard cap validation logic
 * Supports both first apron and second apron hard cap scenarios
 */
export function validateHardCap(team, context = {}) {
  const violations = [];
  
  // Handle missing team data
  if (!team) {
    return {
      passed: false,
      violations: ['Missing team data'],
      hardCapType: null,
    };
  }

  // Extract data from multiple possible team formats
  const teamData = team.team || team;
  const teamTotalSalary = teamData?.totalSalary || 0;
  
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
    (teamTotalSalary + salaryIn - salaryOut);

  // Extract cap settings from team or context
  const teamCapSettings = team.capSettings || {};
  const contextCapSettings = context.capSettings || {};
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  const {
    firstApron = 178132000,
    apron = 178132000,
    secondApron = 188931000,
  } = capSettings;

  // Use firstApron if available, otherwise fall back to apron
  const actualFirstApron = firstApron || apron;

  // Determine hard cap status
  const isHardCappedFirstApron = team.hardCapped === true || teamData?.hardCapFirstApron?.active;
  const isHardCappedSecondApron = teamData?.hardCapTriggered === 'SecondApron' || teamData?.hardCapSecondApron?.active;
  const isAboveSecondApron = teamTotalSalary >= secondApron;

  let hardCapType = null;

  // Check second apron hard cap (highest priority)
  if (isHardCappedSecondApron) {
    hardCapType = 'SecondApron';
    if (projectedSalary > secondApron) {
      violations.push(
        `2nd Apron hard cap violation: Trade would exceed second apron hard-cap by ${formatCurrency(projectedSalary - secondApron)}`
      );
    }
  }
  // Teams above second apron are automatically hard-capped
  else if (isAboveSecondApron) {
    hardCapType = 'SecondApron';
    if (projectedSalary > teamTotalSalary) {
      // Check if this is due to sign-and-trade
      const hasIncomingSignAndTrade = (team.incomingPlayers || team.receives || []).some(p => p.signAndTrade === true);
      if (hasIncomingSignAndTrade) {
        violations.push(`Team would exceed hard-cap after receiving sign-and-trade player`);
      } else {
        violations.push(`Second apron team cannot receive more salary than sent`);
      }
    }
  }
  // Check first apron hard cap
  else if (isHardCappedFirstApron) {
    hardCapType = 'FirstApron';
    if (projectedSalary > actualFirstApron) {
      violations.push(
        `1st Apron hard cap violation: Trade would exceed first apron hard-cap by ${formatCurrency(projectedSalary - actualFirstApron)}`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
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
  const projectedSalary =
    getTeamSalary(team.team) - outgoingSalary + incomingSalary;

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
export function wouldExceedHardCapAfterTrade(team, incomingSalary, outgoingSalary, capSettings) {
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
 */
export function getActiveHardCapLimit(team, capSettings = {}) {
  const result = validateHardCap(team, { capSettings });
  
  if (result.hardCapType === 'SecondApron') {
    return capSettings.secondApron || 188931000;
  } else if (result.hardCapType === 'FirstApron') {
    return capSettings.firstApron || capSettings.apron || 178132000;
  }
  
  return null;
}

// Export legacy function for backward compatibility
export { validateHardCap as hardCapValidation };
export { validateHardCapLegacy as hardCapValidationLegacy };