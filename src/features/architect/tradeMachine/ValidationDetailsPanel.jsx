// src/features/architect/tradeMachine/ValidationDetailsPanel.jsx
// Purpose: Collapsible panel that hard-gates validation details behind validation state
// Ownership: Trade Machine Team
// History:
//   - Jan 2026: Created for UX clarity (Tasks B, C, D from UX/Mode Legend requirement)

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ModeTag } from './ValidationStateHeader';
import TradeSummaryPanel from './TradeSummaryPanel';
import TradeLegalChecker from './TradeLegalChecker';
import TradeExceptionDashboard from './TradeExceptionDashboard';
import FaExceptionTracker from './FaExceptionTracker';
import TradeSalaryCalculator from './TradeSalaryCalculator';
import { TradeReceiptPanel } from './TradeReceiptPanel';
import { getOfficialSalaryMatchingSnapshot } from './utils/getOfficialSalaryMatchingSnapshot';

/**
 * SectionHeader renders a labeled header with mode tag for each details section.
 */
const SectionHeader = ({ title, mode, children }) => (
  <div className="border-b border-white/10 pb-2 mb-3">
    <div className="flex items-center gap-2 mb-1">
      <h4 className="font-medium text-sm text-white/90">{title}</h4>
      <ModeTag mode={mode} />
    </div>
    {children && <div className="text-xs text-white/50">{children}</div>}
  </div>
);

/**
 * NotValidatedCallout - Shows when user tries to view details before validation
 */
const NotValidatedCallout = () => (
  <div
    className="p-4 bg-amber-900/20 border border-amber-600/30 rounded-lg text-center"
    data-testid="not-validated-callout"
  >
    <div className="text-amber-300 font-medium mb-1">
      No Validation Results Available
    </div>
    <div className="text-sm text-amber-200/70">
      Run <span className="font-semibold">Validate Trade</span> to generate official results.
    </div>
  </div>
);

/**
 * ValidationDetailsPanel - Hard-gated collapsible panel for all validation details.
 * 
 * Per Task B: Renamed from "Show Validation Results" to "Show Validation Details"
 * Per Task C: Sections ordered as:
 *   1. Validation Summary (Official)
 *   2. Rule Compliance Overview (Official)
 *   3. Trade Exception Analysis (Official)
 *   4. Salary Calculator (Exploratory)
 *   5. Trade Receipt (Debug)
 */
const ValidationDetailsPanel = ({
  // Validation state
  hasValidatorResult = false,
  isValidating = false,
  // Data
  result = null,
  teams = [],
  forceTrade = false,
  // Calculator props
  calculatorTeamIndex = 0,
  incomingAssets = [],
  salaryOut = [],
  capProjections = null,
  yearKey = null,
  // Calculator team selector
  onCalculatorTeamChange = null,
  // Phase 12.3B: Pre-fetched pick rules for structured derivation
  pickRulesById = {},
}) => {
  // Separate expand states for each panel
  const [productionExpanded, setProductionExpanded] = useState(false);
  const [devToolsExpanded, setDevToolsExpanded] = useState(false);

  // Memoize team options for calculator selector
  const teamOptions = useMemo(() => 
    teams.reduce((acc, t, idx) => {
      if (t.team) {
        acc.push({
          idx,
          label: t.team.nickname || t.team.teamName || `Team ${idx + 1}`,
        });
      }
      return acc;
    }, []),
    [teams]
  );
  
  const hasMultipleTeams = teamOptions.length > 1;

  // Get calculator team data
  const selectedTeam = teams[calculatorTeamIndex];
  const teamResult = result?.teamResults?.[calculatorTeamIndex];
  const officialSnapshot = getOfficialSalaryMatchingSnapshot(teamResult);

  return (
    <div className="mt-6 space-y-4" data-testid="validation-details-panel">
      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL 1: VALIDATION RESULTS - Official validator outputs
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-white/10 rounded-lg overflow-hidden bg-[#111]">
        <button
          type="button"
          onClick={() => setProductionExpanded(!productionExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#111] hover:bg-[#1a1a1a] text-sm font-medium text-white/80 transition-colors"
          aria-expanded={productionExpanded}
          aria-controls="validation-results-content"
        >
          <span className="flex items-center gap-2">
            <span>📋</span>
            <span>Validation Results</span>
            {hasValidatorResult && (
              <span className="text-xs text-green-400">✓ Results available</span>
            )}
          </span>
          {productionExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {productionExpanded && (
          <div id="validation-results-content" className="p-4 border-t border-white/10">
            {!hasValidatorResult ? (
              <NotValidatedCallout />
            ) : (
              <div className="space-y-6">
                {/* Section 1: Validation Summary (Official) */}
                <section data-testid="section-validation-summary">
                  <SectionHeader title="Validation Summary" mode="OFFICIAL">
                    Per-team matching status and trade legality
                  </SectionHeader>
                  <TradeSummaryPanel
                    result={result}
                    teams={teams}
                    forceTrade={forceTrade}
                    isValidating={isValidating}
                    pickRulesById={pickRulesById}
                  />
                </section>

                {/* Section 2: Rule Compliance Overview (Official) */}
                {result?.teamResults && (
                  <section data-testid="section-rule-compliance">
                    <SectionHeader title="Rule Compliance Overview" mode="OFFICIAL">
                      CBA rule pass/fail status per team
                    </SectionHeader>
                    <TradeLegalChecker
                      teamResults={result.teamResults}
                      capSettings={result.capSettings}
                    />
                  </section>
                )}

                {/* Section 3: Trade Exception Analysis (Official) */}
                <section data-testid="section-exception-analysis">
                  <SectionHeader title="Trade Exception Analysis" mode="OFFICIAL">
                    TPE creation, usage, FA exceptions, and existing exceptions
                  </SectionHeader>
                  <div className="space-y-4">
                    <TradeExceptionDashboard result={result} teams={teams} />
                    <FaExceptionTracker result={result} teams={teams} />
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          PANEL 2: DEVELOPMENT TOOLS - Exploratory & Debug sections
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-amber-500/30 rounded-lg overflow-hidden bg-[#111]">
        <button
          type="button"
          onClick={() => setDevToolsExpanded(!devToolsExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0d0906] hover:bg-[#1a1408] text-sm font-medium text-amber-300/70 transition-colors"
          aria-expanded={devToolsExpanded}
          aria-controls="dev-tools-content"
        >
          <span className="flex items-center gap-2">
            <span>🛠️</span>
            <span>Development Tools</span>
            <span className="text-[10px] text-amber-400/50 italic ml-1">
              testing & debug
            </span>
          </span>
          {devToolsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {devToolsExpanded && (
          <div id="dev-tools-content" className="p-4 border-t border-amber-500/20">
            {!hasValidatorResult ? (
              <NotValidatedCallout />
            ) : (
              <div className="space-y-6">
                {/* Section 4: Salary Calculator (Exploratory) */}
                {selectedTeam?.team && (
                  <section data-testid="section-salary-calculator">
                    <SectionHeader title="Salary Calculator" mode="EXPLORATORY">
                      Sandbox for testing salary matching scenarios (validator is authoritative)
                    </SectionHeader>
                    
                    {/* Team selector for calculator - uses memoized teamOptions */}
                    {hasMultipleTeams && (
                      <div className="mb-3">
                        <select
                          value={calculatorTeamIndex}
                          onChange={(e) => onCalculatorTeamChange?.(Number(e.target.value))}
                          className="bg-[#222] border border-white/20 rounded px-2 py-1 text-xs"
                        >
                          {teamOptions.map(item => (
                            <option key={item.idx} value={item.idx}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <TradeSalaryCalculator
                      teamSalary={selectedTeam.team?.teamTotalSalary || selectedTeam.team?.totalSalary || 0}
                      outgoingSalary={salaryOut[calculatorTeamIndex] || 0}
                      incomingPlayers={incomingAssets[calculatorTeamIndex]?.players || []}
                      tpes={selectedTeam.team?.tradeExceptions || []}
                      capSettings={result?.capSettings || capProjections}
                      yearKey={yearKey}
                      validatorAllowableIncoming={officialSnapshot.allowableIncoming}
                      validatorRule={officialSnapshot.ruleApplied}
                      hasValidatorResult={officialSnapshot.hasValidator}
                      validatorSkipReason={officialSnapshot.skipReason}
                    />
                  </section>
                )}

                {/* Section 5: Trade Receipt (Debug) */}
                <section data-testid="section-trade-receipt">
                  <SectionHeader title="Trade Receipt" mode="DEBUG">
                    Developer diagnostic data — not required reading
                  </SectionHeader>
                  <TradeReceiptPanel
                    receipt={result?.tradeReceipt}
                    pickRulesById={pickRulesById}
                  />
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationDetailsPanel;
