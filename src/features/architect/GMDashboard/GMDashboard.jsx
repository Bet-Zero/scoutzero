/**
 * FILE: src/features/architect/GMDashboard/GMDashboard.jsx
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
 *
 * LINKS:
 *  - Plan: plans/gm-dashboard-userid/plan.md
 *  - Latest Chunk: plans/gm-dashboard-userid/chunks/chunk_01.md
 */
import React, { useMemo } from 'react';
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
import capProjections from '@/features/architect/utils/capProjections';
import {
  toSeasonCode,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';

const seasonEndYearsFromCaps = (caps) => {
  const keys = Object.keys(caps || {});
  const years = keys
    .map((k) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const tail = parseInt(k.split('-')[1], 10);
        return 2000 + tail; // "2024-25" -> 2025
      }
      const num = parseInt(k, 10);
      return Number.isFinite(num) ? num : null; // allow "2025"
    })
    .filter(Boolean);
  // De-dup and sort
  return Array.from(new Set(years)).sort((a, b) => a - b);
};

const GMDashboard = () => {
  const { teamId } = useParams();
  const { userId, loading: authLoading } = useAuth();

  // All state now from hook
  const state = useArchitectState({ teamId, userId, authLoading });

  // All modal state now from hook
  const modals = useArchitectModals();

  // Destructure state for easier access
  // Note: Many setters are no longer destructured here as they're used by useArchitectActions
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
    // Setters still needed by GMDashboard JSX/children
    setTeamCapSheet,
    setCurrentYear,
    setActiveTab,
    setLastCapSheet,
    setOffseasonRun,
    setOffseasonSummary,
    setWorldId,
    setWorldAsOfDate,
  } = state;

  // Destructure modals for easier access
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

  // Use teamCapSheet directly as the source of truth (Option B refactor)
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
  });

  const selectedPlayerRulesProfile = selectedPlayer
    ? getRulesProfile(selectedPlayer, selectedRulesYear)
    : null;
  const selectedRulesLeagueContext =
    (selectedRulesYear && leagueContextByYear?.get(selectedRulesYear)) ||
    rulesLeagueContext;

  // === Actions Hook ===
  // All handler functions are now centralized in useArchitectActions
  // Actions now mutate teamCapSheet directly (Option B refactor)
  const actions = useArchitectActions({
    teamId,
    userId,
    authLoading,
    state,
    playersMap,
    modals,
    worldId,
    seasonId: toSeasonCode(currentYear),
  });

  if (authLoading || isLoading) return <p>Loading GM Dashboard...</p>;
  if (!teamCapSheet) return <p>No team data</p>;

  return (
    <div className="gm-dashboard px-6 py-4 text-white min-h-screen bg-[#0d0d0d]">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
        <h1 className="text-3xl font-bold">
          HoopZero Architect – GM Dashboard
        </h1>
        <div className="flex items-center gap-4">
          {/* World Selector - Primary scenario management */}
          {userId && (
            <WorldSelector
              userId={userId}
              worldId={worldId}
              setWorldId={setWorldId}
            />
          )}

          {userId && <div className="h-6 w-px bg-white/10" />}

          {/* Phase 21: World Time Controls */}
          {userId && worldId && (
            <WorldTimeControls
              worldId={worldId}
              asOfDate={worldAsOfDate}
              setAsOfDate={setWorldAsOfDate}
            />
          )}

          {/* Season Selector */}
          <label className="flex items-center gap-2 text-sm font-medium">
            Season
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              {seasonEndYearsFromCaps(capProjections).map((y) => (
                <option key={y} value={y}>
                  {toSeasonKey(y)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
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
            // Phase 16: Offer Sheet Wiring
            outgoingOfferSheets={teamCapSheet?.offerSheets || []}
            incomingOfferSheets={teamCapSheet?.incomingOfferSheets || []}
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
          <HistorySection teamCapSheet={teamCapSheet} />
        )}
      </div>

      <CapAuditDebugPanel worldId={worldId} />

      {showOffseasonModal && offseasonSummary && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Offseason Summary</h3>
            {offseasonSummary.declinedOptions.length > 0 && (
              <>
                <h4>Declined Options</h4>
                <ul>
                  {offseasonSummary.declinedOptions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.expiredContracts.length > 0 && (
              <>
                <h4>Expired Contracts</h4>
                <ul>
                  {offseasonSummary.expiredContracts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.expiredTPEs.length > 0 && (
              <>
                <h4>Expired Trade Exceptions</h4>
                <ul>
                  {offseasonSummary.expiredTPEs.map((t, i) => (
                    <li key={i}>
                      ${t.amount.toLocaleString()} from {t.source}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {offseasonSummary.waivedDeadCap.length > 0 && (
              <>
                <h4>Ongoing Dead Cap</h4>
                <ul>
                  {offseasonSummary.waivedDeadCap.map((w, i) => (
                    <li key={i}>
                      {w.name} → ${w.amount.toLocaleString()} in {w.year}
                    </li>
                  ))}
                </ul>
              </>
            )}
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
