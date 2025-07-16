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
} from '@/utils/architect/firebaseHelpers';

import RosterManager from './RosterManager';
import CapSheet from './CapSheet';
import CapSheetFull from './CapSheetFull';
import ContractEditor from './ContractEditor';
import TradeEditor from './TradeEditor';
import FreeAgentPool from './FreeAgentPool';
import OffseasonTab from './OffseasonTab';
import TeamHistoryTab from './TeamHistoryTab';
import ExceptionTracker from './ExceptionTracker';
import SavePlanModal from './SavePlanModal';
import usePlayerData from '@/hooks/usePlayerData.js';

import capSettings from '@/utils/architect/capSettings';

const GMDashboard = () => {
  const { teamId } = useParams();
  const userId = 'demoUser';
  const [baselineCapSheet, setBaselineCapSheet] = useState(null);
  const [teamCapSheet, setTeamCapSheet] = useState(null);
  const [otherTeamCapSheet] = useState(null);
  const [currentYear, setCurrentYear] = useState(2025);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [activeTab, setActiveTab] = useState('roster');
  const [lastCapSheet, setLastCapSheet] = useState(null);
  const [offseasonRun, setOffseasonRun] = useState(false);
  const [offseasonSummary, setOffseasonSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [viewMode, setViewMode] = useState('plan'); // 'plan' or 'baseline'
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const { players } = usePlayerData();

  const playersMap = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[p.display_name || p.name] = p;
    });
    return map;
  }, [players]);

  useEffect(() => {
    const fetchData = async () => {
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
    };
    fetchData();
  }, [teamId]);

  useEffect(() => {
    if (!teamCapSheet) return;
    if (viewMode === 'plan') {
      if (selectedPlan) {
        saveNamedTeamPlan(userId, teamId, selectedPlan, teamCapSheet);
      } else {
        saveUserTeamPlan(userId, teamId, teamCapSheet);
      }
    }
  }, [teamCapSheet, teamId, userId, selectedPlan, viewMode]);

  useEffect(() => {
    if (freeAgents.length > 0) saveFreeAgents(freeAgents);
  }, [freeAgents]);

  useEffect(() => {
    const loadPlan = async () => {
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
    };
    loadPlan();
  }, [viewMode, selectedPlan, baselineCapSheet, teamId, userId]);

  const handleSign = (playerName, contract) => {
    const newContract = {
      name: playerName,
      salaryByYear: contract.salaryByYear,
      years: Object.keys(contract.salaryByYear).length,
      options: contract.options,
      type: contract.signAndTrade ? 'Sign & Trade' : 'Signed FA',
      signAndTrade: contract.signAndTrade || false,
      guaranteed: contract.guaranteed,
      isMinimum: contract.isMinimum,
      yearsOfService: contract.yearsOfService,
    };

    setTeamCapSheet((prev) => ({
      ...prev,
      activeContracts: [...prev.activeContracts, newContract],
    }));
    setFreeAgents((prev) => prev.filter((p) => p.name !== playerName));
  };

  const handleEditContract = (player) => {
    setSelectedPlayer(player);
    setActiveTab('contract');
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
      mle: { amount: capSettings.mleAmount, used: 0 },
    };

    setTeamCapSheet(resetSheet);
    setOffseasonRun(false);
    setOffseasonSummary(null);
  };

  if (!teamCapSheet) return <p>Loading GM Dashboard...</p>;

  return (
    <div className="gm-dashboard px-6 py-4 text-white min-h-screen bg-[#0d0d0d]">
      <h1 className="text-3xl font-bold mb-6 border-b border-white/10 pb-2">
        HoopZero Architect – GM Dashboard
      </h1>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
        >
          <option value="plan">Plan</option>
          <option value="baseline">Baseline</option>
        </select>
        {viewMode === 'plan' && (
          <>
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
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-2 py-1 text-sm rounded bg-white/10 hover:bg-white/20"
            >
              Save As
            </button>
          </>
        )}
      </div>

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
          onClick={() => setActiveTab('contract')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'contract'
              ? 'bg-lakers/90 text-black'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Contract Editor
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
          <RosterManager
            teamCapSheet={teamCapSheet}
            currentYear={currentYear}
            onUpdateRoster={handleUpdateRoster}
            onEditContract={handleEditContract}
            playersMap={playersMap}
          />
        )}
        {/* Keep your other tab renders as-is */}

        {activeTab === 'cap' && (
          <>
            <CapSheet
              teamCapSheet={teamCapSheet.capSheet}
              capSettings={capSettings}
              currentYear={currentYear}
            />

            <ExceptionTracker
              teamCapSheet={teamCapSheet}
              currentYear={currentYear}
            />
          </>
        )}

        {activeTab === 'capfull' && (
          <CapSheetFull teamCapSheet={teamCapSheet.capSheet} />
        )}

        {activeTab === 'contract' &&
          (selectedPlayer ? (
            <ContractEditor
              player={selectedPlayer}
              capSettings={capSettings}
              teamCapSheet={teamCapSheet}
              onSign={handleSign}
            />
          ) : (
            <div className="text-white p-6 text-sm text-white/60">
              Select a player from the Roster to edit their contract.
            </div>
          ))}

        {activeTab === 'trade' && (
          <TradeEditor
            teamA={teamCapSheet}
            teamB={otherTeamCapSheet || teamCapSheet}
            capSettings={capSettings}
            currentYear={currentYear}
          />
        )}

        {activeTab === 'fa' && (
          <FreeAgentPool
            freeAgents={freeAgents}
            teamCapSheet={teamCapSheet}
            capSettings={capSettings}
            currentYear={currentYear}
            onSign={handleSign}
          />
        )}

        {activeTab === 'offseason' && (
          <OffseasonTab
            teamCapSheet={teamCapSheet}
            setTeamCapSheet={setTeamCapSheet}
            currentYear={currentYear}
            setCurrentYear={setCurrentYear}
            capSettings={capSettings}
            setLastCapSheet={setLastCapSheet}
            setOffseasonRun={setOffseasonRun}
            setOffseasonSummary={setOffseasonSummary}
            setShowModal={setShowModal}
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
          }}
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
