// TradeEditor.jsx

import React from 'react';
import { useTradeMachine } from '@/hooks/tradeMachine/useTradeMachine';
import TradeTeamCard from './TradeTeamCard';
import TradeSummaryPanel from './TradeSummaryPanel';

const TradeEditor = ({ primaryTeam, capProjections, currentYear }) => {
  const {
    teams,
    result,
    forceTrade,
    setForceTrade,
    setPlayerTrade,
    togglePick,
    updatePickField,
    selectTeam,
    addTeam,
    removeTeam,
    handleValidate,
    exportCurrentTrade,
    resetTrade,
    yearKey,
  } = useTradeMachine(primaryTeam, capProjections, currentYear);

  const incomingAssets = teams.map((_, idx) => {
    const players = [];
    const picks = [];
    teams.forEach((t, j) => {
      if (j !== idx) {
        players.push(...t.sends);
        picks.push(...t.picksOut);
      }
    });
    return { players, picks };
  });

  const addLabels = {
    2: 'Add 3rd Team',
    3: 'Add 4th Team',
    4: 'Add 5th Team',
  };

  return (
    <div className="text-white space-y-6">
      <h2 className="text-2xl font-bold tracking-tight border-b border-white/10 pb-2">
        Trade Machine
      </h2>

      {/* Team Cards */}
      <div className="flex flex-col md:flex-row flex-wrap gap-6">
        {teams.map((t, idx) => {
          const otherTeams = teams
            .filter((_, j) => j !== idx && teams[j].team)
            .map((tm) => tm.team);
          return (
            <TradeTeamCard
              key={idx}
              team={t.team}
              sends={t.sends}
              picks={t.picksOut}
              incomingPlayers={incomingAssets[idx]?.players || []}
              incomingPicks={incomingAssets[idx]?.picks || []}
              yearKey={yearKey}
              otherTeams={otherTeams}
              onSetPlayerTrade={(p, action) => setPlayerTrade(idx, p, action)}
              onTogglePick={(p) => togglePick(idx, p)}
              onEditPick={(p, field, value) =>
                updatePickField(idx, p, field, value)
              }
              onSelectTeam={(teamId) => selectTeam(idx, teamId)}
              onRemove={() => removeTeam(idx)}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {teams.length < 5 && (
          <button
            onClick={addTeam}
            className="bg-neutral-700 hover:bg-neutral-600 text-sm px-3 py-1.5 rounded"
          >
            {addLabels[teams.length] || 'Add Team'}
          </button>
        )}

        <button
          onClick={handleValidate}
          className="bg-blue-600 hover:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded"
        >
          Validate Trade
        </button>

        <button
          onClick={resetTrade}
          className="bg-red-700 hover:bg-red-800 text-sm font-medium px-3 py-1.5 rounded"
        >
          Reset
        </button>

        <button
          onClick={exportCurrentTrade}
          className="bg-neutral-800 hover:bg-neutral-700 text-sm px-3 py-1.5 rounded"
        >
          Export Trade JSON
        </button>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={forceTrade}
            onChange={() => setForceTrade(!forceTrade)}
          />
          Force Trade (ignore validation)
        </label>
      </div>

      {/* Summary */}
      <TradeSummaryPanel
        result={result}
        teams={teams}
        forceTrade={forceTrade}
      />
    </div>
  );
};

export default TradeEditor;
