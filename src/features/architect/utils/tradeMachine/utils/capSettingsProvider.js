/**
 * FILE: src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js
 * PURPOSE: Single source of truth for cap settings resolution.
 *          All trade validation and UI calculations should use this module
 *          to ensure consistent cap settings across the application.
 * OWNERSHIP: Feature: architect (Trade Machine - Cap Settings)
 *
 * HISTORY:
 *  - 2025-12-27: Phase 4 - Created as single source for cap settings resolution
 *                Eliminates silent defaults throughout the codebase
 *
 * USAGE:
 *   import { getCapSettings, getCapSettingsForYear } from './capSettingsProvider.js';
 *   
 *   // Get cap settings for a specific year
 *   const { settings, source, warnings } = getCapSettings({ 
 *     year: 2025, 
 *     capProjections 
 *   });
 *
 *   // Strict mode throws on missing data
 *   const result = getCapSettings({ year: 2025, capProjections, strict: true });
 */

import capProjectionsData from '@/features/architect/utils/capProjections.js';

// ============================================================================
// Constants
// ============================================================================

// Version for trade receipt tracking
export const CAP_SETTINGS_VERSION = '1.0.0';

// Valid year range for cap projections
const MIN_VALID_YEAR = 2020;
const MAX_VALID_YEAR = 2040;

/**
 * Keys used to identify cap settings source in trade receipts
 */
export const CAP_SETTINGS_SOURCE_KEYS = {
  PROJECTIONS: 'capProjections',
  PROJECTIONS_FALLBACK: 'capProjections_fallback',
  PROVIDED: 'provided_capSettings',
  CBA_CONSTANTS: 'CBA_CONSTANTS_fallback',
  MISSING: 'MISSING_NO_DATA',
};

/**
 * Emergency fallback values - ONLY used when no other source available
 * These are 2024-25 values and should trigger a warning when used
 * Object.freeze prevents mutations
 */
const EMERGENCY_FALLBACK_2024_25 = Object.freeze({
  salaryCap: 141_000_000,
  firstApron: 179_000_000,
  secondApron: 190_000_000,
  luxuryTax: 171_000_000,
  bae: 4_700_000,
  roomMLE: 8_000_000,
  fullMLE: 12_900_000,
  taxpayerMLE: 5_000_000,
});

/**
 * Converts year to season string format
 * @param {number} year - End year (e.g., 2025)
 * @returns {string} Season string (e.g., "2024-25")
 */
export function yearToSeasonKey(year) {
  if (typeof year === 'string' && year.includes('-')) {
    return year; // Already in season format
  }
  const endYear = Number(year);
  if (!Number.isFinite(endYear) || endYear < MIN_VALID_YEAR || endYear > MAX_VALID_YEAR) {
    return null;
  }
  return `${endYear - 1}-${String(endYear).slice(-2)}`;
}

/**
 * Extracts normalized cap settings from a raw projections entry
 * @param {Object} rawEntry - Raw cap projection data
 * @returns {Object} Normalized cap settings
 */
function normalizeCapEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  return {
    salaryCap: rawEntry.cap ?? rawEntry.salaryCap ?? 0,
    firstApron: rawEntry.firstApron ?? rawEntry.apron ?? 0,
    secondApron: rawEntry.secondApron ?? 0,
    luxuryTax: rawEntry.tax ?? rawEntry.luxuryTax ?? 0,
    bae: rawEntry.bae ?? 0,
    roomMLE: rawEntry.roomMLE ?? 0,
    fullMLE: rawEntry.fullMLE ?? rawEntry.mle ?? 0,
    taxpayerMLE: rawEntry.taxpayerMLE ?? 0,
    floor: rawEntry.floor ?? 0,
    growthRate: rawEntry.growthRate ?? 0,
    confirmed: rawEntry.confirmed ?? false,
  };
}

/**
 * Attempts to resolve cap settings from various sources in priority order
 * 
 * @param {Object} params - Resolution parameters
 * @param {number|string} params.year - Season end year (e.g., 2025) or season string (e.g., "2024-25")
 * @param {Object} [params.capProjections] - Cap projections object (optional, uses default if not provided)
 * @param {Object} [params.providedCapSettings] - Pre-resolved cap settings to use if available
 * @param {boolean} [params.strict=false] - If true, throws error when cap settings cannot be resolved
 * @returns {Object} Result with:
 *   - settings {Object} - The resolved cap settings
 *   - source {string} - Source identifier for debugging
 *   - warnings {string[]} - Any warnings about data resolution
 *   - resolved {boolean} - Whether settings were successfully resolved
 *   - year {number} - The resolved year
 *   - seasonKey {string} - The season string (e.g., "2024-25")
 */
export function getCapSettings({
  year,
  capProjections = null,
  providedCapSettings = null,
  strict = false,
}) {
  const warnings = [];
  let settings = null;
  let source = CAP_SETTINGS_SOURCE_KEYS.MISSING;
  let resolved = false;

  // Determine the year/season key
  let resolvedYear = year;
  if (typeof year === 'string' && year.includes('-')) {
    // Convert "2024-25" to 2025
    const parts = year.split('-');
    resolvedYear = Number(parts[0]) + 1;
  } else {
    resolvedYear = Number(year) || 2025;
  }
  
  const seasonKey = yearToSeasonKey(resolvedYear);

  // Priority 1: Use provided cap settings if available and complete
  if (providedCapSettings && typeof providedCapSettings === 'object') {
    const normalized = normalizeCapEntry(providedCapSettings);
    if (normalized && normalized.salaryCap > 0 && normalized.firstApron > 0) {
      settings = normalized;
      source = CAP_SETTINGS_SOURCE_KEYS.PROVIDED;
      resolved = true;
    }
  }

  // Priority 2: Look up from provided capProjections parameter
  if (!resolved && capProjections && typeof capProjections === 'object') {
    const entry = capProjections[seasonKey] || capProjections[resolvedYear];
    if (entry) {
      const normalized = normalizeCapEntry(entry);
      if (normalized && normalized.salaryCap > 0) {
        settings = normalized;
        source = `${CAP_SETTINGS_SOURCE_KEYS.PROJECTIONS}[${seasonKey}]`;
        resolved = true;
        
        if (!normalized.confirmed) {
          warnings.push(`Cap values for ${seasonKey} are projected (not confirmed)`);
        }
      }
    }
  }

  // Priority 3: Look up from default capProjections module
  if (!resolved) {
    const entry = capProjectionsData[seasonKey] || capProjectionsData[resolvedYear];
    if (entry) {
      const normalized = normalizeCapEntry(entry);
      if (normalized && normalized.salaryCap > 0) {
        settings = normalized;
        source = `${CAP_SETTINGS_SOURCE_KEYS.PROJECTIONS}[${seasonKey}]`;
        resolved = true;
        
        if (!normalized.confirmed) {
          warnings.push(`Cap values for ${seasonKey} are projected (not confirmed)`);
        }
      }
    }
  }

  // Priority 4: Try adjacent years as fallback
  if (!resolved) {
    // Try one year earlier
    const prevSeasonKey = yearToSeasonKey(resolvedYear - 1);
    const prevEntry = capProjections?.[prevSeasonKey] || 
                      capProjectionsData[prevSeasonKey];
    if (prevEntry) {
      const normalized = normalizeCapEntry(prevEntry);
      if (normalized && normalized.salaryCap > 0) {
        settings = normalized;
        source = `${CAP_SETTINGS_SOURCE_KEYS.PROJECTIONS_FALLBACK}[${prevSeasonKey}]`;
        resolved = true;
        warnings.push(`No cap data for ${seasonKey}; using ${prevSeasonKey} values as fallback`);
      }
    }
  }

  // Priority 5: Use emergency fallback (with strong warning)
  if (!resolved) {
    if (strict) {
      throw new Error(
        `[CapSettingsProvider] FATAL: No cap settings available for year ${resolvedYear} (${seasonKey}). ` +
        `Ensure capProjections data is available or provide explicit capSettings.`
      );
    }

    settings = { ...EMERGENCY_FALLBACK_2024_25 };
    source = `${CAP_SETTINGS_SOURCE_KEYS.CBA_CONSTANTS}_2024-25`;
    resolved = true;
    warnings.push(
      `CRITICAL: No cap data for ${seasonKey}. Using 2024-25 emergency fallback values. ` +
      `Trade validation may be inaccurate!`
    );
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development' || import.meta?.env?.DEV) {
      console.warn(
        `[CapSettingsProvider] FALLBACK USED for ${seasonKey}:`,
        settings,
        '\nStack:',
        new Error().stack
      );
    }
  }

  return {
    settings,
    source,
    warnings,
    resolved,
    year: resolvedYear,
    seasonKey,
  };
}

/**
 * Simplified wrapper that just returns cap settings for a year
 * with warnings attached to the returned object
 * 
 * @param {number|string} year - Season end year or season string
 * @param {Object} [capProjections] - Optional cap projections override
 * @returns {Object} Cap settings with _meta property containing source/warnings
 */
export function getCapSettingsForYear(year, capProjections = null) {
  const result = getCapSettings({ year, capProjections });
  
  return {
    ...result.settings,
    _meta: {
      source: result.source,
      warnings: result.warnings,
      seasonKey: result.seasonKey,
      resolved: result.resolved,
    },
  };
}

/**
 * Validates that cap settings are present and reasonable
 * 
 * @param {Object} capSettings - Cap settings to validate
 * @returns {Object} Validation result with passed/warnings/errors
 */
export function validateCapSettings(capSettings) {
  const errors = [];
  const warnings = [];

  if (!capSettings || typeof capSettings !== 'object') {
    return {
      passed: false,
      errors: ['Cap settings are null or undefined'],
      warnings: [],
    };
  }

  // Check required values
  const { salaryCap, firstApron, secondApron } = capSettings;

  if (!salaryCap || salaryCap <= 0) {
    errors.push('salaryCap is missing or invalid');
  }
  if (!firstApron || firstApron <= 0) {
    errors.push('firstApron is missing or invalid');
  }
  if (!secondApron || secondApron <= 0) {
    errors.push('secondApron is missing or invalid');
  }

  // Check reasonable ranges (2020-2035 expected range)
  if (salaryCap > 0 && (salaryCap < 100_000_000 || salaryCap > 350_000_000)) {
    warnings.push(`salaryCap (${salaryCap}) outside typical range`);
  }
  if (firstApron > 0 && firstApron <= salaryCap) {
    warnings.push(`firstApron (${firstApron}) should be greater than salaryCap (${salaryCap})`);
  }
  if (secondApron > 0 && secondApron <= firstApron) {
    warnings.push(`secondApron (${secondApron}) should be greater than firstApron (${firstApron})`);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Returns the cap settings that should be used in trade receipt
 * This is a convenience function for the trade validator
 * 
 * @param {Object} params - Parameters
 * @param {number} params.yearKey - Season end year
 * @param {Object} [params.capProjections] - Cap projections
 * @param {Object} [params.contextCapSettings] - Cap settings from context
 * @returns {Object} Cap settings result for trade receipt
 */
export function getCapSettingsForReceipt({ yearKey, capProjections, contextCapSettings }) {
  const result = getCapSettings({
    year: yearKey,
    capProjections,
    providedCapSettings: contextCapSettings,
  });

  return {
    capSettingsUsed: {
      salaryCap: result.settings.salaryCap,
      firstApron: result.settings.firstApron,
      secondApron: result.settings.secondApron,
      luxuryTax: result.settings.luxuryTax,
    },
    capSettingsSource: result.source,
    capSettingsWarnings: result.warnings,
    seasonKey: result.seasonKey,
  };
}

// Default export for convenience
export default {
  getCapSettings,
  getCapSettingsForYear,
  validateCapSettings,
  getCapSettingsForReceipt,
  CAP_SETTINGS_VERSION,
  CAP_SETTINGS_SOURCE_KEYS,
};
