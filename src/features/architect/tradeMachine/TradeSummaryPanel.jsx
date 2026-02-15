// src/features/architect/tradeMachine/TradeSummaryPanel.jsx
// Purpose: keep your top status & rule explanations, revamp Team Summaries into branded cards,
// and move deep references into a collapsible section.

import React from 'react';
import {
  formatCurrency,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
// import { HelpCircle } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { getTeamColors } from '@/shared/utils/formatting';
import TeamLogo from '@/shared/components/TeamLogo';
// CANONICAL SELECTOR: Single source of truth for salary matching values
import { getOfficialSalaryMatchingSnapshot } from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';
// Phase 11.2: Entitlement warnings helper
import {
  computeEntitlementWarnings,
  getEntitlementKindBadge,
} from '@/features/architect/tradeMachine/utils/entitlementWarnings';
// Phase 12.3C: PickRow projection for protection/condition visibility
import {
  projectEntitlementToPickRow,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
// TM_DATAWARN_UI_E1: Data warnings display
import DataWarningsSection from './DataWarningsSection';

function TradeSummaryPanel({
  result,
  teams = [],
  forceTrade = false,
  showRuleExplanations = true,
  // P0-3: Validation in-flight state for loading indicators
  isValidating = false,
  // Phase 12.3B: Pre-fetched pick rules for structured derivation
  pickRulesById = {},
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

      {/* TM_DATAWARN_UI_E1: Data Quality Warnings */}
      <DataWarningsSection
        warnings={result.dataWarnings}
        summary={result.dataValidationSummary}
        hasDataIssues={result.hasDataIssues}
      />

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

          // Derive incoming assets (players) if present on result
          const incomingPlayers = teamResult?.incomingPlayers || [];

          // Phase 11.2: Find matching team slot to get entitlementsOut
          const teamSlot = teams.find(
            (ts) =>
              ts.team?.id === t.teamId ||
              ts.team?.id === teamMeta?.id ||
              ts.team?.teamName === t.teamName
          );
          const entitlementsOut = teamSlot?.entitlementsOut || [];

          // Phase 15: Derive incoming entitlements from OTHER teams' outgoing
          const thisTeamId = t.teamId || teamMeta?.id;
          const incomingEntitlements = teams
            .filter((ts) => ts.team?.id !== thisTeamId)
            .flatMap((ts) => ts.entitlementsOut || [])
            .filter((e) => !e.toTeamId || e.toTeamId === thisTeamId);

          // Phase 11.2: Compute non-blocking warnings
          const entitlementWarnings =
            computeEntitlementWarnings(entitlementsOut);

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
                    const officialSnapshot =
                      getOfficialSalaryMatchingSnapshot(teamResult);

                    // Incoming salary from official selector
                    const salaryIn = officialSnapshot.salaryIn ?? 0;

                    // TM_FIX_A2_E1: Use effectiveAllowableIncoming when available
                    // This is min(salaryMatchCeiling, hardCapIncomingCeiling) for hard-capped teams
                    const effectiveAllowed =
                      officialSnapshot.effectiveAllowableIncoming;
                    const salaryMatchCeiling =
                      officialSnapshot.allowableIncoming;
                    const hardCapCeiling =
                      officialSnapshot.hardCapIncomingCeiling;
                    const hardCapDetails =
                      officialSnapshot.hardCapCeilingDetails;
                    const isHardCapped = officialSnapshot.isHardCapped;
                    const skipReason = officialSnapshot.skipReason;

                    // Use effective allowable or fall back to salary match ceiling
                    const allowedIncoming =
                      effectiveAllowed ?? salaryMatchCeiling;

                    // Tri-state display: only show allowed as number when present (not null)
                    const showAllowed = allowedIncoming != null;
                    const formattedAllowed = showAllowed
                      ? formatCurrency(allowedIncoming)
                      : '—';

                    // Only compute overBy when salary matching is applicable
                    const overBy = showAllowed
                      ? Math.max(0, salaryIn - allowedIncoming)
                      : null;

                    // Determine if hard cap is the limiter
                    const hardCapIsLimiter =
                      isHardCapped && hardCapDetails?.limiter === 'hardCap';

                    return (
                      <div className="text-xs text-white/70 space-y-1">
                        {/* Phase 2.3: These are MATCHING values for trade legality */}
                        {/* P0-3: Show loading state during validation in-flight */}
                        <p>
                          Matching In / Allowed:{' '}
                          {isValidating ? (
                            <span className="text-blue-400 animate-pulse">
                              Updating…
                            </span>
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

                        {/* TM_FIX_A2_E1: Show ceiling breakdown when hard-capped */}
                        {isHardCapped && !isValidating && showAllowed && (
                          <div className="pl-2 border-l border-white/20 text-[10px] text-white/50 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Salary Match Ceiling:</span>
                              <span>
                                {salaryMatchCeiling != null
                                  ? formatCurrency(salaryMatchCeiling)
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>
                                Hard Cap Ceiling (
                                {hardCapDetails?.apronLabel || 'Apron'}):
                              </span>
                              <span
                                className={
                                  hardCapIsLimiter ? 'text-yellow-400' : ''
                                }
                              >
                                {hardCapCeiling != null
                                  ? formatCurrency(hardCapCeiling)
                                  : '—'}
                                {hardCapIsLimiter && ' ←'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
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

                  {/* Phase 15: Entitlements Received (from other teams) */}
                  <div>
                    <div className="text-xs text-white/60 mb-1">
                      Entitlements Received
                    </div>
                    {incomingEntitlements.length ? (
                      <div className="space-y-1">
                        {incomingEntitlements.map((ent, idx2) => {
                          const badge = getEntitlementKindBadge(ent.kind);
                          const pickRow = projectEntitlementToPickRow(ent, {
                            teamCode: teamMeta?.id,
                            pickRulesById,
                          });
                          const secondaryText =
                            getPickRowSecondaryText(pickRow);
                          return (
                            <div
                              key={ent.id || ent.entitlementId || idx2}
                              className="flex flex-col bg-white/5 px-2 py-1 rounded"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-white/90">
                                    {ent.seasonYear} R{ent.round}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.colorClass}`}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                              </div>
                              {secondaryText && (
                                <div
                                  className="text-white/40 text-[10px] mt-0.5 truncate"
                                  title={secondaryText}
                                >
                                  {secondaryText}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 italic">None</div>
                    )}
                  </div>
                </div>

                {/* Phase 11.2: Entitlements Traded (outgoing) */}
                <div>
                  <div className="text-xs text-white/60 mb-1">
                    Entitlements Traded
                  </div>
                  {entitlementsOut.length > 0 ? (
                    <div className="space-y-1">
                      {entitlementsOut.map((ent, idx3) => {
                        const badge = getEntitlementKindBadge(ent.kind);
                        // Phase 12.3C: Project entitlement for protection/condition visibility
                        // Phase 12.3B: Pass pickRulesById for structured rule-aware derivation
                        const pickRow = projectEntitlementToPickRow(ent, {
                          teamCode: teamMeta?.id,
                          pickRulesById,
                        });
                        const secondaryText = getPickRowSecondaryText(pickRow);
                        return (
                          <div
                            key={ent.id || ent.entitlementId || idx3}
                            className="flex flex-col bg-white/5 px-2 py-1.5 rounded text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-white/90">
                                  {ent.seasonYear} R{ent.round}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.colorClass}`}
                                >
                                  {badge.label}
                                </span>
                              </div>
                              <div
                                className="text-white/50 text-[10px] truncate max-w-[120px]"
                                title={ent.description}
                              >
                                {ent.description?.slice(0, 25) || ''}
                                {ent.description?.length > 25 ? '…' : ''}
                              </div>
                            </div>
                            {/* Phase 12.3C: Protection/conditions text */}
                            {secondaryText && (
                              <div
                                className="text-white/40 text-[10px] mt-0.5 truncate"
                                title={secondaryText}
                              >
                                {secondaryText}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-white/40 italic">None</div>
                  )}

                  {/* Phase 11.2: Non-blocking entitlement warnings */}
                  {entitlementWarnings.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300">
                      <div className="flex items-center gap-1 mb-1 font-medium">
                        <AlertTriangle size={12} />
                        <span>Entitlement Warnings</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {entitlementWarnings.map((w, wIdx) => (
                          <li key={wIdx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
