import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import { useContainerDimensions } from '@/shared/hooks/useContainerDimensions';
import { EditContractModal } from '@/shared/components/EditContractModal';
import { TradeTeamCard } from './TradeTeamCard';
import {
  PrimaryButton,
  SecondaryButton,
  SubtleButton,
  IconButton,
} from './tradeMachineChrome.buttons';
import { CapConfidenceBadge } from '@/features/architect/capSheet/CapConfidenceBadge';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import TradePreviewModal from './TradePreviewModal';
import {
  ValidationStateHeader,
  type TradeReadinessSummary,
} from './ValidationStateHeader';
import { ValidationDetailsPanel } from './ValidationDetailsPanel';
import { PickRightWizardModal } from '@/features/architect/admin/PickRightWizardModal';
import { isEntitlementAuthoringEnabled } from '@/features/architect/utils/entitlements/entitlementWriter';
import {
  clearVacuumOverlay,
  hasVacuumOverlay,
  removeEdit,
  removeCreate,
  applyVacuumTransfer,
} from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';
import type { PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';
import { validateSignAndTradeContractPayload } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { DEV_SNT_INJECTOR_FLAG } from '@/features/architect/tradeMachine/utils/devSntInjector';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';
import type {
  TradeTeamCardProps,
  ValidationDetailsPanelProps,
  TradePreviewModalProps,
  EditContractModalProps,
  EntitlementLike,
  TradeDataEntryLike,
  TradeMachineSatModalState,
  EntitlementEditorState,
  SignAndTradeResult,
  TradeEditorProps,
  PlayerLike,
  TeamLike,
} from './TradeEditor.types';
import {
  normalizeTradeActionMeta,
  toHookTradePlayer,
  toEditContractModalPlayer,
  toEditContractModalTeamCapSheet,
} from './TradeEditor.helpers';
import {
  describeTradeObjective,
  describeTradeException,
  describeTradeOpenAuthority,
} from '@/features/architect/cockpit/tradeOpenRequest';

export const TradeEditor = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap = {},
  onApplyTrade,
  onAfterTradeApplied,
  primaryTeamData = null,
  onEditContract,
  worldId = null, // World ID for world-aware team loading
  worldAsOfDate = null,
  userId = null,
  onDraftActivityChange = null,
  requestedStagePlayerIds = [],
  onStagePlayerHandled = null,
  tradeContext = null,
}: TradeEditorProps) => {
  const {
    teams,
    previewAuthority,
    snapshotValidationDetails,
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
    // Stale validation fix: Use hasCurrentValidation instead of stale detail payload checks
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
  // TMUI-01: remember a pending "open preview after validation" request
  const [wantPreview, setWantPreview] = useState(false);
  // TMAPPLY-02: in-flight lock so Apply can't double-submit
  const [isApplying, setIsApplying] = useState(false);
  const [tradeMachineSatModal, setTradeMachineSatModal] =
    useState<TradeMachineSatModalState>(null);
  // P2: Track which team's calculator to show (0 = primary team by default)
  const [calculatorTeamIndex, setCalculatorTeamIndex] = useState(0);
  const [entitlementEditorState, setEntitlementEditorState] =
    useState<EntitlementEditorState>(null);
  const [contextBannerDismissed, setContextBannerDismissed] = useState(false);

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

  // Meaningful-draft threshold (Slice 3, open-question #18): staged assets OR an
  // explicit objective/exception context count as in-progress; a bare overlay
  // open with no edits and no objective does not.
  const hasDraftActivity = useMemo(() => {
    const hasStagedAssets = teams.some(
      (slot) =>
        slot.sends.length > 0 || (slot.entitlementsOut?.length ?? 0) > 0
    );
    const hasObjectiveContext = Boolean(
      tradeContext?.objective || tradeContext?.exceptionRef
    );
    return hasStagedAssets || hasObjectiveContext;
  }, [teams, tradeContext]);

  useEffect(() => {
    onDraftActivityChange?.(hasDraftActivity);
  }, [hasDraftActivity, onDraftActivityChange]);

  // TMUI-01: validation is deferred a tick so the "Validating…" state can paint.
  // Open the preview only once that requested validation has finished.
  useEffect(() => {
    if (wantPreview && hasCurrentValidation && !isValidating) {
      setPreviewOpen(true);
      setWantPreview(false);
    }
  }, [wantPreview, hasCurrentValidation, isValidating]);

  // Pre-stage one or more players as outgoing when the Trade Machine opens from
  // a player-context entry (the pin board's "Trade" / "Trade all pinned").
  // One-shot: we wait for slot 0's async init to populate the roster, stage each
  // match, then clear the request so removing a player doesn't snap them back.
  // Ids not on the primary roster are a no-op (v1 scope) but are still cleared.
  const stagedRequestKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (requestedStagePlayerIds.length === 0) {
      stagedRequestKeyRef.current = null;
      return;
    }
    const requestKey = requestedStagePlayerIds.join('|');
    if (stagedRequestKeyRef.current === requestKey) return;

    const roster = teams[0]?.team?.players;
    if (!teams[0]?.team || !Array.isArray(roster)) return; // init not ready yet

    for (const playerId of requestedStagePlayerIds) {
      const match = roster.find(
        (p) => (p?.id || p?.player_id) === playerId
      );
      if (match) {
        setPlayerTrade(
          0,
          match as Parameters<typeof setPlayerTrade>[1],
          'trade'
        );
      }
    }
    stagedRequestKeyRef.current = requestKey;
    onStagePlayerHandled?.();
  }, [requestedStagePlayerIds, teams, setPlayerTrade, onStagePlayerHandled]);

  // Stale validation fix: hasCurrentValidation now comes from hook
  // It properly checks if validation result matches current draft configuration

  // Phase 14.2: incomingAssets now uses entitlementsOut instead of picksOut
  // Phase 17: Updated to require toTeamId for 3+ team trades (same logic as hook)
  const incomingAssets = teams.map((tm, idx) => {
    const players: NonNullable<TradeTeamCardProps['incomingPlayers']> = [];
    const entitlements: NonNullable<TradeTeamCardProps['incomingEntitlements']> =
      [];
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

  // Phase 12.3B: Merge pickRulesById from all team slots for projection layer
  const mergedPickRulesById = useMemo(() => {
    const merged: Record<string, PickRuleDoc> = {};
    for (const slot of teams) {
      if (slot?.team?.pickRulesById) {
        Object.assign(merged, slot.team.pickRulesById);
      }
    }
    return merged;
  }, [teams]);

  const handleEditEntitlement = (
    entitlement: EntitlementLike | null | undefined
  ) => {
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
  const handleViewEntitlementDetails = (
    entitlement: EntitlementLike | null | undefined
  ) => {
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

  const currentPreviewAuthority = hasCurrentValidation
    ? previewAuthority
    : null;
  const currentSnapshotValidationDetails = hasCurrentValidation
    ? snapshotValidationDetails
    : null;
  const previewAuthorityReason =
    currentPreviewAuthority?.reason ||
    currentPreviewAuthority?.violations?.[0]?.message ||
    'Trade validation failed';
  const previewOverrideRequested = Boolean(
    (
      currentSnapshotValidationDetails?.override as
        | Record<string, unknown>
        | undefined
    )?.requested
  );
  const previewHasApplyTimeWorldChecks =
    Array.isArray(currentPreviewAuthority?.omittedStages) &&
    currentPreviewAuthority.omittedStages.length > 0;
  const canApplyTrade =
    hasCurrentValidation && currentPreviewAuthority?.legal === true;
  const isDevSntInjectorEnabled =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_SNT_INJECTOR_FLAG) === 'true';
  const selectedTradeTeamCount = useMemo(
    () => teams.filter((slot) => Boolean(slot.team)).length,
    [teams]
  );
  const hasStagedTradeAssets = useMemo(
    () =>
      teams.some(
        (slot) =>
          slot.sends.length > 0 || (slot.entitlementsOut?.length ?? 0) > 0
      ),
    [teams]
  );
  const validationWarningsSource = currentSnapshotValidationDetails as
    | { dataWarnings?: unknown; hasDataIssues?: unknown }
    | null;
  const validationDataWarnings = Array.isArray(
    validationWarningsSource?.dataWarnings
  )
    ? validationWarningsSource.dataWarnings
    : [];
  const hasValidationDataIssues = Boolean(
    validationWarningsSource?.hasDataIssues && validationDataWarnings.length > 0
  );
  const hasCriticalDataIssues = validationDataWarnings.some(
    (warning) =>
      String((warning as { severity?: unknown }).severity ?? '').toLowerCase() ===
      'error'
  );
  const tradeReadiness = useMemo<TradeReadinessSummary>(() => {
    if (initError && teams.length === 0) {
      return {
        tone: 'blocked',
        label: 'Unavailable',
        message: 'Trade Machine failed to initialize.',
      };
    }

    if (selectedTradeTeamCount < 2) {
      return {
        tone: 'setup',
        label: 'Setup required',
        message: 'Select at least two teams before validation.',
      };
    }

    if (!hasStagedTradeAssets) {
      return {
        tone: 'setup',
        label: 'Setup required',
        message: 'Add a player or draft asset to the trade.',
      };
    }

    if (isValidating) {
      return {
        tone: 'validating',
        label: 'Validating',
        message: 'Checking the current trade draft.',
      };
    }

    if (!hasCurrentValidation) {
      return {
        tone: 'ready',
        label: 'Ready to validate',
        message: 'Run validation before preview or apply.',
      };
    }

    if (currentPreviewAuthority?.legal === false) {
      return {
        tone: previewOverrideRequested ? 'warning' : 'blocked',
        label: previewOverrideRequested ? 'Override blocked' : 'Trade blocked',
        message: previewAuthorityReason,
      };
    }

    if (canApplyTrade) {
      if (hasCriticalDataIssues) {
        return {
          tone: 'warning',
          label: 'Review data issues',
          message: 'Validation found data blockers before apply.',
        };
      }

      if (hasValidationDataIssues) {
        return {
          tone: 'warning',
          label: 'Ready with data warnings',
          message: isVacuumMode
            ? 'Review warnings before applying in this session.'
            : 'Review warnings before applying to the active Team Plan.',
        };
      }

      if (previewHasApplyTimeWorldChecks) {
        return {
          tone: 'info',
          label: 'Ready with apply-time checks',
          message: isVacuumMode
            ? 'Local checks passed; session checks run at apply.'
            : 'Local checks passed; final Team Plan checks run at apply.',
        };
      }

      return {
        tone: 'success',
        label: 'Ready to apply',
        message: isVacuumMode
          ? 'Applies this trade to the sandbox session.'
          : 'Applies this move to the active Team Plan.',
      };
    }

    return {
      tone: 'ready',
      label: 'Review validation',
      message: 'Open Validation Results before applying.',
    };
  }, [
    canApplyTrade,
    currentPreviewAuthority?.legal,
    hasCriticalDataIssues,
    hasCurrentValidation,
    hasStagedTradeAssets,
    hasValidationDataIssues,
    initError,
    isVacuumMode,
    isValidating,
    previewAuthorityReason,
    previewHasApplyTimeWorldChecks,
    previewOverrideRequested,
    selectedTradeTeamCount,
    teams.length,
  ]);

  const resolveEntitlementTeamCode = (
    entitlement: EntitlementLike | null | undefined
  ) => {
    const rawTeamCode = entitlement?.holderTeam || entitlement?.holder_team;
    return rawTeamCode == null ? null : String(rawTeamCode);
  };

  const handleRevertEntitlementEdit = (
    entitlement: EntitlementLike | null | undefined
  ) => {
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

  const handleDeleteSessionEntitlement = (
    entitlement: EntitlementLike | null | undefined
  ) => {
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

  const handleTradeMachineSignAndTrade: NonNullable<
    EditContractModalProps['onSignAndTrade']
  > = (player, contractPayload, destinationTeamId): SignAndTradeResult => {
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
      const teamCode = teamId
        ? resolveTeamCode(String(teamId)) || teamId
        : null;
      return teamCode === canonicalDestinationTeamCode;
    });
    const destinationTradeTeamId = String(
      destinationTradeTeam?.team?.id ||
        destinationTradeTeam?.team?.teamCode ||
        destinationTradeTeam?.team?.teamId ||
        canonicalDestinationTeamCode
    );

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
      toHookTradePlayer(player),
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

  const handleApplyTrade = async () => {
    // TMAPPLY-02: in-flight guard against double-submit
    if (isApplying) return;
    if (!hasCurrentValidation) {
      toast.error('Re-validate trade before applying.');
      return;
    }
    if (currentPreviewAuthority?.legal !== true) {
      toast.error('Cannot apply trade: ' + previewAuthorityReason);
      return;
    }
    const tradeData = exportCurrentTrade() as TradeDataEntryLike[] | null;
    if (!onApplyTrade || !tradeData) {
      return;
    }

    setIsApplying(true);
    try {
      await onApplyTrade(tradeData);

      // TMAPPLY-01: In vacuum/sandbox mode, persist entitlement transfers
      // to localStorage ONLY after the trade actually applied — so a
      // blocked/failed apply doesn't leave picks moved while players don't.
      // World mode persists via the mutation pipeline.
      //
      // TMAPPLY-04 (decision): sandbox is an ephemeral preview for ROSTERS
      // (players reload from base on refresh), but pick ownership uses this
      // session overlay — the only sandbox mechanism for pick moves — which
      // survives refresh. The "Clear session pick changes" button (shown in
      // the header) is the reset. Unifying durability across players + picks
      // would require new persistence and isn't worth it for a sandbox edge.
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

      // TM-PICKS-E1: Re-resolve entitlements so UI reflects new ownership
      refreshEntitlements();
      onAfterTradeApplied?.();
    } catch (error: unknown) {
      console.error('[TradeEditor] Trade application failed:', error);
      toast.error(
        `Failed to apply trade: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsApplying(false);
    }
  };

  const bannerAuthority = tradeContext
    ? describeTradeOpenAuthority(tradeContext.authority)
    : null;
  const showContextBanner = Boolean(
    tradeContext &&
      (tradeContext.objective ||
        tradeContext.exceptionRef ||
        tradeContext.relatedEventId) &&
      !contextBannerDismissed
  );

  // Cap-figure confidence for the active season. The league cap/apron/tax
  // numbers are hand-maintained constants; future seasons the NBA hasn't set
  // yet are projections — surface that so they don't read as official.
  const capRulesForYear = useMemo(() => {
    const numericYear = Number(yearKey);
    if (!Number.isFinite(numericYear)) return null;
    try {
      return getCapRulesForYear(numericYear);
    } catch {
      return null;
    }
  }, [yearKey]);
  const capSourceSummary =
    (capRulesForYear?._meta?.sourcesSummary as string | undefined) ?? null;
  const capSeasonLabel = capRulesForYear?.seasonKey ?? null;

  return (
    <div className="text-white space-y-6">
      {showContextBanner && tradeContext && bannerAuthority ? (
        <div
          className="flex items-start justify-between gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2"
          data-testid="trade-context-banner"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span
              data-testid="trade-context-banner-authority"
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                bannerAuthority.tone === 'committed'
                  ? 'border-green-400/40 bg-green-500/10 text-green-200'
                  : bannerAuthority.tone === 'planning'
                    ? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
              }`}
            >
              {bannerAuthority.label}
            </span>
            {tradeContext.objective ? (
              <span data-testid="trade-context-banner-objective">
                Objective: {describeTradeObjective(tradeContext.objective)}
              </span>
            ) : null}
            {tradeContext.exceptionRef ? (
              <span>
                Using {describeTradeException(tradeContext.exceptionRef.kind)} —
                pending validation
              </span>
            ) : null}
            {tradeContext.relatedEventId ? (
              <span>Referencing a committed trade event (not cloned)</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setContextBannerDismissed(true)}
            className="shrink-0 rounded px-1 text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
            aria-label="Dismiss trade context"
            data-testid="trade-context-banner-dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Trade Machine</h2>
          {capSourceSummary ? (
            <CapConfidenceBadge
              summary={capSourceSummary}
              prefix={capSeasonLabel ? `${capSeasonLabel} cap ·` : 'Cap ·'}
              title="Confidence of the league salary cap / apron / tax figures for this season. Projected = the NBA has not set official numbers yet."
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* TM-VACUUM-E1: Clear session edits button (vacuum mode only) */}
          {isVacuumMode && hasVacuumOverlay() && (
            <SubtleButton
              tone="warning"
              onClick={handleClearVacuumOverlay}
              title="Clear all session pick changes"
            >
              Clear session pick changes
            </SubtleButton>
          )}
          <PrimaryButton
            onClick={() => {
              const status = handleValidate();
              if (status === 'insufficient') {
                // TMUI-03: give the click a visible result instead of nothing
                toast.error('Add at least two teams to validate this trade.');
                return;
              }
              setWantPreview(true);
            }}
          >
            Validate Trade
          </PrimaryButton>
          <PrimaryButton
            tone="positive"
            onClick={handleApplyTrade}
            disabled={!canApplyTrade || isApplying}
          >
            {isApplying ? 'Applying…' : 'Apply Trade'}
          </PrimaryButton>
          <IconButton onClick={resetTrade} title="Reset Trade">
            <RotateCcw size={18} />
          </IconButton>
          {teams.length < 5 && (
            <SecondaryButton onClick={addTeam}>Add Team</SecondaryButton>
          )}
        </div>
      </div>

      {/* Task A: Mode + Validation State Header */}
      {/* Stale validation fix: Uses hasCurrentValidation to only show "Validated"
          when the current preview authority/detail payload matches this draft */}
      <ValidationStateHeader
        hasValidatorResult={hasCurrentValidation}
        isValidating={isValidating}
        validatedAt={getValidatedAt()}
        readiness={tradeReadiness}
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
          const otherTeams: NonNullable<TradeTeamCardProps['otherTeams']> =
            teams.flatMap((tm, j) => {
              if (j === idx || !tm.team) {
                return [];
              }
              return [tm.team];
            });
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
                  (currentSnapshotValidationDetails ??
                    null) as TradeTeamCardProps['validationResult']
                }
                teamIndex={idx}
                team={t.team}
                sends={t.sends}
                // Phase 14.2: Removed picks prop - draft assets are entitlements-only
                // Phase 11.1: Pass entitlement toggle and selection state
                entitlementsOut={t.entitlementsOut || []}
                onToggleEntitlement={(e) => toggleEntitlement(idx, e)}
                // Phase 17: Pass destination setter for multi-team entitlement routing
                onSetEntitlementDestination={(entitlementId, toTeamId) => {
                  if (!entitlementId) {
                    return;
                  }
                  setEntitlementDestination(
                    idx,
                    entitlementId,
                    toTeamId ?? null
                  );
                }}
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
                otherTeams={otherTeams}
                playersMap={playersMap}
                onSetPlayerTrade={(p, action, dest, meta) =>
                  setPlayerTrade(
                    idx,
                    toHookTradePlayer(p),
                    action,
                    dest ?? null,
                    normalizeTradeActionMeta(meta)
                  )
                }
                onRequestSignAndTrade={(player, defaultDestinationTeamId) =>
                  openTradeMachineSatModal(idx, player, defaultDestinationTeamId)
                }
                // Phase 14: Removed onTogglePick and onEditPick (legacy picks UI removed)
                onUndoPlayerTrade={(player) => undoPlayerTrade(player)}
                onSelectTeam={(teamId) => selectTeam(idx, teamId)}
                onRemove={() => removeTeam(idx)}
                onEditContract={
                  onEditContract ? (player) => onEditContract(player) : null
                }
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

      {/* Apply-action context — the Apply button itself now lives in the header
          toolbar; this row carries only the contextual warning / blocked text. */}
      {((canApplyTrade && previewHasApplyTimeWorldChecks) ||
        currentPreviewAuthority?.legal === false) && (
        <div className="flex flex-wrap gap-3 items-center">
          {canApplyTrade && previewHasApplyTimeWorldChecks && (
            <span className="text-xs text-yellow-400/50">
              All local preview checks passed. World-state checks (duplicate
              players, entitlement conflicts, exclusivity) run at apply time and
              may still reject this trade.
            </span>
          )}

          {currentPreviewAuthority?.legal === false && (
            <span
              className={`text-xs ${
                previewOverrideRequested ? 'text-amber-300' : 'text-red-400'
              }`}
            >
              {previewOverrideRequested
                ? `Override requested, but preview authority still blocks this trade: ${
                    previewAuthorityReason
                  }`
                : `Trade blocked: ${previewAuthorityReason}`}
            </span>
          )}
        </div>
      )}

      {/* Tasks B, C, D, E: Validation Details Panel with hard-gating and mode tags */}
      {/* Stale validation fix: Uses hasCurrentValidation for proper authority/detail gating */}
      <ValidationDetailsPanel
        hasValidatorResult={hasCurrentValidation}
        isValidating={isValidating}
        previewAuthority={
          currentPreviewAuthority as ValidationDetailsPanelProps['previewAuthority']
        }
        snapshotValidationDetails={
          currentSnapshotValidationDetails as ValidationDetailsPanelProps['snapshotValidationDetails']
        }
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
        open={
          previewOpen &&
          !!currentPreviewAuthority &&
          !!currentSnapshotValidationDetails
        }
        onClose={() => setPreviewOpen(false)}
        teams={teams as TradePreviewModalProps['teams']}
        previewAuthority={
          currentPreviewAuthority as TradePreviewModalProps['previewAuthority']
        }
        snapshotValidationDetails={
          currentSnapshotValidationDetails as TradePreviewModalProps['snapshotValidationDetails']
        }
        yearKey={yearKey}
      />

      {entitlementEditorState && (
        <PickRightWizardModal
          worldId={worldId}
          entitlementId={
            entitlementEditorState.entitlementId != null
              ? String(entitlementEditorState.entitlementId)
              : undefined
          }
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
          player={toEditContractModalPlayer(tradeMachineSatModal.player)}
          initialAction="signAndTrade"
          actionContext="freeAgent"
          teamCapSheet={toEditContractModalTeamCapSheet(
            teams[tradeMachineSatModal.teamIndex]?.team || null
          )}
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
