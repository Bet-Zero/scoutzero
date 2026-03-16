import React, { useState } from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import {
  projectEntitlementToPickRow,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';
import type {
  TeamPlayerLike,
  TradeReceiptLike,
} from './validationPresentationTypes';

const ADJUSTMENT_THRESHOLD = 1;

interface PlayerListItemProps {
  player: TeamPlayerLike;
  direction: 'incoming' | 'outgoing';
}

interface TradeReceiptPanelProps {
  receipt?: TradeReceiptLike | null;
  pickRulesById?: Record<string, unknown>;
}

const PlayerListItem = ({ player, direction }: PlayerListItemProps) => {
  const flags = player.flags || {};
  const hasAdjustment =
    player.baseSalary !== player.matchingValue &&
    Math.abs((player.baseSalary || 0) - (player.matchingValue || 0)) >
      ADJUSTMENT_THRESHOLD;
  const showAdjBadge =
    hasAdjustment &&
    (direction === 'outgoing'
      ? !flags.isBYC && !flags.hasTradeKicker
      : !flags.isPoisonPill && !flags.hasTradeKicker);
  const showBreakdown =
    direction === 'outgoing'
      ? flags.isBYC && player.baseSalary !== player.matchingValue
      : (flags.isPoisonPill || flags.hasTradeKicker) &&
        player.baseSalary !== player.matchingValue;
  const kickerPct = (Number(flags.tradeKickerPct || 0) * 100).toFixed(0);
  const adjTooltipText = `Adjusted: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)}`;

  return (
    <div className="text-xs pl-2 py-1 border-l border-white/10">
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-1">
          {player.name}
          {showAdjBadge && (
            <span
              className="px-1 py-0.5 text-[9px] bg-purple-600/30 text-purple-300 rounded leading-none"
              title={adjTooltipText}
            >
              Adj
            </span>
          )}
          {direction === 'outgoing' && flags.isBYC && (
            <span
              className="text-yellow-400 ml-1"
              title={`BYC: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)} (max of prior, 50% new)`}
            >
              BYC
            </span>
          )}
          {direction === 'incoming' && flags.isPoisonPill && (
            <span
              className="text-purple-400 ml-1"
              title={`Poison Pill: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)} (averaged salary)`}
            >
              PP
            </span>
          )}
          {flags.hasTradeKicker && (
            <span
              className="text-orange-400 ml-1"
              title={
                direction === 'incoming'
                  ? `Trade Kicker (${kickerPct}%): Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)}`
                  : `Trade Kicker: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)}`
              }
            >
              TK
            </span>
          )}
        </span>
        <span className="font-mono text-white/60">
          {formatCurrency(player.matchingValue)}
        </span>
      </div>
      {showBreakdown && direction === 'outgoing' && (
        <div className="text-white/40 text-xs mt-0.5 pl-2">
          Base: {formatCurrency(player.baseSalary)} → Match:{' '}
          {formatCurrency(player.matchingValue)} (BYC: max(prior, 50% new))
        </div>
      )}
      {showBreakdown && direction === 'incoming' && (
        <div className="text-white/40 text-xs mt-0.5 pl-2">
          Base: {formatCurrency(player.baseSalary)} → Match:{' '}
          {formatCurrency(player.matchingValue)}
          {flags.isPoisonPill && ' (Poison Pill avg)'}
          {flags.hasTradeKicker && ` (+${kickerPct}% kicker)`}
        </div>
      )}
    </div>
  );
};

const TradeReceiptPanel = ({
  receipt,
  pickRulesById = {},
}: TradeReceiptPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const showReceipt = import.meta.env.VITE_SHOW_TRADE_RECEIPT === 'true';

  if (!showReceipt) {
    return null;
  }

  if (!receipt) {
    return (
      <div className="mt-6 p-4 bg-[#111] border border-yellow-500/30 rounded text-xs">
        <div className="flex items-center gap-2 text-yellow-400">
          <span className="text-lg">📋</span>
          <span className="font-medium">Trade Receipt Debug Panel</span>
          <span className="text-white/40">
            (No receipt data available yet - construct a trade)
          </span>
        </div>
      </div>
    );
  }

  const handleCopyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  return (
    <div className="mt-6 p-4 bg-[#111] border border-purple-500/30 rounded text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-medium text-purple-400">
            Trade Receipt (Debug Mode)
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              receipt.isLegal
                ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                : 'bg-red-900/30 text-red-400 border border-red-500/30'
            }`}
          >
            {receipt.isLegal ? '✓ LEGAL' : '✗ ILLEGAL'}
          </span>
          <span className="text-white/40 text-xs">
            v{receipt.validatorVersion}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReceipt}
            className="px-2 py-1 bg-[#222] text-white/70 hover:text-white rounded border border-white/20 hover:bg-[#333] text-xs"
          >
            {copyFeedback || 'Copy JSON'}
          </button>
          <button
            type="button"
            className="px-3 py-1 bg-[#222] text-white rounded border border-white/20 hover:bg-[#333]"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-white/60 mb-3">
        <span>Year: {receipt.yearKey}</span>
        <span>Season: {receipt.seasonKey}</span>
        <span>Teams: {receipt.teams?.length || 0}</span>
        <span>Violations: {receipt.allViolations?.length || 0}</span>
        <span className="text-white/40">
          ({Number(receipt.performance?.validationTimeMs ?? 0).toFixed(2)}ms)
        </span>
      </div>

      {receipt.capSettingsUsed && (
        <div className="p-2 mb-3 bg-blue-900/20 border border-blue-500/30 rounded">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-400 font-medium text-xs">
              Cap Settings ({receipt.seasonKey})
            </span>
            <span className="text-white/40 text-xs">
              Source: {receipt.capSettingsSource}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-white/50">Salary Cap:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.salaryCap)}
              </span>
            </div>
            <div>
              <span className="text-white/50">1st Apron:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.firstApron)}
              </span>
            </div>
            <div>
              <span className="text-white/50">2nd Apron:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.secondApron)}
              </span>
            </div>
            <div>
              <span className="text-white/50">Lux Tax:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.luxuryTax)}
              </span>
            </div>
          </div>
        </div>
      )}

      {receipt.capSettingsWarnings?.length > 0 && (
        <div className="p-2 mb-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
          <div className="text-yellow-400 text-xs font-medium mb-1">
            Cap Settings Warnings:
          </div>
          {receipt.capSettingsWarnings.map((warning, index) => (
            <div key={index} className="text-xs text-yellow-300 pl-2">
              • {warning}
            </div>
          ))}
        </div>
      )}

      {receipt.primaryViolation && (
        <div className="p-2 mb-3 bg-red-900/20 border border-red-500/30 rounded text-red-400">
          <strong>Primary Violation:</strong> {receipt.primaryViolation}
        </div>
      )}

      {expanded && (
        <div className="space-y-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            {receipt.teams?.map((team, index) => (
              <div
                key={index}
                className="bg-[#181818] rounded-lg p-3 border border-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-white">
                    {team.teamName}
                  </h4>
                  <span className="text-white/40 text-xs">{team.teamCode}</span>
                </div>

                <div className="text-white/60 text-xs mb-2">
                  Pre-trade Salary: {formatCurrency(team.preTradeTeamSalary)}
                  <span className="text-white/30 ml-1">
                    ({team.preTradeTeamSalarySource})
                  </span>
                </div>

                <div className="p-2 mb-2 bg-[#222] rounded border border-white/10">
                  <div className="text-xs font-medium text-blue-400 mb-1">
                    Rule: {String(team.salaryMatchingEvaluation?.ruleApplied || 'N/A')}
                  </div>
                  <div className="text-xs text-white/60 font-mono break-all">
                    {String(team.salaryMatchingEvaluation?.formulaUsed || 'No formula')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <div className="text-white/40">Outgoing (Base)</div>
                    <div className="font-mono">
                      {formatCurrency(team.totals?.outgoingBaseTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/40">Outgoing (Match)</div>
                    <div className="font-mono">
                      {formatCurrency(team.totals?.outgoingMatchingTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/40">Incoming (Base)</div>
                    <div className="font-mono">
                      {formatCurrency(team.totals?.incomingBaseTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/40">Incoming (Match)</div>
                    <div className="font-mono">
                      {formatCurrency(team.totals?.incomingMatchingTotal)}
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded border border-white/10 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Allowable Incoming:</span>
                    <span className="font-mono text-green-400">
                      {formatCurrency(
                        team.salaryMatchingEvaluation?.allowableIncoming
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Actual Incoming:</span>
                    <span className="font-mono">
                      {formatCurrency(team.salaryMatchingEvaluation?.actualIncoming)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                    <span className="text-white/60">Margin:</span>
                    <span
                      className={`font-mono ${
                        Number(team.salaryMatchingEvaluation?.margin || 0) >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {formatCurrency(team.salaryMatchingEvaluation?.margin)}
                    </span>
                  </div>
                </div>

                {team.outgoingPlayers?.length > 0 && (
                  <div className="mb-2">
                    <div className="text-white/40 text-xs mb-1">
                      Outgoing Players:
                    </div>
                    {team.outgoingPlayers.map((player, playerIndex) => (
                      <PlayerListItem
                        key={playerIndex}
                        player={player}
                        direction="outgoing"
                      />
                    ))}
                  </div>
                )}

                {team.incomingPlayers?.length > 0 && (
                  <div className="mb-2">
                    <div className="text-white/40 text-xs mb-1">
                      Incoming Players:
                    </div>
                    {team.incomingPlayers.map((player, playerIndex) => (
                      <PlayerListItem
                        key={playerIndex}
                        player={player}
                        direction="incoming"
                      />
                    ))}
                  </div>
                )}

                {(team.outgoingEntitlements?.length > 0 ||
                  team.incomingEntitlements?.length > 0) && (
                  <div className="mb-2">
                    {team.outgoingEntitlements?.length > 0 && (
                      <div className="mb-2">
                        <div className="text-white/40 text-xs mb-1">
                          Entitlements Out:
                        </div>
                        {team.outgoingEntitlements.map((entitlement, entitlementIndex) => {
                          const pickRow = projectEntitlementToPickRow({ ...entitlement } as Record<string, unknown>, {
                            teamCode: team.teamCode,
                            pickRulesById: pickRulesById as any,
                          });
                          const secondaryText =
                            getPickRowSecondaryText(pickRow);

                          return (
                            <div
                              key={entitlement.id || entitlementIndex}
                              className="text-xs pl-2 py-0.5 border-l border-amber-500/30"
                            >
                              <div>
                                <span className="text-amber-300">
                                  {entitlement.seasonYear} R{entitlement.round}
                                </span>
                                <span className="text-white/60 ml-1">
                                  — {entitlement.kind}
                                </span>
                                <span className="text-white/30 ml-1 text-[10px]">
                                  ({entitlement.id})
                                </span>
                                {entitlement.toTeamId && (
                                  <span className="text-white/30 ml-1 text-[10px]">
                                    → {entitlement.toTeamId}
                                  </span>
                                )}
                              </div>
                              {secondaryText && (
                                <div className="text-white/40 text-[10px] mt-0.5">
                                  {secondaryText}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {team.incomingEntitlements?.length > 0 && (
                      <div>
                        <div className="text-white/40 text-xs mb-1">
                          Entitlements In:
                        </div>
                        {team.incomingEntitlements.map((entitlement, entitlementIndex) => {
                          const pickRow = projectEntitlementToPickRow({ ...entitlement } as Record<string, unknown>, {
                            teamCode: team.teamCode,
                            pickRulesById: pickRulesById as any,
                          });
                          const secondaryText =
                            getPickRowSecondaryText(pickRow);

                          return (
                            <div
                              key={entitlement.id || entitlementIndex}
                              className="text-xs pl-2 py-0.5 border-l border-green-500/30"
                            >
                              <div>
                                <span className="text-green-300">
                                  {entitlement.seasonYear} R{entitlement.round}
                                </span>
                                <span className="text-white/60 ml-1">
                                  — {entitlement.kind}
                                </span>
                                <span className="text-white/30 ml-1 text-[10px]">
                                  ({entitlement.id})
                                </span>
                                {entitlement.fromTeam && (
                                  <span className="text-white/30 ml-1">
                                    from {entitlement.fromTeam}
                                  </span>
                                )}
                                {entitlement.toTeamId && (
                                  <span className="text-blue-400/50 ml-1 text-[10px]">
                                    [routed]
                                  </span>
                                )}
                              </div>
                              {secondaryText && (
                                <div className="text-white/40 text-[10px] mt-0.5">
                                  {secondaryText}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {team.violations?.length > 0 && (
                  <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded">
                    <div className="text-red-400 text-xs font-medium mb-1">
                      Violations:
                    </div>
                    {team.violations.map((violation, violationIndex) => (
                      <div key={violationIndex} className="text-xs text-red-300 pl-2">
                        • {getValidationIssueText(violation)}
                      </div>
                    ))}
                  </div>
                )}
                {team.warnings?.length > 0 && (
                  <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                    <div className="text-yellow-400 text-xs font-medium mb-1">
                      Warnings:
                    </div>
                    {team.warnings.map((warning, warningIndex) => (
                      <div key={warningIndex} className="text-xs text-yellow-300 pl-2">
                        • {getValidationIssueText(warning)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs">Full Receipt JSON:</span>
            </div>
            <pre className="p-3 bg-[#0a0a0a] border border-white/10 rounded overflow-auto max-h-96 text-xs font-mono text-white/80">
              {JSON.stringify(receipt, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-2 text-white/30 text-xs text-right">
        Debug panel enabled via VITE_SHOW_TRADE_RECEIPT=true
      </div>
    </div>
  );
};

export { TradeReceiptPanel };
