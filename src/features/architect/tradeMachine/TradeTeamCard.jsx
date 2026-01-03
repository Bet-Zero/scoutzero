import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getTeamColors, formatMillions } from '@/shared/utils/formatting';
import {
  getSalaryForYear,
  formatPick,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
import { formatSalary } from '@/shared/utils/formatting';
import CapImpactTiles from './CapImpactTiles';
import { SelectTeamCard } from './SelectTeamCard';
import { OutgoingPlayersList } from './OutgoingPlayersList';
import { OutgoingPicksList } from './OutgoingPicksList';
import TeamSelectDropdown from '@/shared/components/TeamSelectDropdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TradeExceptionManager from './TradeExceptionManager';
import {
  getTeamFaExceptionBuckets,
  isFaExceptionEligibleType,
} from '@/features/architect/utils/faExceptionUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import { getCapHitForSeason } from '@/features/architect/utils/tradeMachine/utils/seasonUtils.js';
import { toSeasonKey } from '@/features/architect/utils/seasonUtils';
import { getSalaryMatchingResult } from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
// Phase 1: Accessor function for validator result consumption (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.0)
import { getTeamSnapshot } from '@/features/architect/hooks/useTradeMachineSnapshot';

/**
 * P3-3: Convert internal skip reason codes to human-readable labels.
 * Example: "HARD_CAP_SKIP" → "Hard cap skip", "TPE_ABSORPTION" → "TPE absorption"
 * If already readable (no underscores, already has spaces), returns as-is.
 */
function formatSkipReasonLabel(skipReason) {
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
  picks,
  yearKey,
  otherTeams = [],
  playersMap = {},
  incomingPlayers = [],
  incomingPicks = [],
  onSetPlayerTrade,
  onUndoPlayerTrade,
  onTogglePick,
  onEditPick,
  onSelectTeam,
  onRemove,
  onApplyTradeException,
  onEditContract,
  // Phase 1: Accept validator result for accessor hook wiring
  validationResult = null,
  teamIndex = null,
  // P0-3: Validation in-flight state for loading indicators
  isValidating = false,
}) => {
  const [activeTab, setActiveTab] = useState('players');
  const [editingTeam, setEditingTeam] = useState(false);
  const [showOutgoing, setShowOutgoing] = useState(false);
  const [showIncoming, setShowIncoming] = useState(false);
  const selectRef = useRef(null);
  const hasTeam = Boolean(team);
  const teamTradeExceptions = team?.tradeExceptions;

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

  // Filter available players (not in sends)
  const availablePlayers = useMemo(
    () =>
      (team?.players || []).filter(
        (p) => !sends.some((s) => s.player_id === p.player_id)
      ),
    [team?.players, sends]
  );

  // Filter incoming players (not already on team)
  const filteredIncomingPlayers = useMemo(
    () =>
      incomingPlayers.filter(
        (p) => !team?.players?.some((tp) => tp.player_id === p.player_id)
      ),
    [incomingPlayers, team?.players]
  );

  // Use STORED teamTotalSalary from the team object (computed by useTradeMachine via capSheet payroll + dead money)
  // This ensures TradeTeamCard uses the SAME value as the validator for salary matching calculations
  // Fallback to getSalaryForYear ONLY if stored value is missing/0 (temporary data issue)
  const teamTotalSalary = useMemo(() => {
    const stored = team?.teamTotalSalary ?? team?.totalSalary ?? 0;
    if (stored > 0) {
      return stored;
    }
    // Fallback: recompute if stored is missing (should not happen in normal flow)
    return getSalaryForYear(team?.players || [], yearKey);
  }, [team?.teamTotalSalary, team?.totalSalary, team?.players, yearKey]);

  // DEV-ONLY: Invariant check to detect teamTotalSalary divergence between stored and computed values
  // This helps catch data issues or regressions without affecting runtime behavior
  if (import.meta.env.DEV && team) {
    const computed = getSalaryForYear(team?.players || [], yearKey);
    const stored = team?.teamTotalSalary ?? team?.totalSalary ?? 0;
    const diff = Math.abs(computed - stored);
    if (diff >= 1) {
      console.warn('[TradeTeamCard] teamTotalSalary DIVERGENCE DETECTED', {
        teamId: team?.id || team?.teamId,
        yearKey,
        stored,
        computed,
        diff,
        source:
          stored > 0
            ? 'stored (team.teamTotalSalary)'
            : 'computed (getSalaryForYear)',
      });
    }
  }

  // Phase 1: Get snapshot from validator result (golden source of truth)
  // RULE: For legality-affecting numbers, use snapshot values; do NOT recompute locally
  const snapshot = getTeamSnapshot(team?.id, validationResult);
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

  // DEV-ONLY: Outgoing salary divergence check (Phase 1.8)
  if (import.meta.env.DEV && hasValidatorResult) {
    const diff = Math.abs(
      localOutgoingSalary - snapshot.outgoingMatchingSalary
    );
    if (diff > 1) {
      console.warn('[TradeTeamCard] outgoingSalary DIVERGENCE', {
        local: localOutgoingSalary,
        snapshot: snapshot.outgoingMatchingSalary,
        diff,
        teamId: team?.id,
      });
    }
  }

  // DEV-ONLY: Incoming salary divergence check (Phase 1.8)
  if (import.meta.env.DEV && hasValidatorResult) {
    const diff = Math.abs(
      localIncomingSalary - snapshot.incomingMatchingSalary
    );
    if (diff > 1) {
      console.warn('[TradeTeamCard] incomingSalary DIVERGENCE', {
        local: localIncomingSalary,
        snapshot: snapshot.incomingMatchingSalary,
        diff,
        teamId: team?.id,
      });
    }
  }

  const { primary } = useMemo(() => getTeamColors(team?.id) || {}, [team?.id]);

  const playersCount = useMemo(
    () => (team?.players?.length || 0) - sends.length + incomingPlayers.length,
    [team, sends, incomingPlayers]
  );

  const picksCount = useMemo(
    () => (team?.picks?.length || 0) - picks.length + incomingPicks.length,
    [team, picks, incomingPicks]
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
        salaryCap: capSettings.salaryCap || capSettings.cap || 0,
        firstApron: capSettings.firstApron || 0,
        secondApron: capSettings.secondApron || 0,
      },
    });
  }, [hasTeam, teamTotalSalary, localOutgoingSalary, capSettings]);

  // Phase 1: Use snapshot.allowableIncoming as source of truth (may be null when not applicable)
  // Fallback to local ONLY when no validator result (with Estimate indicator)
  const allowableIncomingNoTPE = hasValidatorResult
    ? snapshot.allowableIncoming // May be null when salary matching not applicable
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
      const playerSalary = getCapHitForSeason(player, seasonKey) || 0;
      return (teamTradeExceptions || []).some(
        (tpe) =>
          !tpe.isUsed &&
          playerSalary <= tpe.amount &&
          (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
      );
    });
  }, [hasTeam, incomingPlayers, teamTradeExceptions, yearKey]);

  // Modified player trade handler to support multiple selections
  // Replace the existing handleSetPlayerTrade with:
  const handleSetPlayerTrade = (player, action, targetTeamId, tpe) => {
    if (onSetPlayerTrade) {
      onSetPlayerTrade(player, action, targetTeamId, tpe);
    }
  };

  // Modified undo trade handler
  const handleUndoPlayerTrade = (player) => {
    if (onUndoPlayerTrade) {
      onUndoPlayerTrade(player);
    }
  };

  if (!team) {
    return <SelectTeamCard onSelectTeam={onSelectTeam} onRemove={onRemove} />;
  }

  return (
    <div
      className="flex-1 rounded-lg p-4 bg-[#111] relative space-y-4 shadow-inner border"
      style={{ borderColor: primary || 'transparent' }}
    >
      {/* Team Header */}
      <div className="relative flex items-center justify-between border-b border-white/10 pb-2">
        <div className="w-48">
          <TeamSelectDropdown
            selectedTeamId={team.id}
            onChange={(newId) => {
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
        team={team}
        sends={sends}
        incomingPlayers={incomingPlayers}
        yearKey={yearKey}
        snapshot={snapshot}
      />

      <div className="space-y-1">
        {/* Outgoing section */}
        <div>
          <button
            onClick={() => setShowOutgoing((prev) => !prev)}
            className="w-full text-left bg-[#1c1c1c] px-3 py-1.5 rounded border border-white/10 hover:border-neutral-500 text-sm flex flex-col gap-0.5 text-white/80"
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
                const matchingValue = p.matchOutgoing ?? baseSalary;
                const hasPlayerAdjustment =
                  Math.abs(matchingValue - baseSalary) > 1;

                // P1: Use shared utility for adjustment type detection
                const adjustmentLabel = getAdjustmentTooltipLabel(p);
                const tooltipText = `${adjustmentLabel}: Base ${formatSalary(baseSalary)} → Match ${formatSalary(matchingValue)}`;

                return (
                  <span
                    key={p.player_id || p.id}
                    className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                  >
                    {p.name}
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
              {picks
                .filter((p) => p.fromTeamId === team.id)
                .map((p) => (
                  <span
                    key={`${p.year}-${p.round}-${p.via || ''}`}
                    className="bg-[#2a2a2a] text-white/70 text-[11px] px-2 py-0.5 rounded-full border border-white/10"
                  >
                    {formatPick(p)}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Incoming section */}
        <div>
          <button
            onClick={() => setShowIncoming((prev) => !prev)}
            className="w-full text-left bg-[#1c1c1c] px-3 py-1.5 rounded border border-white/10 hover:border-neutral-500 text-sm flex flex-col gap-0.5 text-white/80"
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
                const matchingValue = p.matchIncoming ?? baseSalary;
                const hasPlayerAdjustment =
                  Math.abs(matchingValue - baseSalary) > 1;

                // P1: Use shared utility for adjustment type detection
                const adjustmentLabel = getAdjustmentTooltipLabel(p);
                const tooltipText = `${adjustmentLabel}: Base ${formatSalary(baseSalary)} → Match ${formatSalary(matchingValue)}`;

                return (
                  <span
                    key={p.player_id || p.id}
                    className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                  >
                    {p.name}
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
              {incomingPicks.map((p) => (
                <span
                  key={`${p.year}-${p.round}-${p.via || ''}`}
                  className="bg-[#2a2a2a] text-white/70 text-[11px] px-2 py-0.5 rounded-full border border-white/10"
                >
                  {formatPick(p)}
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
                ) : (
                  allowableIncomingNoTPE != null
                    ? formatSalary(allowableIncomingNoTPE)
                    : (
                      /* P3-3: Add tooltip explaining why salary matching is not applicable */
                      <span
                        title={salaryMatchingSkipReason ? `Not applicable: ${formatSkipReasonLabel(salaryMatchingSkipReason)}` : undefined}
                      >
                        —
                      </span>
                    )
                )}
              </span>
              {/* P3-3: Show (N/A) tag when salary matching not applicable and skip reason exists */}
              {!isValidating && allowableIncomingNoTPE == null && salaryMatchingSkipReason && (
                <span
                  className="ml-1 text-white/40 text-[10px]"
                  title={`Not applicable: ${formatSkipReasonLabel(salaryMatchingSkipReason)}`}
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
              {!isValidating && !salaryMatchingSkipReason &&
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
            </div>
            {team?.tradeExceptions?.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-white/60">Available TPEs:</span>
                {team.tradeExceptions
                  .filter(
                    (tpe) =>
                      !tpe.isUsed &&
                      (!tpe.expirationDate ||
                        new Date(tpe.expirationDate) > new Date())
                  )
                  .map((tpe, idx) => {
                    // Format amount as $11.1M style
                    const formattedAmount = formatMillions(tpe.amount, 1);
                    return (
                      <span
                        key={idx}
                        className="bg-[#2a2a2a] text-white/80 px-2 py-0.5 rounded-full border border-white/10"
                      >
                        {formattedAmount}
                        {tpe.expirationDate && (
                          <span className="ml-1 text-white/40">
                            exp.{' '}
                            {new Date(tpe.expirationDate).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    );
                  })}
                {team.tradeExceptions.filter(
                  (tpe) =>
                    !tpe.isUsed &&
                    (!tpe.expirationDate ||
                      new Date(tpe.expirationDate) > new Date())
                ).length === 0 && <span className="text-white/40">None</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 text-sm border-b border-white/10 pb-1">
        <button
          className={`pb-1 ${
            activeTab === 'players' ? 'text-white border-b-2' : 'text-white/60'
          }`}
          style={activeTab === 'players' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('players')}
        >
          Players ({playersCount})
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'picks' ? 'text-white border-b-2' : 'text-white/60'
          }`}
          style={activeTab === 'picks' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('picks')}
        >
          Picks ({picksCount})
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
          Exceptions ({team.tradeExceptions?.length || 0})
        </button>
      </div>

      {activeTab === 'players' && (
        <OutgoingPlayersList
          team={team}
          players={availablePlayers}
          sends={sends}
          incomingPlayers={filteredIncomingPlayers}
          yearKey={yearKey}
          otherTeams={otherTeams}
          playersMap={playersMap}
          onSetPlayerTrade={handleSetPlayerTrade}
          onUndoPlayerTrade={handleUndoPlayerTrade}
          tradeExceptions={team.tradeExceptions}
          onEditContract={onEditContract}
        />
      )}

      {activeTab === 'picks' && (
        <OutgoingPicksList
          team={team}
          picks={picks}
          incomingPicks={incomingPicks}
          otherTeams={otherTeams}
          onTogglePick={onTogglePick}
          onEditPick={onEditPick}
        />
      )}

      {activeTab === 'exceptions' && team.tradeExceptions?.length > 0 && (
        <TradeExceptionManager
          exceptions={team.tradeExceptions}
          teamId={team.id}
          eligiblePlayers={tpeEligiblePlayers}
          onApplyException={(tpe) => {
            if (tpeEligiblePlayers.length > 0) {
              onApplyTradeException(tpeEligiblePlayers[0], tpe);
            }
          }}
        />
      )}

      {(incomingPlayers.length > 0 || incomingPicks.length > 0) && (
        <div
          className="bg-[#222] border rounded p-3 text-sm"
          style={{ borderColor: primary }}
        >
          <h4 className="text-white/70 text-sm mb-2">Incoming</h4>
          <div className="text-white/90">
            {incomingPlayers.map((p) => (
              <div
                key={p.player_id || p.id}
                className="mb-1 flex items-center gap-2"
              >
                <span>• {p.name}</span>
                {validationFlags.faExceptionTrade !== 'off' && (
                  <>
                    <select
                      className="bg-[#333] text-xs rounded px-1"
                      value={p.absorptionMode || 'MATCH'}
                      onChange={(e) =>
                        onSetPlayerTrade &&
                        onSetPlayerTrade(p, 'setAbsorptionMode', e.target.value)
                      }
                    >
                      <option value="MATCH">Matching</option>
                      <option value="TPE">TPE</option>
                      <option value="FA_EXCEPTION">FA Exception</option>
                    </select>
                    {/* TPE selector - show when TPE mode selected */}
                    {p.absorptionMode === 'TPE' && (
                      <select
                        className="bg-[#333] text-xs rounded px-1"
                        value={p.tpeId || ''}
                        onChange={(e) =>
                          onSetPlayerTrade &&
                          onSetPlayerTrade(p, 'setTpeId', e.target.value)
                        }
                      >
                        <option value="">Select TPE...</option>
                        {(teamTradeExceptions || [])
                          .filter(tpe => 
                            !tpe.isUsed && 
                            (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
                          )
                          .map((tpe) => {
                            const amount = formatMillions(tpe.amount, 1);
                            const playerSalary = getSalaryForYear([p], yearKey);
                            const fits = tpe.amount >= playerSalary;
                            return (
                              <option 
                                key={tpe.id} 
                                value={tpe.id}
                                disabled={!fits}
                              >
                                {amount} {!fits ? '(too small)' : ''}
                              </option>
                            );
                          })}
                      </select>
                    )}
                    {p.absorptionMode === 'FA_EXCEPTION' && (
                      <select
                        className="bg-[#333] text-xs rounded px-1"
                        value={p.bucketType || ''}
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
                            <option key={b.type} value={b.type}>
                              {b.type} (${b.remaining})
                            </option>
                          ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            ))}
            {incomingPicks.map((p) => (
              <div key={`${p.year}-${p.round}-${p.via || ''}`}>
                • {formatPick(p)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTeamCard;
