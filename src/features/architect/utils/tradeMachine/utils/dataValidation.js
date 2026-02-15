/**
 * FILE: dataValidation.js
 * PURPOSE: Validate trade-related data quality and surface warnings for missing/incomplete data
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2026-02-15: Created for Batch C — Data Model Hardening (GAP-DATA-001, GAP-DATA-002)
 * LINKS: matchingValues.js, tradeValidator.js
 *
 * This module provides utilities to validate player data required for accurate
 * trade calculations. Rather than silently falling back to defaults when data
 * is missing, it surfaces clear warnings so users understand data limitations.
 */

/**
 * Warning severity levels for data issues
 */
export const DATA_WARNING_SEVERITY = {
  ERROR: 'error', // Trade validation cannot proceed accurately
  WARNING: 'warning', // Trade validation can proceed but with reduced accuracy
  INFO: 'info', // Informational note about data source
};

/**
 * Data warning codes for consistent identification
 */
export const DATA_WARNING_CODES = {
  BYC_MISSING_PREVIOUS_SALARY: 'BYC_MISSING_PREVIOUS_SALARY',
  SALARY_FIELD_FALLBACK: 'SALARY_FIELD_FALLBACK',
  SALARY_FIELD_MISSING: 'SALARY_FIELD_MISSING',
};

/**
 * Creates a standardized data warning object
 */
export function createDataWarning(code, message, severity, details = {}) {
  return {
    code,
    message,
    severity,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Validates BYC player data requirements
 *
 * GAP-DATA-001: BYC players require previousSalary for accurate matching value calculation.
 * If missing, the system falls back to 50% of new salary, which may be incorrect.
 *
 * @param {Object} player - Player object to validate
 * @returns {Array} Array of data warnings (empty if valid)
 */
export function validateBYCPlayerData(player) {
  const warnings = [];

  if (!player) return warnings;

  const isBYC = player.isBYC || player.baseYearCompensation;

  if (isBYC) {
    const hasPreviousSalary =
      player.previousSalary !== undefined &&
      player.previousSalary !== null &&
      typeof player.previousSalary === 'number' &&
      player.previousSalary > 0;

    if (!hasPreviousSalary) {
      const playerName =
        player.name || player.bio?.displayName || 'Unknown Player';
      const playerId = player.id || player.player_id || 'unknown';

      warnings.push(
        createDataWarning(
          DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY,
          `BYC player "${playerName}" is missing previousSalary — outgoing matching value may be inaccurate`,
          DATA_WARNING_SEVERITY.WARNING,
          {
            playerId,
            playerName,
            isBYC: true,
            previousSalary: player.previousSalary,
            fallbackUsed: true,
            fallbackMethod: '50% of new salary',
            expectedField: 'previousSalary',
            cbaImplication:
              'BYC matching value = max(previousSalary, 50% of newSalary). Without previousSalary, only 50% rule can be applied.',
          }
        )
      );
    }
  }

  return warnings;
}

/**
 * Validates salary field data and tracks fallback usage
 *
 * GAP-DATA-002: Multiple salary field names exist in the codebase.
 * The canonical field is contract.salariesByYear[].capHit.
 * This function tracks when fallbacks are used.
 *
 * @param {Object} player - Player object to validate
 * @param {string} yearKey - Season year key
 * @param {Object} options - Options including actual salary source used
 * @returns {Array} Array of data warnings (empty if using canonical source)
 */
export function validateSalaryFieldData(player, yearKey, options = {}) {
  const warnings = [];

  if (!player) return warnings;

  const { salarySource, salaryValue } = options;
  const playerName = player.name || player.bio?.displayName || 'Unknown Player';
  const playerId = player.id || player.player_id || 'unknown';

  // Check if canonical salary data is available
  const contract = player.contract || player.primaryContract;
  const hasCanonicalSalary =
    contract?.salariesByYear?.length > 0 &&
    contract.salariesByYear.some(
      (y) => y.capHit !== undefined && y.capHit !== null && y.capHit > 0
    );

  if (!hasCanonicalSalary && salaryValue > 0) {
    // Salary was found via fallback field
    warnings.push(
      createDataWarning(
        DATA_WARNING_CODES.SALARY_FIELD_FALLBACK,
        `Player "${playerName}" using fallback salary source: ${salarySource || 'player.salary'}`,
        DATA_WARNING_SEVERITY.INFO,
        {
          playerId,
          playerName,
          salarySource: salarySource || 'fallback',
          salaryValue,
          canonicalPath: 'contract.salariesByYear[].capHit',
          year: yearKey,
        }
      )
    );
  } else if (!hasCanonicalSalary && salaryValue === 0) {
    // No salary data found at all
    warnings.push(
      createDataWarning(
        DATA_WARNING_CODES.SALARY_FIELD_MISSING,
        `Player "${playerName}" has no salary data for year ${yearKey}`,
        DATA_WARNING_SEVERITY.WARNING,
        {
          playerId,
          playerName,
          year: yearKey,
          canonicalPath: 'contract.salariesByYear[].capHit',
        }
      )
    );
  }

  return warnings;
}

/**
 * Validates all trade-related data for a list of players
 *
 * @param {Array} players - Array of player objects
 * @param {string|number} yearKey - Season year key
 * @returns {Object} Validation result with warnings array and summary
 */
export function validateTradeData(players, yearKey) {
  const warnings = [];
  const summary = {
    totalPlayers: 0,
    bycPlayers: 0,
    bycMissingPrevSalary: 0,
    salaryFallbacks: 0,
    salaryMissing: 0,
  };

  if (!Array.isArray(players)) {
    return { warnings, summary };
  }

  summary.totalPlayers = players.length;

  players.forEach((player) => {
    // Validate BYC data
    const bycWarnings = validateBYCPlayerData(player);
    warnings.push(...bycWarnings);

    if (player.isBYC || player.baseYearCompensation) {
      summary.bycPlayers++;
      if (bycWarnings.length > 0) {
        summary.bycMissingPrevSalary++;
      }
    }

    // Validate salary field data
    const salaryWarnings = validateSalaryFieldData(player, yearKey);
    warnings.push(...salaryWarnings);

    salaryWarnings.forEach((w) => {
      if (w.code === DATA_WARNING_CODES.SALARY_FIELD_FALLBACK) {
        summary.salaryFallbacks++;
      } else if (w.code === DATA_WARNING_CODES.SALARY_FIELD_MISSING) {
        summary.salaryMissing++;
      }
    });
  });

  return {
    warnings,
    summary,
    hasIssues: warnings.length > 0,
    hasErrors: warnings.some((w) => w.severity === DATA_WARNING_SEVERITY.ERROR),
    hasWarnings: warnings.some(
      (w) => w.severity === DATA_WARNING_SEVERITY.WARNING
    ),
  };
}

/**
 * Formats a data warning for display in the UI
 *
 * @param {Object} warning - Data warning object
 * @returns {string} Formatted warning message
 */
export function formatDataWarning(warning) {
  if (!warning) return '';

  const prefix =
    warning.severity === DATA_WARNING_SEVERITY.ERROR
      ? '❌'
      : warning.severity === DATA_WARNING_SEVERITY.WARNING
        ? '⚠️'
        : 'ℹ️';

  return `${prefix} ${warning.message}`;
}
