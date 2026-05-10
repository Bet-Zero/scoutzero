/**
 * @file FilterDiagnosticsPanel.tsx
 * @description Phase 2S Dev Diagnostics Panel
 *
 * Collapsible overlay panel that displays filter diagnostics.
 * Only renders when ?debugFilters=1 query param is present.
 *
 * USAGE:
 *   <FilterDiagnosticsPanel diagnostics={diagnosticsFromHook} />
 */

import React, { useState } from 'react';
import type { FilterDiagnostics } from '@/features/table/hooks/useFilterDiagnostics';

/**
 * Format a filter value for display
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value: unknown): string {
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
function StatusBadge({
  status,
}: {
  status: FilterDiagnostics['activeFilters'][number]['status'];
}) {
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
function OptionCoverageSection({
  optionCoverage,
}: {
  optionCoverage: FilterDiagnostics['optionCoverage'] | null | undefined;
}) {
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
          className={`font-bold ${
            rootCauseColors[rootCause as keyof typeof rootCauseColors] ||
            'text-gray-400'
          }`}
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
              {/* Phase 2Y SSOT: optionsByYear */}
              <div className="flex justify-between">
                <span>currentContractView.optionsByYear:</span>
                <span
                  className={
                    rawOptionSources.currentContractViewOptionsByYear > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {rawOptionSources.currentContractViewOptionsByYear} players
                  {rawOptionSources.currentContractViewOptionsByYear === 0 && (
                    <span className="ml-1 text-yellow-500">(SSOT)</span>
                  )}
                </span>
              </div>
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
                  <span className="ml-1 text-gray-500">(legacy)</span>
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
                <span>Players with option for {String(salaryYear)}:</span>
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
                Values for {String(salaryYear)}:{' '}
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

          {/* Data Status Indicator - Phase 2Y */}
          {rawOptionSources.currentContractViewOptionsByYear === 0 &&
            enrichedStats.withAnyOptionByYear === 0 && (
              <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300">
                <strong>🚨 Data Not Backfilled:</strong> No players have
                currentContractView.optionsByYear set. Run the migration script:
                <code className="block mt-1 text-xs bg-gray-800 p-1 rounded">
                  node scripts/migrations/phase2y_backfill_optionsByYear.js
                  --write
                </code>
              </div>
            )}

          {/* Schema Note - Updated Phase 2Y */}
          <div className="p-2 bg-blue-900/30 border border-blue-700 rounded text-blue-300">
            <strong>ℹ️ Schema Note (Phase 2Y):</strong> Option data flows via
            currentContractView.optionsByYear (SSOT) → enrichPlayerData →
            optionByYear. The fallback reads from contracts subcollection
            salariesByYear[].option but this is NOT loaded by
            useSimplePlayerData. Backfill to main doc required.
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
export function FilterDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: FilterDiagnostics | null;
}) {
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
                    {(filter.catalogEntry?.playerFieldPaths?.length ?? 0) >
                      0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Field:{' '}
                        {filter.catalogEntry?.playerFieldPaths?.join(', ')}
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

