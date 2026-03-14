import React from 'react';
import {
  formatCurrency,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
import { AlertTriangle } from 'lucide-react';
import { getTeamColors } from '@/shared/utils/formatting';
import TeamLogo from '@/shared/components/TeamLogo';
import {
  getOfficialSalaryMatchingSnapshot,
  getDisplayAllowableIncoming,
} from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';
import {
  computeEntitlementWarnings,
  getEntitlementKindBadge,
} from '@/features/architect/tradeMachine/utils/entitlementWarnings';
import {
  projectEntitlementToPickRow,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
import {
  getValidationIssueText,
  normalizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';
import DataWarningsSection from './DataWarningsSection';
import type { TeamLike, ValidationResultLike } from './validationPresentationTypes';

interface TradeSummaryPanelProps {
  result?: ValidationResultLike | null;
  teams?: TeamLike[];
  forceTrade?: boolean;
  showRuleExplanations?: boolean;
  isValidating?: boolean;
  pickRulesById?: Record<string, any>;
}

function TradeSummaryPanel({
  result,
  teams = [],
  forceTrade = false,
  showRuleExplanations = true,
  isValidating = false,
  pickRulesById = {},
}: TradeSummaryPanelProps) {
  if (!result) return null;

  const overrideState = result.override || {};
  const hasOverrideRequest = Boolean(forceTrade || overrideState.requested);
  const topLevelViolations = normalizeValidationIssues(result.violations);
  const topStatus = result.legal
    ? '✅ Trade is CBA Legal'
    : hasOverrideRequest
      ? '⚠️ Override Requested – Trade is Still Not CBA Legal'
      : '❌ Trade is NOT CBA Legal';

  return (
    <div className="mt-6 text-sm border-t border-white/10 pt-4 space-y-6">
      <div>
        <strong className="text-base">{topStatus}</strong>
        {!result.legal && !hasOverrideRequest && (
          <div className="text-xs text-white/60 mt-1">
            Fix the issues below before applying the trade.
          </div>
        )}
        {!result.legal && hasOverrideRequest && (
          <div className="text-xs text-amber-300/80 mt-1">
            {overrideState.message ||
              'Override state is tracked separately. It does not change authoritative legality.'}
          </div>
        )}
      </div>

      <DataWarningsSection
        warnings={result.dataWarnings}
        summary={result.dataValidationSummary}
        hasDataIssues={result.hasDataIssues}
      />

      {showRuleExplanations && topLevelViolations.length > 0 && (
        <div className="bg-[#121212] border border-red-500/30 rounded p-3">
          <div className="font-semibold mb-2">Why it fails</div>
          <ul className="list-disc list-inside space-y-1">
            {topLevelViolations.map((violation, index) => (
              <li key={index} className="text-red-300">
                {getValidationIssueText(violation)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {result.summaryByTeamIndex?.map((teamSummary, index) => {
          if (!teamSummary) return null;

          const teamResult = result.teamResults?.[index];
          const isIllegal = teamResult ? !teamResult.legal : false;
          const teamMeta =
            teams.find((team) => team.team?.teamName === teamSummary.teamName) ||
            teams.find((team) => team.team?.id === teamSummary.teamId) ||
            null;
          const colors = teamMeta?.team ? getTeamColors(teamMeta.team.id) : null;
          const primary = colors?.primary;
          const incomingPlayers = teamResult?.incomingPlayers || [];
          const teamSlot = teams.find(
            (team) =>
              team.team?.id === teamSummary.teamId ||
              team.team?.id === teamMeta?.team?.id ||
              team.team?.teamName === teamSummary.teamName
          );
          const entitlementsOut = teamSlot?.entitlementsOut || [];
          const thisTeamId = teamSummary.teamId || teamMeta?.team?.id;
          const incomingEntitlements = teams
            .filter((team) => team.team?.id !== thisTeamId)
            .flatMap((team) => team.entitlementsOut || [])
            .filter((entitlement) => !entitlement.toTeamId || entitlement.toTeamId === thisTeamId);
          const entitlementWarnings = computeEntitlementWarnings(entitlementsOut);

          return (
            <div
              key={teamSummary.teamName || teamMeta?.team?.id || index}
              className={`border rounded bg-[#111] overflow-hidden ${
                isIllegal ? 'border-red-500' : 'border-white/10'
              }`}
            >
              <div
                className="h-1.5"
                style={primary ? { backgroundColor: primary } : undefined}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {teamMeta?.team && (
                      <TeamLogo teamId={teamMeta.team.id} className="w-6 h-6" />
                    )}
                    <h4 className="font-semibold">{teamSummary.teamName}</h4>
                  </div>
                  {isIllegal && (
                    <span className="text-xs text-red-400 font-semibold">
                      ❌ Rejected
                    </span>
                  )}
                </div>

                {teamResult &&
                  (() => {
                    const officialSnapshot =
                      getOfficialSalaryMatchingSnapshot(teamResult);
                    const salaryIn = officialSnapshot.salaryIn ?? 0;
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
                    const allowedIncoming =
                      getDisplayAllowableIncoming(officialSnapshot);
                    const showAllowed = allowedIncoming != null;
                    const formattedAllowed = showAllowed
                      ? formatCurrency(allowedIncoming)
                      : '—';
                    const overBy = showAllowed
                      ? Math.max(0, salaryIn - allowedIncoming)
                      : null;
                    const hardCapIsLimiter =
                      isHardCapped && hardCapDetails?.limiter === 'hardCap';

                    return (
                      <div className="text-xs text-white/70 space-y-1">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/60 mb-1">
                      Players Received
                    </div>
                    {incomingPlayers.length ? (
                      <div className="space-y-1">
                        {incomingPlayers.map((player) => {
                          const baseSalary = player.baseSalary ?? player.salary ?? 0;
                          const matchingValue =
                            player.matchIncoming ??
                            player.matchingValue ??
                            baseSalary;
                          const hasAdjustment =
                            Math.abs(matchingValue - baseSalary) > 1;
                          const adjustmentLabel =
                            getAdjustmentTooltipLabel(player);
                          const tooltipText = `${adjustmentLabel}: Base ${formatCurrency(baseSalary)} → Match ${formatCurrency(matchingValue)}`;

                          return (
                            <div
                              key={player.player_id || player.id}
                              className="flex items-center justify-between bg-white/5 px-2 py-1 rounded"
                            >
                              <div className="flex items-center gap-1 truncate">
                                {player.name || player.fullName}
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
                      Entitlements Received
                    </div>
                    {incomingEntitlements.length ? (
                      <div className="space-y-1">
                        {incomingEntitlements.map((entitlement, entitlementIndex) => {
                          const badge = getEntitlementKindBadge(entitlement.kind);
                          const pickRow = projectEntitlementToPickRow(entitlement, {
                            teamCode: teamMeta?.team?.id,
                            pickRulesById,
                          });
                          const secondaryText =
                            getPickRowSecondaryText(pickRow);

                          return (
                            <div
                              key={
                                entitlement.id ||
                                entitlement.entitlementId ||
                                entitlementIndex
                              }
                              className="flex flex-col bg-white/5 px-2 py-1 rounded"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-white/90">
                                    {entitlement.seasonYear} R{entitlement.round}
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

                <div>
                  <div className="text-xs text-white/60 mb-1">
                    Entitlements Traded
                  </div>
                  {entitlementsOut.length > 0 ? (
                    <div className="space-y-1">
                      {entitlementsOut.map((entitlement, entitlementIndex) => {
                        const badge = getEntitlementKindBadge(entitlement.kind);
                        const pickRow = projectEntitlementToPickRow(entitlement, {
                          teamCode: teamMeta?.team?.id,
                          pickRulesById,
                        });
                        const secondaryText = getPickRowSecondaryText(pickRow);

                        return (
                          <div
                            key={
                              entitlement.id ||
                              entitlement.entitlementId ||
                              entitlementIndex
                            }
                            className="flex flex-col bg-white/5 px-2 py-1.5 rounded text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-white/90">
                                  {entitlement.seasonYear} R{entitlement.round}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.colorClass}`}
                                >
                                  {badge.label}
                                </span>
                              </div>
                              <div
                                className="text-white/50 text-[10px] truncate max-w-[120px]"
                                title={entitlement.description}
                              >
                                {entitlement.description?.slice(0, 25) || ''}
                                {entitlement.description?.length > 25 ? '…' : ''}
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

                  {entitlementWarnings.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300">
                      <div className="flex items-center gap-1 mb-1 font-medium">
                        <AlertTriangle size={12} />
                        <span>Entitlement Warnings</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {entitlementWarnings.map((warning, warningIndex) => (
                          <li key={warningIndex}>{warning}</li>
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
