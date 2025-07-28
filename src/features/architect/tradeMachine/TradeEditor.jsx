import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTradeMachine } from '@/hooks/tradeMachine/useTradeMachine';
import TradeTeamCard from './TradeTeamCard';
import TradeSummaryPanel from './TradeSummaryPanel';
import TradeValidationPanel from './TradeValidationPanel';
import TradePreviewModal from './TradePreviewModal';
import '../../../utils/architect/tradeMachine/tradeValidator.debug'; // Add near other imports

const TradeEditor = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap = {},
  onApplyTrade,
  primaryTeamData = null,
}) => {
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
    undoPlayerTrade,
    resetTrade,
    yearKey,
    applyTradeException, // NEW: Added from useTradeMachine
  } = useTradeMachine(
    primaryTeam,
    capProjections,
    currentYear,
    primaryTeamData
  );

  const [previewOpen, setPreviewOpen] = useState(false);

  const incomingAssets = teams.map((tm, idx) => {
    const players = [];
    const picks = [];
    teams.forEach((t, j) => {
      if (j !== idx && t.team) {
        t.sends.forEach((p) => {
          if (!p.tradeTo || p.tradeTo === tm.team?.id) {
            players.push(p);
          }
        });
        t.picksOut.forEach((p) => {
          if (!p.toTeamId || p.toTeamId === tm.team?.id) {
            picks.push(p);
          }
        });
      }
    });
    return { players, picks };
  });

  const addLabels = {
    2: 'Add Team',
    3: 'Add Team',
    4: 'Add Team',
  };

  // NEW: Handle TPE application
  const handleApplyTradeException = (player, tpe) => {
    const teamIndex = teams.findIndex((t) => t.team?.id === tpe.teamId);
    if (teamIndex !== -1) {
      applyTradeException(teamIndex, player, tpe);
    }
  };

  return (
    <div className="text-white space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-2xl font-bold tracking-tight">Trade Machine</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              handleValidate();
              setPreviewOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-sm font-medium px-3 py-1.5 rounded"
          >
            Validate Trade
          </button>
          <button
            onClick={resetTrade}
            title="Reset Trade"
            className="text-white/70 hover:text-white"
          >
            <RotateCcw size={18} />
          </button>
          {teams.length < 5 && (
            <button
              onClick={addTeam}
              className="bg-neutral-700 hover:bg-neutral-600 text-sm px-3 py-1.5 rounded"
            >
              {addLabels[teams.length] || 'Add Team'}
            </button>
          )}
        </div>
      </div>

      {/* Team Cards */}
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}
      >
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
              playersMap={playersMap}
              onSetPlayerTrade={(p, action, dest) =>
                setPlayerTrade(idx, p, action, dest)
              }
              onTogglePick={(p) => togglePick(idx, p)}
              onEditPick={(p, field, value) =>
                updatePickField(idx, p, field, value)
              }
              onUndoPlayerTrade={undoPlayerTrade}
              onSelectTeam={(teamId) => selectTeam(idx, teamId)}
              onRemove={() => removeTeam(idx)}
              onApplyTradeException={handleApplyTradeException} // NEW PROP
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => {
            const tradeData = exportCurrentTrade();
            if (onApplyTrade && tradeData) {
              onApplyTrade(tradeData);
            }
          }}
          className="bg-green-600 hover:bg-green-700 text-sm font-medium px-3 py-1.5 rounded"
        >
          Apply Trade
        </button>
      </div>

      {/* Summary */}
      <TradeSummaryPanel
        result={result}
        teams={teams}
        forceTrade={forceTrade}
      />
      <TradeValidationPanel result={result} />
      <TradePreviewModal
        open={previewOpen && !!result}
        onClose={() => setPreviewOpen(false)}
        teams={teams}
        result={result}
        yearKey={yearKey}
      />
    </div>
  );
};

export default TradeEditor;
