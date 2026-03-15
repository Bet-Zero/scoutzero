/**
 * FILE: src/features/architect/GMDashboard/GMDashboard.tsx
 * PURPOSE: Primary Architect dashboard for managing cap sheets, contracts, trades, and free agency flows.
 * OWNERSHIP: Feature: architect/core dashboard
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
import EditContractModal from '@/shared/components/EditContractModal';
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
import { useArchitectState } from './hooks/useArchitectState';
import { useArchitectActions } from './hooks/useArchitectActions';
import { useArchitectModals } from './hooks/useArchitectModals';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  FIREBASE_TARGET_MODE,
  isLikelyEmulatorConnectionError,
} from '@/firebaseConfig';
import capProjections from '@/features/architect/utils/capProjections';
import {
  toSeasonCode,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';

type PlayerLike = {
  id?: string | null;
  player_id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  [key: string]: unknown;
};

type TeamCapSheetLike = {
  players?: PlayerLike[] | null;
  offerSheets?: unknown[];
  incomingOfferSheets?: unknown[];
  [key: string]: unknown;
};

type OffseasonSummaryLike = {
  declinedOptions?: string[];
  expiredContracts?: string[];
  expiredTPEs?: Array<{ amount?: number; source?: string | null }>;
  waivedDeadCap?: Array<{
    name?: string | null;
    amount?: number;
    year?: string | number | null;
  }>;
  resetMLE?: boolean;
  [key: string]: unknown;
} | null;

type PlayersMapLike = Record<string, any>;

type DashboardStateLike = {
  teamCapSheet: TeamCapSheetLike | null;
  currentYear: number;
  selectedRulesYear?: number | null;
  activeTab: string;
  selectedPlayer: PlayerLike | null;
  freeAgents: unknown[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  offseasonRun: boolean;
  offseasonSummary: OffseasonSummaryLike;
  playersMap: PlayersMapLike;
  capTableYears: number[];
  worldId: string | null;
  worldAsOfDate: string | null;
  setTeamCapSheet: (value: unknown) => void;
  setCurrentYear: (value: number) => void;
  setActiveTab: (value: string) => void;
  setLastCapSheet: (value: unknown) => void;
  setOffseasonRun: (value: boolean) => void;
  setOffseasonSummary: (value: OffseasonSummaryLike) => void;
  setWorldId: (value: string | null) => void;
  setWorldAsOfDate: (value: string | null) => void;
};

type ModalsLike = {
  showOffseasonModal: boolean;
  showContractModal: boolean;
  initialAction: unknown;
  targetYear: unknown;
  actionContext: unknown;
  closeContractModal: () => void;
  closeOffseasonModal: () => void;
  setShowOffseasonModal: (value: boolean) => void;
  openContractModal?: (...args: any[]) => void;
};

type ActionsLike = {
  handleEditContract: (...args: any[]) => void;
  handleSetDeadCap: (...args: any[]) => void;
  handleSetExceptions: (...args: any[]) => void;
  handleInjectCapSheetFixtures: (...args: any[]) => void;
  handleClearCapSheetFixtures: (...args: any[]) => void;
  hasInjectedCapSheetFixtures: boolean;
  applyTradeToCapSheet: (...args: any[]) => void;
  handleSign: (...args: any[]) => void;
  handleSignAndTrade: (...args: any[]) => void;
  handleStoreOfferSheet: (...args: any[]) => void;
  handleMatchOfferSheet: (...args: any[]) => void;
  handleDeclineOfferSheet: (...args: any[]) => void;
  handleFinalizeOfferSheet: (...args: any[]) => void;
  handleCapSheetAction: (...args: any[]) => void;
  handleSaveContract: (...args: any[]) => void;
  handleExtendContract: (...args: any[]) => void;
  handleWaiveContract: (...args: any[]) => void;
  handleOptionDecision: (...args: any[]) => void;
  handleRenounceRights: (...args: any[]) => void;
  handleInjectTeamHistoryFixtures: (...args: any[]) => void;
  handleClearTeamHistoryFixtures: (...args: any[]) => void;
  hasInjectedTeamHistoryFixtures: boolean;
};

type PlayerRulesProfilesLike = {
  leagueContext: unknown;
  leagueContextByYear?: Map<number, unknown>;
  getProfile: (
    player: PlayerLike,
    selectedRulesYear?: number | null
  ) => unknown;
  getProfileForYear: (...args: any[]) => unknown;
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

const GMDashboard = () => {
  const { teamId } = useParams();
  const { userId, loading: authLoading } = useAuth();

  const state = useArchitectState({
    teamId,
    userId,
    authLoading,
  }) as DashboardStateLike;

  const modals = useArchitectModals() as ModalsLike;

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
    setTeamCapSheet,
    setCurrentYear,
    setActiveTab,
    setLastCapSheet,
    setOffseasonRun,
    setOffseasonSummary,
    setWorldId,
    setWorldAsOfDate,
  } = state;

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
    teamCode: teamId,
    simulationDate: simulatedRulesDate,
    evaluationYears: capTableYears,
  }) as PlayerRulesProfilesLike;

  const selectedPlayerRulesProfile = selectedPlayer
    ? getRulesProfile(selectedPlayer, selectedRulesYear)
    : null;
  const selectedRulesLeagueContext =
    (selectedRulesYear && leagueContextByYear?.get(selectedRulesYear)) ||
    rulesLeagueContext;

  const actions = useArchitectActions({
    teamId,
    userId,
    authLoading,
    state,
    playersMap,
    modals,
    worldId,
    seasonId: toSeasonCode(currentYear),
  } as any) as ActionsLike;

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
              worldId={worldId}
              setWorldId={setWorldId}
            />
          )}

          {userId && <div className="h-6 w-px bg-white/10" />}

          {userId && worldId && (
            <WorldTimeControls
              worldId={worldId}
              asOfDate={worldAsOfDate}
              setAsOfDate={setWorldAsOfDate}
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
            teamId={teamId}
          />
        )}

        {activeTab === 'cap' && (
          <CapSheetSection
            teamCapSheet={teamCapSheet}
            currentYear={currentYear}
            onSelectPlayer={actions.handleEditContract}
            onSetDeadCap={actions.handleSetDeadCap}
            onSetExceptions={actions.handleSetExceptions}
            playersMap={playersMap}
            onInjectCapSheetFixtures={actions.handleInjectCapSheetFixtures}
            onClearCapSheetFixtures={actions.handleClearCapSheetFixtures}
            hasInjectedCapSheetFixtures={actions.hasInjectedCapSheetFixtures}
          />
        )}

        {activeTab === 'capfull' && (
          <CapTableSection
            teamCapSheet={teamCapSheet}
            currentYear={currentYear}
            onSelectPlayer={actions.handleEditContract}
            onActionClick={actions.handleCapSheetAction}
            playersMap={playersMap}
            getRulesProfileForYear={getProfileForYear}
          />
        )}

        {activeTab === 'trade' && (
          <TradeSection
            primaryTeam={teamId}
            capProjections={capProjections}
            currentYear={currentYear}
            playersMap={playersMap}
            onApplyTrade={actions.applyTradeToCapSheet}
            primaryTeamData={teamCapSheet}
            onEditContract={actions.handleEditContract}
            worldId={worldId}
            worldAsOfDate={worldAsOfDate}
            userId={userId}
          />
        )}

        {activeTab === 'fa' && (
          <FreeAgencySection
            freeAgents={freeAgents}
            teamCapSheet={teamCapSheet}
            currentYear={currentYear}
            onSign={actions.handleSign}
            onSignAndTrade={actions.handleSignAndTrade}
            onStoreOfferSheet={worldId ? actions.handleStoreOfferSheet : null}
            playersMap={playersMap}
            outgoingOfferSheets={(teamCapSheet?.offerSheets || []) as any}
            incomingOfferSheets={(teamCapSheet?.incomingOfferSheets || []) as any}
            onMatch={actions.handleMatchOfferSheet}
            onDecline={actions.handleDeclineOfferSheet}
            onFinalize={actions.handleFinalizeOfferSheet}
            worldId={worldId}
          />
        )}

        {activeTab === 'offseason' && (
          <OffseasonSection
            teamCapSheet={teamCapSheet}
            setTeamCapSheet={setTeamCapSheet}
            currentYear={currentYear}
            setCurrentYear={setCurrentYear}
            capProjections={capProjections}
            setLastCapSheet={setLastCapSheet}
            offseasonRun={offseasonRun}
            setOffseasonRun={setOffseasonRun}
            setOffseasonSummary={setOffseasonSummary}
            setShowOffseasonModal={setShowOffseasonModal}
            playersMap={playersMap}
            worldId={worldId}
            teamCode={teamId}
          />
        )}

        {activeTab === 'history' && (
          <HistorySection
            teamCapSheet={teamCapSheet}
            worldId={worldId}
            onInjectTeamHistoryFixtures={
              actions.handleInjectTeamHistoryFixtures
            }
            onClearTeamHistoryFixtures={actions.handleClearTeamHistoryFixtures}
            hasInjectedTeamHistoryFixtures={
              actions.hasInjectedTeamHistoryFixtures
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
          player={selectedPlayer}
          initialAction={initialAction}
          targetYear={targetYear}
          actionContext={actionContext}
          capProjections={capProjections}
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onSignFreeAgent={actions.handleSign}
          onResign={actions.handleSign}
          onSignAndTrade={actions.handleSignAndTrade}
          onStoreOfferSheet={worldId ? actions.handleStoreOfferSheet : null}
          onSaveContract={actions.handleSaveContract}
          onExtend={actions.handleExtendContract}
          onWaive={actions.handleWaiveContract}
          onOptionDecision={actions.handleOptionDecision}
          onRenounce={actions.handleRenounceRights}
          playersMap={playersMap}
          playerRulesProfile={selectedPlayerRulesProfile}
          rulesLeagueContext={selectedRulesLeagueContext}
        />
      )}
    </div>
  );
};

export default GMDashboard;
