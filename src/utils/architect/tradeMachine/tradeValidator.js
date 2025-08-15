// tradeValidator.js - Combined Complete Version
import {
  calculateAllowableIncoming,
  getSalaryForYear,
  getApronStatus,
  formatCurrency,
  wouldExceedHardCap,
} from '@/utils/architect/tradeHelpers.js';
import { validationCache } from './validators/validationCacheService.js';
import { performanceMonitor } from './validators/validationPerformanceMonitor.js';
import { wrapCommonValidators } from './validators/validationDecorator.js';
import debug from './debug.js';

// Import base validators
import * as baseValidators from './validators/index.js';

// Create wrapped versions with performance monitoring and caching
const validators = wrapCommonValidators(baseValidators);

/**
 * Main trade validation entry point
 */
export function validateTrade({
  teams,
  capProjections,
  currentYear,
  tradeCtx = {},
}) {
  // Start overall validation timing
  performanceMonitor.startValidation('trade');

  try {
    // Validate input data structure first
    const inputErrors = validateTradeInput({
      teams,
      capProjections,
      currentYear,
      tradeCtx,
    });

    if (inputErrors.length > 0) {
      return {
        legal: false,
        teamResults: [],
        reason: inputErrors[0],
        violations: inputErrors,
        error: 'INVALID_INPUT',
      };
    }

    // Normalize all input data
    const {
      teams: normalizedTeams,
      capSettings,
      yearKey,
      tradeCtx: normalizedCtx,
    } = normalizeTradeInput({
      teams,
      capProjections,
      currentYear,
      tradeCtx,
    });

    // Process each team's validation rules
    const validatedTeams = normalizedTeams.map((team) => {
      // Run validations in correct order
      const validationResults = {
        signAndTrade: validators.validateSignAndTrade(team, normalizedCtx),
        hardCap: validators.validateHardCap(team),
        secondApron: validators.validateSecondApronRules(team),
        stepien: validators.validateStepien(team),
        roster: validators.validateRoster(team),
        byc: validators.validateBYC(team),
        tpe: validators.validateTPE(team),
      };

      // Collect violations with proper prioritization
      const violations = [];
      const warnings = [];

      Object.entries(validationResults).forEach(([key, result]) => {
        if (!result.passed) {
          if (result.warningsOnly) {
            warnings.push(...(result.violations || []));
          } else {
            violations.push(...(result.violations || []));
          }
        }
      });

      // Overall team validation result
      return {
        teamId: team.teamId,
        teamName: team.teamName,
        legal: violations.length === 0,
        violations,
        warnings,
        validationResults,
        details: violations.join('; ') || 'Valid trade',
        warningDetails: warnings.join('; ') || '',
      };
    });

    // Overall trade validation result
    const legal = validatedTeams.every((team) => team.legal);
    const reason = legal
      ? 'Valid trade'
      : validatedTeams.find((t) => !t.legal)?.violations[0];

    const result = {
      legal,
      teamResults: validatedTeams,
      reason,
      performance: performanceMonitor.getReport(),
    };

    if (debug.enabled) {
      debug.log('📊 Trade Validation Complete', result);
      performanceMonitor.logMetrics();
    }

    return result;
  } finally {
    performanceMonitor.endValidation('trade');
  }
}

// Helper functions
function validateTradeInput({ teams, capProjections, currentYear, tradeCtx }) {
  const errors = [];

  // Validate teams array
  if (!Array.isArray(teams)) {
    errors.push('Teams must be an array');
  } else if (teams.length < 2) {
    errors.push('Trade must involve at least 2 teams');
  }

  // Validate cap projections
  if (!capProjections || typeof capProjections !== 'object') {
    errors.push('Cap projections must be provided');
  }

  // Validate current year
  if (!currentYear || typeof currentYear !== 'number') {
    errors.push('Current year must be provided as a number');
  }

  // Validate team structure if teams array exists
  if (Array.isArray(teams)) {
    teams.forEach((team, index) => {
      if (!team.teamId) {
        errors.push(`Team ${index + 1} is missing teamId`);
      }
      if (!team.team || typeof team.team !== 'object') {
        errors.push(`Team ${index + 1} is missing team data`);
      }
      if (!Array.isArray(team.sends)) {
        errors.push(`Team ${index + 1} is missing sends array`);
      }
    });
  }

  return errors;
}

function normalizeTradeInput({ teams, capProjections, currentYear, tradeCtx }) {
  // Normalize teams data
  const normalizedTeams = teams.map((team) => ({
    ...team,
    sends: team.sends || [],
    receives: team.receives || [],
    teamId: team.teamId,
    teamName: team.team?.name || team.teamName,
  }));

  // Extract cap settings from projections
  const capSettings = {
    salaryCap: capProjections?.salaryCap || 0,
    luxuryTax: capProjections?.luxuryTax || 0,
    apron: capProjections?.apron || 0,
    secondApron: capProjections?.secondApron || 0,
  };

  // Create year key for caching
  const yearKey = `${currentYear}-${currentYear + 1}`;

  // Normalize trade context
  const normalizedCtx = {
    ...tradeCtx,
    year: currentYear,
    yearKey,
  };

  return {
    teams: normalizedTeams,
    capSettings,
    yearKey,
    tradeCtx: normalizedCtx,
  };
}
