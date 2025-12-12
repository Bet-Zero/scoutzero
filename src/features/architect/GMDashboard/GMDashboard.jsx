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
 *
 * LINKS:
 *  - Plan: plans/gm-dashboard-userid/plan.md
 *  - Latest Chunk: plans/gm-dashboard-userid/chunks/chunk_01.md
 */
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  saveNamedTeamPlan,
  listUserTeamPlans,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import EditContractModal from '@/shared/components/EditContractModal';
import SavePlanModal from '@/features/architect/SavePlanModal';
import RosterSection from './sections/RosterSection';
import CapSheetSection from './sections/CapSheetSection';
import CapTableSection from './sections/CapTableSection';
import TradeSection from './sections/TradeSection';
import FreeAgencySection from './sections/FreeAgencySection';
import OffseasonSection from './sections/OffseasonSection';
import HistorySection from './sections/HistorySection';
import { useArchitectState } from './hooks/useArchitectState';
import { useCapSheetState } from '@/features/architect/hooks/useCapSheetState';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
import useAuth from '@/shared/hooks/useAuth';
import { basePlayerRef } from '@/data/firestorePaths';
import { getDoc } from 'firebase/firestore';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import capProjections from '@/features/architect/utils/capProjections';

// ==== Season helpers ====
const toSeasonKey = (endYear) => `${endYear - 1}-${String(endYear).slice(-2)}`;

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

// Helper to ensure contract has proper structure
const ensureContractStructure = (contract, overrides = {}) => {
  if (!contract) return null;

  // If contract already has salariesByYear array, use it directly
  if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
    return {
      ...contract,
      ...overrides,
    };
  }

  // If no contract data, return null
  return null;
};

const GMDashboard = () => {
  const { teamId } = useParams();
  const { userId, loading: authLoading } = useAuth();

  // All state now from hook
  const state = useArchitectState({ teamId, userId, authLoading });

  // Destructure state for easier access
  const {
    teamCapSheet,
    currentYear,
    selectedRulesYear,
    activeTab,
    viewMode,
    selectedPlayer,
    selectedPlan,
    freeAgents,
    plans,
    isLoading,
    isSaving,
    error,
    showModal,
    showSaveModal,
    showContractModal,
    newPlanName,
    initialAction,
    targetYear,
    actionContext,
    lastCapSheet,
    offseasonRun,
    offseasonSummary,
    playersMap,
    capTableYears,
    setTeamCapSheet,
    setCurrentYear,
    setSelectedRulesYear,
    setActiveTab,
    setViewMode,
    setSelectedPlayer,
    setSelectedPlan,
    setFreeAgents,
    startSave,
    finishSave,
    setShowModal,
    setShowSaveModal,
    setShowContractModal,
    setNewPlanName,
    setInitialAction,
    setTargetYear,
    setActionContext,
    setLastCapSheet,
    setOffseasonRun,
    setOffseasonSummary,
    setPlans,
  } = state;

  // === Cap Sheet State Management Hook ===
  // Provides undo capability and action history tracking
  const capSheetState = useCapSheetState({
    initialCapSheet: teamCapSheet,
    currentYear,
  });

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
    players: capSheetState.modifiedCapSheet?.players || [],
    teamCapSheet: capSheetState.modifiedCapSheet,
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

  // Sync hook state when teamCapSheet changes (e.g., from loading plans)
  useEffect(() => {
    if (teamCapSheet) {
      capSheetState.refreshFromSource(teamCapSheet);
    }
  }, [teamCapSheet, capSheetState]);

  const applyTradeToCapSheet = async (tradeData) => {
    if (!tradeData || !Array.isArray(tradeData)) return;

    const updated = {
      ...teamCapSheet,
      activeContracts: teamCapSheet.activeContracts || [],
      players: teamCapSheet.players || [],
    };

    const targetTrade = tradeData.find((t) => t.teamId === teamId);
    if (!targetTrade) return;

    const incoming = targetTrade.incoming || [];
    const outgoing = targetTrade.outgoing || [];

    const normalize = (str = '') => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isSamePlayer = (a, b) => {
      const aId = a.player_id || a.id;
      const bId = b.id || b.player_id;
      if (aId && bId) return aId === bId;
      return normalize(a.name) === normalize(b.name);
    };

    // Remove outgoing players from main roster
    updated.players = updated.players.filter((player) => {
      const traded = outgoing.some((out) => isSamePlayer(player, out));
      if (traded) {
        console.log(`🗑️ Removing ${player.name} from roster (traded away)`);
      }
      return !traded;
    });

    // Filter out players you just traded away from active contracts
    updated.activeContracts = (updated.activeContracts || []).filter(
      (contract) => {
        const traded = outgoing.some((out) => isSamePlayer(contract, out));
        if (traded) {
          console.log(`🗑️ Removing ${contract.name} (traded away)`);
        }
        return !traded;
      }
    );

    // Add the incoming traded players
    const newContracts = incoming.map((p) => {
      // Use contract directly if it has salariesByYear array, otherwise use player's contract
      const architectContract = ensureContractStructure(p.contract || p, {
        contractType: p.contractType || 'Trade',
        isExtension: !!p.isExtension,
        isRookieScale: !!p.isRookieScale,
        signingTeam: teamId,
      });

      return {
        name: p.name,
        player_id: p.id || p.player_id,
        years: architectContract?.salariesByYear?.length || 1,
        options: p.options || {},
        type: 'Trade',
        signAndTrade: !!p.signAndTrade,
        guaranteed: p.guaranteed ?? true,
        isMinimum: p.isMinimum ?? false,
        yearsOfService: p.yearsOfService ?? 0,
        contract: architectContract || undefined,
      };
    });

    const newPlayers = await Promise.all(
      incoming.map(async (p) => {
        const base = playersMap[p.name] || playersMap[p.player_id] || null;
        let playerData = base;
        if (!playerData && (p.id || p.player_id)) {
          // Load from architect_basePlayers collection
          const playerSnap = await getDoc(basePlayerRef(p.id || p.player_id));
          if (playerSnap.exists()) {
            const loaded = playerSnap.data();
            playerData = {
              id: loaded.playerId || p.id || p.player_id,
              player_id: loaded.playerId || p.id || p.player_id,
              name: loaded.displayName || p.name,
              displayName: loaded.displayName || p.name,
              position: loaded.bio?.position || '',
              age: loaded.bio?.age || null,
              contract: loaded.contract || null,
              bio: loaded.bio || {},
              ...loaded,
            };
          }
        }

        // Use contract from trade data or player data, ensuring it has proper structure
        const architectContract = ensureContractStructure(
          p.contract || playerData?.contract,
          {
            contractType: p.contractType || 'Trade',
            isExtension: !!p.isExtension,
            isRookieScale: !!p.isRookieScale,
            signingTeam: teamId,
          }
        );

        const position =
          playerData?.position ||
          playerData?.formattedPosition ||
          getPlayerPositionLabel(playerData?.bio?.position || p.position || '');
        return {
          ...(playerData || {}),
          name: playerData?.name || p.name,
          player_id: p.id || p.player_id || playerData?.player_id,
          displayName:
            playerData?.bio?.displayName || p.bio?.displayName || p.name,
          position,
          contract: architectContract || playerData?.contract,
        };
      })
    );

    updated.activeContracts.push(...newContracts);
    updated.players.push(...newPlayers);

    console.log(
      '✅ Applied trade — activeContracts now:',
      updated.activeContracts
    );

    setTeamCapSheet(updated);
  };

  const handleSign = (playerObj, contract) => {
    // Contract should already have salariesByYear array format
    const architectContract = ensureContractStructure(contract, {
      contractType: contract.contractType || 'Signed FA',
      isExtension: !!contract.isExtension,
      isRookieScale: !!contract.isRookieScale,
      signingTeam: teamId,
    });

    const newContract = {
      name: playerObj.name,
      player_id: playerObj.id || playerObj.player_id,
      years: architectContract?.salariesByYear?.length || 1,
      options: contract.options || {},
      type: contract.signAndTrade ? 'Sign & Trade' : 'Signed FA',
      signAndTrade: contract.signAndTrade || false,
      guaranteed: contract.guaranteed,
      isMinimum: contract.isMinimum,
      yearsOfService: contract.yearsOfService,
      contract: architectContract,
    };

    setTeamCapSheet((prev) => {
      const active = prev?.activeContracts || [];
      const players = prev?.players || [];

      const base =
        playersMap[playerObj.name] ||
        playersMap[playerObj.player_id] ||
        playersMap[playerObj.id] ||
        {};

      const position =
        base.position ||
        base.formattedPosition ||
        getPlayerPositionLabel(base.bio?.position || playerObj.position || '');

      const newPlayer = {
        ...(base || {}),
        name: base.name || playerObj.name,
        player_id: playerObj.id || playerObj.player_id || base.player_id,
        displayName:
          base.bio?.displayName || playerObj.bio?.displayName || playerObj.name,
        position,
        contract:
          ensureContractStructure(contract, {
            contractType: contract.contractType || 'Signed FA',
            isExtension: !!contract.isExtension,
            isRookieScale: !!contract.isRookieScale,
            signingTeam: teamId,
          }) || base.contract,
      };

      return {
        ...prev,
        activeContracts: [...active, newContract],
        players: [...players, newPlayer],
      };
    });

    setFreeAgents((prev) =>
      prev.filter(
        (p) =>
          p.name !== playerObj.name &&
          p.id !== playerObj.id &&
          p.player_id !== playerObj.player_id
      )
    );
  };

  const handleEditContract = (player) => {
    setSelectedPlayer(player);
    setInitialAction(null); // No pre-selection when just clicking player name
    setTargetYear(null); // No specific year context
    setActionContext(null); // No specific action context - show based on player state
    setSelectedRulesYear(currentYear);
    setShowContractModal(true);
  };

  // Handler for clicking action cells (PO/TO/UFA/RFA) in CapSheetFull or Renounce
  const handleCapSheetAction = (player, actionType, year) => {
    if (actionType === 'renounce') {
      handleRenounceRights(player);
      return;
    }

    setSelectedPlayer(player);
    setTargetYear(year); // Store which year was clicked
    setSelectedRulesYear(year || currentYear);

    // Determine action context based on what was clicked
    const contextMap = {
      po: 'option',
      to: 'option',
      ufa: 'freeAgent',
      rfa: 'freeAgent',
    };

    setInitialAction(null); // No pre-selection - user picks
    setActionContext(contextMap[actionType] || null);
    setShowContractModal(true);
  };

  const handleSaveContract = (player, contractData) => {
    capSheetState.signPlayer(player, contractData, 'signNew');
    setShowContractModal(false);
  };

  const handleExtendContract = (player, extensionContract) => {
    capSheetState.extendContract(player, extensionContract);
    setShowContractModal(false);
  };

  const handleWaiveContract = (player, { stretch, buyout }) => {
    const confirmMsg = stretch
      ? 'Waive and stretch this player?'
      : 'Waive this player?';
    if (!window.confirm(confirmMsg)) return;

    capSheetState.waivePlayer(player, { stretch, buyout });
    setShowContractModal(false);
  };

  const handleOptionDecision = (player, accepted) => {
    capSheetState.exerciseOption(player, accepted);
    setShowContractModal(false);
  };

  const handleRenounceRights = (player) => {
    if (
      window.confirm(
        `Are you sure you want to renounce rights to ${player.displayName || player.name}? This will clear their cap hold.`
      )
    ) {
      capSheetState.renounceRights(player);
    }
  };

  const handleUpdateRoster = (updatedCapSheet) => {
    setTeamCapSheet(updatedCapSheet);
  };

  const handleResetCapSheet = () => {
    const confirmReset = window.confirm(
      'Are you sure you want to clear all contracts and reset the cap sheet?'
    );
    if (!confirmReset) return;

    const resetSheet = {
      ...teamCapSheet,
      activeContracts: [],
      waivedContracts: [],
      tradeExceptions: [],
      exceptionHistory: [],
      mleHistory: [],
      pickLog: [],
      currentPicks: {},
      amount: capProjections[toSeasonKey(currentYear)]?.fullMLE || 0,
    };

    setTeamCapSheet(resetSheet);
    setOffseasonRun(false);
    setOffseasonSummary(null);
  };

  if (authLoading || isLoading) return <p>Loading GM Dashboard...</p>;
  if (!teamCapSheet) return <p>No team data</p>;

  return (
    <div className="gm-dashboard px-6 py-4 text-white min-h-screen bg-[#0d0d0d]">
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
        <h1 className="text-3xl font-bold">
          HoopZero Architect – GM Dashboard
        </h1>
        <div className="flex items-center gap-2">
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

          {/* View mode - only show plan option if userId is available */}
          {userId && (
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              <option value="plan">Plan</option>
              <option value="baseline">Baseline</option>
            </select>
          )}

          {/* Plan picker - only show if userId is available and in plan mode */}
          {userId && viewMode === 'plan' && (
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
          )}

          {/* Undo Button & Changes Counter */}
          {capSheetState.hasChanges && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
              <span className="text-xs text-white/50">
                {capSheetState.actionHistory.length} change
                {capSheetState.actionHistory.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={capSheetState.undo}
                disabled={!capSheetState.canUndo}
                className="px-2 py-1 text-xs font-medium rounded bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 border border-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Undo last action"
              >
                ↩ Undo
              </button>
              <button
                type="button"
                onClick={capSheetState.reset}
                className="px-2 py-1 text-xs font-medium rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 transition-all"
                title="Reset all changes"
              >
                Reset
              </button>
            </div>
          )}
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
            teamCapSheet={capSheetState.modifiedCapSheet}
            playersMap={playersMap}
            teamId={teamId}
          />
        )}

        {activeTab === 'cap' && (
          <CapSheetSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            currentYear={currentYear}
            onSelectPlayer={handleEditContract}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'capfull' && (
          <CapTableSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            currentYear={currentYear}
            onSelectPlayer={handleEditContract}
            onActionClick={handleCapSheetAction}
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
            onApplyTrade={applyTradeToCapSheet}
            primaryTeamData={teamCapSheet}
            onEditContract={handleEditContract}
          />
        )}

        {activeTab === 'fa' && (
          <FreeAgencySection
            freeAgents={freeAgents}
            teamCapSheet={capSheetState.modifiedCapSheet}
            capProjections={capProjections}
            currentYear={currentYear}
            onSign={handleSign}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'offseason' && (
          <OffseasonSection
            teamCapSheet={capSheetState.modifiedCapSheet}
            setTeamCapSheet={setTeamCapSheet}
            currentYear={currentYear}
            setCurrentYear={setCurrentYear}
            capProjections={capProjections}
            setLastCapSheet={setLastCapSheet}
            setOffseasonRun={setOffseasonRun}
            setOffseasonSummary={setOffseasonSummary}
            setShowModal={setShowModal}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'history' && (
          <HistorySection teamCapSheet={teamCapSheet} />
        )}
      </div>

      {showModal && offseasonSummary && (
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
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <SavePlanModal
          isOpen={showSaveModal}
          name={newPlanName}
          onNameChange={setNewPlanName}
          onCancel={() => setShowSaveModal(false)}
          onSave={async () => {
            if (!newPlanName.trim()) return;
            startSave();
            try {
              await saveNamedTeamPlan(
                userId,
                teamId,
                newPlanName.trim(),
                teamCapSheet
              );
              const updated = await listUserTeamPlans(userId, teamId);
              setPlans(updated);
              setSelectedPlan(newPlanName.trim());
              setNewPlanName('');
              setShowSaveModal(false);
              finishSave();
            } catch (err) {
              console.error('Failed to save plan', err);
              finishSave('Failed to save plan');
            }
          }}
        />
      )}

      {showContractModal && (
        <EditContractModal
          isOpen={showContractModal}
          onClose={() => {
            setShowContractModal(false);
            setInitialAction(null);
            setTargetYear(null);
            setActionContext(null);
            setSelectedRulesYear(currentYear);
          }}
          player={selectedPlayer}
          initialAction={initialAction}
          targetYear={targetYear}
          actionContext={actionContext}
          capProjections={capProjections}
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onSign={handleSign}
          onSave={handleSaveContract}
          onExtend={handleExtendContract}
          onWaive={handleWaiveContract}
          onOptionDecision={handleOptionDecision}
          playersMap={playersMap}
          playerRulesProfile={selectedPlayerRulesProfile}
          rulesLeagueContext={selectedRulesLeagueContext}
        />
      )}

      {userId && viewMode === 'plan' && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowSaveModal(true)}
            className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20"
          >
            Save Plan
          </button>
        </div>
      )}
    </div>
  );
};

export default GMDashboard;
