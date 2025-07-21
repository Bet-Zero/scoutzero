import React from 'react';
import TradeTeamBlock from './TradeTeamBlock';
import TradeSummary from './components/TradeSummary.jsx';
import useTradeMachine from './hooks/useTradeMachine.js';

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
    incomingAssets,
    capImpactByTeamIndex,
    addLabels,
    yearKey,
  } = useTradeMachine({ primaryTeam, capProjections, currentYear });

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-4">Trade Machine</h2>
      <div className="flex flex-col md:flex-row gap-6">
        {teams.map((t, idx) => (
          <TradeTeamBlock
            key={idx}
            team={t.team}
            sends={t.sends}
            picks={t.picksOut}
            incomingPlayers={incomingAssets[idx]?.players || []}
            incomingPicks={incomingAssets[idx]?.picks || []}
            yearKey={yearKey}
            capImpact={capImpactByTeamIndex[idx]}
            tradePartnerName={
              teams.length > 1 ? teams[idx === 0 ? 1 : 0]?.team?.teamName : ''
            }
            onSetPlayerTrade={(p, action) => setPlayerTrade(idx, p, action)}
            onTogglePick={(p) => togglePick(idx, p)}
            onEditPick={(p, field, value) => updatePickField(idx, p, field, value)}
            onSelectTeam={(teamId) => selectTeam(idx, teamId)}
            onRemove={() => removeTeam(idx)}
          />
        ))}
      </div>
      {teams.length < 5 && (
        <button
          onClick={addTeam}
          className="mt-2 bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm"
        >
          {addLabels[teams.length] || 'Add Team'}
        </button>
      )}
      <button
        onClick={handleValidate}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
      >
        Validate Trade
      </button>
      <label className="flex items-center gap-2 mt-2 text-sm">
        <input
          type="checkbox"
          checked={forceTrade}
          onChange={() => setForceTrade(!forceTrade)}
        />
        Force Trade (ignore validation)
      </label>
      <button
        onClick={exportCurrentTrade}
        className="mt-2 bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm"
      >
        Export Trade JSON
      </button>
      <TradeSummary result={result} teams={teams} forceTrade={forceTrade} />
    </div>
  );
};

export default TradeEditor;
