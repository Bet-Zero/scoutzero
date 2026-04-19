import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getTeamColors, formatMillions } from '@/shared/utils/formatting';
import {
  getSalaryForYear,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
import { formatSalary } from '@/shared/utils/formatting';
import CapImpactTiles from './CapImpactTiles';
import { SelectTeamCard } from './SelectTeamCard';
import { OutgoingPlayersList } from './OutgoingPlayersList';
import { EntitlementPicksList } from './EntitlementPicksList';
import TeamSelectDropdown from '@/shared/components/TeamSelectDropdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TradeExceptionManager from './TradeExceptionManager';
import {
  getTeamFaExceptionBuckets,
  isFaExceptionEligibleType,
} from '@/features/architect/utils/faExceptionUtils';
import { validationFlags } from '@/config/validationFlags';
import {
  getCapHitForSeason,
  normalizeYearInput,
} from '@/features/architect/utils/tradeMachine/utils/seasonUtils';
import { toSeasonKey } from '@/features/architect/utils/seasonUtils';
import { getSalaryMatchingResult } from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
// Phase 1: Accessor function for validator result consumption (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.0)
import { getTeamSnapshot } from '@/features/architect/hooks/useTradeMachineSnapshot';
import {
  computeTeamCapTotals,
  warnOnTotalsDivergence,
} from '@/features/architect/utils/capTotals';
// Phase 65: Canonical TPE read accessor
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import type { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import type {
  TeamTpeLike,
  TradeExceptionLike,
} from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

type UnknownRecord = Record<string, unknown>;
type UseTradeMachineResult = ReturnType<typeof useTradeMachine>;
type HookTradeTeamSlot = UseTradeMachineResult['teams'][number];
type HookTradeTeam = NonNullable<HookTradeTeamSlot['team']>;
type OutgoingPlayersListProps = Parameters<typeof OutgoingPlayersList>[0];
type EntitlementPicksListProps = Parameters<typeof EntitlementPicksList>[0];
type ChildPlayerLike = OutgoingPlayersListProps['sends'][number];
type ChildTeamOptionLike = NonNullable<
  OutgoingPlayersListProps['otherTeams']
>[number];
type ChildEntitlementTeamOptionLike = NonNullable<
  EntitlementPicksListProps['otherTeams']
>[number];
type ValidationResultLike = Parameters<typeof getTeamSnapshot>[1];
type HookTradePlayer = HookTradeTeamSlot['sends'][number];
type HookTradeEntitlement = NonNullable<
  HookTradeTeamSlot['entitlementsOut']
>[number];
type PlayerLike = HookTradePlayer &
  ChildPlayerLike & {
    matchOutgoing?: number | string | null;
    matchIncoming?: number | string | null;
    absorptionMode?: string | null;
    tpeId?: string | number | null;
    bucketType?: string | null;
  };
type EntitlementLike = HookTradeEntitlement & {
  id?: string | number;
  entitlementId?: string | number;
  identityKey?: string;
  underlyingStatus?: string;
  seasonYear?: number | string | null;
  round?: number | string | null;
  kind?: string | null;
  secondaryText?: string | null;
  fromTeamId?: string | number | null;
  toTeamId?: string | number | null;
  linkedEntitlementIds?: Array<string | number>;
  residualOfEntitlementId?: string | number | null;
  __vacuumSessionOnly?: boolean;
  __vacuumEdited?: boolean;
};
type TeamOptionLike = ChildTeamOptionLike &
  ChildEntitlementTeamOptionLike & {
    id?: string;
    teamName?: string;
    teamCode?: string;
  };
type TeamLike = Omit<
  HookTradeTeam,
  | 'id'
  | 'teamId'
  | 'teamCode'
  | 'teamName'
  | 'abbreviation'
  | 'players'
  | 'entitlements'
  | 'pickRulesById'
  | 'capHolds'
  | 'teamTotalSalary'
  | 'totalSalary'
> & {
  id?: string | null;
  teamId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  abbreviation?: string | null;
  players?: PlayerLike[];
  entitlements?: EntitlementLike[];
  pickRulesById?: Record<string, unknown>;
  capHolds?: unknown[];
  teamTotalSalary?: number;
  totalSalary?: number;
};
type TeamTradeException = TradeExceptionLike & {
  id?: string | number;
  amount?: number | null;
  remaining?: number | null;
  name?: string | null;
  createdFrom?: string | null;
  isUsed?: boolean;
  expirationDate?: string | null;
  expiresOn?: string | null;
};

const getPlayerKey = (player: PlayerLike) =>
  player.player_id ?? player.id ?? player.name ?? 'player';

const getPlayerLabel = (player: PlayerLike) =>
  player.name ?? player.bio?.displayName ?? 'Unnamed player';

const getEntitlementKey = (entitlement: EntitlementLike) =>
  entitlement.id ??
  entitlement.entitlementId ??
  entitlement.identityKey ??
  `${entitlement.seasonYear ?? 'unknown'}-${entitlement.round ?? 'unknown'}-${
    entitlement.kind ?? 'unknown'
  }`;

interface TradeTeamCardProps {
  team?: TeamLike | null;
  sends: PlayerLike[];
  yearKey: string | number;
  otherTeams?: TeamOptionLike[];
  playersMap?: OutgoingPlayersListProps['playersMap'];
  incomingPlayers?: PlayerLike[];
  incomingEntitlements?: EntitlementLike[];
  onSetPlayerTrade?:
    | ((
        player: PlayerLike,
        action: string,
        targetTeamId?: string | null,
        meta?: unknown
      ) => void)
    | null;
  onUndoPlayerTrade?: ((player: PlayerLike) => void) | null;
  onRequestSignAndTrade?:
    | ((player: PlayerLike, defaultDestinationTeamId?: string | null) => void)
    | null;
  onSelectTeam: (teamId: string) => void;
  onRemove?: (() => void) | null;
  onEditContract?: ((player: PlayerLike) => void) | null;
  validationResult?: ValidationResultLike;
  teamIndex?: number | null;
  isValidating?: boolean;
  entitlementsOut?: EntitlementLike[];
  onToggleEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  onSetEntitlementDestination?:
    | ((
        entitlementId: string | undefined | null,
        toTeamId: string | undefined | null
      ) => void)
    | null;
  onEditEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  onViewEntitlementDetails?: ((entitlement: EntitlementLike) => void) | null;
  onCreateEntitlement?: ((teamId?: string | null) => void) | null;
  isVacuumMode?: boolean;
  onRevertEntitlementEdit?: ((entitlement: EntitlementLike) => void) | null;
  onDeleteSessionEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  worldId?: string | null;
  compact?: boolean;
}

/**
 * P3-3: Convert internal skip reason codes to human-readable labels.
 * Example: "HARD_CAP_SKIP" → "Hard cap skip", "TPE_ABSORPTION" → "TPE absorption"
 * If already readable (no underscores, already has spaces), returns as-is.
 */
function formatSkipReasonLabel(skipReason: unknown): string | null {
  if (!skipReason || typeof skipReason !== 'string') return null;

  // If already looks human-readable (contains spaces, no underscores), return as-is
  if (skipReason.includes(' ') && !skipReason.includes('_')) {
    return skipReason;
  }

  const ACRONYMS = ['TPE', 'BYC', 'MLE', 'BAE'];
  const words = skipReason.split('_');

  const processed = words.map((word, index) => {
    const upper = word.toUpperCase();
    if (ACRONYMS.includes(upper)) return upper;

    // Title-case first word, lowercase others
    if (index === 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.toLowerCase();
  });

  return processed.join(' ');
}

const TradeTeamCard = ({
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
  const [showOutgoing, setShowOutgoing] = useState(false);
  const [showIncoming, setShowIncoming] = useState(false);
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
  const capImpactTeam = team
    ? {
        id: team.id ?? undefined,
        teamId: team.teamId ?? undefined,
        teamTotalSalary:
          typeof team.teamTotalSalary === 'number'
            ? team.teamTotalSalary
            : undefined,
        totalSalary:
          typeof team.totalSalary === 'number' ? team.totalSalary : undefined,
      }
    : null;

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

  // Filter incoming players (not already on team)
  const filteredIncomingPlayers = useMemo(
    () =>
      incomingPlayers.filter(
        (p) => !team?.players?.some((tp) => tp.player_id === p.player_id)
      ),
    [incomingPlayers, team?.players]
  );

  // Use SSOT teamTotalSalary from computeTeamCapTotals
  // This ensures TradeTeamCard uses the SAME value as the Cap Sheet and validator
  const teamTotalSalary = useMemo(() => {
    if (!team) return 0;
    const normalizedYear = normalizeYearInput(yearKey);
    if (!normalizedYear) return 0;

    const totals = computeTeamCapTotals(
      team as UnknownRecord,
      normalizedYear.endYear
    );
    return totals.totalCapAllocations || 0;
  }, [team, yearKey]);

  // Phase 1: Get snapshot from validator result (golden source of truth)
  // RULE: For legality-affecting numbers, use snapshot values; do NOT recompute locally
  const snapshot = getTeamSnapshot(selectedTeamId, validationResult);
  const hasValidatorResult = snapshot !== null;

  // Phase 1: Outgoing/Incoming salaries come from validator snapshot
  // Fallback to local calculation ONLY when validator hasn't run yet (with visible indicator)
  const localOutgoingSalary = useMemo(
    () => getSalaryForYear(sends, yearKey),
    [sends, yearKey]
  );
  const localIncomingSalary = useMemo(
    () => getSalaryForYear(incomingPlayers, yearKey),
    [incomingPlayers, yearKey]
  );

  // Use snapshot values when available, fallback to local with Estimate indicator
  const outgoingSalary = hasValidatorResult
    ? snapshot.outgoingMatchingSalary
    : localOutgoingSalary;
  const incomingSalary = hasValidatorResult
    ? snapshot.incomingMatchingSalary
    : localIncomingSalary;
  const isEstimate = !hasValidatorResult;

  // Phase 2.1/2.3: Base salaries from snapshot (for UX clarity - showing both matching + base)
  const outgoingBaseSalary = hasValidatorResult
    ? snapshot.outgoingBaseSalary
    : localOutgoingSalary;
  const incomingBaseSalary = hasValidatorResult
    ? snapshot.incomingBaseSalary
    : localIncomingSalary;

  // Phase 2.4: Determine if there's a matching adjustment (base differs from matching)
  const hasOutgoingAdjustment =
    hasValidatorResult && Math.abs(outgoingSalary - outgoingBaseSalary) > 1;
  const hasIncomingAdjustment =
    hasValidatorResult && Math.abs(incomingSalary - incomingBaseSalary) > 1;

  // DEV-ONLY: Divergence checks using canonical helper (Phase 1.8, Phase 73)
  // Phase 73: Updated to use warnOnTotalsDivergence for consistent rate-limited warnings
  if (hasValidatorResult) {
    warnOnTotalsDivergence(
      'TradeTeamCard',
      'outgoingSalary',
      localOutgoingSalary,
      snapshot.outgoingMatchingSalary,
      1
    );
    warnOnTotalsDivergence(
      'TradeTeamCard',
      'incomingSalary',
      localIncomingSalary,
      snapshot.incomingMatchingSalary,
      1
    );
  }

  const { primary } = useMemo(
    () =>
      getTeamColors(
        team?.id === null || team?.id === undefined ? undefined : String(team.id)
      ),
    [team?.id]
  );

  const playersCount = useMemo(
    () => (team?.players?.length || 0) - sends.length + incomingPlayers.length,
    [team, sends, incomingPlayers]
  );

  // Phase 14.2: Count based on entitlements, not legacy picks
  const picksCount = useMemo(
    () =>
      (team?.entitlements?.length || 0) -
      entitlementsOut.length +
      incomingEntitlements.length,
    [team, entitlementsOut, incomingEntitlements]
  );

  // Use centralized cap settings provider for consistent cap/apron values
  const capSettings = useMemo(() => {
    return getCapSettingsForYear(yearKey);
  }, [yearKey]);

  const faBuckets = useMemo(
    () => getTeamFaExceptionBuckets(team || {}),
    [team]
  );

  // Phase 1: Allowable incoming from validator snapshot (golden number)
  // Local calculation retained ONLY for DEV divergence warning, not for display
  const localSalaryMatchingResult = useMemo(() => {
    if (!hasTeam || !capSettings) return null;

    return getSalaryMatchingResult({
      teamTotalSalary,
      outgoingSalary: localOutgoingSalary,
      capSettings: {
        salaryCap: capSettings.salaryCap || Number(capSettings.cap) || 0,
        firstApron: capSettings.firstApron || 0,
        secondApron: capSettings.secondApron || 0,
      },
    });
  }, [hasTeam, teamTotalSalary, localOutgoingSalary, capSettings]);

  // Phase 1: Use snapshot.allowableIncoming as source of truth (may be null when not applicable)
  // Fallback to local ONLY when no validator result (with Estimate indicator)
  const allowableIncomingNoTPE = hasValidatorResult
    ? snapshot.displayAllowableIncoming // Hard-cap-aware value when available
    : (localSalaryMatchingResult?.allowableIncoming ?? 0);

  // Phase: Allowable Incoming N/A Consistency - use explicit applicability from snapshot
  const salaryMatchingApplicable = hasValidatorResult
    ? snapshot.salaryMatchingApplicable
    : true;
  const salaryMatchingSkipReason = hasValidatorResult
    ? snapshot.salaryMatchingSkipReason
    : null;

  // Phase 1: Rule label from snapshot (not local recomputation)
  const salaryMatchingRuleLabel = hasValidatorResult
    ? snapshot.salaryMatchingRule
    : localSalaryMatchingResult?.ruleLabel || '';
  const salaryMatchingFormula = hasValidatorResult
    ? snapshot.salaryMatchingFormula
    : localSalaryMatchingResult?.formulaUsed || '';
  const hardCapIsLimiter =
    hasValidatorResult &&
    snapshot.isHardCapped &&
    snapshot.effectiveAllowableIncoming != null &&
    snapshot.allowableIncoming != null &&
    snapshot.effectiveAllowableIncoming < snapshot.allowableIncoming;
  const hardCapLimiterLabel = hasValidatorResult
    ? snapshot.hardCapLimiterLabel ||
      (snapshot.hardCapType === 'SECOND_APRON'
        ? '2nd Apron'
        : snapshot.hardCapType === 'FIRST_APRON'
          ? '1st Apron'
          : snapshot.hardCapType === 'UNKNOWN'
            ? '1st Apron (fail-closed)'
            : 'Hard Cap')
    : null;

  // DEV-ONLY: Allowable incoming divergence check (Phase 1.8)
  // Only check when both values are numbers (skip when not applicable)
  if (
    import.meta.env.DEV &&
    hasValidatorResult &&
    localSalaryMatchingResult &&
    snapshot.allowableIncoming != null &&
    localSalaryMatchingResult.allowableIncoming != null
  ) {
    const diff = Math.abs(
      localSalaryMatchingResult.allowableIncoming - snapshot.allowableIncoming
    );
    if (diff > 1) {
      console.warn('[TradeTeamCard] allowableIncoming DIVERGENCE', {
        local: localSalaryMatchingResult.allowableIncoming,
        snapshot: snapshot.allowableIncoming,
        diff,
        teamId: team?.id,
        localRule: localSalaryMatchingResult.ruleLabel,
        snapshotRule: snapshot.salaryMatchingRule,
      });
    }
  }

  const tpeEligiblePlayers = useMemo(() => {
    if (!hasTeam) return [];
    const seasonKey =
      typeof yearKey === 'string' && yearKey.includes('-')
        ? yearKey
        : toSeasonKey(yearKey);

    return incomingPlayers.filter((player) => {
      const playerSalary =
        getCapHitForSeason(player as UnknownRecord, seasonKey) || 0;
      return (teamTradeExceptions || []).some(
        (tpe) =>
          !tpe?.isUsed &&
          playerSalary <= Number(tpe?.amount ?? 0) &&
          (!tpe?.expirationDate ||
            new Date(String(tpe.expirationDate)) > new Date())
      );
    });
  }, [hasTeam, incomingPlayers, teamTradeExceptions, yearKey]);

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
      } bg-[#111] relative shadow-inner border`}
      style={{ borderColor: primary || 'transparent' }}
    >
      {/* Team Header */}
      <div className="relative flex items-center justify-between border-b border-white/10 pb-2">
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
            className="absolute -top-[8px] -right-[8px] text-white/20 text-xs p-0 leading-none hover:text-white/50"
            title="Remove team"
          >
            ✕
          </button>
        )}
      </div>

      <CapImpactTiles
        team={capImpactTeam}
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
            className={`w-full text-left bg-[#1c1c1c] px-3 py-1.5 rounded border border-white/10 hover:border-neutral-500 ${
              compact ? 'text-xs' : 'text-sm'
            } flex flex-col gap-0.5 text-white/80`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="flex items-center gap-1">
                {/* Phase 2.3: Explicit "Matching Value" label when showing matching-adjusted salary */}
                Outgoing {hasOutgoingAdjustment ? 'Matching Value' : 'Salary'}:{' '}
                {/* P0-3: Show loading state during validation in-flight */}
                {isValidating && sends.length > 0 ? (
                  <span className="text-blue-400 animate-pulse">
                    {hasValidatorResult ? 'Updating…' : 'Calculating…'}
                  </span>
                ) : (
                  formatSalary(outgoingSalary)
                )}
                {/* Phase 1: Visible indicator when using local estimate (Rule 2) */}
                {/* P0-3: Hide estimate badge during validation - show loading instead */}
                {!isValidating && isEstimate && sends.length > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-600/20 text-amber-400 rounded"
                    title="Value is an estimate until trade is validated"
                  >
                    Estimate
                  </span>
                )}
                {/* Phase 2.4: Adjustment indicator */}
                {/* P0-3: Hide adjustment badge during validation */}
                {!isValidating && hasOutgoingAdjustment && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] bg-purple-600/20 text-purple-300 rounded"
                    title="Includes BYC, poison pill, or trade kicker adjustments"
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
              <span className="text-[11px] text-white/50">
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
                const hasPlayerAdjustment =
                  Math.abs(matchingValue - baseSalary) > 1;

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
                    className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                  >
                    {getPlayerLabel(p)}
                    {/* P1: Player-level adjustment indicator with specific tooltip */}
                    {hasPlayerAdjustment && (
                      <span
                        className="px-1 py-0.5 text-[9px] bg-purple-600/30 text-purple-300 rounded leading-none"
                        title={tooltipText}
                      >
                        Adj
                      </span>
                    )}
                    {onUndoPlayerTrade && (
                      <button
                        onClick={() => handleUndoPlayerTrade(p)}
                        className="ml-1 text-white/50 hover:text-white"
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
                    className="bg-[#2a2a2a] text-white/70 text-[11px] px-2 py-0.5 rounded-full border border-white/10"
                  >
                    {e.seasonYear ?? '—'} R{e.round ?? '—'}{' '}
                    {e.kind === 'swap_right' ? 'Swap' : ''}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Incoming section */}
        <div>
          <button
            onClick={() => setShowIncoming((prev) => !prev)}
            className={`w-full text-left bg-[#1c1c1c] px-3 py-1.5 rounded border border-white/10 hover:border-neutral-500 ${
              compact ? 'text-xs' : 'text-sm'
            } flex flex-col gap-0.5 text-white/80`}
          >
            <div className="flex justify-between items-center w-full">
              <span className="flex items-center gap-1">
                {/* Phase 2.3: Explicit "Matching Value" label when showing matching-adjusted salary */}
                Incoming {hasIncomingAdjustment ? 'Matching Value' : 'Salary'}:{' '}
                {/* P0-3: Show loading state during validation in-flight */}
                {isValidating && incomingPlayers.length > 0 ? (
                  <span className="text-blue-400 animate-pulse">
                    {hasValidatorResult ? 'Updating…' : 'Calculating…'}
                  </span>
                ) : (
                  formatSalary(incomingSalary)
                )}
                {/* Phase 1: Visible indicator when using local estimate (Rule 2) */}
                {/* P0-3: Hide estimate badge during validation - show loading instead */}
                {!isValidating && isEstimate && incomingPlayers.length > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-600/20 text-amber-400 rounded"
                    title="Value is an estimate until trade is validated"
                  >
                    Estimate
                  </span>
                )}
                {/* Phase 2.4: Adjustment indicator */}
                {/* P0-3: Hide adjustment badge during validation */}
                {!isValidating && hasIncomingAdjustment && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] bg-purple-600/20 text-purple-300 rounded"
                    title="Includes BYC, poison pill, or trade kicker adjustments"
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
              <span className="text-[11px] text-white/50">
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
                const hasPlayerAdjustment =
                  Math.abs(matchingValue - baseSalary) > 1;

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
                    className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                  >
                    {getPlayerLabel(p)}
                    {/* P1: Player-level adjustment indicator with specific tooltip */}
                    {hasPlayerAdjustment && (
                      <span
                        className="px-1 py-0.5 text-[9px] bg-purple-600/30 text-purple-300 rounded leading-none"
                        title={tooltipText}
                      >
                        Adj
                      </span>
                    )}
                    {onUndoPlayerTrade && (
                      <button
                        onClick={() => handleUndoPlayerTrade(p)}
                        className="ml-1 text-white/50 hover:text-white"
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
                  className="bg-[#2a2a2a] text-white/70 text-[11px] px-2 py-0.5 rounded-full border border-white/10"
                >
                  {e.seasonYear ?? '—'} R{e.round ?? '—'}{' '}
                  {e.kind === 'swap_right' ? 'Swap' : ''}
                </span>
              ))}
            </div>
          )}
          {/* Show Allowable Incoming and TPEs side-by-side */}
          <div className="flex flex-wrap gap-4 text-xs text-white/60 mt-1 items-center">
            <div>
              Allowable Incoming:{' '}
              <span className="font-semibold text-white/80">
                {/* P0-3: Show loading state during validation in-flight */}
                {isValidating ? (
                  <span className="text-blue-400 animate-pulse">
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
                    className="ml-1 text-white/40 text-[10px]"
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
                  className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-600/20 text-amber-400 rounded"
                  title="Value is an estimate until trade is validated"
                >
                  Estimate
                </span>
              )}
              {/* P3-3: Skip reason is now shown via tooltip on "—" and "(N/A)" tag.
                  The formatSkipReasonLabel helper converts internal codes to readable labels. */}
              {/* Show rule label only when applicable (no skipReason) and rule is meaningful */}
              {/* P0-3: Hide rule label during validation */}
              {!isValidating &&
                !salaryMatchingSkipReason &&
                salaryMatchingRuleLabel &&
                salaryMatchingRuleLabel !== 'unknown' && (
                  <span
                    className="ml-1 text-white/40"
                    title={salaryMatchingFormula}
                    role="note"
                    aria-label={`Rule: ${salaryMatchingRuleLabel}. Formula: ${salaryMatchingFormula}`}
                  >
                    ({salaryMatchingRuleLabel})
                  </span>
                )}
              {!isValidating && hardCapIsLimiter && (
                <span
                  className="ml-1 text-yellow-400 text-[10px]"
                  title={`Hard cap ceiling is the active allowable incoming limiter (${hardCapLimiterLabel})`}
                >
                  ({hardCapLimiterLabel} Limited)
                </span>
              )}
            </div>
            {teamTradeExceptions.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-white/60">Available TPEs:</span>
                {activeTradeExceptions.map((tpe, tpeIdx) => (
                  <span
                    key={String(tpe.id ?? tpeIdx)}
                    className="bg-[#2a2a2a] text-white/80 px-2 py-0.5 rounded-full border border-white/10"
                  >
                    {formatMillions(Number(tpe.amount ?? 0), 1)}
                  </span>
                ))}
                {activeTradeExceptions.length === 0 && (
                  <span className="text-white/40">None</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className={`flex ${
          compact ? 'gap-2 text-xs' : 'gap-4 text-sm'
        } border-b border-white/10 pb-1`}
      >
        <button
          className={`pb-1 ${
            activeTab === 'players' ? 'text-white border-b-2' : 'text-white/60'
          }`}
          style={activeTab === 'players' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('players')}
        >
          {compact ? `Plyr (${playersCount})` : `Players (${playersCount})`}
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'picks' ? 'text-white border-b-2' : 'text-white/60'
          }`}
          style={activeTab === 'picks' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('picks')}
        >
          {compact ? `Pck (${picksCount})` : `Picks (${picksCount})`}
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'exceptions'
              ? 'text-white border-b-2'
              : 'text-white/60'
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
          team={team}
          sends={sends}
          incomingPlayers={filteredIncomingPlayers}
          yearKey={yearKey}
          worldId={worldId}
          otherTeams={otherTeams}
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
          // Phase 14: Empty state hint for debugging
          emptyStateHint="Check emulator seed / baseTeams.entitlementIds"
          // Phase 17: Pass multi-team destination routing props
          otherTeams={otherTeams.map((otherTeam) => ({
            ...otherTeam,
            id: otherTeam.id ?? undefined,
            teamName: otherTeam.teamName ?? undefined,
            teamCode: otherTeam.teamCode ?? undefined,
          }))}
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
          <div className="text-xs text-white/40 px-1">
            No trade exceptions available for this team.
          </div>
        ))}

      {/* Phase 14.2: Show if incoming players or entitlements */}
      {(incomingPlayers.length > 0 || incomingEntitlements.length > 0) && (
        <div
          className="bg-[#222] border rounded p-3 text-sm max-h-[300px] overflow-y-auto"
          style={{ borderColor: primary }}
        >
          <h4 className="text-white/70 text-sm mb-2">Incoming</h4>
          <div className="text-white/90">
            {incomingPlayers.map((p) => {
              // Auto-detect absorption mode: if no explicit mode set and player fits a TPE, default to TPE
              const isTpeEligible = tpeEligiblePlayers.some(
                (ep) => (ep.player_id || ep.id) === (p.player_id || p.id)
              );
              const effectiveMode =
                p.absorptionMode || (isTpeEligible ? 'TPE' : 'MATCH');

              return (
                <div
                  key={String(getPlayerKey(p))}
                  className="mb-1 flex items-center gap-2"
                >
                  <span>• {getPlayerLabel(p)}</span>
                  {validationFlags.faExceptionTrade !== 'off' && (
                    <>
                      <select
                        className="bg-[#333] text-xs rounded px-1"
                        value={String(effectiveMode)}
                        onChange={(e) =>
                          onSetPlayerTrade &&
                          onSetPlayerTrade(
                            p,
                            'setAbsorptionMode',
                            e.target.value
                          )
                        }
                      >
                        <option value="MATCH">Matching</option>
                        <option value="TPE">TPE</option>
                        <option value="FA_EXCEPTION">FA Exception</option>
                      </select>
                      {/* TPE selector - show when TPE mode selected */}
                      {effectiveMode === 'TPE' && (
                        <select
                          className="bg-[#333] text-xs rounded px-1"
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
                          className="bg-[#333] text-xs rounded px-1"
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

export default TradeTeamCard;
