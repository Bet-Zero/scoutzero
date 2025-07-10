import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  saveTeamCapSheet,
  loadTeamCapSheet,
  saveFreeAgents,
  loadFreeAgents,
} from '../utils/firebaseHelpers';

import RosterManager from './RosterManager';
import CapSheet from './CapSheet';
import CapSheetFull from './CapSheetFull';
import ContractEditor from './ContractEditor';
import TradeEditor from './TradeEditor';
import FreeAgentPool from './FreeAgentPool';
import OffseasonTab from './OffseasonTab';
import TeamHistoryTab from './TeamHistoryTab';
import ExceptionTracker from './ExceptionTracker';

import capSettings from '../utils/capSettings';
import initialFreeAgents from '../data/freeAgents';
import initialTeamA from '../data/teamLakers';
import initialTeamB from '../data/teamKnicks';

const GMDashboard = () => {
  const { teamId } = useParams();
  const [teamCapSheet, setTeamCapSheet] = useState(null);
  const [otherTeamCapSheet] = useState(initialTeamB);
  const [currentYear, setCurrentYear] = useState(2025);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [activeTab, setActiveTab] = useState('roster');
  const [lastCapSheet, setLastCapSheet] = useState(null);
  const [offseasonRun, setOffseasonRun] = useState(false);
  const [offseasonSummary, setOffseasonSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);

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
    <div className="gm-dashboard">
      <h1>HoopZero Architect – GM Dashboard</h1>

      <div className="tab-bar">
        <button onClick={() => setActiveTab('roster')}>Roster</button>
        <button onClick={() => setActiveTab('cap')}>Cap Sheet</button>
        <button onClick={() => setActiveTab('capfull')}>Full Cap Table</button>
        <button onClick={() => setActiveTab('contract')}>
          Contract Editor
        </button>
        <button onClick={() => setActiveTab('trade')}>Trade Machine</button>
        <button onClick={() => setActiveTab('fa')}>Free Agency</button>
        <button onClick={() => setActiveTab('offseason')}>Offseason</button>
        <button onClick={() => setActiveTab('history')}>Team History</button>
      </div>

      <div className="tab-content">
        {activeTab === 'roster' && (
          <RosterManager
            teamCapSheet={teamCapSheet}
            currentYear={currentYear}
            onUpdateRoster={handleUpdateRoster}
            onEditContract={handleEditContract}
          />
        )}

        {activeTab === 'cap' && (
          <>
            <CapSheet
              teamCapSheet={teamCapSheet}
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
          <CapSheetFull teamCapSheet={teamCapSheet} />
        )}

        {activeTab === 'contract' && selectedPlayer && (
          <ContractEditor
            player={selectedPlayer}
            capSettings={capSettings}
            teamCapSheet={teamCapSheet}
            onSign={handleSign}
          />
        )}

        {activeTab === 'trade' && (
          <TradeEditor
            teamA={teamCapSheet}
            teamB={otherTeamCapSheet}
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
    </div>
  );
};

export default GMDashboard;
