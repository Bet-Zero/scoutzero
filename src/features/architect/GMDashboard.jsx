import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  saveTeamCapSheet,
  loadTeamCapSheet,
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
import usePlayerData from '@/hooks/usePlayerData.js';

import capSettings from '@/utils/architect/capSettings';
import { teamOptions } from '@/utils/filtering';

const GMDashboard = () => {
  const { teamId } = useParams();
  const [teamCapSheet, setTeamCapSheet] = useState(null);
  const [otherTeamId, setOtherTeamId] = useState('');
  const [otherTeamCapSheet, setOtherTeamCapSheet] = useState(null);
  const [currentYear, setCurrentYear] = useState(2025);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [activeTab, setActiveTab] = useState('roster');
  const [lastCapSheet, setLastCapSheet] = useState(null);
  const [offseasonRun, setOffseasonRun] = useState(false);
  const [offseasonSummary, setOffseasonSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
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
      const loadedTeam = await loadTeamCapSheet(teamId);
      const loadedFA = await loadFreeAgents();
      if (loadedTeam) setTeamCapSheet(loadedTeam);
      else console.warn('No saved team found, using blank slate.');
      if (loadedFA.length > 0) setFreeAgents(loadedFA);
    };
    fetchData();
  }, [teamId]);

  useEffect(() => {
    if (teamCapSheet && !otherTeamId) {
      const fallback = teamOptions.find(
        (t) => t.toLowerCase() !== teamId.toLowerCase()
      );
      setOtherTeamId(fallback ? fallback.toLowerCase() : '');
    }
  }, [teamCapSheet, teamId, otherTeamId]);

  useEffect(() => {
    const loadOtherTeam = async () => {
      if (!otherTeamId || otherTeamId === teamId) return;
      const other = await loadTeamCapSheet(otherTeamId);
      if (other) setOtherTeamCapSheet(other);
    };
    loadOtherTeam();
  }, [otherTeamId, teamId]);

  useEffect(() => {
    if (teamCapSheet) saveTeamCapSheet(teamId, teamCapSheet);
  }, [teamCapSheet, teamId]);

  useEffect(() => {
    if (freeAgents.length > 0) saveFreeAgents(freeAgents);
  }, [freeAgents]);

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
          <>
            <div className="flex gap-2 items-center mb-4">
              <label className="text-sm text-white/60">Trade With:</label>
              <select
                value={otherTeamId}
                onChange={(e) => setOtherTeamId(e.target.value)}
                className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
              >
                {teamOptions
                  .filter((t) => t.toLowerCase() !== teamId.toLowerCase())
                  .sort()
                  .map((team) => (
                    <option key={team} value={team.toLowerCase()}>
                      {team}
                    </option>
                  ))}
              </select>
            </div>
            {otherTeamCapSheet ? (
              <TradeEditor
                teamA={teamCapSheet}
                teamB={otherTeamCapSheet}
                capSettings={capSettings}
                currentYear={currentYear}
              />
            ) : (
              <p className="text-sm text-white/60">Loading other team...</p>
            )}
          </>
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
    </div>
  );
};

export default GMDashboard;
