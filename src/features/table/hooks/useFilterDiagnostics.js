/**
 * @file useFilterDiagnostics.js
 * @description Phase 2S Dev Diagnostics Hook
 *
 * Provides filter diagnostics data for the dev panel.
 * Only active when ?debugFilters=1 query param is present.
 *
 * USAGE:
 *   const diagnostics = useFilterDiagnostics(players, filteredPlayers, activeFilters);
 *   // Returns null if debug mode is off
 *   // Returns diagnostics object if debug mode is on
 */

import { useMemo } from 'react';
import {
  PLAYER_FILTER_CATALOG,
  getCatalogFilterKeys,
} from '@/shared/utils/filtering/playerFilterCatalog';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

// Get default filters once at module load
const FILTER_DEFAULTS = getDefaultPlayerFilters();

/**
 * Check if debug mode is enabled via query param
 * @returns {boolean}
 */
function isDebugModeEnabled() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debugFilters') === '1';
}

/**
 * Get list of currently active (non-default) filters
 * @param {Object} activeFilters - Current filter state
 * @returns {Array<{key: string, value: any, defaultValue: any}>}
 */
function getActiveFiltersList(activeFilters) {
  const active = [];

  for (const [key, value] of Object.entries(activeFilters)) {
    const defaultValue = FILTER_DEFAULTS[key];

    // Check if value differs from default
    if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
      // Skip if it's an empty array (treated as "all")
      if (Array.isArray(value) && value.length === 0) continue;
      // Skip if it's null/undefined
      if (value === null || value === undefined) continue;
      // Skip if it's an empty string
      if (value === '') continue;

      active.push({
        key,
        value,
        defaultValue,
      });
    }
  }

  return active;
}

/**
 * Get catalog entries for active filters
 * @param {Array<{key: string}>} activeFilters
 * @returns {Array<Object>}
 */
function getCatalogEntriesForActive(activeFilters) {
  const catalogKeys = getCatalogFilterKeys();

  return activeFilters.map(({ key, value }) => {
    // Fixed: catalog uses 'key' not 'filterKey'
    const catalogEntry = PLAYER_FILTER_CATALOG.find((c) => c.key === key);

    return {
      key,
      value,
      inCatalog: catalogKeys.includes(key),
      catalogEntry: catalogEntry || null,
      status: catalogEntry?.status || 'UNKNOWN',
    };
  });
}

/**
 * Calculate filter reduction stats
 * @param {Array} allPlayers
 * @param {Array} filteredPlayers
 * @returns {Object}
 */
function getReductionStats(allPlayers, filteredPlayers) {
  const total = allPlayers?.length || 0;
  const filtered = filteredPlayers?.length || 0;
  const removed = total - filtered;
  const percentage = total > 0 ? Math.round((removed / total) * 100) : 0;

  return {
    totalPlayers: total,
    filteredPlayers: filtered,
    removedPlayers: removed,
    reductionPercentage: percentage,
  };
}

/**
 * Phase 2W: Calculate option coverage diagnostics
 * Shows raw vs enriched option data to identify root cause of Option Types filter returning 0 players
 * @param {Array} allPlayers - Full player list
 * @param {Object} activeFilters - Current filter state
 * @returns {Object} Option coverage diagnostics
 */
function getOptionCoverageDiagnostics(allPlayers, activeFilters) {
  const salaryYear = activeFilters?.salaryYear || 2025;
  const optionYear = activeFilters?.optionYear ?? salaryYear; // Phase 2X: use optionYear if set

  // Count raw option sources
  const rawOptionSources = {
    // currentContractView.options[] - flat array like ["PO"] or ["TO"]
    currentContractViewOptions: 0,
    // currentContractView.optionsByYear - Phase 2X SSOT (year-keyed map)
    currentContractViewOptionsByYear: 0,
    // contractsView.seasons[].optionType - LEGACY (doesn't exist in main doc)
    contractsViewSeasons: 0,
    // contracts subcollection - NOT AVAILABLE in main doc
    contractsSubcollection: 0,
  };

  // Count raw option values
  const rawOptionValues = {};

  // Count enriched optionByYear
  const enrichedStats = {
    withAnyOptionByYear: 0,
    withOptionForSalaryYear: 0,
    withOptionForOptionYear: 0,
    optionByYearValues: {},
  };

  // Sample players for debugging
  const rawSamples = [];
  const enrichedSamples = [];

  for (const player of allPlayers || []) {
    // Check raw source 1: currentContractView.options[] (legacy flat array)
    const rawOptions = player.currentContractView?.options || [];
    if (rawOptions.length > 0) {
      rawOptionSources.currentContractViewOptions++;
      for (const opt of rawOptions) {
        const val = typeof opt === 'string' ? opt : JSON.stringify(opt);
        rawOptionValues[val] = (rawOptionValues[val] || 0) + 1;
      }
    }

    // Check raw source 2: currentContractView.optionsByYear (Phase 2X SSOT)
    const rawOptionsByYear = player.currentContractView?.optionsByYear;
    if (rawOptionsByYear && Object.keys(rawOptionsByYear).length > 0) {
      rawOptionSources.currentContractViewOptionsByYear++;
      if (rawSamples.length < 10) {
        rawSamples.push({
          id: player.id,
          name: player.name || player.bio?.displayName || 'Unknown',
          source: 'currentContractView.optionsByYear',
          value: rawOptionsByYear,
        });
      }
    }

    // Check raw source 3: contractsView.seasons (legacy - doesn't exist in main doc)
    if (player.contractsView?.seasons?.length > 0) {
      rawOptionSources.contractsViewSeasons++;
    }

    // Check enriched: optionByYear
    const optionByYear = player.optionByYear || {};
    const optionYearKeys = Object.keys(optionByYear);
    if (optionYearKeys.length > 0) {
      enrichedStats.withAnyOptionByYear++;
      if (enrichedSamples.length < 10) {
        enrichedSamples.push({
          id: player.id,
          name: player.name || player.bio?.displayName || 'Unknown',
          optionByYear,
        });
      }
    }

    // Check if option exists for the active salary year
    const optionForSalaryYear = optionByYear[salaryYear];
    if (optionForSalaryYear) {
      enrichedStats.withOptionForSalaryYear++;
    }

    // Check if option exists for the active option year (Phase 2X)
    const optionForYear = optionByYear[optionYear];
    if (optionForYear) {
      enrichedStats.withOptionForSalaryYear++;
      enrichedStats.optionByYearValues[optionForYear] =
        (enrichedStats.optionByYearValues[optionForYear] || 0) + 1;
    }
  }

  // Determine root cause
  let rootCause = 'UNKNOWN';
  let diagnosis = '';

  if (rawOptionSources.currentContractViewOptions === 0) {
    rootCause = 'NO_RAW_DATA';
    diagnosis =
      'No option data exists in currentContractView.options[] - upstream scraper needs update';
  } else if (enrichedStats.withAnyOptionByYear === 0) {
    rootCause = 'ENRICHMENT_BUG';
    diagnosis =
      'Raw options exist but optionByYear is empty - enrichPlayerData not mapping year→option';
  } else if (enrichedStats.withOptionForSalaryYear === 0) {
    rootCause = 'YEAR_MISMATCH';
    diagnosis = `optionByYear has data but not for salaryYear=${salaryYear} - filter may need different year`;
  } else {
    rootCause = 'FILTER_BUG';
    diagnosis =
      'Data exists and enriched correctly - check filter predicate logic';
  }

  return {
    salaryYear,
    totalPlayers: allPlayers?.length || 0,
    rawOptionSources,
    rawOptionValues,
    rawSamples,
    enrichedStats,
    enrichedSamples,
    rootCause,
    diagnosis,
    // Schema note for developer
    schemaNote:
      'IMPORTANT: enrichPlayerData expects contractsView.seasons[].optionType but this field does NOT EXIST in current schema. Option year mapping ONLY exists in contracts subcollection which is NOT fetched by useSimplePlayerData.',
  };
}

/**
 * Dev diagnostics hook for filter debugging
 *
 * @param {Array} allPlayers - Full player list before filtering
 * @param {Array} filteredPlayers - Players after filtering
 * @param {Object} activeFilters - Current filter state object
 * @returns {Object|null} - Diagnostics object or null if debug mode off
 */
export function useFilterDiagnostics(
  allPlayers,
  filteredPlayers,
  activeFilters
) {
  const isEnabled = isDebugModeEnabled();

  return useMemo(() => {
    if (!isEnabled) return null;

    const activeFiltersList = getActiveFiltersList(activeFilters || {});
    const catalogEntries = getCatalogEntriesForActive(activeFiltersList);
    const reductionStats = getReductionStats(allPlayers, filteredPlayers);

    // Find any active filters not in catalog (potential issues)
    const uncatalogedFilters = catalogEntries.filter((e) => !e.inCatalog);

    // Get catalog coverage stats
    const totalCatalogEntries = PLAYER_FILTER_CATALOG.length;
    const wiredEntries = PLAYER_FILTER_CATALOG.filter(
      (e) => e.status === 'WIRED'
    ).length;
    const stubEntries = PLAYER_FILTER_CATALOG.filter(
      (e) => e.status === 'STUB'
    ).length;
    const deprecatedEntries = PLAYER_FILTER_CATALOG.filter(
      (e) => e.status === 'DEPRECATED'
    ).length;

    return {
      enabled: true,
      timestamp: new Date().toISOString(),

      // Active filter details
      activeFilters: catalogEntries,
      activeFilterCount: activeFiltersList.length,

      // Warnings
      uncatalogedFilters,
      hasUncatalogedFilters: uncatalogedFilters.length > 0,

      // Reduction stats
      reduction: reductionStats,

      // Catalog coverage
      catalog: {
        total: totalCatalogEntries,
        wired: wiredEntries,
        stub: stubEntries,
        deprecated: deprecatedEntries,
        coveragePercentage: Math.round(
          (wiredEntries / totalCatalogEntries) * 100
        ),
      },

      // Phase 2W: Option coverage diagnostics
      optionCoverage: getOptionCoverageDiagnostics(allPlayers, activeFilters),
    };
  }, [isEnabled, allPlayers, filteredPlayers, activeFilters]);
}

export default useFilterDiagnostics;
