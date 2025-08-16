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
        tpe: validators.validateTradeExceptions(team),
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

      // Extra second apron checks when minimal trade context is provided
      if (team.teamTotalSalary >= capSettings.secondApron) {
        if (team.cashSent > 0 || team.cashReceived > 0) {
          violations.push('Second apron team cannot include cash in trades');
        }
        if (team.context?.otherTeamsSending > 1) {
          violations.push(
            'Second apron team cannot aggregate salaries from multiple sources'
          );
        }
      }

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
      // teamId is optional – fallback to team name fields if available
      if (
        !team.teamId &&
        !team.teamName &&
        !team.team?.name &&
        !team.team?.teamName
      ) {
        errors.push(`Team ${index + 1} is missing team identifier`);
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
  // Resolve season key (e.g., 2025-26)
  const seasonKey = `${currentYear}-${String(currentYear + 1).slice(-2)}`;
  const projection = capProjections?.[seasonKey] || {};

  // Extract cap settings from projections
  const capSettings = {
    salaryCap: projection.cap || projection.salaryCap || 0,
    luxuryTax: projection.tax || projection.luxuryTax || 0,
    firstApron: projection.firstApron || projection.apron || 0,
    secondApron: projection.secondApron || 0,
  };

  // Create year key for caching
  const yearKey = seasonKey;

  // Normalize teams data
  const normalizedTeams = teams.map((team, index) => {
    const sends = team.sends || [];
    const otherTeamsSending = teams.reduce(
      (count, t, i) => count + (i !== index && (t.sends || []).length > 0 ? 1 : 0),
      0
    );

    return {
      ...team,
      sends,
      receives: team.receives || [],
      outgoingPicks: team.outgoingPicks || team.picksOut || [],
      // Generate a usable teamId if one isn't provided
      teamId:
        team.teamId ||
        team.team?.id ||
        team.teamName ||
        team.team?.teamName ||
        `TEAM${index + 1}`,
      teamName:
        team.team?.name ||
        team.team?.teamName ||
        team.teamName ||
        team.teamId ||
        `Team ${index + 1}`,
      teamTotalSalary: team.team?.totalSalary || team.totalSalary || 0,
      context: {
        capSettings,
        yearKey,
        totalTeams: teams.length,
        otherTeamsSending,
      },
    };
  });

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
