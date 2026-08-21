import React, { useState } from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import {
  projectEntitlementToPickRow,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
import type { PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import { TWO_WAY_TRADE_MATCHING_EXPLANATION } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
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
  pickRulesById?: Record<string, PickRuleDoc>;
}

type PlayerFlagsLike = {
  isBYC?: boolean;
  hasTradeKicker?: boolean;
  isPoisonPill?: boolean;
  tradeKickerPct?: number | string | null;
  isTwoWay?: boolean;
};

const toText = (value: unknown) => (value == null ? '' : String(value));
const toList = <T,>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const PlayerListItem = ({ player, direction }: PlayerListItemProps) => {
  const flags = (player.flags || {}) as PlayerFlagsLike;
  const hasAdjustment =
    player.baseSalary !== player.matchingValue &&
    Math.abs((player.baseSalary || 0) - (player.matchingValue || 0)) >
      ADJUSTMENT_THRESHOLD;
  const showAdjBadge =
    hasAdjustment &&
    (direction === 'outgoing'
      ? !flags.isBYC && !flags.hasTradeKicker
      : !flags.isPoisonPill && !flags.hasTradeKicker) &&
    !flags.isTwoWay;
  const showBreakdown =
    flags.isTwoWay ||
    (direction === 'outgoing'
      ? flags.isBYC && player.baseSalary !== player.matchingValue
      : (flags.isPoisonPill || flags.hasTradeKicker) &&
        player.baseSalary !== player.matchingValue);
  const kickerPct = (Number(flags.tradeKickerPct || 0) * 100).toFixed(0);
  const playerName = toText(player.name) || 'Unknown';
  const adjTooltipText = `Adjusted: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)}`;

  return (
    <div className="text-xs pl-2 py-1 border-l border-cockpit-edge">
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-1">
          {playerName}
          {showAdjBadge && (
            <span
              className="px-1 py-0.5 text-[10px] bg-cockpit-info/30 text-cockpit-info rounded leading-none"
              title={adjTooltipText}
            >
              Adj
            </span>
          )}
          {flags.isTwoWay && (
            <span
              className="text-cockpit-info ml-1"
              title={TWO_WAY_TRADE_MATCHING_EXPLANATION}
            >
              2W
            </span>
          )}
          {!flags.isTwoWay && direction === 'outgoing' && flags.isBYC && (
            <span
              className="text-cockpit-watch ml-1"
              title={`BYC: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)} (max of prior, 50% new)`}
            >
              BYC
            </span>
          )}
          {!flags.isTwoWay &&
            direction === 'incoming' &&
            flags.isPoisonPill && (
              <span
                className="text-cockpit-info ml-1"
                title={`Poison Pill: Base ${formatCurrency(player.baseSalary)} → Match ${formatCurrency(player.matchingValue)} (averaged salary)`}
              >
                PP
              </span>
            )}
          {!flags.isTwoWay && flags.hasTradeKicker && (
            <span
              className="text-cockpit-watch ml-1"
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
        <span className="font-mono text-cockpit-text-secondary">
          {formatCurrency(player.matchingValue)}
        </span>
      </div>
      {showBreakdown && flags.isTwoWay && (
        <div className="text-cockpit-text-muted text-xs mt-0.5 pl-2">
          {TWO_WAY_TRADE_MATCHING_EXPLANATION}
        </div>
      )}
      {showBreakdown && !flags.isTwoWay && direction === 'outgoing' && (
        <div className="text-cockpit-text-muted text-xs mt-0.5 pl-2">
          Base: {formatCurrency(player.baseSalary)} → Match:{' '}
          {formatCurrency(player.matchingValue)} (BYC: max(prior, 50% new))
        </div>
      )}
      {showBreakdown && !flags.isTwoWay && direction === 'incoming' && (
        <div className="text-cockpit-text-muted text-xs mt-0.5 pl-2">
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
      <div className="mt-6 p-4 bg-cockpit-slab border border-cockpit-watch/30 rounded text-xs">
        <div className="flex items-center gap-2 text-cockpit-watch">
          <span className="text-lg">📋</span>
          <span className="font-medium">Trade Receipt Debug Panel</span>
          <span className="text-cockpit-text-muted">
            (No receipt data available yet - construct a trade)
          </span>
        </div>
      </div>
    );
  }

  const capSettingsWarnings = toList(receipt.capSettingsWarnings);

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
    <div className="mt-6 p-4 bg-cockpit-slab border border-cockpit-info/30 rounded text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-medium text-cockpit-info">
            Trade Receipt (Debug Mode)
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              receipt.isLegal
                ? 'bg-cockpit-safe/30 text-cockpit-safe border border-cockpit-safe/30'
                : 'bg-cockpit-danger/30 text-cockpit-danger border border-cockpit-danger/30'
            }`}
          >
            {receipt.isLegal ? '✓ LEGAL' : '✗ ILLEGAL'}
          </span>
          <span className="text-cockpit-text-muted text-xs">
            v{toText(receipt.validatorVersion)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReceipt}
            className="px-2 py-1 bg-cockpit-raised text-cockpit-text-secondary hover:text-cockpit-text-primary rounded border border-cockpit-edge hover:bg-cockpit-edge text-xs"
          >
            {copyFeedback || 'Copy JSON'}
          </button>
          <button
            type="button"
            className="px-3 py-1 bg-cockpit-raised text-cockpit-text-primary rounded border border-cockpit-edge hover:bg-cockpit-edge"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-cockpit-text-secondary mb-3">
        <span>Year: {toText(receipt.yearKey)}</span>
        <span>Season: {toText(receipt.seasonKey)}</span>
        <span>Teams: {receipt.teams?.length || 0}</span>
        <span>Violations: {receipt.allViolations?.length || 0}</span>
        <span className="text-cockpit-text-muted">
          ({Number(receipt.performance?.validationTimeMs ?? 0).toFixed(2)}ms)
        </span>
      </div>

      {receipt.capSettingsUsed && (
        <div className="p-2 mb-3 bg-cockpit-info/20 border border-cockpit-info/30 rounded">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-cockpit-info font-medium text-xs">
              Cap Settings ({toText(receipt.seasonKey)})
            </span>
            <span className="text-cockpit-text-muted text-xs">
              Source: {toText(receipt.capSettingsSource)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-cockpit-text-muted">Salary Cap:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.salaryCap)}
              </span>
            </div>
            <div>
              <span className="text-cockpit-text-muted">1st Apron:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.firstApron)}
              </span>
            </div>
            <div>
              <span className="text-cockpit-text-muted">2nd Apron:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.secondApron)}
              </span>
            </div>
            <div>
              <span className="text-cockpit-text-muted">Lux Tax:</span>
              <span className="font-mono ml-1">
                {formatCurrency(receipt.capSettingsUsed.luxuryTax)}
              </span>
            </div>
          </div>
        </div>
      )}

      {capSettingsWarnings.length > 0 && (
        <div className="p-2 mb-3 bg-cockpit-watch/20 border border-cockpit-watch/30 rounded">
          <div className="text-cockpit-watch text-xs font-medium mb-1">
            Cap Settings Warnings:
          </div>
          {capSettingsWarnings.map((warning, index) => (
            <div key={index} className="text-xs text-cockpit-watch pl-2">
              • {warning}
            </div>
          ))}
        </div>
      )}

      {receipt.primaryViolation && (
        <div className="p-2 mb-3 bg-cockpit-danger/20 border border-cockpit-danger/30 rounded text-cockpit-danger">
          <strong>Primary Violation:</strong> {toText(receipt.primaryViolation)}
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
            {receipt.teams?.map((team, index) => {
              const outgoingPlayers = toList(team.outgoingPlayers);
              const incomingPlayers = toList(team.incomingPlayers);
              const outgoingEntitlements = toList(team.outgoingEntitlements);
              const incomingEntitlements = toList(team.incomingEntitlements);
              const teamViolations = toList(team.violations);
              const teamWarnings = toList(team.warnings);
              const pathEvaluation =
                team.salaryMatchingEvaluation?.pathEvaluation ?? null;

              return (
                <div
                  key={index}
                  className="bg-cockpit-raised rounded-lg p-3 border border-cockpit-edge"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-cockpit-text-primary">
                      {toText(team.teamName)}
                    </h4>
                    <span className="text-cockpit-text-muted text-xs">
                      {toText(team.teamCode)}
                    </span>
                  </div>

                  <div className="text-cockpit-text-secondary text-xs mb-2">
                    Team Salary: {team.preTradeTeamSalary == null
                      ? 'Needs input'
                      : formatCurrency(team.preTradeTeamSalary)}
                    <span className="text-cockpit-text-ghost ml-1">
                      ({toText(team.preTradeTeamSalarySource)})
                    </span>
                  </div>
                  <div className="text-xs text-cockpit-text-secondary">
                    Apron Team Salary: {team.preTradeApronTeamSalary == null
                      ? 'Needs input'
                      : formatCurrency(team.preTradeApronTeamSalary)}
                    {' · '}Tax Salary: {team.preTradeTaxSalary == null
                      ? 'Needs input'
                      : formatCurrency(team.preTradeTaxSalary)}
                  </div>

                  <div className="p-2 mb-2 bg-cockpit-raised rounded border border-cockpit-edge">
                    <div className="text-xs font-medium text-cockpit-info mb-1">
                      Rule:{' '}
                      {String(
                        team.salaryMatchingEvaluation?.ruleApplied || 'N/A'
                      )}
                    </div>
                    <div className="text-xs text-cockpit-text-secondary font-mono break-all">
                      {String(
                        team.salaryMatchingEvaluation?.formulaUsed ||
                          'No formula'
                      )}
                    </div>
                  </div>

                  {pathEvaluation && (
                    <div className="p-2 mb-2 rounded border border-cockpit-info/30 bg-cockpit-info/10 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-cockpit-info">
                          {pathEvaluation.ruleLabel}
                        </span>
                        <span
                          className={
                            pathEvaluation.status === 'PASS'
                              ? 'text-cockpit-safe'
                              : pathEvaluation.status === 'FAIL'
                                ? 'text-cockpit-danger'
                                : 'text-cockpit-watch'
                          }
                        >
                          {pathEvaluation.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-cockpit-text-secondary">
                        Allowance:{' '}
                        {pathEvaluation.allowance == null
                          ? 'needs exact Apron Team Salary'
                          : formatCurrency(pathEvaluation.allowance)}
                      </div>
                      {pathEvaluation.components.map((component) => (
                        <div
                          key={component.componentId}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-cockpit-edge pt-1 text-[11px]"
                        >
                          <span className="text-cockpit-text-secondary">
                            {component.kind === 'HELD_STANDARD_TPE'
                              ? 'Held Standard TPE'
                              : pathEvaluation.ruleLabel}{' '}
                            · {component.timing.toLowerCase().replace('_', ' ')}
                          </span>
                          <span className="font-mono text-cockpit-text-primary">
                            {formatCurrency(component.usedIncoming)} /{' '}
                            {formatCurrency(component.maximumIncoming)}
                          </span>
                        </div>
                      ))}
                      {pathEvaluation.missingInputs.length > 0 && (
                        <div className="text-[11px] text-cockpit-watch">
                          Needs: {pathEvaluation.missingInputs.join(', ')}
                        </div>
                      )}
                      {pathEvaluation.violations.map((violation) => (
                        <div
                          key={violation}
                          className="text-[11px] text-cockpit-danger"
                        >
                          {violation}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <div className="text-cockpit-text-muted">
                        Outgoing (Base)
                      </div>
                      <div className="font-mono">
                        {formatCurrency(team.totals?.outgoingBaseTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-cockpit-text-muted">
                        Outgoing (Match)
                      </div>
                      <div className="font-mono">
                        {formatCurrency(team.totals?.outgoingMatchingTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-cockpit-text-muted">
                        Incoming (Base)
                      </div>
                      <div className="font-mono">
                        {formatCurrency(team.totals?.incomingBaseTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-cockpit-text-muted">
                        Incoming (Match)
                      </div>
                      <div className="font-mono">
                        {formatCurrency(team.totals?.incomingMatchingTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded border border-cockpit-edge mb-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-cockpit-text-secondary">
                        Allowable Incoming:
                      </span>
                      <span className="font-mono text-cockpit-safe">
                        {formatCurrency(
                          team.salaryMatchingEvaluation?.allowableIncoming
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-cockpit-text-secondary">
                        Actual Incoming:
                      </span>
                      <span className="font-mono">
                        {formatCurrency(
                          team.salaryMatchingEvaluation?.actualIncoming
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-cockpit-edge pt-1 mt-1">
                      <span className="text-cockpit-text-secondary">
                        Margin:
                      </span>
                      <span
                        className={`font-mono ${
                          Number(team.salaryMatchingEvaluation?.margin || 0) >=
                          0
                            ? 'text-cockpit-safe'
                            : 'text-cockpit-danger'
                        }`}
                      >
                        {formatCurrency(team.salaryMatchingEvaluation?.margin)}
                      </span>
                    </div>
                  </div>

                  {outgoingPlayers.length > 0 && (
                    <div className="mb-2">
                      <div className="text-cockpit-text-muted text-xs mb-1">
                        Outgoing Players:
                      </div>
                      {outgoingPlayers.map((player, playerIndex) => (
                        <PlayerListItem
                          key={playerIndex}
                          player={player}
                          direction="outgoing"
                        />
                      ))}
                    </div>
                  )}

                  {incomingPlayers.length > 0 && (
                    <div className="mb-2">
                      <div className="text-cockpit-text-muted text-xs mb-1">
                        Incoming Players:
                      </div>
                      {incomingPlayers.map((player, playerIndex) => (
                        <PlayerListItem
                          key={playerIndex}
                          player={player}
                          direction="incoming"
                        />
                      ))}
                    </div>
                  )}

                  {(outgoingEntitlements.length > 0 ||
                    incomingEntitlements.length > 0) && (
                    <div className="mb-2">
                      {outgoingEntitlements.length > 0 && (
                        <div className="mb-2">
                          <div className="text-cockpit-text-muted text-xs mb-1">
                            Entitlements Out:
                          </div>
                          {outgoingEntitlements.map(
                            (entitlement, entitlementIndex) => {
                              const pickRow = projectEntitlementToPickRow(
                                { ...entitlement } as Record<string, unknown>,
                                {
                                  teamCode: toText(team.teamCode),
                                  pickRulesById,
                                }
                              );
                              const secondaryText =
                                getPickRowSecondaryText(pickRow);

                              return (
                                <div
                                  key={entitlement.id || entitlementIndex}
                                  className="text-xs pl-2 py-0.5 border-l border-cockpit-watch/30"
                                >
                                  <div>
                                    <span className="text-cockpit-watch">
                                      {toText(entitlement.seasonYear)} R
                                      {toText(entitlement.round)}
                                    </span>
                                    <span className="text-cockpit-text-secondary ml-1">
                                      — {toText(entitlement.kind)}
                                    </span>
                                    <span className="text-cockpit-text-ghost ml-1 text-[10px]">
                                      ({toText(entitlement.id)})
                                    </span>
                                    {entitlement.toTeamId && (
                                      <span className="text-cockpit-text-ghost ml-1 text-[10px]">
                                        → {toText(entitlement.toTeamId)}
                                      </span>
                                    )}
                                  </div>
                                  {secondaryText && (
                                    <div className="text-cockpit-text-muted text-[10px] mt-0.5">
                                      {secondaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                      {incomingEntitlements.length > 0 && (
                        <div>
                          <div className="text-cockpit-text-muted text-xs mb-1">
                            Entitlements In:
                          </div>
                          {incomingEntitlements.map(
                            (entitlement, entitlementIndex) => {
                              const pickRow = projectEntitlementToPickRow(
                                { ...entitlement } as Record<string, unknown>,
                                {
                                  teamCode: toText(team.teamCode),
                                  pickRulesById,
                                }
                              );
                              const secondaryText =
                                getPickRowSecondaryText(pickRow);

                              return (
                                <div
                                  key={entitlement.id || entitlementIndex}
                                  className="text-xs pl-2 py-0.5 border-l border-cockpit-safe/30"
                                >
                                  <div>
                                    <span className="text-cockpit-safe">
                                      {toText(entitlement.seasonYear)} R
                                      {toText(entitlement.round)}
                                    </span>
                                    <span className="text-cockpit-text-secondary ml-1">
                                      — {toText(entitlement.kind)}
                                    </span>
                                    <span className="text-cockpit-text-ghost ml-1 text-[10px]">
                                      ({toText(entitlement.id)})
                                    </span>
                                    {entitlement.fromTeam && (
                                      <span className="text-cockpit-text-ghost ml-1">
                                        from {toText(entitlement.fromTeam)}
                                      </span>
                                    )}
                                    {entitlement.toTeamId && (
                                      <span className="text-cockpit-info/50 ml-1 text-[10px]">
                                        [routed]
                                      </span>
                                    )}
                                  </div>
                                  {secondaryText && (
                                    <div className="text-cockpit-text-muted text-[10px] mt-0.5">
                                      {secondaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {teamViolations.length > 0 && (
                    <div className="mt-2 p-2 bg-cockpit-danger/20 border border-cockpit-danger/30 rounded">
                      <div className="text-cockpit-danger text-xs font-medium mb-1">
                        Violations:
                      </div>
                      {teamViolations.map((violation, violationIndex) => (
                        <div
                          key={violationIndex}
                          className="text-xs text-cockpit-danger pl-2"
                        >
                          • {toText(getValidationIssueText(violation))}
                        </div>
                      ))}
                    </div>
                  )}
                  {teamWarnings.length > 0 && (
                    <div className="mt-2 p-2 bg-cockpit-watch/20 border border-cockpit-watch/30 rounded">
                      <div className="text-cockpit-watch text-xs font-medium mb-1">
                        Warnings:
                      </div>
                      {teamWarnings.map((warning, warningIndex) => (
                        <div
                          key={warningIndex}
                          className="text-xs text-cockpit-watch pl-2"
                        >
                          • {toText(getValidationIssueText(warning))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cockpit-text-secondary text-xs">
                Full Receipt JSON:
              </span>
            </div>
            <pre className="p-3 bg-cockpit-void border border-cockpit-edge rounded overflow-auto max-h-96 text-xs font-mono text-cockpit-text-secondary">
              {JSON.stringify(receipt, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-2 text-cockpit-text-ghost text-xs text-right">
        Debug panel enabled via VITE_SHOW_TRADE_RECEIPT=true
      </div>
    </div>
  );
};

export { TradeReceiptPanel };
