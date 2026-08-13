import React, { useState, useRef, useEffect } from 'react';
import { formatMillions } from '@/shared/utils/formatting';
import {
  getSalaryForYear,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
import { formatSalary } from '@/shared/utils/formatting';
import { CapImpactTiles } from './CapImpactTiles';
import { SelectTeamCard } from './SelectTeamCard';
import { OutgoingPlayersList } from './OutgoingPlayersList';
import { EntitlementPicksList } from './EntitlementPicksList';
import { TeamSelectDropdown } from '@/shared/components/TeamSelectDropdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TradeExceptionManager } from './TradeExceptionManager';
import { isFaExceptionEligibleType } from '@/features/architect/utils/faExceptionUtils';
import {
  isTwoWayTradePlayer,
  TWO_WAY_TRADE_MATCHING_EXPLANATION,
} from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import { validationFlags } from '@/config/validationFlags';
import { useTradeTeamCardSalaries } from './useTradeTeamCardSalaries';
// Phase 65: Canonical TPE read accessor
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import type { TeamTpeLike } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type {
  UnknownRecord,
  PlayerLike,
  EntitlementLike,
  TeamLike,
  TeamOptionLike,
  TeamTradeException,
  ValidationResultLike,
  ChildPlayerLike,
  ChildTeamOptionLike,
  ChildEntitlementTeamOptionLike,
  OutgoingPlayersListProps,
  TradeTeamCardProps,
} from './TradeTeamCard.helpers';

const formatTradeSectionSalary = (salary: number, hasPlayers: boolean) =>
  hasPlayers && salary === 0 ? '$0' : formatSalary(salary);
import {
  getPlayerKey,
  getPlayerLabel,
  getEntitlementKey,
  formatSkipReasonLabel,
} from './TradeTeamCard.helpers';

export const TradeTeamCard = ({
  team,
  sends,
  // Phase 14.2: Removed picks prop - draft assets are entitlements-only
  yearKey,
  otherTeams = [],
  playersMap = {},
  incomingPlayers = [],
  // Phase 14.2: Changed from incomingPicks to incomingEntitlements
  incomingEntitlements = [],
  onSetPlayerTrade,
  onUndoPlayerTrade,
  onRequestSignAndTrade,
  // Phase 14: Removed onTogglePick and onEditPick (legacy picks UI removed)
  onSelectTeam,
  onRemove,
  onEditContract,
  // Phase 1: Accept validator result for accessor hook wiring
  validationResult = null,
  teamIndex = null,
  // P0-3: Validation in-flight state for loading indicators
  isValidating = false,
  // Phase 11.1: Entitlement trading props
  entitlementsOut = [],
  onToggleEntitlement,
  // Phase 17: Multi-team destination routing
  onSetEntitlementDestination,
  // TM-4: Entitlement edit callback
  onEditEntitlement,
  // View entitlement details callback
  onViewEntitlementDetails,
  // TM-7: Entitlement create callback
  onCreateEntitlement,
  // TM-VACUUM-E2: Vacuum mode + per-item session controls
  isVacuumMode = false,
  onRevertEntitlementEdit,
  onDeleteSessionEntitlement,
  worldId = null,
  // Multi-team layout compact mode
  compact = false,
}: TradeTeamCardProps) => {
  const [activeTab, setActiveTab] = useState('players');
  const [editingTeam, setEditingTeam] = useState(false);
  // Staged pieces are the deal — show them by default so the package is
  // readable at a glance; the rows still toggle closed for a tighter card.
  const [showOutgoing, setShowOutgoing] = useState(true);
  const [showIncoming, setShowIncoming] = useState(true);
  const selectRef = useRef<{
    focus: () => void;
    showPicker?: () => void;
    click: () => void;
  } | null>(null);
  const hasTeam = Boolean(team);
  const selectedTeamId = team?.id ?? team?.teamCode ?? null;
  // Phase 65: Use canonical TPE accessor
  const teamTradeExceptions = getTeamTpeList(
    (team as TeamTpeLike | null) ?? null
  ) as TeamTradeException[];
  const activeTradeExceptions = teamTradeExceptions.filter(
    (tpe) =>
      !tpe.isUsed &&
      (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
  );
  useEffect(() => {
    if (editingTeam && selectRef.current) {
      selectRef.current.focus();
      if (typeof selectRef.current.showPicker === 'function') {
        selectRef.current.showPicker();
      } else {
        selectRef.current.click();
      }
    }
  }, [editingTeam]);

  const {
    filteredIncomingPlayers,
    teamTotalSalary,
    snapshot,
    hasValidatorResult,
    outgoingSalary,
    incomingSalary,
    isEstimate,
    outgoingBaseSalary,
    incomingBaseSalary,
    hasOutgoingAdjustment,
    hasIncomingAdjustment,
    primary,
    playersCount,
    outgoingPlayersTeam,
    playerOtherTeams,
    entitlementOtherTeams,
    picksCount,
    faBuckets,
    allowableIncomingNoTPE,
    salaryMatchingApplicable,
    salaryMatchingSkipReason,
    salaryMatchingRuleLabel,
    salaryMatchingFormula,
    hardCapIsLimiter,
    hardCapLimiterLabel,
    tpeEligiblePlayers,
  } = useTradeTeamCardSalaries({
    team,
    sends,
    incomingPlayers,
    incomingEntitlements,
    entitlementsOut,
    otherTeams,
    yearKey,
    validationResult,
    selectedTeamId,
    teamTradeExceptions,
    hasTeam,
  });

  // Modified player trade handler to support multiple selections
  // Replace the existing handleSetPlayerTrade with:
  const handleSetPlayerTrade = (
    player: PlayerLike,
    action: string,
    targetTeamId: string | null,
    tpe: unknown
  ) => {
    if (onSetPlayerTrade) {
      onSetPlayerTrade(player, action, targetTeamId, tpe);
    }
  };

  // Modified undo trade handler
  const handleUndoPlayerTrade = (player: PlayerLike) => {
    if (onUndoPlayerTrade) {
      onUndoPlayerTrade(player);
    }
  };

  const relaySetPlayerTrade: OutgoingPlayersListProps['onSetPlayerTrade'] = (
    ...args
  ) => {
    const [player, action, targetTeamId, tpe] = args as [
      PlayerLike,
      string,
      string | null | undefined,
      unknown,
    ];
    handleSetPlayerTrade(player, action, targetTeamId ?? null, tpe);
  };

  const relayUndoPlayerTrade: OutgoingPlayersListProps['onUndoPlayerTrade'] = (
    ...args
  ) => {
    const [player] = args as [PlayerLike];
    handleUndoPlayerTrade(player);
  };

  const relayRequestSignAndTrade:
    | OutgoingPlayersListProps['onRequestSignAndTrade']
    | undefined = onRequestSignAndTrade
    ? (...args) => {
        const [player, destinationTeamId] = args as [
          PlayerLike,
          string | null | undefined,
        ];
        onRequestSignAndTrade(player, destinationTeamId ?? null);
      }
    : undefined;

  const relayEditContract = onEditContract
    ? (player: ChildPlayerLike) => onEditContract(player as PlayerLike)
    : undefined;

  if (!team) {
    return <SelectTeamCard onSelectTeam={onSelectTeam} onRemove={onRemove} />;
  }

  return (
    <div
      className={`flex-1 rounded-lg ${
        compact ? 'p-3 space-y-2' : 'p-4 space-y-4'
      } bg-cockpit-slab relative shadow-cockpit-slab border`}
      style={{ borderColor: primary || 'transparent' }}
    >
      {/* Team Header */}
      <div className="relative flex items-center justify-between border-b border-cockpit-edge pb-2">
        <div className="flex-1 min-w-0 max-w-[260px]">
          <TeamSelectDropdown
            selectedTeamId={team.id}
            onChange={(newId: string) => {
              setEditingTeam(false);
              onSelectTeam(newId);
            }}
          />
        </div>

        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute -top-[8px] -right-[8px] text-cockpit-text-ghost text-xs p-0 leading-none hover:text-cockpit-text-muted"
            title="Remove team"
          >
            ✕
          </button>
        )}
      </div>

      <CapImpactTiles
        team={team}
        sends={sends}
        incomingPlayers={incomingPlayers}
        yearKey={yearKey}
        snapshot={snapshot ? { ...snapshot } : null}
        compact={compact}
        isValidating={isValidating}
      />

      <div className="space-y-1">
        {/* Outgoing section */}
        <div>
          <button
            onClick={() => setShowOutgoing((prev) => !prev)}
            className={`w-full text-left bg-cockpit-raised px-3 py-1.5 rounded-md border border-cockpit-edge hover:border-cockpit-text-muted ${
              compact ? 'text-xs' : 'text-sm'
            } flex flex-col gap-0.5 text-cockpit-text-secondary`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="flex items-center gap-1">
                {/* Phase 2.3: Explicit "Matching Value" label when showing matching-adjusted salary */}
                Outgoing {hasOutgoingAdjustment ? 'Matching Value' : 'Salary'}:{' '}
                {/* P0-3: Show loading state during validation in-flight */}
                {isValidating && sends.length > 0 ? (
                  <span className="text-cockpit-info animate-pulse">
                    {hasValidatorResult ? 'Updating…' : 'Calculating…'}
                  </span>
                ) : (
                  formatTradeSectionSalary(outgoingSalary, sends.length > 0)
                )}
                {/* Phase 1: Visible indicator when using local estimate (Rule 2) */}
                {/* P0-3: Hide estimate badge during validation - show loading instead */}
                {!isValidating && isEstimate && sends.length > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 text-[10px] bg-cockpit-watch/20 text-cockpit-watch rounded-md"
                    title="Value is an estimate until trade is validated"
                  >
                    Estimate
                  </span>
                )}
                {/* Phase 2.4: Adjustment indicator */}
                {/* P0-3: Hide adjustment badge during validation */}
                {!isValidating && hasOutgoingAdjustment && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] bg-cockpit-info/20 text-cockpit-info rounded-md"
                    title="Includes player-specific trade matching adjustments"
                  >
                    Adjusted
                  </span>
                )}
              </span>
              {showOutgoing ? (
                <ChevronUp size={14} className="opacity-60" />
              ) : (
                <ChevronDown size={14} className="opacity-60" />
              )}
            </div>
            {/* Phase 2.3: Show base salary as secondary line when there's an adjustment */}
            {/* P0-3: Hide base salary line during validation */}
            {!isValidating && hasOutgoingAdjustment && (
              <span className="text-[11px] text-cockpit-text-muted">
                Base Salary: {formatSalary(outgoingBaseSalary)}
              </span>
            )}
          </button>

          {showOutgoing && (
            <div className="flex flex-wrap gap-2 mt-1 px-1">
              {sends.map((p) => {
                // Phase 2.4: Check if this player has matching adjustment (BYC, poison pill, kicker)
                const baseSalary = getSalaryForYear([p], yearKey);
                const matchingValue = Number(p.matchOutgoing ?? baseSalary);
                const isTwoWay = isTwoWayTradePlayer(p);
                const hasPlayerAdjustment =
                  isTwoWay || Math.abs(matchingValue - baseSalary) > 1;

                // P1: Use shared utility for adjustment type detection
                const adjustmentLabel = getAdjustmentTooltipLabel(
                  p as Record<string, unknown>
                );
                const tooltipText = `${adjustmentLabel}: Base ${formatSalary(
                  baseSalary
                )} → Match ${formatSalary(matchingValue)}`;

                return (
                  <span
                    key={String(getPlayerKey(p))}
                    className="bg-cockpit-danger/15 text-cockpit-text-primary text-[11px] px-2 py-0.5 rounded-full border border-cockpit-danger/25 flex items-center gap-1"
                  >
                    {getPlayerLabel(p)}
                    <span className="text-cockpit-text-muted">
                      {formatSalary(baseSalary)}
                    </span>
                    {/* P1: Player-level adjustment indicator with specific tooltip */}
                    {hasPlayerAdjustment && (
                      <span
                        className="px-1 py-0.5 text-[10px] bg-cockpit-info/20 text-cockpit-info rounded-md leading-none"
                        title={tooltipText}
                      >
                        {isTwoWay ? '2W' : 'Adj'}
                      </span>
                    )}
                    {onUndoPlayerTrade && (
                      <button
                        onClick={() => handleUndoPlayerTrade(p)}
                        className="ml-1 text-cockpit-text-muted hover:text-cockpit-text-primary"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              {/* Phase 14.2: Show outgoing entitlements instead of picks */}
              {entitlementsOut
                .filter((e) => e.fromTeamId === selectedTeamId || !e.fromTeamId)
                .map((e) => (
                  <span
                    key={String(getEntitlementKey(e))}
                    className="bg-cockpit-danger/15 text-cockpit-text-secondary text-[11px] px-2 py-0.5 rounded-full border border-cockpit-danger/25"
                  >
                    {e.seasonYear ?? '—'}{' '}
                    {Number(e.round) === 1
                      ? '1st Rd'
                      : Number(e.round) === 2
                        ? '2nd Rd'
                        : `R${e.round ?? '—'}`}{' '}
                    {e.kind === 'swap_right' ? 'Swap' : 'Pick'}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Incoming section */}
        <div>
          <button
            onClick={() => setShowIncoming((prev) => !prev)}
            className={`w-full text-left bg-cockpit-raised px-3 py-1.5 rounded-md border border-cockpit-edge hover:border-cockpit-text-muted ${
              compact ? 'text-xs' : 'text-sm'
            } flex flex-col gap-0.5 text-cockpit-text-secondary`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="flex items-center gap-1">
                {/* Phase 2.3: Explicit "Matching Value" label when showing matching-adjusted salary */}
                Incoming {hasIncomingAdjustment ? 'Matching Value' : 'Salary'}:{' '}
                {/* P0-3: Show loading state during validation in-flight */}
                {isValidating && incomingPlayers.length > 0 ? (
                  <span className="text-cockpit-info animate-pulse">
                    {hasValidatorResult ? 'Updating…' : 'Calculating…'}
                  </span>
                ) : (
                  formatTradeSectionSalary(
                    incomingSalary,
                    incomingPlayers.length > 0
                  )
                )}
                {/* Phase 1: Visible indicator when using local estimate (Rule 2) */}
                {/* P0-3: Hide estimate badge during validation - show loading instead */}
                {!isValidating && isEstimate && incomingPlayers.length > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 text-[10px] bg-cockpit-watch/20 text-cockpit-watch rounded-md"
                    title="Value is an estimate until trade is validated"
                  >
                    Estimate
                  </span>
                )}
                {/* Phase 2.4: Adjustment indicator */}
                {/* P0-3: Hide adjustment badge during validation */}
                {!isValidating && hasIncomingAdjustment && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] bg-cockpit-info/20 text-cockpit-info rounded-md"
                    title="Includes player-specific trade matching adjustments"
                  >
                    Adjusted
                  </span>
                )}
              </span>
              {showIncoming ? (
                <ChevronUp size={14} className="opacity-60" />
              ) : (
                <ChevronDown size={14} className="opacity-60" />
              )}
            </div>
            {/* Phase 2.3: Show base salary as secondary line when there's an adjustment */}
            {/* P0-3: Hide base salary line during validation */}
            {!isValidating && hasIncomingAdjustment && (
              <span className="text-[11px] text-cockpit-text-muted">
                Base Salary: {formatSalary(incomingBaseSalary)}
              </span>
            )}
          </button>

          {showIncoming && (
            <div className="flex flex-wrap gap-2 mt-1 px-1">
              {incomingPlayers.map((p) => {
                // Phase 2.4: Check if this player has matching adjustment (BYC, poison pill, kicker)
                const baseSalary = getSalaryForYear([p], yearKey);
                const matchingValue = Number(p.matchIncoming ?? baseSalary);
                const isTwoWay = isTwoWayTradePlayer(p);
                const hasPlayerAdjustment =
                  isTwoWay || Math.abs(matchingValue - baseSalary) > 1;

                // P1: Use shared utility for adjustment type detection
                const adjustmentLabel = getAdjustmentTooltipLabel(
                  p as Record<string, unknown>
                );
                const tooltipText = `${adjustmentLabel}: Base ${formatSalary(
                  baseSalary
                )} → Match ${formatSalary(matchingValue)}`;

                return (
                  <span
                    key={String(getPlayerKey(p))}
                    className="bg-cockpit-safe/15 text-cockpit-text-primary text-[11px] px-2 py-0.5 rounded-full border border-cockpit-safe/25 flex items-center gap-1"
                  >
                    {getPlayerLabel(p)}
                    <span className="text-cockpit-text-muted">
                      {formatSalary(baseSalary)}
                    </span>
                    {/* P1: Player-level adjustment indicator with specific tooltip */}
                    {hasPlayerAdjustment && (
                      <span
                        className="px-1 py-0.5 text-[10px] bg-cockpit-info/20 text-cockpit-info rounded-md leading-none"
                        title={tooltipText}
                      >
                        {isTwoWay ? '2W' : 'Adj'}
                      </span>
                    )}
                    {onUndoPlayerTrade && (
                      <button
                        onClick={() => handleUndoPlayerTrade(p)}
                        className="ml-1 text-cockpit-text-muted hover:text-cockpit-text-primary"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              {/* Phase 14.2: Show incoming entitlements instead of picks */}
              {incomingEntitlements.map((e) => (
                <span
                  key={String(getEntitlementKey(e))}
                  className="bg-cockpit-safe/15 text-cockpit-text-secondary text-[11px] px-2 py-0.5 rounded-full border border-cockpit-safe/25"
                >
                  {e.seasonYear ?? '—'}{' '}
                  {Number(e.round) === 1
                    ? '1st Rd'
                    : Number(e.round) === 2
                      ? '2nd Rd'
                      : `R${e.round ?? '—'}`}{' '}
                  {e.kind === 'swap_right' ? 'Swap' : 'Pick'}
                </span>
              ))}
            </div>
          )}
          {/* Show Allowable Incoming and TPEs side-by-side */}
          <div className="flex flex-wrap gap-4 text-xs text-cockpit-text-secondary mt-1 items-center">
            <div>
              Allowable Incoming:{' '}
              <span className="font-semibold text-cockpit-text-primary">
                {/* P0-3: Show loading state during validation in-flight */}
                {isValidating ? (
                  <span className="text-cockpit-info animate-pulse">
                    {hasValidatorResult ? 'Updating…' : 'Calculating…'}
                  </span>
                ) : allowableIncomingNoTPE != null ? (
                  formatSalary(allowableIncomingNoTPE)
                ) : (
                  /* P3-3: Add tooltip explaining why salary matching is not applicable */
                  <span
                    title={
                      salaryMatchingSkipReason
                        ? `Not applicable: ${formatSkipReasonLabel(
                            salaryMatchingSkipReason
                          )}`
                        : undefined
                    }
                  >
                    —
                  </span>
                )}
              </span>
              {/* P3-3: Show (N/A) tag when salary matching not applicable and skip reason exists */}
              {!isValidating &&
                allowableIncomingNoTPE == null &&
                salaryMatchingSkipReason && (
                  <span
                    className="ml-1 text-cockpit-text-muted text-[10px]"
                    title={`Not applicable: ${formatSkipReasonLabel(
                      salaryMatchingSkipReason
                    )}`}
                  >
                    (N/A)
                  </span>
                )}
              {/* Phase 1: Visible indicator when using local estimate (Rule 2) */}
              {/* P0-3: Hide estimate badge during validation - show loading instead */}
              {!isValidating && isEstimate && (
                <span
                  className="ml-1 px-1.5 py-0.5 text-[10px] bg-cockpit-watch/20 text-cockpit-watch rounded-md"
                  title="Value is an estimate until trade is validated"
                >
                  Estimate
                </span>
              )}
              {/* P3-3: Skip reason is now shown via tooltip on "—" and "(N/A)" tag.
                  The formatSkipReasonLabel helper converts internal codes to readable labels. */}
              {/* Show rule label only when applicable (no skipReason) and rule is meaningful */}
              {/* P0-3: Hide rule label during validation */}
              {/* BZE-224: run the rule label through the skip-reason formatter so
                  validator codes (UNDER_CAP, SECOND_APRON…) never render raw */}
              {!isValidating &&
                !salaryMatchingSkipReason &&
                salaryMatchingRuleLabel &&
                salaryMatchingRuleLabel !== 'unknown' && (
                  <span
                    className="ml-1 text-cockpit-text-muted"
                    title={salaryMatchingFormula}
                    role="note"
                    aria-label={`Rule: ${
                      formatSkipReasonLabel(salaryMatchingRuleLabel) ??
                      salaryMatchingRuleLabel
                    }. Formula: ${salaryMatchingFormula}`}
                  >
                    (
                    {formatSkipReasonLabel(salaryMatchingRuleLabel) ??
                      salaryMatchingRuleLabel}
                    )
                  </span>
                )}
              {!isValidating && hardCapIsLimiter && (
                <span
                  className="ml-1 text-cockpit-watch text-[10px]"
                  title={`Hard cap ceiling is the active allowable incoming limiter (${hardCapLimiterLabel})`}
                >
                  ({hardCapLimiterLabel} Limited)
                </span>
              )}
            </div>
            {/* TMUI-17: gate on ACTIVE TPEs so the "Available" label matches reality */}
            {activeTradeExceptions.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-cockpit-text-secondary">Available TPEs:</span>
                {activeTradeExceptions.map((tpe, tpeIdx) => (
                  <span
                    key={String(tpe.id ?? tpeIdx)}
                    className="bg-cockpit-raised text-cockpit-text-secondary px-2 py-0.5 rounded-full border border-cockpit-edge"
                  >
                    {formatMillions(Number(tpe.amount ?? 0), 1)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className={`flex ${
          compact ? 'gap-2 text-xs' : 'gap-4 text-sm'
        } border-b border-cockpit-edge pb-1`}
      >
        <button
          className={`pb-1 ${
            activeTab === 'players'
              ? 'text-cockpit-text-primary border-b-2'
              : 'text-cockpit-text-secondary'
          }`}
          style={activeTab === 'players' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('players')}
        >
          {compact ? `Plyr (${playersCount})` : `Players (${playersCount})`}
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'picks'
              ? 'text-cockpit-text-primary border-b-2'
              : 'text-cockpit-text-secondary'
          }`}
          style={activeTab === 'picks' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('picks')}
        >
          {compact ? `Pck (${picksCount})` : `Picks (${picksCount})`}
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'exceptions'
              ? 'text-cockpit-text-primary border-b-2'
              : 'text-cockpit-text-secondary'
          }`}
          style={activeTab === 'exceptions' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('exceptions')}
        >
          {compact
            ? `Exc (${activeTradeExceptions.length})`
            : `Exceptions (${activeTradeExceptions.length})`}
        </button>
      </div>

      {activeTab === 'players' && (
        <OutgoingPlayersList
          team={outgoingPlayersTeam}
          sends={sends}
          incomingPlayers={filteredIncomingPlayers}
          yearKey={yearKey}
          worldId={worldId}
          otherTeams={playerOtherTeams}
          playersMap={playersMap}
          sourceTeamId={team?.teamCode || team?.id || null}
          sourceTeamCapHolds={team?.capHolds || []}
          onSetPlayerTrade={relaySetPlayerTrade}
          onRequestSignAndTrade={relayRequestSignAndTrade}
          onUndoPlayerTrade={relayUndoPlayerTrade}
          onEditContract={relayEditContract}
          compact={compact}
        />
      )}

      {activeTab === 'picks' && (
        // Phase 14: Always render EntitlementPicksList (removed legacy OutgoingPicksList fallback)
        <EntitlementPicksList
          entitlements={team.entitlements || []}
          teamId={team.id || team.teamCode || ''}
          showPooled={false}
          // Phase 11.1: Pass toggle handler and selected entitlement IDs
          onToggleEntitlement={
            onToggleEntitlement
              ? (entitlement) =>
                  onToggleEntitlement(entitlement as EntitlementLike)
              : undefined
          }
          selectedEntitlementIds={(entitlementsOut || [])
            .map((e) => e.entitlementId || e.id)
            .filter((id): id is string | number => id !== undefined)}
          // Phase 12.3B: Pass pick rules for structured derivation
          pickRulesById={team.pickRulesById || {}}
          emptyStateHint="This team has no tradeable picks loaded."
          // Phase 17: Pass multi-team destination routing props
          otherTeams={entitlementOtherTeams}
          entitlementsOut={entitlementsOut}
          onSetDestination={
            onSetEntitlementDestination
              ? (entitlementId, toTeamId) =>
                  onSetEntitlementDestination(
                    entitlementId == null ? null : String(entitlementId),
                    toTeamId == null ? null : String(toTeamId)
                  )
              : undefined
          }
          onEditEntitlement={
            onEditEntitlement
              ? (entitlement) =>
                  onEditEntitlement(entitlement as EntitlementLike)
              : undefined
          }
          onViewDetails={
            onViewEntitlementDetails
              ? (entitlement) =>
                  onViewEntitlementDetails(entitlement as EntitlementLike)
              : undefined
          }
          onCreateEntitlement={
            onCreateEntitlement ? () => onCreateEntitlement(team.id) : undefined
          }
          isVacuumMode={isVacuumMode}
          onRevertEntitlementEdit={
            onRevertEntitlementEdit
              ? (entitlement) =>
                  onRevertEntitlementEdit(entitlement as EntitlementLike)
              : undefined
          }
          onDeleteSessionEntitlement={
            onDeleteSessionEntitlement
              ? (entitlement) =>
                  onDeleteSessionEntitlement(entitlement as EntitlementLike)
              : undefined
          }
          compact={compact}
        />
      )}

      {activeTab === 'exceptions' &&
        (teamTradeExceptions.length > 0 ? (
          <TradeExceptionManager
            exceptions={teamTradeExceptions}
            teamId={team.id ?? undefined}
          />
        ) : (
          <div className="text-xs text-cockpit-text-muted px-1">
            No trade exceptions available for this team.
          </div>
        ))}

      {/* Phase 14.2: Show if incoming players or entitlements */}
      {(incomingPlayers.length > 0 || incomingEntitlements.length > 0) && (
        <div
          className="bg-cockpit-raised border rounded-md p-3 text-sm max-h-[300px] overflow-y-auto"
          style={{ borderColor: primary }}
        >
          <h4 className="text-cockpit-text-secondary text-sm mb-2">Incoming</h4>
          <div className="text-cockpit-text-primary">
            {incomingPlayers.map((p) => {
              // Auto-detect absorption mode: if no explicit mode set and player fits a TPE, default to TPE
              const isTwoWay = isTwoWayTradePlayer(p);
              const isTpeEligible = tpeEligiblePlayers.some(
                (ep) => (ep.player_id || ep.id) === (p.player_id || p.id)
              );
              const effectiveMode =
                isTwoWay
                  ? 'MATCH'
                  : p.absorptionMode || (isTpeEligible ? 'TPE' : 'MATCH');

              return (
                <div
                  key={String(getPlayerKey(p))}
                  className="mb-1 flex items-center gap-2"
                >
                  <span>• {getPlayerLabel(p)}</span>
                  {validationFlags.faExceptionTrade !== 'off' && (
                    <>
                      <select
                        className="bg-cockpit-raised text-xs rounded-md px-1"
                        value={String(effectiveMode)}
                        disabled={isTwoWay}
                        title={
                          isTwoWay
                            ? TWO_WAY_TRADE_MATCHING_EXPLANATION
                            : undefined
                        }
                        onChange={(e) =>
                          onSetPlayerTrade &&
                          onSetPlayerTrade(
                            p,
                            'setAbsorptionMode',
                            e.target.value
                          )
                        }
                      >
                        <option value="MATCH">
                          {isTwoWay ? 'No salary match (Two-Way)' : 'Matching'}
                        </option>
                        {!isTwoWay && <option value="TPE">TPE</option>}
                        {!isTwoWay && (
                          <option value="FA_EXCEPTION">FA Exception</option>
                        )}
                      </select>
                      {/* TPE selector - show when TPE mode selected */}
                      {effectiveMode === 'TPE' && (
                        <select
                          className="bg-cockpit-raised text-xs rounded-md px-1"
                          value={p.tpeId == null ? '' : String(p.tpeId)}
                          onChange={(e) =>
                            onSetPlayerTrade &&
                            onSetPlayerTrade(p, 'setTpeId', e.target.value)
                          }
                        >
                          <option value="">Select TPE...</option>
                          {(teamTradeExceptions || [])
                            .filter(
                              (tpe) =>
                                !tpe.isUsed &&
                                (!tpe.expirationDate ||
                                  new Date(tpe.expirationDate) > new Date())
                            )
                            .map((tpe) => {
                              const amount = formatMillions(
                                Number(tpe.amount ?? 0),
                                1
                              );
                              const tpeName = tpe.name || tpe.createdFrom;
                              const playerSalary = getSalaryForYear(
                                [p],
                                yearKey
                              );
                              const fits =
                                Number(tpe.amount ?? 0) >= playerSalary;
                              return (
                                <option
                                  key={String(tpe.id ?? amount)}
                                  value={String(tpe.id ?? '')}
                                  disabled={!fits}
                                >
                                  {amount}
                                  {tpeName ? ` (${tpeName})` : ''}{' '}
                                  {!fits ? '(too small)' : ''}
                                </option>
                              );
                            })}
                        </select>
                      )}
                      {effectiveMode === 'FA_EXCEPTION' && (
                        <select
                          className="bg-cockpit-raised text-xs rounded-md px-1"
                          value={String(p.bucketType ?? '')}
                          onChange={(e) =>
                            onSetPlayerTrade &&
                            onSetPlayerTrade(p, 'setFaBucket', e.target.value)
                          }
                        >
                          {faBuckets
                            .filter((b) =>
                              isFaExceptionEligibleType(b.type, validationFlags)
                            )
                            .map((b) => (
                              <option
                                key={String(b.type)}
                                value={String(b.type)}
                              >
                                {String(b.type)} (${Number(b.remaining)})
                              </option>
                            ))}
                        </select>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {/* Phase 14.2: Show incoming entitlements instead of picks */}
            {incomingEntitlements.map((e) => (
              <div key={String(getEntitlementKey(e))}>
                • {e.seasonYear ?? '—'} R{e.round ?? '—'}{' '}
                {e.kind === 'swap_right' ? 'Swap Right' : 'Pick'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
