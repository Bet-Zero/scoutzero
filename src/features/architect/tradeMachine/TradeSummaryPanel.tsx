import React from 'react';
import {
  formatCurrency,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
import { AlertTriangle } from 'lucide-react';
import { getTeamColors } from '@/shared/utils/formatting';
import { TeamLogo } from '@/shared/components/TeamLogo';
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
import type { PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';
import { DataWarningsSection } from './DataWarningsSection';
import { buildVerdictItems } from '@/features/architect/tradeMachine/verdictSummary';
import type {
  PreviewAuthorityLike,
  SnapshotValidationDetailsLike,
  TeamLike,
} from './validationPresentationTypes';

interface TradeSummaryPanelProps {
  previewAuthority?: PreviewAuthorityLike | null;
  snapshotValidationDetails?: SnapshotValidationDetailsLike | null;
  teams?: TeamLike[];
  forceTrade?: boolean;
  showRuleExplanations?: boolean;
  isValidating?: boolean;
  pickRulesById?: Record<string, PickRuleDoc>;
}

export function TradeSummaryPanel({
  previewAuthority = null,
  snapshotValidationDetails = null,
  teams = [],
  forceTrade = false,
  showRuleExplanations = true,
  isValidating = false,
  pickRulesById = {},
}: TradeSummaryPanelProps) {
  if (!previewAuthority && !snapshotValidationDetails) return null;

  const overrideState = snapshotValidationDetails?.override || {};
  const hasOverrideRequest = Boolean(forceTrade || overrideState.requested);
  const previewPassed = previewAuthority?.legal === true;
  const previewFailed = previewAuthority?.legal === false;
  const playerNameById = new Map<string, string>();
  teams
    .flatMap((team) => team.sends || [])
    .forEach((player) => {
      const id = String(player.player_id ?? player.id ?? '').trim();
      const name = String(player.name ?? player.fullName ?? '').trim();
      if (id && name && id !== name) playerNameById.set(id, name);
    });
  const verdictOptions = {
    resolvePlayerName: (playerId: string) => playerNameById.get(playerId),
  };
  const verdictItems = buildVerdictItems(
    snapshotValidationDetails?.teamResults,
    previewAuthority,
    verdictOptions
  );
  const needsInput = verdictItems.some((item) => item.kind === 'needsInput');
  const tradeWideBlockingItems = buildVerdictItems(
    [],
    previewAuthority,
    verdictOptions
  ).filter((item) => item.teamName === null && item.kind !== 'warning');
  const topStatus = needsInput
    ? '⚪ Needs input — trade not ready'
    : previewPassed
      ? '✅ Trade passes validation'
      : hasOverrideRequest
        ? '⚠️ Override requested — trade remains blocked'
        : previewFailed
          ? '❌ Trade fails validation'
          : '⚪ Validation unavailable';

  return (
    <div className="mt-6 text-sm border-t border-cockpit-edge pt-4 space-y-6">
      <div>
        <strong className="text-base">{topStatus}</strong>
        {previewFailed && !hasOverrideRequest && !needsInput && (
          <div className="text-xs text-cockpit-text-secondary mt-1">
            Fix the issues below before applying the trade.
          </div>
        )}
        {needsInput && (
          <div className="text-xs text-cockpit-watch mt-1">
            Add the missing information before applying this trade.
          </div>
        )}
        {previewFailed && hasOverrideRequest && (
          <div className="text-xs text-cockpit-watch/80 mt-1">
            {String(
              overrideState.message ||
                'The override request does not change the trade result.'
            )}
          </div>
        )}
      </div>

      <DataWarningsSection
        warnings={snapshotValidationDetails?.dataWarnings}
        summary={snapshotValidationDetails?.dataValidationSummary}
        hasDataIssues={snapshotValidationDetails?.hasDataIssues}
      />

      {showRuleExplanations && tradeWideBlockingItems.length > 0 && (
        <div
          className={`bg-cockpit-slab border rounded p-3 ${
            needsInput ? 'border-cockpit-watch/30' : 'border-cockpit-danger/30'
          }`}
        >
          <div className="font-semibold mb-2">
            {needsInput ? 'Why it needs input' : 'Why it fails'}
          </div>
          <ul className="list-disc list-inside space-y-1">
            {tradeWideBlockingItems.map((item, index) => (
              <li
                key={index}
                className={
                  item.kind === 'needsInput'
                    ? 'text-cockpit-watch'
                    : 'text-cockpit-danger'
                }
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {snapshotValidationDetails?.summaryByTeamIndex?.map(
          (teamSummary, index) => {
            if (!teamSummary) return null;

            const teamResult = snapshotValidationDetails?.teamResults?.[index];
            const teamNeedsInput = Object.values(teamResult?.rules ?? {}).some(
              (rule) => rule?.status === 'NEEDS_INPUT'
            );
            const isIllegal = teamResult
              ? !teamResult.legal && !teamNeedsInput
              : false;
            const teamMeta =
              teams.find(
                (team) => team.team?.teamName === teamSummary.teamName
              ) ||
              teams.find((team) => team.team?.id === teamSummary.teamId) ||
              null;
            const colors = teamMeta?.team
              ? getTeamColors(teamMeta.team.id)
              : null;
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
              .filter(
                (entitlement) =>
                  !entitlement.toTeamId || entitlement.toTeamId === thisTeamId
              );
            const entitlementWarnings =
              computeEntitlementWarnings(entitlementsOut);

            return (
              <div
                key={teamSummary.teamName || teamMeta?.team?.id || index}
                className={`border rounded bg-cockpit-slab overflow-hidden ${
                  teamNeedsInput
                    ? 'border-cockpit-watch/40'
                    : isIllegal
                      ? 'border-cockpit-danger'
                      : 'border-cockpit-edge'
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
                        <TeamLogo
                          teamId={teamMeta.team.id}
                          className="w-6 h-6"
                        />
                      )}
                      <h4 className="font-semibold">{teamSummary.teamName}</h4>
                    </div>
                    {teamNeedsInput ? (
                      <span className="text-xs text-cockpit-watch font-semibold">
                        ⚪ Needs input
                      </span>
                    ) : isIllegal ? (
                      <span className="text-xs text-cockpit-danger font-semibold">
                        ❌ Rejected
                      </span>
                    ) : null}
                  </div>

                  {teamResult &&
                    (() => {
                      const officialSnapshot =
                        getOfficialSalaryMatchingSnapshot(
                          teamResult ? { ...teamResult } : null
                        );
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
                        <div className="text-xs text-cockpit-text-secondary space-y-1">
                          <p>
                            Matching In / Allowed:{' '}
                            {isValidating ? (
                              <span className="text-cockpit-info animate-pulse">
                                Updating…
                              </span>
                            ) : (
                              <>
                                {formatCurrency(salaryIn)} / {formattedAllowed}
                                {skipReason && (
                                  <span className="text-cockpit-text-muted ml-1">
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
                            <div className="pl-2 border-l border-cockpit-edge text-[10px] text-cockpit-text-muted space-y-0.5">
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
                                    hardCapIsLimiter ? 'text-cockpit-watch' : ''
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
                      <div className="text-xs text-cockpit-text-secondary mb-1">
                        Players Received
                      </div>
                      {incomingPlayers.length ? (
                        <div className="space-y-1">
                          {incomingPlayers.map((player) => {
                            const baseSalary =
                              player.baseSalary ?? player.salary ?? 0;
                            const matchingValue =
                              player.matchIncoming ??
                              player.matchingValue ??
                              baseSalary;
                            const hasAdjustment =
                              Math.abs(matchingValue - baseSalary) > 1;
                            const adjustmentLabel = getAdjustmentTooltipLabel({
                              ...player,
                            });
                            const tooltipText = `${adjustmentLabel}: Base ${formatCurrency(baseSalary)} → Match ${formatCurrency(matchingValue)}`;

                            return (
                              <div
                                key={player.player_id || player.id}
                                className="flex items-center justify-between bg-cockpit-raised px-2 py-1 rounded"
                              >
                                <div className="flex items-center gap-1 truncate">
                                  {player.name || player.fullName}
                                  {hasAdjustment && (
                                    <span
                                      className="px-1 py-0.5 text-[10px] bg-cockpit-info/30 text-cockpit-info rounded leading-none"
                                      title={tooltipText}
                                    >
                                      Adj
                                    </span>
                                  )}
                                </div>
                                <div className="text-cockpit-text-muted text-xs">
                                  {baseSalary
                                    ? formatCurrency(baseSalary)
                                    : '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-cockpit-text-muted italic">
                          None
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-cockpit-text-secondary mb-1">
                        Entitlements Received
                      </div>
                      {incomingEntitlements.length ? (
                        <div className="space-y-1">
                          {incomingEntitlements.map(
                            (entitlement, entitlementIndex) => {
                              const badge = getEntitlementKindBadge(
                                entitlement.kind
                              );
                              const pickRow = projectEntitlementToPickRow(
                                { ...entitlement } as Record<string, unknown>,
                                {
                                  teamCode: teamMeta?.team?.id,
                                  pickRulesById,
                                }
                              );
                              const secondaryText =
                                getPickRowSecondaryText(pickRow);

                              return (
                                <div
                                  key={
                                    entitlement.id ||
                                    entitlement.entitlementId ||
                                    entitlementIndex
                                  }
                                  className="flex flex-col bg-cockpit-raised px-2 py-1 rounded"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="text-cockpit-text-primary">
                                        {entitlement.seasonYear} R
                                        {entitlement.round}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.colorClass}`}
                                      >
                                        {badge.label}
                                      </span>
                                    </div>
                                  </div>
                                  {secondaryText && (
                                    <div
                                      className="text-cockpit-text-muted text-[10px] mt-0.5 truncate"
                                      title={secondaryText}
                                    >
                                      {secondaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-cockpit-text-muted italic">
                          None
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-cockpit-text-secondary mb-1">
                      Entitlements Traded
                    </div>
                    {entitlementsOut.length > 0 ? (
                      <div className="space-y-1">
                        {entitlementsOut.map(
                          (entitlement, entitlementIndex) => {
                            const badge = getEntitlementKindBadge(
                              entitlement.kind
                            );
                            const pickRow = projectEntitlementToPickRow(
                              { ...entitlement } as Record<string, unknown>,
                              {
                                teamCode: teamMeta?.team?.id,
                                pickRulesById,
                              }
                            );
                            const secondaryText =
                              getPickRowSecondaryText(pickRow);
                            const entitlementDescription =
                              entitlement.description || '';

                            return (
                              <div
                                key={
                                  entitlement.id ||
                                  entitlement.entitlementId ||
                                  entitlementIndex
                                }
                                className="flex flex-col bg-cockpit-raised px-2 py-1.5 rounded text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-cockpit-text-primary">
                                      {entitlement.seasonYear} R
                                      {entitlement.round}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.colorClass}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                  <div
                                    className="text-cockpit-text-muted text-[10px] truncate max-w-[120px]"
                                    title={entitlementDescription}
                                  >
                                    {entitlementDescription.slice(0, 25)}
                                    {entitlementDescription.length > 25
                                      ? '…'
                                      : ''}
                                  </div>
                                </div>
                                {secondaryText && (
                                  <div
                                    className="text-cockpit-text-muted text-[10px] mt-0.5 truncate"
                                    title={secondaryText}
                                  >
                                    {secondaryText}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-cockpit-text-muted italic">
                        None
                      </div>
                    )}

                    {entitlementWarnings.length > 0 && (
                      <div className="mt-2 p-2 bg-cockpit-watch/20 border border-cockpit-watch/30 rounded text-xs text-cockpit-watch">
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
          }
        )}
      </div>
    </div>
  );
}
