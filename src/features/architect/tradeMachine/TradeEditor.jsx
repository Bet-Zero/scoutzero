import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import TradeTeamCard from './TradeTeamCard';
import TradePreviewModal from './TradePreviewModal';
import ValidationStateHeader from './ValidationStateHeader';
import ValidationDetailsPanel from './ValidationDetailsPanel';
// import TradeDebugPanel from './TradeDebugPanel';

const TradeEditor = ({
  primaryTeam,
  capProjections,
  currentYear,
  playersMap = {},
  onApplyTrade,
  primaryTeamData = null,
  onEditContract,
  worldId = null, // World ID for world-aware team loading
}) => {
  const {
    teams,
    result,
    forceTrade,
    // setForceTrade,
    setPlayerTrade,
    togglePick,
    // Phase 11.1: Destructure entitlement toggle for trading
    toggleEntitlement,
    updatePickField,
    selectTeam,
    addTeam,
    removeTeam,
    handleValidate,
    exportCurrentTrade,
    undoPlayerTrade,
    resetTrade,
    yearKey,
    applyTradeException,
    incomingAssets: hookIncomingAssets,
    // P0-3: Track validation in-flight state
    isValidating,
    // P2: Expose salaryOut for TradeSalaryCalculator
    salaryOut,
    // Stale validation fix: Use hasCurrentValidation instead of result check
    hasCurrentValidation,
    getValidatedAt,
  } = useTradeMachine(
    primaryTeam,
    capProjections,
    currentYear,
    primaryTeamData,
    worldId
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  // P2: Track which team's calculator to show (0 = primary team by default)
  const [calculatorTeamIndex, setCalculatorTeamIndex] = useState(0);

  // Stale validation fix: hasCurrentValidation now comes from hook
  // It properly checks if validation result matches current draft configuration

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

  // Handle TPE application
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

      {/* Task A: Mode + Validation State Header */}
      {/* Stale validation fix: Uses hasCurrentValidation to only show "Validated" 
          when result matches current draft configuration */}
      <ValidationStateHeader
        hasValidatorResult={hasCurrentValidation}
        isValidating={isValidating}
        validatedAt={getValidatedAt()}
      />

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
              validationResult={hasCurrentValidation ? result : null}
              teamIndex={idx}
              team={t.team}
              sends={t.sends}
              picks={t.picksOut}
              // Phase 11.1: Pass entitlement toggle and selection state
              entitlementsOut={t.entitlementsOut || []}
              onToggleEntitlement={(e) => toggleEntitlement(idx, e)}
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
              onApplyTradeException={handleApplyTradeException}
              onEditContract={onEditContract}
              // P0-3: Pass validation in-flight state
              isValidating={isValidating}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => {
            // Block trade application if validation fails and not forced
            if (!forceTrade && result && !result.legal) {
              alert(
                'Cannot apply trade: ' +
                  (result.reason || 'Trade validation failed')
              );
              return;
            }

            const tradeData = exportCurrentTrade();
            if (onApplyTrade && tradeData) {
              onApplyTrade(tradeData);
            }
          }}
          disabled={!forceTrade && result && !result.legal}
          className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
            !forceTrade && result && !result.legal
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          Apply Trade
        </button>

        {!forceTrade && result && !result.legal && (
          <span className="text-red-400 text-xs">
            Trade blocked: {result.reason || 'Validation failed'}
          </span>
        )}
      </div>

      {/* Tasks B, C, D, E: Validation Details Panel with hard-gating and mode tags */}
      {/* Stale validation fix: Uses hasCurrentValidation for proper gating */}
      <ValidationDetailsPanel
        hasValidatorResult={hasCurrentValidation}
        isValidating={isValidating}
        result={result}
        teams={teams}
        forceTrade={forceTrade}
        calculatorTeamIndex={calculatorTeamIndex}
        incomingAssets={incomingAssets}
        salaryOut={salaryOut}
        capProjections={capProjections}
        yearKey={yearKey}
        onCalculatorTeamChange={setCalculatorTeamIndex}
      />

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
