/**
 * FILE: src/features/architect/GMDashboard/GMDashboard.tsx
 * PURPOSE: Primary Architect dashboard for managing cap sheets, contracts, trades, and free agency flows.
 * OWNERSHIP: Feature: architect/core dashboard
 *
 * ARCHITECT OWNERSHIP:
 * - Composition shell only.
 * - Delegates dashboard-visible state/load coordination to useArchitectState.
 * - Delegates UI mutation orchestration to useArchitectActions.
 * - Must not become a world-read or committed-write authority.
 *
 * HISTORY:
 *  - 2025-12-10: Updated to surface player rules profile integration (chunk_01).
 *  - 2025-12-10: Wired multi-year rules context into cap table + contract modal flows (chunk_02).
 *  - 2025-01-XX: Refactored to extract tab sections into separate components.
 *  - 2025-12-12: Refactored to use authenticated userId instead of hardcoded demoUser
 *  - 2025-12-12: Phase 3 refactor - extracted all handlers into useArchitectActions hook
 *  - 2025-12-14: Option B refactor - removed shadow cap sheet state, teamCapSheet is now the only source of truth
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditContractModal } from '@/shared/components/EditContractModal';
import { RosterSection } from './sections/RosterSection';
import { CapSheetSection } from './sections/CapSheetSection';
import { CapTableSection } from './sections/CapTableSection';
import { ExceptionTracker } from '@/features/architect/capSheet/ExceptionTracker';
import { TradeSection } from './sections/TradeSection';
import { FreeAgencySection } from './sections/FreeAgencySection';
import { OffseasonSection } from './sections/OffseasonSection';
import { HistorySection } from './sections/HistorySection';
import { ComparisonSection } from './sections/ComparisonSection';
import { GuideSection } from './sections/GuideSection';
import { useArchitectComparisonViewModel } from './hooks/useArchitectComparisonViewModel';
import { useArchitectGuidedAnswers } from './hooks/useArchitectGuidedAnswers';
import type { Stage4NavigationTargetId } from '@/features/architect/guidedQuestions';
import { WorldSelector } from '@/features/architect/GMDashboard/components/WorldSelector';
import { WorldTimeControls } from '@/features/architect/GMDashboard/components/WorldTimeControls';
import { CapAuditDebugPanel } from '@/features/architect/GMDashboard/components/CapAuditDebugPanel';
import { FullCapFreeAgentModal } from '@/features/architect/GMDashboard/components/FullCapFreeAgentModal';
import {
  CockpitShell,
  CockpitStatePanel,
  TradeOverlay,
  routePlayerAction,
  buildTradeOpenRequest,
  buildFollowThroughContext,
} from '@/features/architect/cockpit';
import type {
  NavRailItem,
  RoomDescriptor,
  PlayerAction,
  PlayerActionContext,
  TradeOpenRequest,
  TradeObjective,
  FollowThroughContext,
} from '@/features/architect/cockpit';
import { useArchitectDeskNavigation, writeLastTeamSlug } from './hooks/useArchitectDeskNavigation';
import { resolvePrimaryPlayerFocusId } from './postActionHandoff/playerFocus';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';
import { useArchitectPostActionReceipt } from './hooks/useArchitectPostActionReceipt';
import { useHistoryEventDetailRequest } from './hooks/useHistoryEventDetailRequest';
import { deriveSeasonAdvanceReceipt } from './postActionHandoff/types';
import { useArchitectState } from './hooks/useArchitectState';
import {
  buildArchitectTeamPlanContextExitMessage,
  confirmArchitectTeamPlanContextExit,
} from './hooks/teamPlanSaveState';
import { useArchitectWorkspaceContext } from './hooks/useArchitectWorkspaceContext';
import { useArchitectActions } from './hooks/useArchitectActions';
import { useArchitectModals } from './hooks/useArchitectModals';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  FIREBASE_TARGET_MODE,
  isLikelyEmulatorConnectionError,
} from '@/firebaseConfig';
import { capProjections } from '@/features/architect/utils/capProjections';
import {
  toSeasonCode,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';
import { buildFreeAgentSurfaceEntry } from '@/features/architect/freeAgency/FreeAgentPool';
import {
  loadWorldTeamFreeAgentPool,
  resetWorldTeamFreeAgentPool,
  saveWorldTeamFreeAgentPool,
} from '@/features/architect/freeAgency/freeAgentPoolPersistence';
import type {
  FreeAgentPoolManagementControls,
  FreeAgentLookupPlayer,
  FreeAgentListItem,
  FreeAgentSurfaceEntry,
} from '@/features/architect/freeAgency/FreeAgentPool/types';
import type { TradeSignAndTradeSeed } from '@/features/architect/tradeMachine/TradeEditor.types';

type EditContractModalProps = Parameters<typeof EditContractModal>[0];
type EditContractArchitectActionCallbacks = Pick<
  EditContractModalProps,
  | 'onSignFreeAgent'
  | 'onResign'
  | 'onSignAndTrade'
  | 'getSignAndTradePreflight'
  | 'getOfferSheetPreflight'
  | 'onStoreOfferSheet'
  | 'onExtend'
  | 'onWaive'
  | 'onOptionDecision'
  | 'onRenounce'
>;
type ContractModalActionOverrides = Pick<
  EditContractModalProps,
  'actionsOverride' | 'actionLabelsOverride' | 'showOfferSheetToggle'
>;
type ContractModalActionLabelsOverride = NonNullable<
  EditContractModalProps['actionLabelsOverride']
>;
type FreeAgencySectionProps = Parameters<typeof FreeAgencySection>[0];
type CapSheetSectionProps = Parameters<typeof CapSheetSection>[0];
type CapTableSectionProps = Parameters<typeof CapTableSection>[0];
type TradeSectionProps = Parameters<typeof TradeSection>[0];
type OffseasonSectionProps = Parameters<typeof OffseasonSection>[0];
type ArchitectOverrideMetadata = Parameters<
  ReturnType<typeof useArchitectActions>['handleOptionDecision']
>[2];

const toModalActionResult = async (
  resultPromise: Promise<{ success: boolean; message?: string }>
) => ({ ...(await resultPromise) });

const toOverrideMetadata = (value: unknown): ArchitectOverrideMetadata => {
  if (
    value &&
    typeof value === 'object' &&
    'overrideUsed' in value &&
    'overrideReasons' in value &&
    'overrideTimestamp' in value
  ) {
    return value as ArchitectOverrideMetadata;
  }

  return null;
};

// Phase 1 cockpit gate: the cap audit dev panel is opt-in inside the
// cockpit so it does not steal chrome space by default. Toggle via the
// browser console with:
//   localStorage.setItem('architect.devTools.capAudit', '1')
const COCKPIT_CAP_AUDIT_FLAG_KEY = 'architect.devTools.capAudit';

const V1_CONTRACT_ACTION_LABEL_OVERRIDES = {
  signNew: 'Sign New Contract (Preview)',
  extend: 'Extend Contract (Preview)',
  waive: 'Waive Player (Preview)',
  waiveStretch: 'Waive & Stretch (Preview)',
  buyout: 'Buyout Contract (Preview)',
} satisfies ContractModalActionLabelsOverride;

function isCockpitCapAuditEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(COCKPIT_CAP_AUDIT_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

const seasonEndYearsFromCaps = (caps: Record<string, unknown> | null | undefined) => {
  const keys = Object.keys(caps || {});
  const years = keys
    .map((key) => {
      if (/^\d{4}-\d{2}$/.test(key)) {
        const tail = parseInt(key.split('-')[1], 10);
        return 2000 + tail;
      }
      const numericValue = parseInt(key, 10);
      return Number.isFinite(numericValue) ? numericValue : null;
    })
    .filter((value): value is number => Boolean(value));

  return Array.from(new Set(years)).sort((a, b) => a - b);
};

export const GMDashboard = () => {
  // League View enters here with team identity only; this dashboard owns selected season state.
  const { teamId } = useParams();
  const { userId, loading: authLoading } = useAuth();
  const normalizedTeamId = teamId ?? '';

  // Pin board: an intentional, multi-player collection surfaced in the activity
  // rail. Pinning is an explicit action (the player action menu) — never a
  // side effect of clicking a player. Replaces the old single auto-pinned
  // `deskPlayerId` + top SelectionDock model.
  const [pinnedPlayerIds, setPinnedPlayerIds] = useState<string[]>([]);
  const addPin = useCallback((id: string | null) => {
    if (!id) return;
    setPinnedPlayerIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const removePin = useCallback((id: string) => {
    setPinnedPlayerIds((prev) => prev.filter((p) => p !== id));
  }, []);
  const togglePin = useCallback((player: Record<string, unknown>) => {
    const id = resolvePrimaryPlayerFocusId(
      player as Parameters<typeof resolvePrimaryPlayerFocusId>[0]
    );
    if (!id) return;
    setPinnedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);
  // Manual (non-pinned) cross-room focus: a view-on-X intent highlights a
  // player in the destination room without pinning them. Merged into
  // focusedPlayerIds below; replaced on each view intent. Visual-only.
  const [manualFocusPlayerId, setManualFocusPlayerId] = useState<string | null>(
    null
  );
  // FA-target subtype (open-question #1): ids pinned *as targets* from Free
  // Agency. A parallel session/visual-only set keyed by id — pins stay a plain
  // string[]; this only drives the rail's "Target" badge. Never world data.
  const [freeAgentTargetIds, setFreeAgentTargetIds] = useState<Set<string>>(
    () => new Set()
  );
  const pinPlayerFromAction = useCallback((context: PlayerActionContext) => {
    const id = context.playerId;
    if (!id) return;
    setPinnedPlayerIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (context.isFreeAgentTarget) {
      setFreeAgentTargetIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }, []);
  const unpinPlayerFromAction = useCallback(
    (context: PlayerActionContext) => {
      const id = context.playerId;
      if (!id) return;
      removePin(id);
      setFreeAgentTargetIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [removePin]
  );
  const [tradeDraftActive, setTradeDraftActive] = useState(false);
  // Trade Machine renders as a full-viewport overlay rather than a room in the
  // workbench swapper. `isTradeOpen` toggles its visibility; `hasOpenedTrade`
  // gates the lazy first mount and then stays true so the overlay subtree —
  // and the in-progress draft inside it — survives close/reopen untouched.
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [hasOpenedTrade, setHasOpenedTrade] = useState(false);
  // One-shot request to pre-stage one or more players into the Trade Machine,
  // set when the overlay is opened from a player-context entry (the pin board's
  // per-row "Trade" or "Trade all pinned"). Cleared by TradeEditor once
  // consumed (mirrors the Free Agency requested-open idiom).
  const [requestedTradeStagePlayerIds, setRequestedTradeStagePlayerIds] =
    useState<string[]>([]);
  // Context-carrying open request (Slice 3): drives the in-overlay objective/
  // authority banner. Persists across overlay close/reopen so the banner and
  // draft survive together; replaced on the next context-carrying open.
  const [tradeOpenRequest, setTradeOpenRequest] =
    useState<TradeOpenRequest | null>(null);
  // BZE-190: one-shot sign-and-trade seed handed to the Trade Machine when the
  // user picks "Sign & Trade" on one of their own free agents in Free Agency.
  // Cleared by TradeEditor once consumed (mirrors requestedTradeStagePlayerIds).
  const [signAndTradeSeed, setSignAndTradeSeed] =
    useState<TradeSignAndTradeSeed | null>(null);
  // Follow-through context (Slice 5): the launch context carried into the
  // Compare/Guide rooms. Session-only (open-question #11) — never persisted.
  const [followThroughContext, setFollowThroughContext] =
    useState<FollowThroughContext | null>(null);
  const openTrade = useCallback(() => {
    setHasOpenedTrade(true);
    setIsTradeOpen(true);
  }, []);
  // Context-carrying open. Plain `openTrade` (NavRail / deep-link / resume)
  // preserves any prior request + draft; this one stages players and/or sets
  // the objective banner.
  const openTradeWithRequest = useCallback((request: TradeOpenRequest) => {
    setRequestedTradeStagePlayerIds(request.playerIds ?? []);
    setTradeOpenRequest(request);
    setHasOpenedTrade(true);
    setIsTradeOpen(true);
  }, []);
  // BZE-190: open the Trade Machine carrying a free agent as a sign-and-trade
  // seed. The deal (contract, destination team, legality) is assembled there.
  const openTradeForSignAndTrade = useCallback(
    (player: Record<string, unknown>) => {
      setSignAndTradeSeed({
        player,
        sourceTeamCode: normalizedTeamId || null,
      });
      setHasOpenedTrade(true);
      setIsTradeOpen(true);
    },
    [normalizedTeamId]
  );
  const closeTrade = useCallback(() => setIsTradeOpen(false), []);
  const [freeAgentOptionKeys, setFreeAgentOptionKeys] = useState<string[]>([]);
  const [freeAgentOptionEntries, setFreeAgentOptionEntries] = useState<
    FreeAgentSurfaceEntry[]
  >([]);
  const [freeAgentPoolSavedAt, setFreeAgentPoolSavedAt] = useState<
    string | null
  >(null);
  const [requestedFreeAgentOpenKey, setRequestedFreeAgentOpenKey] =
    useState<string | null>(null);
  const [isFullCapFreeAgentModalOpen, setIsFullCapFreeAgentModalOpen] =
    useState(false);
  const [
    fullCapFreeAgentModalSelectionKey,
    setFullCapFreeAgentModalSelectionKey,
  ] = useState<string | null>(null);
  const openFullCapFreeAgentModal = useCallback(
    (selectionKey: string | null = null) => {
      setFullCapFreeAgentModalSelectionKey(selectionKey);
      setIsFullCapFreeAgentModalOpen(true);
    },
    []
  );
  const closeFullCapFreeAgentModal = useCallback(
    () => {
      setIsFullCapFreeAgentModalOpen(false);
      setFullCapFreeAgentModalSelectionKey(null);
    },
    []
  );

  useEffect(() => {
    if (normalizedTeamId) {
      writeLastTeamSlug(normalizedTeamId);
    }
  }, [normalizedTeamId]);

  const state = useArchitectState({
    teamId: normalizedTeamId,
    userId,
    authLoading,
  });

  const modals = useArchitectModals();

  const {
    teamCapSheet,
    currentYear,
    selectedRulesYear,
    activeTab,
    selectedPlayer,
    freeAgents,
    isLoading,
    isSaving,
    error,
    lastSavedAt,
    lastSaveError,
    offseasonRun,
    offseasonSummary,
    playersMap,
    capTableYears,
    worldId,
    activeWorldLabel,
    worldAsOfDate,
    worldCurrentSeason,
    worldMetadataLoading,
    activeWorldOwner,
    worldTimeOwner,
    worldModeBoundary,
    setTeamCapSheet,
    setCurrentYear,
    setActiveTab,
    setLastCapSheet,
    setOffseasonRun,
    setOffseasonSummary,
    reloadActiveWorldTeamData,
  } = state;

  useEffect(() => {
    setFreeAgentPoolSavedAt(null);
  }, [currentYear, normalizedTeamId, worldId]);

  useArchitectDeskNavigation({
    activeTab,
    setActiveTab,
    focusedPlayerId: pinnedPlayerIds[0] ?? null,
    onPlayerIdFromUrl: addPin,
    isTradeOpen,
    onOpenTradeFromUrl: openTrade,
  });

  const workspaceContext = useArchitectWorkspaceContext({
    teamCapSheet,
    teamId: normalizedTeamId,
    currentYear,
    worldId,
    activeWorldLabel,
    worldAsOfDate,
    worldCurrentSeason,
    worldMetadataLoading,
    isLoading,
    isSaving,
    error,
    lastSavedAt,
    lastSaveError,
    hasStagedTradeDraft: tradeDraftActive,
    worldModeBoundary,
  });
  const confirmUnsafeContextExit = useCallback(
    (intent: Parameters<typeof confirmArchitectTeamPlanContextExit>[1]) =>
      confirmArchitectTeamPlanContextExit(workspaceContext.saveState, intent),
    [workspaceContext.saveState]
  );
  const handleViewingSeasonChange = useCallback(
    (nextYear: number) => {
      if (nextYear === currentYear) return;
      if (!confirmUnsafeContextExit('switch-season')) return;
      setCurrentYear(nextYear);
    },
    [confirmUnsafeContextExit, currentYear, setCurrentYear]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const message = buildArchitectTeamPlanContextExitMessage(
      workspaceContext.saveState,
      'leave-architect'
    );
    if (!message) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [workspaceContext.saveState]);

  const resolvedHistoryTeamCode = useMemo(() => {
    const capSheetTeamCode = String(teamCapSheet?.teamCode ?? '').trim();
    return (
      capSheetTeamCode ||
      resolveTeamCode(normalizedTeamId) ||
      normalizedTeamId
    );
  }, [normalizedTeamId, teamCapSheet?.teamCode]);

  const isEmulatorMode = FIREBASE_TARGET_MODE === 'EMULATOR';
  const showEmulatorUnavailableBanner =
    isEmulatorMode && error && isLikelyEmulatorConnectionError(error);

  const {
    showOffseasonModal,
    showContractModal,
    initialAction,
    targetYear,
    actionContext,
    closeContractModal,
    closeOffseasonModal,
    setShowOffseasonModal,
  } = modals;
  const [contractModalActionOverrides, setContractModalActionOverrides] =
    useState<ContractModalActionOverrides | null>(null);
  const closeDashboardContractModal = useCallback(() => {
    setContractModalActionOverrides(null);
    closeContractModal();
  }, [closeContractModal]);

  useEffect(() => {
    if (!showContractModal) {
      setContractModalActionOverrides(null);
    }
  }, [showContractModal]);

  const simulatedRulesDate = useMemo(
    () => new Date(currentYear - 1, 6, 15),
    [currentYear]
  );

  const {
    leagueContext: rulesLeagueContext,
    leagueContextByYear,
    getProfile: getRulesProfile,
    getProfileForYear,
  } = usePlayerRulesProfiles({
    players: teamCapSheet?.players || [],
    teamCapSheet,
    currentYear,
    teamCode: normalizedTeamId,
    simulationDate: simulatedRulesDate,
    evaluationYears: capTableYears,
  });

  const selectedPlayerRulesProfile = selectedPlayer
    ? getRulesProfile(selectedPlayer, selectedRulesYear)
    : null;
  const selectedRulesLeagueContext =
    (selectedRulesYear && leagueContextByYear?.get(selectedRulesYear)) ||
    rulesLeagueContext;

  const postActionReceiptScopeKey = [
    worldId ?? 'sandbox',
    resolvedHistoryTeamCode,
  ].join(':');
  const postActionReceipt = useArchitectPostActionReceipt(
    postActionReceiptScopeKey
  );
  const {
    requestedHistoryEventDetail,
    openHistoryRoot,
    requestHistoryEventDetail,
    handleHistoryEventDetailHandled,
  } = useHistoryEventDetailRequest({
    worldId,
    teamCode: resolvedHistoryTeamCode,
    onOpenHistory: () => setActiveTab('history'),
  });
  // Stage 2C: derive session-scoped focused player ids from the most recent
  // committed post-action receipt. Visual-only — receipt dismiss/clear
  // automatically clears the highlight. Single-label surfaces still use the
  // first primary id; the Full Cap Table receives every changed player.
  // Highlight set = pinned players ∪ the most recent receipt's changed players.
  // Both light up across the room surfaces; receipt highlights auto-clear on
  // dismiss while pins persist until explicitly unpinned.
  const focusedPlayerIds = useMemo(() => {
    const receiptIds = postActionReceipt.receipt?.primaryPlayerIds ?? [];
    const merged = [...pinnedPlayerIds];
    for (const id of receiptIds) {
      if (!merged.includes(id)) merged.push(id);
    }
    // Manual view-intent focus (not pinned) also lights up the destination row.
    if (manualFocusPlayerId && !merged.includes(manualFocusPlayerId)) {
      merged.push(manualFocusPlayerId);
    }
    return merged;
  }, [
    pinnedPlayerIds,
    postActionReceipt.receipt?.primaryPlayerIds,
    manualFocusPlayerId,
  ]);
  const focusedPlayerId = focusedPlayerIds[0] ?? null;

  const resolveFocusedPlayerLabel = useCallback(
    (playerId: string | null) => {
      if (!playerId) return null;
      const player = playersMap[playerId];
      if (player) {
        const bio = player.bio as { displayName?: string } | undefined;
        return (
          bio?.displayName ||
          player.displayName ||
          player.name ||
          playerId
        );
      }
      return playerId;
    },
    [playersMap]
  );

  const pinnedPlayers = useMemo(
    () =>
      pinnedPlayerIds.map((id) => ({
        id,
        label: resolveFocusedPlayerLabel(id) ?? id,
        isTarget: freeAgentTargetIds.has(id),
      })),
    [pinnedPlayerIds, resolveFocusedPlayerLabel, freeAgentTargetIds]
  );

  // Stage 3C: derive current roster player ids from teamCapSheet for comparison.
  const comparisonRosterPlayerIds = useMemo(() => {
    const players = teamCapSheet?.players;
    if (!Array.isArray(players)) return [];
    const ids: string[] = [];
    for (const p of players) {
      if (!p || typeof p !== 'object') continue;
      const player = p as Record<string, unknown>;
      const bio = player['bio'] as Record<string, unknown> | null | undefined;
      const id =
        (typeof player['id'] === 'string' ? player['id'] : null) ??
        (typeof player['player_id'] === 'string' ? player['player_id'] : null) ??
        (typeof bio?.['playerId'] === 'string' ? bio['playerId'] : null);
      if (id && id.trim()) ids.push(id.trim());
    }
    return ids;
  }, [teamCapSheet?.players]);

  const comparisonWorldName =
    workspaceContext.world.status !== 'sandbox'
      ? workspaceContext.world.label
      : null;

  const comparisonViewModel = useArchitectComparisonViewModel({
    worldId,
    teamCode: resolvedHistoryTeamCode,
    worldName: comparisonWorldName,
    baselineSeason: null,
    currentSeason: worldCurrentSeason ?? null,
    currentRosterPlayerIds: comparisonRosterPlayerIds,
    refreshKey: postActionReceipt.generation,
  });

  // Stage 4B: derive Front Office Guide answers from existing seams.
  const guidedAnswersViewModel = useArchitectGuidedAnswers({
    workspaceContext,
    comparison: comparisonViewModel,
    postActionReceipt: postActionReceipt.receipt,
  });

  const handleGuideNavigate = useCallback(
    (target: Stage4NavigationTargetId) => {
      switch (target) {
        case 'roster':
          setActiveTab('roster');
          return;
        case 'cap':
          setActiveTab('cap');
          return;
        case 'capfull':
          setActiveTab('capfull');
          return;
        case 'trade':
          openTrade();
          return;
        case 'fa':
          setActiveTab('fa');
          return;
        case 'offseason':
          setActiveTab('offseason');
          return;
        case 'history':
          openHistoryRoot();
          return;
        case 'compare':
          setActiveTab('compare');
          return;
        case 'guide':
          setActiveTab('guide');
          return;
      }
    },
    [setActiveTab, openHistoryRoot, openTrade]
  );

  const actions = useArchitectActions({
    teamId: normalizedTeamId,
    userId,
    authLoading,
    state,
    playersMap,
    modals,
    worldId,
    seasonId: toSeasonCode(currentYear),
    publishPostActionReceipt: postActionReceipt.publish,
  });

  const handleOffseasonAdvanceApplied = useCallback(
    (aftermath: Parameters<NonNullable<OffseasonSectionProps['onAfterOffseasonAdvanceApplied']>>[0]) => {
      const receipt = deriveSeasonAdvanceReceipt({
        aftermath,
        primaryTeamCode: normalizedTeamId,
      });
      if (receipt) {
        postActionReceipt.publish(receipt);
      }
    },
    [normalizedTeamId, postActionReceipt]
  );

  // Single sink for unified player-menu intents. Routes each PlayerAction to an
  // existing owner via routePlayerAction — navigation/pin/trade/inspect only, no
  // new mutation authority (Open still goes through actions.handleEditContract).
  const handlePlayerAction = useCallback(
    (action: PlayerAction, context: PlayerActionContext) => {
      routePlayerAction(action, context, {
        openInspect: (ctx) => {
          const player = playersMap[ctx.playerId];
          if (player) {
            actions.handleEditContract(
              player as Parameters<typeof actions.handleEditContract>[0]
            );
          }
        },
        pinPlayer: pinPlayerFromAction,
        unpinPlayer: unpinPlayerFromAction,
        openTradeWithPlayer: (ctx) =>
          openTradeWithRequest(
            buildTradeOpenRequest({
              source:
                ctx.sourceRoom === 'cap' || ctx.sourceRoom === 'capfull'
                  ? 'cap'
                  : ctx.sourceRoom === 'rail'
                    ? 'pinned'
                    : ctx.sourceRoom === 'receipt'
                      ? 'receipt'
                      : 'roster',
              playerIds: [ctx.playerId],
            })
          ),
        viewOnRoster: (ctx) => {
          setManualFocusPlayerId(ctx.playerId);
          setActiveTab('roster');
        },
        viewOnCap: (ctx) => {
          setManualFocusPlayerId(ctx.playerId);
          setActiveTab('cap');
        },
        viewInFullCap: (ctx) => {
          setManualFocusPlayerId(ctx.playerId);
          setActiveTab('capfull');
        },
        findInHistory: () => openHistoryRoot(),
        compareImpact: (ctx) => {
          setFollowThroughContext(
            buildFollowThroughContext({
              origin: ctx.eventId ? 'history-event' : 'pinned-player',
              playerIds: [ctx.playerId],
              eventId: ctx.eventId ?? undefined,
              teamCode: ctx.teamCode,
            })
          );
          setActiveTab('compare');
        },
        guideNextMove: (ctx) => {
          setFollowThroughContext(
            buildFollowThroughContext({
              origin: ctx.eventId ? 'history-event' : 'pinned-player',
              playerIds: [ctx.playerId],
              eventId: ctx.eventId ?? undefined,
              teamCode: ctx.teamCode,
            })
          );
          setActiveTab('guide');
        },
      });
    },
    [
      playersMap,
      actions,
      pinPlayerFromAction,
      unpinPlayerFromAction,
      openTradeWithRequest,
      setActiveTab,
      openHistoryRoot,
    ]
  );

  const cockpitHardCapStatus = useMemo(() => {
    if (!teamCapSheet || workspaceContext.cap.status !== 'available') {
      return null;
    }
    return getHardCapStatus(teamCapSheet, {
      capSettings: {
        firstApron: workspaceContext.cap.firstApron,
        secondApron: workspaceContext.cap.secondApron,
      },
    });
  }, [
    teamCapSheet,
    workspaceContext.cap,
  ]);

  const manualCapSheetMutationAuthority = useMemo(
    () => ({
      handleSetDeadCap: actions.handleSetDeadCap,
      handleSetExceptions: actions.handleSetExceptions,
    }),
    [actions.handleSetDeadCap, actions.handleSetExceptions]
  );

  const contractActionRouting = useMemo(
    () => ({
      currentYearCapSheet: {
        openPlayerContractModal:
          actions.handleEditContract as CapSheetSectionProps['onOpenPlayerContractModal'],
      },
      fullCapTable: {
        openPlayerContractModal:
          actions.handleEditContract as CapTableSectionProps['onOpenPlayerContractModal'],
        launchContractAction:
          actions.handleCapTableModalAction as CapTableSectionProps['onLaunchContractAction'],
        renounceCapHold:
          actions.handleCapHoldRenounce as CapTableSectionProps['onRenounceCapHold'],
        launchPlayerAction:
          actions.handleLaunchPlayerContractAction as CapTableSectionProps['onLaunchPlayerAction'],
      },
    }),
    [
      actions.handleCapHoldRenounce,
      actions.handleCapTableModalAction,
      actions.handleEditContract,
      actions.handleLaunchPlayerContractAction,
    ]
  );

  const freeAgencyActionOwner =
    actions.freeAgencyActionOwner as FreeAgencySectionProps['actionOwner'];
  const standardFreeAgentExposureClassification =
    freeAgencyActionOwner.freeAgentModalAvailability
      .standardSigningExposureClassification;
  const standardExtendExposureClassification = worldId
    ? 'V1 supported'
    : 'preview-only';
  const standardWaiveExposureClassification = worldId
    ? 'V1 supported'
    : 'preview-only';
  const standardWaiveStretchExposureClassification = worldId
    ? 'V1 supported'
    : 'preview-only';
  const standardBuyoutExposureClassification = worldId
    ? 'V1 supported'
    : 'preview-only';
  const optionDecisionExposureClassification = worldId
    ? 'V1 supported'
    : 'preview-only';
  const freeAgentPoolSeasonKey = toSeasonKey(currentYear);
  const buildFreeAgentPoolScope = useCallback(() => {
    const teamCode = String(normalizedTeamId || '').trim().toUpperCase();
    if (!worldId || !teamCode) {
      throw new Error('Open an active Team Plan world to save this pool.');
    }
    return {
      worldId,
      teamCode,
      seasonKey: freeAgentPoolSeasonKey,
    };
  }, [freeAgentPoolSeasonKey, normalizedTeamId, worldId]);
  const saveManagedFreeAgentPool = useCallback(
    async (selectionKeys: string[]) => {
      const scope = buildFreeAgentPoolScope();
      const snapshot = await saveWorldTeamFreeAgentPool({
        ...scope,
        selectionKeys,
      });
      setFreeAgentPoolSavedAt(snapshot.updatedAt);
    },
    [buildFreeAgentPoolScope]
  );
  const loadManagedFreeAgentPool = useCallback(async () => {
    const snapshot = await loadWorldTeamFreeAgentPool(
      buildFreeAgentPoolScope()
    );
    setFreeAgentPoolSavedAt(snapshot?.updatedAt || null);
    return snapshot?.selectionKeys ?? [];
  }, [buildFreeAgentPoolScope]);
  const resetManagedFreeAgentPool = useCallback(async () => {
    await resetWorldTeamFreeAgentPool(buildFreeAgentPoolScope());
    setFreeAgentPoolSavedAt(null);
  }, [buildFreeAgentPoolScope]);
  const freeAgentPoolManagement = useMemo<FreeAgentPoolManagementControls>(
    () => ({
      scopeLabel: `${workspaceContext.team.label} / ${freeAgentPoolSeasonKey}`,
      persistenceLabel: worldId ? 'Team Plan pool' : 'Session pool',
      disabledReason: worldId
        ? null
        : 'Open an active Team Plan world to save or load this pool.',
      savedAtLabel: freeAgentPoolSavedAt
        ? `Saved ${new Date(freeAgentPoolSavedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : null,
      onSave: saveManagedFreeAgentPool,
      onLoad: loadManagedFreeAgentPool,
      onReset: resetManagedFreeAgentPool,
    }),
    [
      freeAgentPoolSavedAt,
      freeAgentPoolSeasonKey,
      loadManagedFreeAgentPool,
      resetManagedFreeAgentPool,
      saveManagedFreeAgentPool,
      workspaceContext.team.label,
      worldId,
    ]
  );

  const modalPlayer = selectedPlayer as EditContractModalProps['player'];
  const modalTeamCapSheet = teamCapSheet as EditContractModalProps['teamCapSheet'];
  const modalOnWaive: NonNullable<EditContractModalProps['onWaive']> = (
    player,
    payload
  ) =>
    toModalActionResult(
      actions.handleWaiveContract(
        player as Parameters<typeof actions.handleWaiveContract>[0],
        payload as Parameters<typeof actions.handleWaiveContract>[1]
      )
    );
  const modalOnOptionDecision: NonNullable<
    EditContractModalProps['onOptionDecision']
  > = (player, accepted, overrideMetadata, targetYearOverride) =>
    toModalActionResult(
      actions.handleOptionDecision(
        player as Parameters<typeof actions.handleOptionDecision>[0],
        accepted,
        toOverrideMetadata(overrideMetadata),
        typeof targetYearOverride === 'number' ? targetYearOverride : null
      )
    );
  const modalOnRenounce: NonNullable<EditContractModalProps['onRenounce']> = (
    player,
    overrideMetadata
  ) =>
    toModalActionResult(
      actions.handleRenounceRights(
        player as Parameters<typeof actions.handleRenounceRights>[0],
        toOverrideMetadata(overrideMetadata)
      )
    );
  const modalActionCallbacks: EditContractArchitectActionCallbacks = {
    onSignFreeAgent:
      freeAgencyActionOwner.dualPathSigning
        .signFreeAgent as EditContractModalProps['onSignFreeAgent'],
    onResign:
      freeAgencyActionOwner.dualPathSigning
        .signFreeAgent as EditContractModalProps['onResign'],
    onSignAndTrade: null,
    getSignAndTradePreflight: null,
    getOfferSheetPreflight: null,
    onStoreOfferSheet: null,
    onExtend: actions.handleExtendContract as EditContractModalProps['onExtend'],
    onWaive: modalOnWaive,
    onOptionDecision: modalOnOptionDecision,
    onRenounce: modalOnRenounce,
  };
  const contractModalExposureOverrides: ContractModalActionOverrides = {
    ...(contractModalActionOverrides || {}),
    actionLabelsOverride: {
      ...V1_CONTRACT_ACTION_LABEL_OVERRIDES,
      accept: worldId ? 'Accept Option' : 'Accept Option (Preview)',
      decline: worldId ? 'Decline Option' : 'Decline Option (Preview)',
      extend:
        worldId &&
        initialAction === 'extend' &&
        selectedPlayerRulesProfile?.extensionEligibility?.isEligible === true
          ? 'Extend Contract'
          : 'Extend Contract (Preview)',
      waive: worldId ? 'Waive Player' : 'Waive Player (Preview)',
      waiveStretch:
        worldId && actionContext === 'underContract'
          ? 'Waive & Stretch'
          : 'Waive & Stretch (Preview)',
      buyout:
        worldId && actionContext === 'underContract'
          ? 'Buyout Contract'
          : 'Buyout Contract (Preview)',
      ...(contractModalActionOverrides?.actionLabelsOverride || {}),
    },
  };

  // SECTION HANDOFF SURFACES: The dashboard shell publishes upstream truth,
  // action owners, and reload authorities into wrappers. Major sections may
  // own local presentation/composition, but they must not replace upstream
  // read or committed-write authorities.
  const capSheetSectionSurface: CapSheetSectionProps = {
    teamCapSheet,
    currentYear,
    onOpenPlayerContractModal:
      contractActionRouting.currentYearCapSheet.openPlayerContractModal,
    manualCapSheetMutationAuthority,
    playersMap,
    capSheetDevFixtureControls: actions.capSheetDevTools,
    highlightPlayerId: focusedPlayerId,
    highlightPlayerIds: focusedPlayerIds,
    onPlayerAction: handlePlayerAction,
    pinnedPlayerIds,
  };
  const tradeSectionSurface: TradeSectionProps = {
    primaryTeam: normalizedTeamId,
    capProjections,
    currentYear,
    playersMap,
    onApplyTrade: actions.applyTradeToCapSheet as TradeSectionProps['onApplyTrade'],
    onAfterTradeApplied: () => {
      closeTrade();
      setActiveTab('capfull');
    },
    primaryTeamData: teamCapSheet,
    onEditContract: (player) =>
      actions.handleEditContract(
        player as Parameters<typeof actions.handleEditContract>[0]
      ),
    worldId,
    worldAsOfDate,
    userId,
    onDraftActivityChange: setTradeDraftActive,
    requestedStagePlayerIds: requestedTradeStagePlayerIds,
    onStagePlayerHandled: () => setRequestedTradeStagePlayerIds([]),
    requestedSignAndTradeSeed: signAndTradeSeed,
    onSignAndTradeSeedHandled: () => setSignAndTradeSeed(null),
    tradeContext: tradeOpenRequest
      ? {
          objective: tradeOpenRequest.objective,
          exceptionRef: tradeOpenRequest.exceptionRef,
          relatedEventId: tradeOpenRequest.relatedEventId ?? null,
          authority: tradeOpenRequest.authority,
        }
      : null,
  };
  const freeAgencySectionSurface: FreeAgencySectionProps = {
    freeAgents,
    currentYear,
    actionOwner: freeAgencyActionOwner,
    playersMap,
    outgoingOfferSheets: teamCapSheet?.offerSheets || [],
    incomingOfferSheets: teamCapSheet?.incomingOfferSheets || [],
    selectedPlayerKeys: freeAgentOptionKeys,
    onSelectedPlayerKeysChange: setFreeAgentOptionKeys,
    requestedOpenSelectionKey: requestedFreeAgentOpenKey,
    onRequestedOpenSelectionHandled: () => setRequestedFreeAgentOpenKey(null),
    onSelectedEntriesChange: setFreeAgentOptionEntries,
    onAfterSigningComplete: () => setActiveTab('capfull'),
    onPlayerAction: handlePlayerAction,
    pinnedPlayerIds,
    poolManagement: freeAgentPoolManagement,
  };
  const fullCapFreeAgentPoolEntries = useMemo(
    () =>
      (freeAgents || []).map((freeAgent) =>
        buildFreeAgentSurfaceEntry(
          freeAgent as FreeAgentListItem,
          playersMap as Record<string, FreeAgentLookupPlayer>
        )
      ),
    [freeAgents, playersMap]
  );
  const fullCapFreeAgentModalEntries = useMemo(() => {
    const entriesBySelectionKey = new Map<string, FreeAgentSurfaceEntry>();
    fullCapFreeAgentPoolEntries.forEach((entry) => {
      entriesBySelectionKey.set(entry.selectionKey, entry);
    });
    freeAgentOptionEntries.forEach((entry) => {
      entriesBySelectionKey.set(entry.selectionKey, entry);
    });
    return Array.from(entriesBySelectionKey.values());
  }, [freeAgentOptionEntries, fullCapFreeAgentPoolEntries]);
  const launchFullCapFreeAgentAction = useCallback(
    (entry: FreeAgentSurfaceEntry) => {
      setContractModalActionOverrides({
        actionsOverride:
          freeAgencyActionOwner.freeAgentModalAvailability.visibleActions,
        actionLabelsOverride:
          freeAgencyActionOwner.freeAgentModalAvailability.actionLabelsOverride,
        showOfferSheetToggle: false,
      });
      closeFullCapFreeAgentModal();
      actions.handleEditContract(
        entry.surfacePlayer as Parameters<typeof actions.handleEditContract>[0]
      );
    },
    [
      actions.handleEditContract,
      closeFullCapFreeAgentModal,
      freeAgencyActionOwner.freeAgentModalAvailability.actionLabelsOverride,
      freeAgencyActionOwner.freeAgentModalAvailability.visibleActions,
    ]
  );
  const offseasonSectionSurface: OffseasonSectionProps = {
    teamCapSheet,
    setTeamCapSheet,
    currentYear,
    setCurrentYear,
    capProjections,
    setOffseasonRun,
    setOffseasonSummary,
    setShowOffseasonModal,
    playersMap,
    worldId,
    activeWorldIdentityToken: activeWorldOwner.identityToken,
    teamCode: normalizedTeamId,
    worldSeason: worldCurrentSeason,
    worldSeasonLoading: worldMetadataLoading,
    onReloadWorldData: worldModeBoundary.onReloadWorldData,
    onAfterOffseasonAdvanceApplied: handleOffseasonAdvanceApplied,
  };

  const navItems: NavRailItem[] = useMemo(
    () => [
      {
        id: 'capfull',
        label: 'Full Cap Table',
        glyph: '≡',
        onActivate: () => setActiveTab('capfull'),
        testId: 'tab-full-cap-table',
        title: 'Home base — your primary workspace',
        isHome: true,
      },
      {
        id: 'roster',
        label: 'Roster',
        glyph: 'R',
        onActivate: () => setActiveTab('roster'),
        testId: 'tab-roster',
      },
      {
        id: 'cap',
        label: 'Cap Sheet',
        glyph: '$',
        onActivate: () => setActiveTab('cap'),
        testId: 'tab-cap-sheet',
        title: 'Single-season cap detail',
      },
      {
        id: 'trade',
        label: 'Trade Machine',
        glyph: '⇄',
        onActivate: openTrade,
        forceActive: isTradeOpen,
        indicator: tradeDraftActive,
        title: 'Open Trade Machine - launcher only',
      },
      {
        id: 'fa',
        label: 'Free Agency',
        glyph: 'FA',
        onActivate: () => setActiveTab('fa'),
      },
      {
        id: 'offseason',
        label: 'Offseason',
        glyph: '↻',
        onActivate: () => setActiveTab('offseason'),
      },
      {
        id: 'history',
        label: 'Team History',
        glyph: 'H',
        onActivate: openHistoryRoot,
      },
      {
        id: 'compare',
        label: 'Compare',
        glyph: '⇌',
        onActivate: () => setActiveTab('compare'),
        testId: 'tab-compare',
        title: 'Committed scenario comparison',
      },
      {
        id: 'guide',
        label: 'Guide',
        glyph: '?',
        onActivate: () => setActiveTab('guide'),
        testId: 'tab-guide',
        title: 'Front Office Guide',
      },
    ],
    [setActiveTab, openHistoryRoot, openTrade, isTradeOpen, tradeDraftActive]
  );

  if (authLoading || isLoading) {
    return (
      <CockpitStatePanel
        variant="loading"
        title="Loading GM Dashboard"
        message="Loading franchise cap sheet and world context…"
        testId="gm-dashboard-loading"
      />
    );
  }

  if (!teamCapSheet) {
    return (
      <CockpitStatePanel
        variant="empty"
        title="No team data"
        message="Could not load this team's cap sheet. Return to the league view and pick another team."
        action={
          <Link
            to="/gm"
            className="rounded border border-cockpit-edge bg-cockpit-inlay px-3 py-1.5 text-xs text-cockpit-text-primary hover:bg-cockpit-raised"
          >
            Back to League
          </Link>
        }
        testId="gm-dashboard-empty"
      />
    );
  }

  const worldSelectorSlot = userId ? (
    <WorldSelector
      userId={userId}
      activeWorldOwner={activeWorldOwner}
      worldModeBoundary={worldModeBoundary}
      saveState={workspaceContext.saveState}
    />
  ) : null;

  const worldTimeControlsSlot = userId ? (
    <WorldTimeControls
      worldTimeOwner={worldTimeOwner}
      disabled={worldModeBoundary.kind !== 'world'}
    />
  ) : null;

  const seasonSelectorSlot = (
    <label className="hidden items-center gap-1.5 text-[11px] font-medium text-cockpit-text-secondary md:flex">
      <span className="uppercase tracking-wide text-cockpit-text-muted">Season</span>
      <select
        value={currentYear}
        onChange={(event) =>
          handleViewingSeasonChange(parseInt(event.target.value, 10))
        }
        aria-label="Viewing season"
        className="rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1 text-[11px] text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        {seasonEndYearsFromCaps(capProjections).map((year) => (
          <option key={year} value={year}>
            {toSeasonKey(year)}
          </option>
        ))}
      </select>
    </label>
  );

  const banner = (
    <div className="flex flex-col gap-1 px-4 py-2 empty:hidden">
      {showEmulatorUnavailableBanner ? (
        <div
          className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-amber-100 text-xs"
          data-testid="firebase-emulator-warning-banner"
        >
          Emulator mode: Firebase emulators not detected. Start them with: npm run emu
        </div>
      ) : null}
      {error ? (
        <p className="rounded border border-cockpit-danger/30 bg-cockpit-danger/10 px-3 py-1.5 text-xs text-cockpit-danger">
          {error}
        </p>
      ) : null}
      {isSaving ? (
        <p className="text-xs text-cockpit-text-secondary">Saving...</p>
      ) : null}
    </div>
  );

  const rooms: Record<ActiveTab, RoomDescriptor> = {
    roster: {
      id: 'roster',
      title: 'Roster',
      subtitle: workspaceContext.team.label,
      hideHeader: true,
      bleed: true,
      content: (
        <RosterSection
          teamCapSheet={teamCapSheet}
          playersMap={playersMap}
          teamId={normalizedTeamId}
          currentYear={currentYear}
          onOpenPlayerContractModal={(player) =>
            actions.handleEditContract(
              player as Parameters<typeof actions.handleEditContract>[0]
            )
          }
          highlightPlayerId={focusedPlayerId}
          highlightPlayerIds={focusedPlayerIds}
          onPlayerAction={handlePlayerAction}
          pinnedPlayerIds={pinnedPlayerIds}
        />
      ),
    },
    cap: {
      id: 'cap',
      title: 'Cap Sheet',
      subtitle: workspaceContext.seasons.selectedViewingSeasonLabel ?? undefined,
      hideHeader: true,
      bleed: true,
      content: <CapSheetSection {...capSheetSectionSurface} />,
    },
    capfull: {
      id: 'capfull',
      title: 'Full Cap Table',
      bleed: true,
      hideHeader: true,
      content: (
        <CapTableSection
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onOpenPlayerContractModal={
            contractActionRouting.fullCapTable.openPlayerContractModal
          }
          onLaunchContractAction={
            contractActionRouting.fullCapTable.launchContractAction
          }
          onRenounceCapHold={contractActionRouting.fullCapTable.renounceCapHold}
          onSignAndTradeFreeAgent={
            worldId
              ? (player) =>
                  openTradeForSignAndTrade(player as Record<string, unknown>)
              : null
          }
          onLaunchPlayerAction={
            contractActionRouting.fullCapTable.launchPlayerAction
          }
          onPlayerAction={handlePlayerAction}
          playersMap={playersMap}
          getRulesProfileForYear={getProfileForYear}
          highlightPlayerId={focusedPlayerId}
          highlightPlayerIds={focusedPlayerIds}
          pinnedPlayerIds={pinnedPlayerIds}
          onTogglePin={togglePin}
          manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
          onLaunchFreeAgentSearch={openFullCapFreeAgentModal}
          standardFreeAgentLauncherExposureClassification={
            standardFreeAgentExposureClassification
          }
          standardExtendExposureClassification={
            standardExtendExposureClassification
          }
          standardWaiveExposureClassification={
            standardWaiveExposureClassification
          }
          standardWaiveStretchExposureClassification={
            standardWaiveStretchExposureClassification
          }
          standardBuyoutExposureClassification={
            standardBuyoutExposureClassification
          }
          optionDecisionExposureClassification={
            optionDecisionExposureClassification
          }
          freeAgentOptions={freeAgentOptionEntries}
          onOpenFreeAgentOption={(selectionKey) => {
            openFullCapFreeAgentModal(selectionKey);
          }}
          onRemoveFreeAgentOption={(selectionKey) => {
            setFreeAgentOptionKeys((selectionKeys) =>
              selectionKeys.filter((key) => key !== selectionKey)
            );
          }}
          exceptionsReadout={
            <ExceptionTracker
              teamCapSheet={
                teamCapSheet as Parameters<
                  typeof ExceptionTracker
                >[0]['teamCapSheet']
              }
              currentYear={currentYear}
              selectedYear={currentYear}
            />
          }
        />
      ),
    },
    // The Trade Machine no longer renders as a workbench room — it opens as a
    // full-viewport overlay (see modalsSlot). This descriptor only satisfies the
    // `Record<ActiveTab, RoomDescriptor>` contract; `activeTab` is never set to
    // 'trade', so this content is never mounted.
    trade: {
      id: 'trade',
      title: 'Trade Machine',
      content: null,
    },
    fa: {
      id: 'fa',
      title: 'Free Agency',
      content: <FreeAgencySection {...freeAgencySectionSurface} />,
    },
    offseason: {
      id: 'offseason',
      title: 'Offseason',
      content: (
        <OffseasonSection
          {...offseasonSectionSurface}
          worldPickerSlot={worldSelectorSlot}
        />
      ),
    },
    history: {
      id: 'history',
      title: 'Team History',
      hideHeader: true,
      bleed: true,
      content: (
        <HistorySection
          teamCapSheet={teamCapSheet}
          worldId={worldId}
          onInjectTeamHistoryFixtures={
            actions.teamHistoryDevTools.injectFixtures
          }
          onClearTeamHistoryFixtures={actions.teamHistoryDevTools.clearFixtures}
          hasInjectedTeamHistoryFixtures={
            actions.teamHistoryDevTools.hasInjectedFixtures
          }
          requestedHistoryEventDetail={requestedHistoryEventDetail}
          onRequestedHistoryEventDetailHandled={handleHistoryEventDetailHandled}
          onNavigateRoom={(room) => setActiveTab(room)}
          onOpenTradeWithRequest={openTradeWithRequest}
          onPlayerAction={handlePlayerAction}
          resolvePlayerLabel={(playerId) =>
            resolveFocusedPlayerLabel(playerId) ?? playerId
          }
        />
      ),
    },
    compare: {
      id: 'compare',
      title: 'Compare',
      subtitle: 'Committed scenario comparison',
      content: (
        <ComparisonSection
          status={comparisonViewModel.status}
          viewModel={comparisonViewModel.viewModel}
          error={comparisonViewModel.error}
          onNavigateToHistory={openHistoryRoot}
          onNavigateToCapSheet={() => setActiveTab('cap')}
          onNavigateToRoster={() => setActiveTab('roster')}
          followThroughContext={followThroughContext}
          worldPickerSlot={worldSelectorSlot}
        />
      ),
    },
    guide: {
      id: 'guide',
      title: 'Guide',
      subtitle: 'Front Office Guide',
      content: (
        <GuideSection
          viewModel={guidedAnswersViewModel}
          onNavigate={handleGuideNavigate}
          followThroughContext={followThroughContext}
          onOpenTradeWithRequest={openTradeWithRequest}
        />
      ),
    },
  };

  const modalsSlot = (
    <>
      {isCockpitCapAuditEnabled() ? (
        <CapAuditDebugPanel worldId={worldId} />
      ) : null}

      {/* Trade Machine — full-viewport overlay. Lazily mounted on first open,
          then kept mounted (visibility toggled) so the in-progress draft and
          scroll/sub-panel state survive close/reopen exactly as left. */}
      {hasOpenedTrade ? (
        <TradeOverlay open={isTradeOpen} onClose={closeTrade}>
          <TradeSection {...tradeSectionSurface} />
        </TradeOverlay>
      ) : null}

      <FullCapFreeAgentModal
        isOpen={isFullCapFreeAgentModalOpen}
        onClose={closeFullCapFreeAgentModal}
        teamLabel={workspaceContext.team.label}
        seasonLabel={
          workspaceContext.seasons.selectedViewingSeasonLabel ??
          toSeasonKey(currentYear)
        }
        entries={fullCapFreeAgentModalEntries}
        initialSelectionKey={fullCapFreeAgentModalSelectionKey}
        isLoading={isLoading || worldMetadataLoading}
        onLaunchAction={launchFullCapFreeAgentAction}
        standardSigningExposureClassification={
          standardFreeAgentExposureClassification
        }
      />

      {showOffseasonModal && offseasonSummary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-cockpit-edge bg-cockpit-slab p-5 text-sm text-cockpit-text-primary shadow-xl">
            <h3>Offseason Summary</h3>
            {offseasonSummary.declinedOptions?.length ? (
              <>
                <h4>Declined Options</h4>
                <ul>
                  {offseasonSummary.declinedOptions.map((player, index) => (
                    <li key={index}>{player}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {offseasonSummary.expiredContracts?.length ? (
              <>
                <h4>Expired Contracts</h4>
                <ul>
                  {offseasonSummary.expiredContracts.map((player, index) => (
                    <li key={index}>{player}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {offseasonSummary.expiredTPEs?.length ? (
              <>
                <h4>Expired Trade Exceptions</h4>
                <ul>
                  {offseasonSummary.expiredTPEs.map((tpe, index) => (
                    <li key={index}>
                      ${Number(tpe.amount || 0).toLocaleString()} from{' '}
                      {tpe.source}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {offseasonSummary.waivedDeadCap?.length ? (
              <>
                <h4>Ongoing Dead Cap</h4>
                <ul>
                  {offseasonSummary.waivedDeadCap.map(
                    (waivedContract, index) => (
                      <li key={index}>
                        {waivedContract.name} → $
                        {Number(waivedContract.amount || 0).toLocaleString()} in{' '}
                        {waivedContract.year}
                      </li>
                    )
                  )}
                </ul>
              </>
            ) : null}
            {offseasonSummary.resetMLE && (
              <p>
                <strong>MLE reset for new season.</strong>
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                closeOffseasonModal();
                setActiveTab('cap');
              }}
              className="mt-4 rounded border border-cockpit-edge bg-cockpit-inlay px-3 py-1.5 text-xs font-medium text-cockpit-text-primary hover:bg-cockpit-raised"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showContractModal && (
        <EditContractModal
          isOpen={showContractModal}
          onClose={closeDashboardContractModal}
          player={modalPlayer}
          initialAction={initialAction}
          targetYear={targetYear}
          actionYear={targetYear ?? currentYear}
          actionContext={actionContext}
          capProjections={capProjections}
          teamCapSheet={modalTeamCapSheet}
          currentYear={currentYear}
          {...modalActionCallbacks}
          {...contractModalExposureOverrides}
          playersMap={playersMap}
          playerRulesProfile={selectedPlayerRulesProfile}
          rulesLeagueContext={selectedRulesLeagueContext}
        />
      )}
    </>
  );

  return (
    <CockpitShell
      workspace={workspaceContext}
      isEmulator={isEmulatorMode}
      activeTab={activeTab}
      navItems={navItems}
      rooms={rooms}
      receipt={postActionReceipt.receipt}
      receiptGeneration={postActionReceipt.generation}
      worldId={worldId}
      historyTeamCode={resolvedHistoryTeamCode}
      paletteIdentifier={
        teamCapSheet?.teamCode || teamCapSheet?.teamName || normalizedTeamId
      }
      hardCapStatus={cockpitHardCapStatus}
      worldSelectorSlot={worldSelectorSlot}
      worldTimeControlsSlot={worldTimeControlsSlot}
      seasonSelectorSlot={seasonSelectorSlot}
      onNavigateToCapSheet={() => setActiveTab('cap')}
      onNavigateToRoster={() => setActiveTab('roster')}
      onNavigateToOffseason={() => setActiveTab('offseason')}
      onOpenHistory={openHistoryRoot}
      onOpenHistoryEntry={(eventId) =>
        requestHistoryEventDetail(eventId, 'activity-rail')
      }
      onNavigateReceiptHistory={() =>
        requestHistoryEventDetail(
          postActionReceipt.receipt?.eventId ?? null,
          'post-action-handoff'
        )
      }
      onDismissReceipt={postActionReceipt.dismiss}
      tradeDraftActive={tradeDraftActive}
      onResumeTradeDraft={openTrade}
      onNavigateToCompare={() => {
        setFollowThroughContext(
          buildFollowThroughContext({
            origin: 'receipt',
            receiptKind: postActionReceipt.receipt?.kind,
            eventId: postActionReceipt.receipt?.eventId ?? undefined,
            playerIds: postActionReceipt.receipt?.primaryPlayerIds,
            teamCode: resolvedHistoryTeamCode,
          })
        );
        setActiveTab('compare');
      }}
      onNavigateToGuide={() => {
        setFollowThroughContext(
          buildFollowThroughContext({
            origin: 'receipt',
            receiptKind: postActionReceipt.receipt?.kind,
            eventId: postActionReceipt.receipt?.eventId ?? undefined,
            playerIds: postActionReceipt.receipt?.primaryPlayerIds,
            teamCode: resolvedHistoryTeamCode,
          })
        );
        setActiveTab('guide');
      }}
      onOpenGuideForObjective={(objective) => {
        setFollowThroughContext(
          buildFollowThroughContext({
            origin: 'warning',
            warningType: objective,
            teamCode: resolvedHistoryTeamCode,
          })
        );
        setActiveTab('guide');
      }}
      onOpenTradeForObjective={(objective) =>
        openTradeWithRequest(
          buildTradeOpenRequest({ source: 'warning', objective })
        )
      }
      onOpenTradeFromReceipt={() =>
        openTradeWithRequest(buildTradeOpenRequest({ source: 'receipt' }))
      }
      pinnedPlayers={pinnedPlayers}
      onUnpinPlayer={removePin}
      onOpenPinnedPlayer={(playerId) => {
        const player = playersMap[playerId];
        if (player) {
          actions.handleEditContract(
            player as Parameters<typeof actions.handleEditContract>[0]
          );
        }
      }}
      onTradePinnedPlayer={(playerId) =>
        openTradeWithRequest(
          buildTradeOpenRequest({ source: 'pinned', playerIds: [playerId] })
        )
      }
      onTradeAllPinned={() => {
        // Confirm when more than two players are pinned (open-question #6).
        if (
          pinnedPlayerIds.length > 2 &&
          typeof window !== 'undefined' &&
          !window.confirm(
            `Open a trade with all ${pinnedPlayerIds.length} pinned players?`
          )
        ) {
          return;
        }
        openTradeWithRequest(
          buildTradeOpenRequest({
            source: 'pinned-all',
            playerIds: pinnedPlayerIds,
          })
        );
      }}
      onPlayerAction={handlePlayerAction}
      resolvePlayerLabel={(playerId) =>
        resolveFocusedPlayerLabel(playerId) ?? playerId
      }
      banner={banner}
      modals={modalsSlot}
    />
  );
};
