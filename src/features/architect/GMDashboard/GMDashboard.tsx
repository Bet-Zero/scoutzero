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
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EditContractModal } from '@/shared/components/EditContractModal';
import { RosterSection } from './sections/RosterSection';
import { CapSheetSection } from './sections/CapSheetSection';
import { CapTableSection } from './sections/CapTableSection';
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
import { ArchitectModeShell } from '@/features/architect/GMDashboard/components/ArchitectModeShell';
import { ArchitectContextTray } from '@/features/architect/GMDashboard/components/ArchitectContextTray';
import { ArchitectDecisionTrail } from '@/features/architect/GMDashboard/components/ArchitectDecisionTrail';
import { ArchitectHQ } from '@/features/architect/GMDashboard/components/ArchitectHQ';
import { ArchitectRoomFrame } from '@/features/architect/GMDashboard/components/ArchitectRoomFrame';
import {
  ARCHITECT_ROOMS,
  ROOM_BY_ID,
  ROOM_BY_LEGACY_TAB,
  type ArchitectRoomId,
} from '@/features/architect/GMDashboard/components/architectRooms';
import { deriveArchitectWarnings } from '@/features/architect/GMDashboard/components/deriveArchitectWarnings';
import { useArchitectPostActionReceipt } from './hooks/useArchitectPostActionReceipt';
import { useHistoryEventDetailRequest } from './hooks/useHistoryEventDetailRequest';
import { deriveSeasonAdvanceReceipt } from './postActionHandoff/types';
import { useArchitectState, type ActiveTab } from './hooks/useArchitectState';
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

const firstUsableString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const playerIdFromUnknown = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const bio = record.bio as Record<string, unknown> | null | undefined;
  return firstUsableString(
    record.id,
    record.playerId,
    record.player_id,
    bio?.playerId,
    bio?.id
  );
};

const playerNameFromUnknown = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const bio = record.bio as Record<string, unknown> | null | undefined;
  return firstUsableString(
    record.displayName,
    record.fullName,
    record.name,
    bio?.displayName,
    bio?.fullName,
    bio?.name
  );
};

const resolveFocusedPlayerLabel = ({
  playerId,
  selectedPlayer,
  playersMap,
  teamPlayers,
}: {
  playerId: string | null;
  selectedPlayer: unknown;
  playersMap: Record<string, unknown>;
  teamPlayers: unknown[] | null | undefined;
}): string | null => {
  const selectedPlayerId = playerIdFromUnknown(selectedPlayer);
  const focusId = playerId ?? selectedPlayerId;
  if (!focusId) return null;

  const candidates = [
    playersMap[focusId],
    selectedPlayerId === focusId ? selectedPlayer : null,
    ...(Array.isArray(teamPlayers) ? teamPlayers : []),
    ...Object.values(playersMap),
  ];
  const match = candidates.find((candidate) => playerIdFromUnknown(candidate) === focusId);
  const name = playerNameFromUnknown(match);
  return name ? `${name} (${focusId})` : focusId;
};

export const GMDashboard = () => {
  // League View enters here with team identity only; this dashboard owns selected season state.
  const { teamId } = useParams();
  const { userId, loading: authLoading } = useAuth();
  const normalizedTeamId = teamId ?? '';

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
  const [activeRoom, setActiveRoom] = useState<ArchitectRoomId>('hq');
  const openRoom = useCallback(
    (roomId: ArchitectRoomId) => {
      setActiveRoom(roomId);
      const legacyTab = ROOM_BY_ID[roomId].legacyTab;
      if (legacyTab) {
        setActiveTab(legacyTab);
      }
    },
    [setActiveTab]
  );
  const openLegacyTab = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);
      const roomId = ROOM_BY_LEGACY_TAB[tab];
      if (roomId) {
        setActiveRoom(roomId);
      }
    },
    [setActiveTab]
  );

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
    onOpenHistory: () => openLegacyTab('history'),
  });
  // Stage 2C: derive a session-scoped focused player id from the most recent
  // committed post-action receipt. Visual-only — receipt dismiss/clear
  // automatically clears the highlight. Multi-player receipts (trades) use
  // the first primary id; matching is name-fallback tolerant in
  // playerMatchesFocus.
  const focusedPlayerId =
    postActionReceipt.receipt?.primaryPlayerIds?.[0] ?? null;

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
          openLegacyTab('roster');
          return;
        case 'cap':
          openLegacyTab('cap');
          return;
        case 'capfull':
          openLegacyTab('capfull');
          return;
        case 'trade':
          openLegacyTab('trade');
          return;
        case 'fa':
          openLegacyTab('fa');
          return;
        case 'offseason':
          openLegacyTab('offseason');
          return;
        case 'history':
          openHistoryRoot();
          return;
        case 'compare':
          openLegacyTab('compare');
          return;
        case 'guide':
          openLegacyTab('guide');
          return;
      }
    },
    [openLegacyTab, openHistoryRoot]
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
      },
    }),
    [
      actions.handleCapHoldRenounce,
      actions.handleCapTableModalAction,
      actions.handleEditContract,
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
    onAfterTradeApplied: () => openLegacyTab('cap'),
    primaryTeamData: teamCapSheet,
    onEditContract: (player) =>
      actions.handleEditContract(
        player as Parameters<typeof actions.handleEditContract>[0]
      ),
    worldId,
    worldAsOfDate,
    userId,
  };
  const freeAgencySectionSurface: FreeAgencySectionProps = {
    freeAgents,
    currentYear,
    actionOwner: freeAgencyActionOwner,
    playersMap,
    outgoingOfferSheets: teamCapSheet?.offerSheets || [],
    incomingOfferSheets: teamCapSheet?.incomingOfferSheets || [],
    onAfterSigningComplete: () => openLegacyTab('cap'),
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

  const architectWarnings = useMemo(
    () => deriveArchitectWarnings(workspaceContext),
    [workspaceContext]
  );
  const focusedPlayerLabel = useMemo(
    () =>
      resolveFocusedPlayerLabel({
        playerId: focusedPlayerId,
        selectedPlayer,
        playersMap,
        teamPlayers: teamCapSheet?.players,
      }),
    [focusedPlayerId, playersMap, selectedPlayer, teamCapSheet?.players]
  );

  if (authLoading || isLoading) return <p>Loading GM Dashboard...</p>;
  if (!teamCapSheet) return <p>No team data</p>;

  const activeRoomDescriptor = ROOM_BY_ID[activeRoom];
  const controls = (
    <>
      <span
        className={`border px-2.5 py-1 text-xs font-semibold ${
          isEmulatorMode
            ? 'border-amber-300/30 bg-amber-400/15 text-amber-200'
            : 'border-rose-300/30 bg-rose-500/15 text-rose-200'
        }`}
        data-testid="firebase-target-mode-badge"
      >
        {isEmulatorMode ? 'EMULATOR MODE' : 'PROD MODE'}
      </span>

      {userId && (
        <WorldSelector
          userId={userId}
          activeWorldOwner={activeWorldOwner}
          worldModeBoundary={worldModeBoundary}
        />
      )}

      {userId && (
        <WorldTimeControls
          worldTimeOwner={worldTimeOwner}
          disabled={worldModeBoundary.kind !== 'world'}
        />
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-white/80">
        <span>Season</span>
        <select
          value={currentYear}
          onChange={(event) => setCurrentYear(parseInt(event.target.value, 10))}
          aria-label="Viewing season"
          className="border border-white/10 bg-[#10151d] px-2 py-1 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {seasonEndYearsFromCaps(capProjections).map((year) => (
            <option key={year} value={year}>
              {toSeasonKey(year)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  const statusBanner =
    showEmulatorUnavailableBanner || error || isSaving ? (
      <div className="mt-3 space-y-2">
        {showEmulatorUnavailableBanner && (
          <div
            className="border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-sm text-amber-100"
            data-testid="firebase-emulator-warning-banner"
          >
            Emulator mode: Firebase emulators not detected. Start them with: npm
            run emu
          </div>
        )}
        {error && (
          <div className="border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}
        {isSaving && (
          <div className="border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60">
            Saving...
          </div>
        )}
      </div>
    ) : null;
  const decisionTrail = (
    <ArchitectDecisionTrail
      worldId={worldId}
      teamCode={resolvedHistoryTeamCode}
      receipt={postActionReceipt.receipt}
      refreshKey={postActionReceipt.generation}
      onOpenCapOffice={() => openRoom('cap')}
      onOpenRosterRoom={() => openRoom('roster')}
      onOpenLeagueLog={openHistoryRoot}
      onOpenHistoryEntry={(eventId) =>
        requestHistoryEventDetail(eventId, 'activity-rail')
      }
      onDismissReceipt={postActionReceipt.dismiss}
    />
  );
  const roomContent = (() => {
    switch (activeRoom) {
      case 'hq':
        return (
          <ArchitectHQ
            context={workspaceContext}
            rooms={ARCHITECT_ROOMS}
            warnings={architectWarnings}
            comparison={comparisonViewModel}
            decisionTrail={decisionTrail}
            onOpenRoom={openRoom}
          />
        );
      case 'roster':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <RosterSection
              teamCapSheet={teamCapSheet}
              playersMap={playersMap}
              teamId={normalizedTeamId}
              onOpenPlayerContractModal={(player) =>
                actions.handleEditContract(
                  player as Parameters<typeof actions.handleEditContract>[0]
                )
              }
              highlightPlayerId={focusedPlayerId}
            />
          </ArchitectRoomFrame>
        );
      case 'cap':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <CapSheetSection {...capSheetSectionSurface} />
          </ArchitectRoomFrame>
        );
      case 'contracts':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <CapTableSection
              teamCapSheet={teamCapSheet}
              currentYear={currentYear}
              onOpenPlayerContractModal={
                contractActionRouting.fullCapTable.openPlayerContractModal
              }
              onLaunchContractAction={
                contractActionRouting.fullCapTable.launchContractAction
              }
              onRenounceCapHold={
                contractActionRouting.fullCapTable.renounceCapHold
              }
              playersMap={playersMap}
              getRulesProfileForYear={getProfileForYear}
              highlightPlayerId={focusedPlayerId}
            />
          </ArchitectRoomFrame>
        );
      case 'trade':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <TradeSection {...tradeSectionSurface} />
          </ArchitectRoomFrame>
        );
      case 'fa':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <FreeAgencySection {...freeAgencySectionSurface} />
          </ArchitectRoomFrame>
        );
      case 'offseason':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <OffseasonSection {...offseasonSectionSurface} />
          </ArchitectRoomFrame>
        );
      case 'history':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <HistorySection
              teamCapSheet={teamCapSheet}
              worldId={worldId}
              onInjectTeamHistoryFixtures={
                actions.teamHistoryDevTools.injectFixtures
              }
              onClearTeamHistoryFixtures={
                actions.teamHistoryDevTools.clearFixtures
              }
              hasInjectedTeamHistoryFixtures={
                actions.teamHistoryDevTools.hasInjectedFixtures
              }
              requestedHistoryEventDetail={requestedHistoryEventDetail}
              onRequestedHistoryEventDetailHandled={
                handleHistoryEventDetailHandled
              }
            />
          </ArchitectRoomFrame>
        );
      case 'scenario':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <ComparisonSection
              status={comparisonViewModel.status}
              viewModel={comparisonViewModel.viewModel}
              error={comparisonViewModel.error}
              onNavigateToHistory={openHistoryRoot}
              onNavigateToCapSheet={() => openRoom('cap')}
              onNavigateToRoster={() => openRoom('roster')}
            />
          </ArchitectRoomFrame>
        );
      case 'advisor':
        return (
          <ArchitectRoomFrame room={activeRoomDescriptor}>
            <GuideSection
              viewModel={guidedAnswersViewModel}
              onNavigate={handleGuideNavigate}
            />
            <div className="mt-4">
              <CapAuditDebugPanel worldId={worldId} />
            </div>
          </ArchitectRoomFrame>
        );
    }
  })();

  return (
    <>
      <ArchitectModeShell
        context={workspaceContext}
        activeRoom={activeRoom}
        rooms={ARCHITECT_ROOMS}
        controls={controls}
        contextTray={
          <ArchitectContextTray
            context={workspaceContext}
            activeRoomLabel={activeRoomDescriptor.label}
            focusedPlayerLabel={focusedPlayerLabel}
            receipt={postActionReceipt.receipt}
            requestedHistoryEventDetail={requestedHistoryEventDetail}
            warnings={architectWarnings}
            onOpenCapOffice={() => openRoom('cap')}
            onOpenRosterRoom={() => openRoom('roster')}
            onOpenLeagueLog={openHistoryRoot}
          />
        }
        statusBanner={statusBanner}
        onOpenRoom={openRoom}
      >
        {roomContent}
      </ArchitectModeShell>

      {showOffseasonModal && offseasonSummary && (
        <div className="modal-overlay">
          <div className="modal-content">
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
                  {offseasonSummary.waivedDeadCap.map((waivedContract, index) => (
                    <li key={index}>
                      {waivedContract.name} → $
                      {Number(waivedContract.amount || 0).toLocaleString()} in{' '}
                      {waivedContract.year}
                    </li>
                  ))}
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
                openLegacyTab('cap');
              }}
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
};
