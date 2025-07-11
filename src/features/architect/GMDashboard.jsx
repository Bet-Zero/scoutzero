import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { saveTeamCapSheet, loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';

import RosterManager from './RosterManager';
import CapSheet from './CapSheet';
import CapSheetFull from './CapSheetFull';
import ContractEditor from './ContractEditor';
import TradeEditor from './TradeEditor';
import OffseasonTab from './OffseasonTab';
import TeamHistoryTab from './TeamHistoryTab';
import ExceptionTracker from './ExceptionTracker';
import usePlayerData from '@/hooks/usePlayerData.js';

import capSettings from '@/utils/architect/capSettings';

const GMDashboard = () => {
  const { teamId } = useParams();
  const [teamCapSheet, setTeamCapSheet] = useState(null);
  const [otherTeamCapSheet] = useState(null);
  const [currentYear, setCurrentYear] = useState(2025);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
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
      const loadedCapSheet = await loadTeamCapSheet(teamId);
      if (loadedCapSheet) setTeamCapSheet(loadedCapSheet);
      else console.warn('No saved team found, using blank slate.');
    };
    fetchData();
  }, [teamId]);

  useEffect(() => {
    if (teamCapSheet) saveTeamCapSheet(teamId, teamCapSheet);
  }, [teamCapSheet, teamId]);


  const handleSign = (playerName, contract) => {
    const newContract = {
      name: playerName,
      contract_clean: contract,
      type: contract.signAndTrade ? 'Sign & Trade' : 'Signed FA',
      signAndTrade: contract.signAndTrade || false,
    };

    setTeamCapSheet((prev) => ({
      ...prev,
      players: [...prev.players, newContract],
    }));
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
      players: [],
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
            playersMap={playersMap}
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
            teamB={otherTeamCapSheet || teamCapSheet}
            capSettings={capSettings}
            currentYear={currentYear}
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
