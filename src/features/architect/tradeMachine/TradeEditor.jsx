import React, { useState, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import TradeTeamCard from './TradeTeamCard';
import TradePreviewModal from './TradePreviewModal';
import ValidationStateHeader from './ValidationStateHeader';
import ValidationDetailsPanel from './ValidationDetailsPanel';
import { EntitlementEditorModal } from '@/features/architect/admin/EntitlementEditorModal';
import { isEntitlementAuthoringEnabled } from '@/features/architect/utils/entitlements/entitlementWriter';
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
  userId = null,
}) => {
  const {
    teams,
    result,
    forceTrade,
    // setForceTrade,
    setPlayerTrade,
    // Phase 14.2: Removed togglePick and updatePickField - draft assets are entitlements-only
    // Phase 11.1: Destructure entitlement toggle for trading
    toggleEntitlement,
    // Phase 17: Destructure destination setter for multi-team entitlement routing
    setEntitlementDestination,
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
    // Phase 16.3: Expose init error for UI error surfacing
    initError,
    // Phase 17: Active team count for multi-team destination logic
    activeTeamCount,
    // TM-4: Apply entitlement overrides to local state
    applyEntitlementOverrideUpdate,
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
  const [entitlementEditorState, setEntitlementEditorState] = useState(null);

  const canEditEntitlements = isEntitlementAuthoringEnabled();

  // Stale validation fix: hasCurrentValidation now comes from hook
  // It properly checks if validation result matches current draft configuration

  // Phase 14.2: incomingAssets now uses entitlementsOut instead of picksOut
  // Phase 17: Updated to require toTeamId for 3+ team trades (same logic as hook)
  const incomingAssets = teams.map((tm, idx) => {
    const players = [];
    const entitlements = [];
    teams.forEach((t, j) => {
      if (j !== idx && t.team) {
        t.sends.forEach((p) => {
          if (!p.tradeTo || p.tradeTo === tm.team?.id) {
            players.push(p);
          }
        });
        // Phase 17: For 3+ team trades, require explicit toTeamId
        // For 2-team trades, allow broadcast fallback (backward compatibility)
        (t.entitlementsOut || []).forEach((e) => {
          const isMultiTeamTrade = activeTeamCount > 2;
          if (isMultiTeamTrade) {
            // 3+ teams: only include if explicitly routed to this team
            if (e.toTeamId === tm.team?.id) {
              entitlements.push(e);
            }
          } else {
            // 2 teams: allow broadcast fallback for backward compatibility
            if (!e.toTeamId || e.toTeamId === tm.team?.id) {
              entitlements.push(e);
            }
          }
        });
      }
    });
    return { players, entitlements };
  });

  const addLabels = {
    2: 'Add Team',
    3: 'Add Team',
    4: 'Add Team',
  };

  // Phase 12.3B: Merge pickRulesById from all team slots for projection layer
  const mergedPickRulesById = useMemo(() => {
    const merged = {};
    for (const slot of teams) {
      if (slot?.team?.pickRulesById) {
        Object.assign(merged, slot.team.pickRulesById);
      }
    }
    return merged;
  }, [teams]);

  // Handle TPE application
  const handleApplyTradeException = (player, tpe) => {
    const teamIndex = teams.findIndex((t) => t.team?.id === tpe.teamId);
    if (teamIndex !== -1) {
      applyTradeException(teamIndex, player, tpe);
    }
  };

  const handleEditEntitlement = (entitlement) => {
    if (!canEditEntitlements) {
      toast.error('Entitlement authoring is disabled.');
      return;
    }
    if (!worldId) {
      toast.error('Select an active world to edit entitlements.');
      return;
    }
    if (!userId) {
      toast.error('Sign in to edit entitlements.');
      return;
    }

    const entitlementId = entitlement?.id || entitlement?.entitlementId;
    if (!entitlementId) {
      toast.error('Missing entitlement ID.');
      return;
    }

    setEntitlementEditorState({
      entitlementId,
      initialDocument: entitlement,
    });
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

      {/* Phase 16.3: Init error display */}
      {initError && teams.length === 0 && (
        <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 text-red-200">
          <div className="font-semibold text-red-100 mb-1">
            Trade Machine failed to initialize.
          </div>
          <div className="text-sm mb-2">{initError}</div>
          <div className="text-xs text-red-300/70">
            Check console for [tradeMachine:init] error.
          </div>
        </div>
      )}

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
              // Phase 14.2: Removed picks prop - draft assets are entitlements-only
              // Phase 11.1: Pass entitlement toggle and selection state
              entitlementsOut={t.entitlementsOut || []}
              onToggleEntitlement={(e) => toggleEntitlement(idx, e)}
              // Phase 17: Pass destination setter for multi-team entitlement routing
              onSetEntitlementDestination={(entitlementId, toTeamId) =>
                setEntitlementDestination(idx, entitlementId, toTeamId)
              }
              onEditEntitlement={
                canEditEntitlements ? handleEditEntitlement : null
              }
              incomingPlayers={incomingAssets[idx]?.players || []}
              // Phase 14.2: Incoming entitlements instead of incoming picks
              incomingEntitlements={incomingAssets[idx]?.entitlements || []}
              yearKey={yearKey}
              otherTeams={otherTeams}
              playersMap={playersMap}
              onSetPlayerTrade={(p, action, dest) =>
                setPlayerTrade(idx, p, action, dest)
              }
              // Phase 14: Removed onTogglePick and onEditPick (legacy picks UI removed)
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
        pickRulesById={mergedPickRulesById}
      />

      <TradePreviewModal
        open={previewOpen && !!result}
        onClose={() => setPreviewOpen(false)}
        teams={teams}
        result={result}
        yearKey={yearKey}
      />

      {entitlementEditorState && (
        <EntitlementEditorModal
          worldId={worldId}
          entitlementId={entitlementEditorState.entitlementId}
          initialDocument={entitlementEditorState.initialDocument}
          userId={userId}
          onClose={() => setEntitlementEditorState(null)}
          onSuccess={({ entitlementId, document }) => {
            applyEntitlementOverrideUpdate(entitlementId, document);
            setEntitlementEditorState(null);
          }}
        />
      )}
    </div>
  );
};

export default TradeEditor;
