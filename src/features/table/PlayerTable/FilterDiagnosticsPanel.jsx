/**
 * @file FilterDiagnosticsPanel.jsx
 * @description Phase 2S Dev Diagnostics Panel
 *
 * Collapsible overlay panel that displays filter diagnostics.
 * Only renders when ?debugFilters=1 query param is present.
 *
 * USAGE:
 *   <FilterDiagnosticsPanel diagnostics={diagnosticsFromHook} />
 */

import React, { useState } from 'react';

/**
 * Format a filter value for display
 * @param {any} value
 * @returns {string}
 */
function formatValue(value) {
  if (Array.isArray(value)) {
    return value.length > 3
      ? `[${value.slice(0, 3).join(', ')}...+${value.length - 3}]`
      : `[${value.join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const colors = {
    WIRED: 'bg-green-600 text-white',
    STUB: 'bg-yellow-500 text-black',
    DEPRECATED: 'bg-red-600 text-white',
    UNKNOWN: 'bg-gray-500 text-white',
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-mono rounded ${colors[status] || colors.UNKNOWN}`}
    >
      {status}
    </span>
  );
}

/**
 * Phase 2W: Option Coverage Diagnostics Section
 * Shows raw vs enriched option data for debugging Option Types filter
 */
function OptionCoverageSection({ optionCoverage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!optionCoverage) return null;

  const {
    salaryYear,
    totalPlayers,
    rawOptionSources,
    rawOptionValues,
    rawSamples,
    enrichedStats,
    rootCause,
    diagnosis,
  } = optionCoverage;

  const rootCauseColors = {
    NO_RAW_DATA: 'text-red-400',
    ENRICHMENT_BUG: 'text-orange-400',
    YEAR_MISMATCH: 'text-yellow-400',
    FILTER_BUG: 'text-blue-400',
    UNKNOWN: 'text-gray-400',
  };

  return (
    <div className="p-2 bg-purple-900/30 border border-purple-700 rounded">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-purple-300 font-semibold text-xs">
          📊 Option Coverage (Phase 2W)
        </div>
        <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* Always visible summary */}
      <div className="mt-2 text-xs">
        <div
          className={`font-bold ${rootCauseColors[rootCause] || 'text-gray-400'}`}
        >
          Root Cause: {rootCause}
        </div>
        <div className="text-gray-300 mt-1">{diagnosis}</div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2 text-xs">
          {/* Raw Sources */}
          <div className="p-2 bg-gray-800 rounded">
            <div className="text-gray-400 mb-1">
              Raw Option Sources (in main doc)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>currentContractView.options[]:</span>
                <span
                  className={
                    rawOptionSources.currentContractViewOptions > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {rawOptionSources.currentContractViewOptions} players
                </span>
              </div>
              <div className="flex justify-between">
                <span>contractsView.seasons[]:</span>
                <span
                  className={
                    rawOptionSources.contractsViewSeasons > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {rawOptionSources.contractsViewSeasons} (expected 0 - schema
                  mismatch)
                </span>
              </div>
            </div>
            {Object.keys(rawOptionValues).length > 0 && (
              <div className="mt-2 text-gray-400">
                Raw values:{' '}
                {Object.entries(rawOptionValues)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(', ')}
              </div>
            )}
          </div>

          {/* Enriched Stats */}
          <div className="p-2 bg-gray-800 rounded">
            <div className="text-gray-400 mb-1">
              Enriched optionByYear (after enrichPlayerData)
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Players with any optionByYear:</span>
                <span
                  className={
                    enrichedStats.withAnyOptionByYear > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {enrichedStats.withAnyOptionByYear}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Players with option for {salaryYear}:</span>
                <span
                  className={
                    enrichedStats.withOptionForSalaryYear > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {enrichedStats.withOptionForSalaryYear}
                </span>
              </div>
            </div>
            {Object.keys(enrichedStats.optionByYearValues).length > 0 && (
              <div className="mt-2 text-gray-400">
                Values for {salaryYear}:{' '}
                {Object.entries(enrichedStats.optionByYearValues)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(', ')}
              </div>
            )}
          </div>

          {/* Sample Players */}
          {rawSamples.length > 0 && (
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-400 mb-1">
                Sample Players with Raw Options
              </div>
              {rawSamples.slice(0, 5).map((s, i) => (
                <div key={i} className="text-gray-300">
                  {s.name}: {JSON.stringify(s.value)}
                </div>
              ))}
            </div>
          )}

          {/* Schema Note */}
          <div className="p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300">
            <strong>⚠️ Schema Note:</strong> enrichPlayerData expects
            contractsView.seasons[].optionType but this field does NOT exist.
            Option year mapping is ONLY in contracts subcollection (not fetched
            by useSimplePlayerData).
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filter Diagnostics Panel Component
 *
 * @param {Object} props
 * @param {Object|null} props.diagnostics - Diagnostics object from useFilterDiagnostics hook
 */
export function FilterDiagnosticsPanel({ diagnostics }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't render if diagnostics is null (debug mode off)
  if (!diagnostics) return null;

  const {
    activeFilters,
    activeFilterCount,
    uncatalogedFilters,
    hasUncatalogedFilters,
    reduction,
    catalog,
  } = diagnostics;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[60vh] overflow-hidden rounded-lg shadow-2xl border border-gray-700 bg-gray-900 text-gray-100 text-sm font-mono">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">🔧</span>
          <span className="font-semibold">Filter Diagnostics</span>
          {hasUncatalogedFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-red-600 rounded">!</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">
            {activeFilterCount} active
          </span>
          <span className="text-gray-500">{isExpanded ? '▼' : '▲'}</span>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="overflow-y-auto max-h-[50vh] p-3 space-y-3">
          {/* Reduction Stats */}
          <div className="p-2 bg-gray-800 rounded">
            <div className="text-xs text-gray-400 mb-1">Reduction</div>
            <div className="flex justify-between">
              <span>{reduction.totalPlayers} total</span>
              <span className="text-green-400">
                → {reduction.filteredPlayers} shown
              </span>
              <span className="text-red-400">
                -{reduction.removedPlayers} ({reduction.reductionPercentage}%)
              </span>
            </div>
          </div>

          {/* Active Filters */}
          <div>
            <div className="text-xs text-gray-400 mb-1">
              Active Filters ({activeFilterCount})
            </div>
            {activeFilterCount === 0 ? (
              <div className="text-gray-500 italic">No active filters</div>
            ) : (
              <div className="space-y-1">
                {activeFilters.map((filter, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded ${filter.inCatalog ? 'bg-gray-800' : 'bg-red-900/30 border border-red-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-blue-300">{filter.key}</span>
                      <StatusBadge status={filter.status} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Value:{' '}
                      <span className="text-white">
                        {formatValue(filter.value)}
                      </span>
                    </div>
                    {filter.catalogEntry?.playerField && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Field: {filter.catalogEntry.playerField}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Uncataloged Warning */}
          {hasUncatalogedFilters && (
            <div className="p-2 bg-red-900/30 border border-red-700 rounded">
              <div className="text-red-400 font-semibold text-xs mb-1">
                ⚠️ Uncataloged Filters Detected
              </div>
              <div className="text-xs text-gray-300">
                {uncatalogedFilters.map((f) => f.key).join(', ')}
              </div>
            </div>
          )}

          {/* Catalog Coverage */}
          <div className="p-2 bg-gray-800 rounded">
            <div className="text-xs text-gray-400 mb-1">Catalog Coverage</div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-lg font-bold text-white">
                  {catalog.total}
                </div>
                <div className="text-gray-500">Total</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">
                  {catalog.wired}
                </div>
                <div className="text-gray-500">Wired</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-400">
                  {catalog.stub}
                </div>
                <div className="text-gray-500">Stub</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-400">
                  {catalog.deprecated}
                </div>
                <div className="text-gray-500">Deprecated</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{ width: `${catalog.coveragePercentage}%` }}
              />
            </div>
            <div className="text-center text-xs text-gray-400 mt-1">
              {catalog.coveragePercentage}% wired
            </div>
          </div>

          {/* Phase 2W: Option Coverage Diagnostics */}
          {diagnostics.optionCoverage && (
            <OptionCoverageSection
              optionCoverage={diagnostics.optionCoverage}
            />
          )}

          {/* Debug Hint */}
          <div className="text-xs text-gray-500 text-center">
            Remove ?debugFilters=1 to hide this panel
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterDiagnosticsPanel;
