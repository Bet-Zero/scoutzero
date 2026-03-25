import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import { useContainerDimensions } from '@/shared/hooks/useContainerDimensions';
import EditContractModal from '@/shared/components/EditContractModal';
import TradeTeamCard from './TradeTeamCard';
import TradePreviewModal from './TradePreviewModal';
import ValidationStateHeader from './ValidationStateHeader';
import ValidationDetailsPanel from './ValidationDetailsPanel';
import { PickRightWizardModal } from '@/features/architect/admin/PickRightWizardModal';
import { isEntitlementAuthoringEnabled } from '@/features/architect/utils/entitlements/entitlementWriter';
import {
  clearVacuumOverlay,
  hasVacuumOverlay,
  removeEdit,
  removeCreate,
  applyVacuumTransfer,
} from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';
import { validateSignAndTradeContractPayload } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { DEV_SNT_INJECTOR_FLAG } from '@/features/architect/tradeMachine/utils/devSntInjector';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';

type UseTradeMachineResult = ReturnType<typeof useTradeMachine>;
type HookTradeTeamSlot = UseTradeMachineResult['teams'][number];
type ValidationDetailsPanelProps = Parameters<typeof ValidationDetailsPanel>[0];
type TradePreviewModalProps = Parameters<typeof TradePreviewModal>[0];
type TradeTeamCardProps = Parameters<typeof TradeTeamCard>[0];

type PlayerLike = {
  id?: string | number;
  player_id?: string | number;
  name?: string;
  tradeTo?: string | null;
};

type TeamLike = {
  id?: string;
  teamId?: string;
  teamCode?: string;
  pickRulesById?: Record<string, unknown>;
};

type EntitlementLike = {
  id?: string | number;
  entitlementId?: string | number;
  toTeamId?: string | null;
  holderTeam?: string | null;
  holder_team?: string | null;
  originalTeamId?: string | null;
  originalTeam?: string | null;
  seasonYear?: number;
  year?: number;
  round?: number;
  kind?: string;
  protectionDetails?: string | null;
  protection?: string | null;
  fromTeamId?: string | null;
};

type TradeTeamSlotLike = {
  team?: TeamLike | null;
  sends: PlayerLike[];
  entitlementsOut?: EntitlementLike[];
};

type TradeDataEntryLike = {
  teamId?: string;
  outgoingEntitlements?: EntitlementLike[];
};

type TradeMachineSatModalState = {
  teamIndex: number;
  player: PlayerLike;
  defaultDestinationTeamId: string | null;
} | null;

type EntitlementEditorState = {
  entitlementId: string | number | null;
  initialDocument: Record<string, unknown>;
} | null;

type SignAndTradeResult = {
  success: boolean;
  message?: string;
};

interface TradeEditorProps {
  primaryTeam?: string | null;
  capProjections?: Record<string, unknown> | null;
  currentYear?: number | null;
  playersMap?: Record<string, unknown>;
  onApplyTrade?: ((tradeData: TradeDataEntryLike[]) => Promise<unknown> | unknown) | null;
  primaryTeamData?: TeamLike | null;
  onEditContract?: ((...args: unknown[]) => unknown) | null;
  worldId?: string | null;
  worldAsOfDate?: string | Date | null;
  userId?: string | null;
}

const TradeEditor = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap = {},
  onApplyTrade,
  primaryTeamData = null,
  onEditContract,
  worldId = null, // World ID for world-aware team loading
  worldAsOfDate = null,
  userId = null,
}: TradeEditorProps) => {
  const {
    teams,
    result,
    forceTrade,
    // setForceTrade,
    setPlayerTrade,
    // Phase 14.2: Removed togglePick and updatePickField - draft assets are entitlements-only
    // Phase 11.1: Destructure entitlement toggle for trading
    toggleEntitlement,
    // Phase 17: Destructure destination setter for multi-team entitlement routing
    setEntitlementDestination,
    selectTeam,
    addTeam,
    removeTeam,
    handleValidate,
    exportCurrentTrade,
    undoPlayerTrade,
    resetTrade,
    yearKey,
    incomingAssets: hookIncomingAssets,
    // P0-3: Track validation in-flight state
    isValidating,
    // P2: Expose salaryOut for TradeSalaryCalculator
    salaryOut,
    // Stale validation fix: Use hasCurrentValidation instead of result check
    hasCurrentValidation,
    getValidatedAt,
    hasInjectedDevSntPlayers,
    injectDevSntPlayers,
    clearInjectedDevSntPlayers,
    // Phase 16.3: Expose init error for UI error surfacing
    initError,
    // Phase 17: Active team count for multi-team destination logic
    activeTeamCount,
    // TM-4: Apply entitlement overrides to local state
    applyEntitlementOverrideUpdate,
    // TM-VACUUM-E1: Re-resolve entitlements for all active slots
    refreshEntitlements,
  } = useTradeMachine(
    primaryTeam,
    capProjections,
    currentYear ?? new Date().getFullYear(),
    primaryTeamData,
    worldId,
    worldAsOfDate as string
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const [tradeMachineSatModal, setTradeMachineSatModal] =
    useState<TradeMachineSatModalState>(null);
  // P2: Track which team's calculator to show (0 = primary team by default)
  const [calculatorTeamIndex, setCalculatorTeamIndex] = useState(0);
  const [entitlementEditorState, setEntitlementEditorState] =
    useState<EntitlementEditorState>(null);

  const canEditEntitlements = isEntitlementAuthoringEnabled();
  const isVacuumMode = !worldId;

  // TM-VACUUM-E1: When switching from vacuum → world mode, clear overlay once
  const prevWorldIdRef = useRef<string | null>(worldId);
  useEffect(() => {
    if (prevWorldIdRef.current === null && worldId !== null) {
      clearVacuumOverlay();
    }
    prevWorldIdRef.current = worldId;
  }, [worldId]);

  // Stale validation fix: hasCurrentValidation now comes from hook
  // It properly checks if validation result matches current draft configuration

  // Phase 14.2: incomingAssets now uses entitlementsOut instead of picksOut
  // Phase 17: Updated to require toTeamId for 3+ team trades (same logic as hook)
  const incomingAssets = teams.map((tm, idx) => {
    const players: PlayerLike[] = [];
    const entitlements: EntitlementLike[] = [];
    teams.forEach((t, j) => {
      if (j !== idx && t.team) {
        t.sends.forEach((p) => {
          if (!p.tradeTo || p.tradeTo === tm.team?.id) {
            players.push(p);
          }
        });
        // Phase 17: For 3+ team trades, require explicit toTeamId
        // For 2-team trades, allow broadcast fallback (backward compatibility)
        (t.entitlementsOut || []).forEach((e) => {
          const isMultiTeamTrade = activeTeamCount > 2;
          if (isMultiTeamTrade) {
            // 3+ teams: only include if explicitly routed to this team
            if (e.toTeamId === tm.team?.id) {
              entitlements.push(e);
            }
          } else {
            // 2 teams: allow broadcast fallback for backward compatibility
            if (!e.toTeamId || e.toTeamId === tm.team?.id) {
              entitlements.push(e);
            }
          }
        });
      }
    });
    return { players, entitlements };
  });

  const addLabels: Record<number, string> = {
    2: 'Add Team',
    3: 'Add Team',
    4: 'Add Team',
  };

  // Phase 12.3B: Merge pickRulesById from all team slots for projection layer
  const mergedPickRulesById = useMemo(() => {
    const merged: Record<string, unknown> = {};
    for (const slot of teams) {
      if (slot?.team?.pickRulesById) {
        Object.assign(merged, slot.team.pickRulesById);
      }
    }
    return merged;
  }, [teams]);

  const handleEditEntitlement = (entitlement: EntitlementLike | null | undefined) => {
    if (!canEditEntitlements) {
      toast.error('Entitlement authoring is disabled.');
      return;
    }
    // TM-VACUUM-E1: In world mode, require userId. In vacuum mode, allow without auth.
    if (worldId && !userId) {
      toast.error('Sign in to edit entitlements.');
      return;
    }

    const entitlementId = entitlement?.id || entitlement?.entitlementId;
    if (!entitlementId) {
      toast.error('Missing entitlement ID.');
      return;
    }

    setEntitlementEditorState({
      entitlementId,
      initialDocument: entitlement,
    });
  };

  const handleCreateEntitlement = (teamCode: string | null | undefined) => {
    if (!canEditEntitlements) {
      toast.error('Entitlement authoring is disabled.');
      return;
    }
    // TM-VACUUM-E1: In world mode, require userId. In vacuum mode, allow without auth.
    if (worldId && !userId) {
      toast.error('Sign in to create entitlements.');
      return;
    }
    if (!teamCode) {
      toast.error('Team code required to create entitlement.');
      return;
    }

    // Open modal in create mode with defaults
    setEntitlementEditorState({
      entitlementId: null, // null = create mode
      initialDocument: {
        holderTeam: teamCode,
        seasonYear: currentYear || 2026,
        round: 1,
        kind: 'pick_ownership',
      },
    });
  };

  /**
   * Handle viewing entitlement details - shows a toast with parsed entitlement info
   */
  const handleViewEntitlementDetails = (entitlement: EntitlementLike | null | undefined) => {
    if (!entitlement) return;

    const year = entitlement.seasonYear || entitlement.year || '?';
    const round = entitlement.round === 1 ? '1st' : '2nd';
    const kind = entitlement.kind || 'unknown';
    const holder = entitlement.holderTeam || '?';
    const original =
      entitlement.originalTeamId || entitlement.originalTeam || holder;
    const protection =
      entitlement.protectionDetails || entitlement.protection || null;

    const lines = [
      `${year} Round ${round}`,
      `Type: ${kind.replace(/_/g, ' ')}`,
      `Holder: ${holder}`,
      original !== holder ? `Original: ${original}` : null,
      protection ? `Protection: ${protection}` : null,
    ].filter(Boolean);

    toast(lines.join('\n'), { duration: 5000 });
  };

  // TM-VACUUM-E1: Clear session overlay and re-resolve entitlements
  const handleClearVacuumOverlay = () => {
    clearVacuumOverlay();
    refreshEntitlements();
    toast.success('Session pick changes cleared');
  };

  // Hybrid layout: measure container to compute layoutMode
  const teamGridRef = useRef<HTMLDivElement | null>(null);
  const { width: containerWidth } = useContainerDimensions(teamGridRef, {
    width: 1200,
    height: 600,
  });
  const layoutMode = useMemo(() => {
    const teamCount = teams.length;
    if (teamCount <= 1) return 'normal';
    const gapTotal = (teamCount - 1) * 24; // gap-6 = 24px
    const perCard = (containerWidth - gapTotal) / teamCount;
    if (perCard >= 500) return 'normal';
    if (perCard >= 320) return 'compact';
    return 'scroll';
  }, [containerWidth, teams.length]);
  const compact = layoutMode !== 'normal';

  const canApplyTrade = hasCurrentValidation && result?.legal === true;
  const isDevSntInjectorEnabled =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_SNT_INJECTOR_FLAG) === 'true';

  const resolveEntitlementTeamCode = (entitlement: EntitlementLike | null | undefined) =>
    entitlement?.holderTeam || entitlement?.holder_team || null;

  const handleRevertEntitlementEdit = (entitlement: EntitlementLike | null | undefined) => {
    if (!isVacuumMode) return;
    const entitlementId = entitlement?.id || entitlement?.entitlementId;
    const teamCode = resolveEntitlementTeamCode(entitlement);
    if (
      !teamCode ||
      !entitlementId ||
      String(entitlementId).startsWith('vacuum:')
    ) {
      return;
    }

    removeEdit(teamCode, String(entitlementId));
    refreshEntitlements();
    // TM-VACUUM-E3: Auto-validate after per-item revert
    handleValidate();
    toast.success('Session edit reverted');
  };

  const handleDeleteSessionEntitlement = (entitlement: EntitlementLike | null | undefined) => {
    if (!isVacuumMode) return;
    const entitlementId = entitlement?.id || entitlement?.entitlementId;
    const teamCode = resolveEntitlementTeamCode(entitlement);
    if (
      !teamCode ||
      !entitlementId ||
      !String(entitlementId).startsWith('vacuum:')
    ) {
      return;
    }

    removeCreate(teamCode, String(entitlementId));
    refreshEntitlements();
    // TM-VACUUM-E3: Auto-validate after per-item delete
    handleValidate();
    toast.success('Session pick right deleted');
  };

  const openTradeMachineSatModal = (
    teamIndex: number,
    player: PlayerLike,
    defaultDestinationTeamId: string | null | undefined
  ) => {
    setTradeMachineSatModal({
      teamIndex,
      player,
      defaultDestinationTeamId: defaultDestinationTeamId || null,
    });
  };

  const closeTradeMachineSatModal = () => {
    setTradeMachineSatModal(null);
  };

  const handleTradeMachineSignAndTrade = (
    player: PlayerLike,
    contractPayload: Record<string, unknown>,
    destinationTeamId: string | null | undefined
  ): SignAndTradeResult => {
    if (!tradeMachineSatModal) {
      return { success: false, message: 'Sign-and-trade modal is not active.' };
    }

    const sourceTeam = teams[tradeMachineSatModal.teamIndex]?.team || null;
    const sourceTeamId = sourceTeam?.id || sourceTeam?.teamCode || null;
    const sourceTeamCode = sourceTeamId
      ? resolveTeamCode(sourceTeamId) || sourceTeamId
      : null;

    const canonicalDestinationTeamCode = destinationTeamId
      ? resolveTeamCode(destinationTeamId) || destinationTeamId
      : null;
    if (!canonicalDestinationTeamCode) {
      toast.error('Sign-and-trade requires a destination team.');
      return { success: false, message: 'Destination team is required.' };
    }

    if (sourceTeamCode && canonicalDestinationTeamCode === sourceTeamCode) {
      toast.error('Destination team must be different from the source team.');
      return {
        success: false,
        message: 'Destination team must be different from the source team.',
      };
    }

    const destinationTradeTeam = teams.find((tm) => {
      const teamId =
        tm?.team?.id || tm?.team?.teamCode || tm?.team?.teamId || null;
      const teamCode = teamId ? resolveTeamCode(String(teamId)) || teamId : null;
      return teamCode === canonicalDestinationTeamCode;
    });
    const destinationTradeTeamId = String(
      destinationTradeTeam?.team?.id ||
      destinationTradeTeam?.team?.teamCode ||
      destinationTradeTeam?.team?.teamId ||
      canonicalDestinationTeamCode);

    const contractValidation = validateSignAndTradeContractPayload(
      contractPayload,
      yearKey,
      { requireActiveYearRow: true }
    );

    if (!contractValidation.valid || !contractValidation.contract) {
      toast.error(
        contractValidation.reasons[0] ||
          'Sign-and-trade contract details are incomplete.'
      );
      return {
        success: false,
        message:
          contractValidation.reasons[0] ||
          'Sign-and-trade contract details are incomplete.',
      };
    }

    setPlayerTrade(
      tradeMachineSatModal.teamIndex,
      player,
      'signAndTrade',
      destinationTradeTeamId,
      {
        signAndTradeContract: contractValidation.contract,
        destinationTeamCode: canonicalDestinationTeamCode,
      }
    );

    closeTradeMachineSatModal();
    return { success: true };
  };

  return (
    <div className="text-white space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-2xl font-bold tracking-tight">Trade Machine</h2>
        <div className="flex items-center gap-2">
          {/* TM-VACUUM-E1: Clear session edits button (vacuum mode only) */}
          {isVacuumMode && hasVacuumOverlay() && (
            <button
              onClick={handleClearVacuumOverlay}
              className="bg-amber-700/60 hover:bg-amber-600/60 text-amber-200 text-xs font-medium px-3 py-1.5 rounded"
              title="Clear all session pick changes"
            >
              Clear session pick changes
            </button>
          )}
          <button
            onClick={() => {
              handleValidate();
              setPreviewOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded"
          >
            Validate Trade
          </button>
          <button
            onClick={resetTrade}
            title="Reset Trade"
            className="text-white/70 hover:text-white"
          >
            <RotateCcw size={18} />
          </button>
          {teams.length < 5 && (
            <button
              onClick={addTeam}
              className="bg-neutral-700 hover:bg-neutral-600 text-sm px-3 py-1.5 rounded"
            >
              {addLabels[teams.length] || 'Add Team'}
            </button>
          )}
        </div>
      </div>

      {/* Task A: Mode + Validation State Header */}
      {/* Stale validation fix: Uses hasCurrentValidation to only show "Validated"
          when result matches current draft configuration */}
      <ValidationStateHeader
        hasValidatorResult={hasCurrentValidation}
        isValidating={isValidating}
        validatedAt={getValidatedAt()}
      />

      {/* Phase 16.3: Init error display */}
      {initError && teams.length === 0 && (
        <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 text-red-200">
          <div className="font-semibold text-red-100 mb-1">
            Trade Machine failed to initialize.
          </div>
          <div className="text-sm mb-2">{initError}</div>
          <div className="text-xs text-red-300/70">
            Check console for [tradeMachine:init] error.
          </div>
        </div>
      )}

      {/* Team Cards — Hybrid layout: normal / compact / scroll */}
      <div
        ref={teamGridRef}
        className={`${
          layoutMode === 'scroll' ? 'flex overflow-x-auto pb-4' : 'grid'
        } gap-6`}
        style={
          layoutMode === 'scroll'
            ? { scrollSnapType: 'x mandatory' }
            : { gridTemplateColumns: `repeat(${teams.length}, 1fr)` }
        }
      >
        {teams.map((t, idx) => {
          const otherTeams = teams
            .filter((_, j) => j !== idx && teams[j].team)
            .map((tm) => tm.team)
            .filter(Boolean);
          return (
            <div
              key={idx}
              className={layoutMode === 'scroll' ? 'flex-shrink-0' : ''}
              style={
                layoutMode === 'scroll'
                  ? { width: '340px', scrollSnapAlign: 'start' }
                  : {}
              }
            >
              <TradeTeamCard
                compact={compact}
                validationResult={
                  (hasCurrentValidation ? result : null) as TradeTeamCardProps['validationResult']
                }
                teamIndex={idx}
                team={
                  t.team
                    ? {
                        ...t.team,
                        id: t.team.id ?? undefined,
                      }
                    : null
                }
                sends={t.sends}
                // Phase 14.2: Removed picks prop - draft assets are entitlements-only
                // Phase 11.1: Pass entitlement toggle and selection state
                entitlementsOut={t.entitlementsOut || []}
                onToggleEntitlement={(e) => toggleEntitlement(idx, e)}
                // Phase 17: Pass destination setter for multi-team entitlement routing
                onSetEntitlementDestination={(entitlementId, toTeamId) =>
                  setEntitlementDestination(idx, entitlementId, toTeamId)
                }
                onEditEntitlement={
                  canEditEntitlements ? handleEditEntitlement : null
                }
                onViewEntitlementDetails={handleViewEntitlementDetails}
                onCreateEntitlement={
                  canEditEntitlements ? handleCreateEntitlement : null
                }
                isVacuumMode={isVacuumMode}
                onRevertEntitlementEdit={handleRevertEntitlementEdit}
                onDeleteSessionEntitlement={handleDeleteSessionEntitlement}
                incomingPlayers={incomingAssets[idx]?.players || []}
                // Phase 14.2: Incoming entitlements instead of incoming picks
                incomingEntitlements={incomingAssets[idx]?.entitlements || []}
                yearKey={yearKey}
                otherTeams={otherTeams as TradeTeamCardProps['otherTeams']}
                playersMap={playersMap}
                onSetPlayerTrade={(p: any, action: any, dest: any, meta: any) =>
                  setPlayerTrade(idx, p, action, dest, meta)
                }
                onRequestSignAndTrade={(player, defaultDestinationTeamId) =>
                  openTradeMachineSatModal(
                    idx,
                    player as PlayerLike,
                    defaultDestinationTeamId as string | null | undefined
                  )
                }
                // Phase 14: Removed onTogglePick and onEditPick (legacy picks UI removed)
                onUndoPlayerTrade={undoPlayerTrade as (...args: unknown[]) => void}
                onSelectTeam={(teamId) => selectTeam(idx, teamId)}
                onRemove={() => removeTeam(idx)}
                onEditContract={onEditContract}
                worldId={worldId}
                // P0-3: Pass validation in-flight state
                isValidating={isValidating}
              />
            </div>
          );
        })}
      </div>

      {/* Scroll fade indicators for scroll mode */}
      {layoutMode === 'scroll' && (
        <div className="flex justify-center gap-2 mt-2">
          <span className="text-white/40 text-xs">
            ← Scroll to see all teams →
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={async () => {
            if (!hasCurrentValidation) {
              toast.error('Re-validate trade before applying.');
              return;
            }
            if (result?.legal !== true) {
              alert(
                'Cannot apply trade: ' +
                  (result?.reason || 'Trade validation failed')
              );
              return;
            }
            const tradeData = exportCurrentTrade() as TradeDataEntryLike[] | null;
            if (onApplyTrade && tradeData) {
              // TM-PICKS-E1: In vacuum/sandbox mode, persist entitlement transfers to localStorage
              // so they survive page refresh. World mode persists via mutation pipeline.
              if (isVacuumMode) {
                for (const teamEntry of tradeData) {
                  const outgoing = teamEntry.outgoingEntitlements || [];
                  for (const ent of outgoing) {
                    const entId = ent.entitlementId || ent.id;
                    const fromTeam = ent.fromTeamId || teamEntry.teamId;
                    const toTeam = ent.toTeamId;
                    if (entId && fromTeam && toTeam) {
                      applyVacuumTransfer(
                        String(entId),
                        String(fromTeam),
                        String(toTeam)
                      );
                    }
                  }
                }
              }

              try {
                await onApplyTrade(tradeData);
                // TM-PICKS-E1: Re-resolve entitlements so UI reflects new ownership
                refreshEntitlements();
              } catch (error: unknown) {
                console.error('[TradeEditor] Trade application failed:', error);
                toast.error(
                  `Failed to apply trade: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
              }
            }
          }}
          disabled={!canApplyTrade}
          className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
            !canApplyTrade
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          Apply Trade
        </button>

        {canApplyTrade && (
          <span className="text-xs text-white/40">
            CBA validation passed. World-state and post-state checks (duplicate
            players, entitlement conflicts, exclusivity, cap/roster integrity)
            run at apply time.
          </span>
        )}

        {result && !result.legal && (
          <span
            className={`text-xs ${
              (result.override as Record<string, unknown> | undefined)?.requested ? 'text-amber-300' : 'text-red-400'
            }`}
          >
            {(result.override as Record<string, unknown> | undefined)?.requested
              ? `Override requested, but authoritative validation still blocks this trade: ${
                  result.reason || 'Validation failed'
                }`
              : `Trade blocked: ${result.reason || 'Validation failed'}`}
          </span>
        )}
      </div>

      {/* Tasks B, C, D, E: Validation Details Panel with hard-gating and mode tags */}
      {/* Stale validation fix: Uses hasCurrentValidation for proper gating */}
      <ValidationDetailsPanel
        hasValidatorResult={hasCurrentValidation}
        isValidating={isValidating}
        result={result as ValidationDetailsPanelProps['result']}
        teams={teams as ValidationDetailsPanelProps['teams']}
        forceTrade={forceTrade}
        calculatorTeamIndex={calculatorTeamIndex}
        incomingAssets={incomingAssets as Record<string, unknown>[]}
        salaryOut={salaryOut}
        capProjections={capProjections}
        yearKey={yearKey}
        onCalculatorTeamChange={setCalculatorTeamIndex}
        pickRulesById={mergedPickRulesById}
        showSntInjector={isDevSntInjectorEnabled}
        hasInjectedSntPlayers={hasInjectedDevSntPlayers}
        onInjectSntPlayers={injectDevSntPlayers}
        onClearInjectedSntPlayers={clearInjectedDevSntPlayers}
      />

      <TradePreviewModal
        open={previewOpen && !!result}
        onClose={() => setPreviewOpen(false)}
        teams={teams as TradePreviewModalProps['teams']}
        result={result as TradePreviewModalProps['result']}
        yearKey={yearKey}
      />

      {entitlementEditorState && (
        <PickRightWizardModal
          worldId={worldId}
          entitlementId={entitlementEditorState.entitlementId as never}
          initialDocument={entitlementEditorState.initialDocument}
          userId={userId}
          vacuumMode={isVacuumMode}
          onClose={() => setEntitlementEditorState(null)}
          onSuccess={({ entitlementId, document }) => {
            applyEntitlementOverrideUpdate(entitlementId, document);
            setEntitlementEditorState(null);
          }}
          onVacuumSessionMutation={() => {
            refreshEntitlements();
            setEntitlementEditorState(null);
          }}
          onDuplicateAsNew={(document) => {
            // TM-VACUUM-E3: Close current editor and open create-mode with prefilled values
            setEntitlementEditorState({
              entitlementId: null,
              initialDocument: document,
            });
          }}
        />
      )}

      {tradeMachineSatModal && (
        <EditContractModal
          isOpen={!!tradeMachineSatModal}
          onClose={closeTradeMachineSatModal}
          player={tradeMachineSatModal.player}
          initialAction="signAndTrade"
          actionContext="freeAgent"
          teamCapSheet={teams[tradeMachineSatModal.teamIndex]?.team || null}
          currentYear={currentYear}
          actionsOverride={['signAndTrade']}
          actionLabelsOverride={{
            signAndTrade: 'Sign & Trade (Trade Machine)',
          }}
          onSignAndTrade={handleTradeMachineSignAndTrade}
        />
      )}
    </div>
  );
};

export default TradeEditor;
