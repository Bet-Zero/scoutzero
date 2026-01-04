// src/features/architect/tradeMachine/TradeSummaryPanel.jsx
// Purpose: keep your top status & rule explanations, revamp Team Summaries into branded cards,
// and move deep references into a collapsible section.

import React from 'react';
import {
  formatCurrency,
  getAdjustmentTooltipLabel,
  formatSwapInfo,
  // getSalaryForYear,
} from '@/features/architect/utils/tradeHelpers';
// import { HelpCircle } from 'lucide-react';
import { getTeamColors } from '@/shared/utils/formatting';
import TeamLogo from '@/shared/components/TeamLogo';
// CANONICAL SELECTOR: Single source of truth for salary matching values
import { getOfficialSalaryMatchingSnapshot } from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';

/**
 * Helper used for pick chip text
 * Uses shared formatSwapInfo utility for swap display consistency.
 */
const getPickLabel = (p) => {
  if (!p) return '';
  let label = `${p.year} ${p.round} Round`;
  if (p.via) label += ` (via ${p.via})`;
  if (p.protection) label += ` 🛡 ${p.protection}`;
  if (p.isSwap) {
    label += ` 🔄 ${formatSwapInfo(p)}`;
  }
  return label;
};

function TradeSummaryPanel({
  result,
  teams = [],
  forceTrade = false,
  showRuleExplanations = true,
  // P0-3: Validation in-flight state for loading indicators
  isValidating = false,
}) {
  if (!result) return null;

  // Top status banner text
  const topStatus = forceTrade
    ? '⚠️ Trade Forced – Not CBA Legal'
    : result.legal
      ? '✅ Trade is CBA Legal'
      : '❌ Trade is NOT CBA Legal';

  return (
    <div className="mt-6 text-sm border-t border-white/10 pt-4 space-y-6">
      {/* Top Status Message */}
      <div>
        <strong className="text-base">{topStatus}</strong>
        {!result.legal && !forceTrade && (
          <div className="text-xs text-white/60 mt-1">
            Fix the issues below or toggle Force Trade to proceed (for sandbox
            testing).
          </div>
        )}
      </div>

      {/* Rule Explanations (surface-level) */}
      {showRuleExplanations && result?.failures?.length > 0 && (
        <div className="bg-[#121212] border border-red-500/30 rounded p-3">
          <div className="font-semibold mb-2">Why it fails</div>
          <ul className="list-disc list-inside space-y-1">
            {result.failures.map((f, idx) => (
              <li key={idx} className="text-red-300">
                {f.message || f.reason || String(f)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Team Summaries — revamped to cards with logo/color + rows */}
      <div className="grid md:grid-cols-2 gap-4">
        {result.summaryByTeamIndex?.map((t, i) => {
          if (!t) return null;

          const teamResult = result.teamResults?.[i];
          const isIllegal = teamResult ? !teamResult.legal : false;

          const teamMeta =
            teams.find((te) => te.teamName === t.teamName) ||
            teams.find((te) => te.id === t.teamId) ||
            null;
          const colors = teamMeta ? getTeamColors(teamMeta.id) : null;
          const primary = colors?.primary;

          // Derive incoming assets (players/picks) if present on result
          const incomingPlayers = teamResult?.incomingPlayers || [];
          const incomingPicks = teamResult?.picksIn || t.picksIn || [];

          return (
            <div
              key={t.teamName || teamMeta?.id || i}
              className={`border rounded bg-[#111] overflow-hidden ${
                isIllegal ? 'border-red-500' : 'border-white/10'
              }`}
            >
              {/* color accent bar */}
              <div
                className="h-1.5"
                style={primary ? { backgroundColor: primary } : undefined}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {teamMeta && (
                      <TeamLogo teamId={teamMeta.id} className="w-6 h-6" />
                    )}
                    <h4 className="font-semibold">{t.teamName}</h4>
                  </div>
                  {isIllegal && (
                    <span className="text-xs text-red-400 font-semibold">
                      ❌ Rejected
                    </span>
                  )}
                </div>

                {/* Salary snapshot */}
                {teamResult &&
                  (() => {
                    // CANONICAL SOURCE: Use getOfficialSalaryMatchingSnapshot for all salary matching values
                    // Per MASTER_TRADE_MACHINE_ALIGNMENT.md Invariant 1: Single Source per Concept
                    const officialSnapshot = getOfficialSalaryMatchingSnapshot(teamResult);
                    
                    // Incoming salary from official selector
                    const salaryIn = officialSnapshot.salaryIn ?? 0;
                    // Allowable incoming from official selector (null means N/A)
                    const allowedIncoming = officialSnapshot.allowableIncoming;
                    const skipReason = officialSnapshot.skipReason;

                    // Tri-state display: only show allowed as number when present (not null)
                    const showAllowed = allowedIncoming != null;
                    const formattedAllowed = showAllowed
                      ? formatCurrency(allowedIncoming)
                      : '—';

                    // Only compute overBy when salary matching is applicable
                    const overBy = showAllowed
                      ? Math.max(0, salaryIn - allowedIncoming)
                      : null;

                    return (
                      <p className="text-xs text-white/70">
                        {/* Phase 2.3: These are MATCHING values for trade legality */}
                        {/* P0-3: Show loading state during validation in-flight */}
                        Matching In / Allowed:{' '}
                        {isValidating ? (
                          <span className="text-blue-400 animate-pulse">Updating…</span>
                        ) : (
                          <>
                            {formatCurrency(salaryIn)} / {formattedAllowed}
                            {skipReason && (
                              <span className="text-white/40 ml-1">
                                ({skipReason})
                              </span>
                            )}
                            {overBy != null && overBy > 0 && (
                              <> — Over by {formatCurrency(overBy)}</>
                            )}
                          </>
                        )}
                      </p>
                    );
                  })()}

                {/* Assets in */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/60 mb-1">
                      Players Received
                    </div>
                    {incomingPlayers.length ? (
                      <div className="space-y-1">
                        {incomingPlayers.map((p) => {
                          // Phase 2.4: Check if matching differs from base
                          const baseSalary = p.baseSalary ?? p.salary ?? 0;
                          const matchingValue =
                            p.matchIncoming ?? p.matchingValue ?? baseSalary;
                          const hasAdjustment =
                            Math.abs(matchingValue - baseSalary) > 1;

                          // P1: Use shared utility for adjustment type detection
                          const adjustmentLabel = getAdjustmentTooltipLabel(p);
                          const tooltipText = `${adjustmentLabel}: Base ${formatCurrency(baseSalary)} → Match ${formatCurrency(matchingValue)}`;

                          return (
                            <div
                              key={p.player_id || p.id}
                              className="flex items-center justify-between bg-white/5 px-2 py-1 rounded"
                            >
                              <div className="flex items-center gap-1 truncate">
                                {p.name || p.fullName}
                                {/* P1: Adjusted indicator with specific tooltip when matching != base */}
                                {hasAdjustment && (
                                  <span
                                    className="px-1 py-0.5 text-[9px] bg-purple-600/30 text-purple-300 rounded leading-none"
                                    title={tooltipText}
                                  >
                                    Adj
                                  </span>
                                )}
                              </div>
                              <div className="text-white/50 text-xs">
                                {/* Phase 2.3: Show base salary; matching values labeled elsewhere */}
                                {baseSalary ? formatCurrency(baseSalary) : '—'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 italic">None</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-white/60 mb-1">
                      Picks Received
                    </div>
                    {incomingPicks.length ? (
                      <div className="space-y-1">
                        {incomingPicks.map((pk, idx2) => (
                          <div
                            key={`${pk?.year || 'y'}-${pk?.round || 'r'}-${idx2}`}
                            className="flex items-center justify-between bg-white/5 px-2 py-1 rounded"
                          >
                            <div className="truncate">{getPickLabel(pk)}</div>
                            <div className="text-white/50">
                              {pk?.toTeamId ? 'Incoming' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 italic">None</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TradeSummaryPanel;
