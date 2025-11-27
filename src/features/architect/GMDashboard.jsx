import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  loadTeamCapSheet,
  saveUserTeamPlan,
  loadUserTeamPlan,
  listUserTeamPlans,
  saveNamedTeamPlan,
  loadNamedTeamPlan,
  saveFreeAgents,
  loadFreeAgents,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import RosterVisual from './RosterVisual';
import CapSheet from './CapSheet';
import CapSheetFull from './CapSheetFull';
import ContractEditorModal from './ContractEditorModal';
import TradeEditor from './tradeMachine/TradeEditor';
import FreeAgentPool from './FreeAgentPool';
import OffseasonTab from './OffseasonTab';
import TeamHistoryTab from './TeamHistoryTab';
import ExceptionTracker from './ExceptionTracker';
import SavePlanModal from './SavePlanModal';
import useArchitectPlayerData from '@/features/architect/hooks/useArchitectPlayerData';
import { enrichPlayerData } from '@/features/roster/utils';
import { basePlayerRef } from '@/data/firestorePaths';
import { getDoc } from 'firebase/firestore';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import capProjections from '@/features/architect/utils/capProjections';

// ==== Season helpers (inline for now; you can extract later) ====
const LOCAL_SEASON_KEY = 'hz.currentSeasonEndYear';

const getDefaultSeasonEndYear = (date = new Date()) => {
  // NBA season flips July 1 → 2024-25 ends in 2025, 2025-26 ends in 2026
  const y = date.getFullYear();
  return date.getMonth() >= 6 ? y + 1 : y;
};

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

const normalizeSalaryValue = (val) => {
  let num =
    typeof val === 'string' ? Number(val.replace(/[^0-9.-]/g, '')) : val || 0;
  if (Number.isNaN(num)) num = 0;
  // If the value looks like it's in millions (e.g. 3.1), convert to full dollars
  if (num > 0 && num < 1000) num *= 1_000_000;
  return Math.round(num);
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
  const userId = 'demoUser';
  const [baselineCapSheet, setBaselineCapSheet] = useState(null);
  const [teamCapSheet, setTeamCapSheet] = useState(null);
  // AFTER:
  const [currentYear, setCurrentYear] = useState(() => {
    const qp = new URLSearchParams(window.location.search).get('season');
    if (qp && Number.isFinite(parseInt(qp, 10))) return parseInt(qp, 10);
    const saved = localStorage.getItem(LOCAL_SEASON_KEY);
    if (saved && Number.isFinite(parseInt(saved, 10)))
      return parseInt(saved, 10);
    return getDefaultSeasonEndYear(); // ← literal time default
  });

  // Persist selection + keep URL shareable (?season=YYYY)
  useEffect(() => {
    localStorage.setItem(LOCAL_SEASON_KEY, String(currentYear));
    const url = new URL(window.location.href);
    url.searchParams.set('season', String(currentYear));
    window.history.replaceState({}, '', url);
  }, [currentYear]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [activeTab, setActiveTab] = useState('roster');
  const [lastCapSheet, setLastCapSheet] = useState(null);
  const [offseasonRun, setOffseasonRun] = useState(false);
  const [offseasonSummary, setOffseasonSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('architect.viewMode') || 'baseline'
  ); // 'plan' or 'baseline'

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('architect.viewMode', viewMode);
  }, [viewMode]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const { players } = useArchitectPlayerData();

  const playersMap = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[p.name] = p;
    });
    return map;
  }, [players]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const base = await loadTeamCapSheet(teamId);
        const planList = await listUserTeamPlans(userId, teamId);
        setPlans(planList);
        const first = planList[0]?.id || '';
        let plan = null;
        if (first) {
          const data = await loadNamedTeamPlan(userId, teamId, first);
          plan = data?.capSheet || data;
          setSelectedPlan(first);
        } else {
          plan = await loadUserTeamPlan(userId, teamId);
        }
        const loadedFA = await loadFreeAgents();
        if (base) setBaselineCapSheet(base);
        if (plan) setTeamCapSheet(plan);
        else if (base) setTeamCapSheet(JSON.parse(JSON.stringify(base)));
        else console.warn('No saved team found, using blank slate.');
        if (loadedFA.length > 0) setFreeAgents(loadedFA);
      } catch (err) {
        console.error(err);
        setError('Error loading team data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [teamId]);

  useEffect(() => {
    if (!teamCapSheet) return;
    const savePlan = async () => {
      try {
        if (viewMode === 'plan') {
          if (selectedPlan) {
            await saveNamedTeamPlan(
              userId,
              teamId,
              selectedPlan,
              teamCapSheet,
              capProjections,
              currentYear
            );
          } else {
            await saveUserTeamPlan(
              userId,
              teamId,
              teamCapSheet,
              capProjections,
              currentYear
            );
          }
        }
      } catch (err) {
        console.error('Failed to save plan', err);
      }
    };
    savePlan();
  }, [
    teamCapSheet,
    teamId,
    userId,
    selectedPlan,
    viewMode,
    capProjections,
    currentYear,
  ]);

  useEffect(() => {
    if (freeAgents.length === 0) return;
    const saveAgents = async () => {
      try {
        await saveFreeAgents(freeAgents);
      } catch (err) {
        console.error('Failed to save free agents', err);
      }
    };
    saveAgents();
  }, [freeAgents]);

  useEffect(() => {
    const loadPlan = async () => {
      setIsLoading(true);
      setError('');
      try {
        if (viewMode === 'baseline') {
          if (baselineCapSheet)
            setTeamCapSheet(JSON.parse(JSON.stringify(baselineCapSheet)));
          return;
        }
        if (selectedPlan) {
          const data = await loadNamedTeamPlan(userId, teamId, selectedPlan);
          if (data?.capSheet) setTeamCapSheet(data.capSheet);
        } else if (baselineCapSheet) {
          setTeamCapSheet(JSON.parse(JSON.stringify(baselineCapSheet)));
        }
      } catch (err) {
        console.error(err);
        setError('Error loading plan');
      } finally {
        setIsLoading(false);
      }
    };
    loadPlan();
  }, [viewMode, selectedPlan, baselineCapSheet, teamId, userId]);

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

    console.log(
      '🔍 OUTGOING:',
      outgoing.map((p) => p.name)
    );
    console.log(
      '📄 ACTIVE BEFORE FILTER:',
      updated.activeContracts.map((c) => c.name)
    );

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
    setShowContractModal(true);
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

  if (isLoading) return <p>Loading GM Dashboard...</p>;
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

          {/* View mode */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
          >
            <option value="plan">Plan</option>
            <option value="baseline">Baseline</option>
          </select>

          {/* Plan picker */}
          {viewMode === 'plan' && (
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
          <RosterVisual
            teamCapSheet={teamCapSheet}
            playersMap={playersMap}
            teamId={teamId}
          />
        )}
        {/* Keep your other tab renders as-is */}

        {activeTab === 'cap' &&
          (teamCapSheet?.players ? (
            <>
              <CapSheet
                teamCapSheet={teamCapSheet}
                currentYear={currentYear}
                onSelectPlayer={handleEditContract}
                playersMap={playersMap}
              />
              <ExceptionTracker
                teamCapSheet={teamCapSheet}
                currentYear={currentYear}
              />
            </>
          ) : (
            <div className="text-white/80 mt-4">Loading cap sheet...</div>
          ))}

        {activeTab === 'capfull' && (
          <CapSheetFull
            teamCapSheet={teamCapSheet}
            currentYear={currentYear}
            onSelectPlayer={handleEditContract}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'trade' && (
          <TradeEditor
            primaryTeam={teamId}
            capProjections={capProjections}
            currentYear={currentYear}
            playersMap={playersMap}
            onApplyTrade={applyTradeToCapSheet}
            primaryTeamData={teamCapSheet}
          />
        )}

        {activeTab === 'fa' && (
          <FreeAgentPool
            freeAgents={freeAgents}
            teamCapSheet={teamCapSheet}
            capProjections={capProjections}
            currentYear={currentYear}
            onSign={handleSign}
            playersMap={playersMap}
          />
        )}

        {activeTab === 'offseason' && (
          <OffseasonTab
            teamCapSheet={teamCapSheet}
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
          <TeamHistoryTab teamCapSheet={teamCapSheet} />
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
            setIsSaving(true);
            setError('');
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
            } catch (err) {
              console.error('Failed to save plan', err);
              setError('Failed to save plan');
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}

      {showContractModal && (
        <ContractEditorModal
          isOpen={showContractModal}
          onClose={() => setShowContractModal(false)}
          player={selectedPlayer}
          capProjections={capProjections}
          teamCapSheet={teamCapSheet}
          onSign={handleSign}
          playersMap={playersMap}
        />
      )}

      {viewMode === 'plan' && (
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
