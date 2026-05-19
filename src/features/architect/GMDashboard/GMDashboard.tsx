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
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { EditContractModal } from '@/shared/components/EditContractModal';
import { RosterSection } from './sections/RosterSection';
import { CapSheetSection } from './sections/CapSheetSection';
import { CapTableSection } from './sections/CapTableSection';
import { TradeSection } from './sections/TradeSection';
import { FreeAgencySection } from './sections/FreeAgencySection';
import { OffseasonSection } from './sections/OffseasonSection';
import { HistorySection } from './sections/HistorySection';
import { WorldSelector } from '@/features/architect/GMDashboard/components/WorldSelector';
import { WorldTimeControls } from '@/features/architect/GMDashboard/components/WorldTimeControls';
import { CapAuditDebugPanel } from '@/features/architect/GMDashboard/components/CapAuditDebugPanel';
import { ArchitectWorkspaceHeader } from '@/features/architect/GMDashboard/components/ArchitectWorkspaceHeader';
import { ScenarioMoveRail } from '@/features/architect/GMDashboard/components/ScenarioMoveRail';
import { useArchitectState } from './hooks/useArchitectState';
import { useArchitectWorkspaceContext } from './hooks/useArchitectWorkspaceContext';
import { useArchitectActions } from './hooks/useArchitectActions';
import { useArchitectModals } from './hooks/useArchitectModals';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
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

  const actions = useArchitectActions({
    teamId: normalizedTeamId,
    userId,
    authLoading,
    state,
    playersMap,
    modals,
    worldId,
    seasonId: toSeasonCode(currentYear),
  });

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
  };
  const tradeSectionSurface: TradeSectionProps = {
    primaryTeam: normalizedTeamId,
    capProjections,
    currentYear,
    playersMap,
    onApplyTrade: actions.applyTradeToCapSheet as TradeSectionProps['onApplyTrade'],
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
  };

  if (authLoading || isLoading) return <p>Loading GM Dashboard...</p>;
  if (!teamCapSheet) return <p>No team data</p>;

  return (
    <div className="gm-dashboard px-6 py-4 text-white min-h-screen bg-[#0d0d0d]">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
        <h1 className="text-3xl font-bold">
          HoopZero Architect – GM Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isEmulatorMode
                ? 'bg-amber-400/15 text-amber-200 border-amber-300/30'
                : 'bg-rose-500/15 text-rose-200 border-rose-300/30'
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

          {userId && <div className="h-6 w-px bg-white/10" />}

          {userId && (
            <WorldTimeControls
              worldTimeOwner={worldTimeOwner}
              disabled={worldModeBoundary.kind !== 'world'}
            />
          )}

          <label className="flex items-center gap-2 text-sm font-medium">
            Season
            <select
              value={currentYear}
              onChange={(event) =>
                setCurrentYear(parseInt(event.target.value, 10))
              }
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              {seasonEndYearsFromCaps(capProjections).map((year) => (
                <option key={year} value={year}>
                  {toSeasonKey(year)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ArchitectWorkspaceHeader context={workspaceContext} />

      <ScenarioMoveRail
        worldId={worldId}
        teamCode={normalizedTeamId}
        onOpenHistory={() => setActiveTab('history')}
      />

      {showEmulatorUnavailableBanner && (
        <div
          className="mb-3 rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-amber-100 text-sm"
          data-testid="firebase-emulator-warning-banner"
        >
          Emulator mode: Firebase emulators not detected. Start them with: npm
          run emu
        </div>
      )}
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {isSaving && <p className="text-sm mb-2">Saving...</p>}

      <div className="tab-bar flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'roster'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Roster
        </button>
        <button
          onClick={() => setActiveTab('cap')}
          data-testid="tab-cap-sheet"
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'cap'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Cap Sheet
        </button>
        <button
          onClick={() => setActiveTab('capfull')}
          data-testid="tab-full-cap-table"
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'capfull'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Full Cap Table
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'trade'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Trade Machine
        </button>
        <button
          onClick={() => setActiveTab('fa')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'fa'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Free Agency
        </button>
        <button
          onClick={() => setActiveTab('offseason')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'offseason'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Offseason
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'history'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Team History
        </button>
      </div>

      <div className="tab-content space-y-6">
        {activeTab === 'roster' && (
          <RosterSection
            teamCapSheet={teamCapSheet}
            playersMap={playersMap}
            teamId={normalizedTeamId}
          />
        )}

        {activeTab === 'cap' && (
          <CapSheetSection {...capSheetSectionSurface} />
        )}

        {activeTab === 'capfull' && (
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
          />
        )}

        {activeTab === 'trade' && (
          <TradeSection {...tradeSectionSurface} />
        )}

        {activeTab === 'fa' && (
          <FreeAgencySection {...freeAgencySectionSurface} />
        )}

        {activeTab === 'offseason' && (
          <OffseasonSection {...offseasonSectionSurface} />
        )}

        {activeTab === 'history' && (
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
          />
        )}
      </div>

      <CapAuditDebugPanel worldId={worldId} />

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
            <button type="button" onClick={closeOffseasonModal}>
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
    </div>
  );
};

