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
import {
  CockpitShell,
  CockpitStatePanel,
  SelectionDock,
} from '@/features/architect/cockpit';
import type { NavRailItem, RoomDescriptor } from '@/features/architect/cockpit';
import { useArchitectDeskNavigation, writeLastTeamSlug } from './hooks/useArchitectDeskNavigation';
import { resolvePrimaryPlayerFocusId } from './postActionHandoff/playerFocus';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';
import { useArchitectPostActionReceipt } from './hooks/useArchitectPostActionReceipt';
import { useHistoryEventDetailRequest } from './hooks/useHistoryEventDetailRequest';
import { deriveSeasonAdvanceReceipt } from './postActionHandoff/types';
import { useArchitectState } from './hooks/useArchitectState';
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

  const [deskPlayerId, setDeskPlayerId] = useState<string | null>(null);
  const [tradeDraftActive, setTradeDraftActive] = useState(false);

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
    offseasonRun,
    offseasonSummary,
    playersMap,
    capTableYears,
    worldId,
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

  useArchitectDeskNavigation({
    activeTab,
    setActiveTab,
    deskPlayerId,
    setDeskPlayerId,
  });

  const workspaceContext = useArchitectWorkspaceContext({
    teamCapSheet,
    teamId: normalizedTeamId,
    currentYear,
    worldId,
    activeWorldLabel: null,
    worldAsOfDate,
    worldCurrentSeason,
    worldMetadataLoading,
    isLoading,
    isSaving,
    error,
    worldModeBoundary,
  });
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
  // Stage 2C: derive a session-scoped focused player id from the most recent
  // committed post-action receipt. Visual-only — receipt dismiss/clear
  // automatically clears the highlight. Multi-player receipts (trades) use
  // the first primary id; matching is name-fallback tolerant in
  // playerMatchesFocus.
  const focusedPlayerId =
    deskPlayerId ?? postActionReceipt.receipt?.primaryPlayerIds?.[0] ?? null;

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

  const selectionDockLabel = useMemo(
    () => resolveFocusedPlayerLabel(focusedPlayerId),
    [focusedPlayerId, resolveFocusedPlayerLabel]
  );

  const pinDeskPlayer = useCallback((player: Record<string, unknown>) => {
    const id = resolvePrimaryPlayerFocusId(
      player as Parameters<typeof resolvePrimaryPlayerFocusId>[0]
    );
    if (id) setDeskPlayerId(id);
  }, []);

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
          setActiveTab('trade');
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
    [setActiveTab, openHistoryRoot]
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
  const freeAgencyWorldOnlyOwner = freeAgencyActionOwner.worldOnly;
  const modalActionCallbacks: EditContractArchitectActionCallbacks = {
    onSignFreeAgent:
      freeAgencyActionOwner.dualPathSigning
        .signFreeAgent as EditContractModalProps['onSignFreeAgent'],
    onResign:
      freeAgencyActionOwner.dualPathSigning
        .signFreeAgent as EditContractModalProps['onResign'],
    onSignAndTrade: freeAgencyWorldOnlyOwner
      ? (freeAgencyWorldOnlyOwner.signAndTrade as EditContractModalProps['onSignAndTrade'])
      : null,
    getSignAndTradePreflight: freeAgencyWorldOnlyOwner
      ? (freeAgencyWorldOnlyOwner.getSignAndTradePreflight as EditContractModalProps['getSignAndTradePreflight'])
      : null,
    getOfferSheetPreflight: freeAgencyWorldOnlyOwner
      ? (freeAgencyWorldOnlyOwner.getOfferSheetPreflight as EditContractModalProps['getOfferSheetPreflight'])
      : null,
    onStoreOfferSheet: freeAgencyWorldOnlyOwner
      ? (freeAgencyWorldOnlyOwner.storeOfferSheet as EditContractModalProps['onStoreOfferSheet'])
      : null,
    onExtend: actions.handleExtendContract as EditContractModalProps['onExtend'],
    onWaive: modalOnWaive,
    onOptionDecision: modalOnOptionDecision,
    onRenounce: modalOnRenounce,
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
  };
  const tradeSectionSurface: TradeSectionProps = {
    primaryTeam: normalizedTeamId,
    capProjections,
    currentYear,
    playersMap,
    onApplyTrade: actions.applyTradeToCapSheet as TradeSectionProps['onApplyTrade'],
    onAfterTradeApplied: () => setActiveTab('cap'),
    primaryTeamData: teamCapSheet,
    onEditContract: (player) =>
      actions.handleEditContract(
        player as Parameters<typeof actions.handleEditContract>[0]
      ),
    worldId,
    worldAsOfDate,
    userId,
    onDraftActivityChange: setTradeDraftActive,
  };
  const freeAgencySectionSurface: FreeAgencySectionProps = {
    freeAgents,
    currentYear,
    actionOwner: freeAgencyActionOwner,
    playersMap,
    outgoingOfferSheets: teamCapSheet?.offerSheets || [],
    incomingOfferSheets: teamCapSheet?.incomingOfferSheets || [],
    onAfterSigningComplete: () => setActiveTab('cap'),
  };
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
        onActivate: () => setActiveTab('trade'),
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
    [setActiveTab, openHistoryRoot]
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
        onChange={(event) => setCurrentYear(parseInt(event.target.value, 10))}
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
      content: (
        <RosterSection
          teamCapSheet={teamCapSheet}
          playersMap={playersMap}
          teamId={normalizedTeamId}
          onOpenPlayerContractModal={(player) => {
            pinDeskPlayer(player as Record<string, unknown>);
            actions.handleEditContract(
              player as Parameters<typeof actions.handleEditContract>[0]
            );
          }}
          highlightPlayerId={focusedPlayerId}
        />
      ),
    },
    cap: {
      id: 'cap',
      title: 'Cap Sheet',
      subtitle: workspaceContext.seasons.selectedViewingSeasonLabel ?? undefined,
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
          onLaunchPlayerAction={
            contractActionRouting.fullCapTable.launchPlayerAction
          }
          playersMap={playersMap}
          getRulesProfileForYear={getProfileForYear}
          highlightPlayerId={focusedPlayerId}
          manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
          onLaunchFreeAgentSearch={() => setActiveTab('fa')}
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
    trade: {
      id: 'trade',
      title: 'Trade Machine',
      content: <TradeSection {...tradeSectionSurface} />,
    },
    fa: {
      id: 'fa',
      title: 'Free Agency',
      content: <FreeAgencySection {...freeAgencySectionSurface} />,
    },
    offseason: {
      id: 'offseason',
      title: 'Offseason',
      content: <OffseasonSection {...offseasonSectionSurface} />,
    },
    history: {
      id: 'history',
      title: 'Team History',
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
        />
      ),
    },
  };

  const modalsSlot = (
    <>
      {isCockpitCapAuditEnabled() ? (
        <CapAuditDebugPanel worldId={worldId} />
      ) : null}

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
          onClose={closeContractModal}
          player={modalPlayer}
          initialAction={initialAction}
          targetYear={targetYear}
          actionYear={targetYear ?? currentYear}
          actionContext={actionContext}
          capProjections={capProjections}
          teamCapSheet={modalTeamCapSheet}
          currentYear={currentYear}
          {...modalActionCallbacks}
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
      onNavigateToCompare={() => setActiveTab('compare')}
      onNavigateToGuide={() => setActiveTab('guide')}
      selectionDock={
        selectionDockLabel ? (
          <SelectionDock
            playerLabel={selectionDockLabel}
            onViewCap={() => setActiveTab('cap')}
            onViewRoster={() => setActiveTab('roster')}
            onOpenTrade={() => setActiveTab('trade')}
            onClear={() => setDeskPlayerId(null)}
          />
        ) : null
      }
      banner={banner}
      modals={modalsSlot}
    />
  );
};
