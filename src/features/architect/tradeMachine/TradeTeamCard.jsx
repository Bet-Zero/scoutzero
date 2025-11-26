import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getTeamColors } from '@/utils/formatting';
import capProjections from '@/utils/architect/capProjections';
import {
  getSalaryForYear,
  formatPick,
  calculateAllowableIncoming,
  getIncomingCeiling,
} from '@/utils/architect/tradeHelpers';
import { formatSalary } from '@/utils/formatting';
import CapImpactTiles from './CapImpactTiles';
import { SelectTeamCard } from './SelectTeamCard';
import { OutgoingPlayersList } from './OutgoingPlayersList';
import { OutgoingPicksList } from './OutgoingPicksList';
import TeamSelectDropdown from '@/components/shared/TeamSelectDropdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TradeExceptionManager from './TradeExceptionManager';
import {
  getTeamFaExceptionBuckets,
  isFaExceptionEligibleType,
} from '@/utils/architect/faExceptionUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import { getCapHitForSeason } from '@/utils/architect/tradeMachine/utils/seasonUtils.js';
import { toSeasonKey } from '@/utils/architect/seasonUtils';

const TradeTeamCard = ({
  team,
  sends,
  picks,
  yearKey,
  otherTeams = [],
  playersMap = {},
  incomingPlayers = [],
  incomingPicks = [],
  onSetPlayerTrade,
  onUndoPlayerTrade,
  onTogglePick,
  onEditPick,
  onSelectTeam,
  onRemove,
  onApplyTradeException,
}) => {
  const [activeTab, setActiveTab] = useState('players');
  const [editingTeam, setEditingTeam] = useState(false);
  const [showOutgoing, setShowOutgoing] = useState(false);
  const [showIncoming, setShowIncoming] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    if (editingTeam && selectRef.current) {
      selectRef.current.focus();
      if (typeof selectRef.current.showPicker === 'function') {
        selectRef.current.showPicker();
      } else {
        selectRef.current.click();
      }
    }
  }, [editingTeam]);

  // Filter available players (not in sends)
  const availablePlayers = useMemo(
    () =>
      (team?.players || []).filter(
        (p) => !sends.some((s) => s.player_id === p.player_id)
      ),
    [team?.players, sends]
  );

  // Filter incoming players (not already on team)
  const filteredIncomingPlayers = useMemo(
    () =>
      incomingPlayers.filter(
        (p) => !team?.players?.some((tp) => tp.player_id === p.player_id)
      ),
    [incomingPlayers, team?.players]
  );

  // Calculate team total salary for the current year
  const teamTotalSalary = useMemo(
    () => getSalaryForYear(team?.players || [], yearKey),
    [team?.players, yearKey]
  );

  // Memoized calculations
  const outgoingSalary = useMemo(
    () => getSalaryForYear(sends, yearKey),
    [sends, yearKey]
  );

  const incomingSalary = useMemo(
    () => getSalaryForYear(incomingPlayers, yearKey),
    [incomingPlayers, yearKey]
  );

  const { primary, secondary } = useMemo(
    () => getTeamColors(team?.id) || {},
    [team?.id]
  );

  const playersCount = useMemo(
    () => (team?.players?.length || 0) - sends.length + incomingPlayers.length,
    [team, sends, incomingPlayers]
  );

  const picksCount = useMemo(
    () => (team?.picks?.length || 0) - picks.length + incomingPicks.length,
    [team, picks, incomingPicks]
  );

  const capSettings = useMemo(() => {
    // yearKey is already the end-year (e.g., 2025), convert to season format: "2024-25"
    const key = toSeasonKey(yearKey);
    return capProjections[key] || {};
  }, [yearKey]);

  const faBuckets = useMemo(
    () => getTeamFaExceptionBuckets(team || {}),
    [team]
  );

  const allowableIncoming = useMemo(
    () =>
      team
        ? calculateAllowableIncoming(
            teamTotalSalary,
            outgoingSalary,
            incomingPlayers,
            team.tradeExceptions || [],
            { ...capSettings, yearKey }
          )
        : 0,
    [teamTotalSalary, outgoingSalary, incomingPlayers, capSettings, yearKey]
  );

  // Allowable Incoming for display (excluding TPEs)
  const allowableIncomingNoTPE = useMemo(
    () =>
      team
        ? getIncomingCeiling(
            teamTotalSalary,
            outgoingSalary,
            [], // Exclude TPEs from calculation
            capSettings,
            yearKey
          )
        : 0,
    [teamTotalSalary, outgoingSalary, capSettings, yearKey]
  );

  const tpeEligiblePlayers = useMemo(() => {
    if (!team) return [];
    const seasonKey =
      typeof yearKey === 'string' && yearKey.includes('-')
        ? yearKey
        : toSeasonKey(yearKey);

    return incomingPlayers.filter((player) => {
      const playerSalary = getCapHitForSeason(player, seasonKey) || 0;
      return (team.tradeExceptions || []).some(
        (tpe) =>
          !tpe.isUsed &&
          playerSalary <= tpe.amount &&
          (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
      );
    });
  }, [incomingPlayers, team?.tradeExceptions, yearKey]);

  // Modified player trade handler to support multiple selections
  // Replace the existing handleSetPlayerTrade with:
  const handleSetPlayerTrade = (player, action, targetTeamId, tpe) => {
    if (onSetPlayerTrade) {
      onSetPlayerTrade(player, action, targetTeamId, tpe);
    }
  };

  // Modified undo trade handler
  const handleUndoPlayerTrade = (player) => {
    if (onUndoPlayerTrade) {
      onUndoPlayerTrade(player);
    }
  };

  if (!team) {
    return <SelectTeamCard onSelectTeam={onSelectTeam} onRemove={onRemove} />;
  }

  return (
    <div
      className="flex-1 rounded-lg p-4 bg-[#111] relative space-y-4 shadow-inner border"
      style={{ borderColor: primary || 'transparent' }}
    >
      {/* Team Header */}
      <div className="relative flex items-center justify-between border-b border-white/10 pb-2">
        <div className="w-48">
          <TeamSelectDropdown
            selectedTeamId={team.id}
            onChange={(newId) => {
              setEditingTeam(false);
              onSelectTeam(newId);
            }}
          />
        </div>

        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute -top-[8px] -right-[8px] text-white/20 text-xs p-0 leading-none hover:text-white/50"
            title="Remove team"
          >
            ✕
          </button>
        )}
      </div>

      <CapImpactTiles
        team={team}
        sends={sends}
        incomingPlayers={incomingPlayers}
        yearKey={yearKey}
      />

      <div className="space-y-1">
        {/* Outgoing section */}
        <div>
          <button
            onClick={() => setShowOutgoing((prev) => !prev)}
            className="w-full text-left bg-[#1c1c1c] px-3 py-1.5 rounded border border-white/10 hover:border-neutral-500 text-sm flex justify-between items-center text-white/80"
          >
            <span>Outgoing Salary: {formatSalary(outgoingSalary)}</span>
            {showOutgoing ? (
              <ChevronUp size={14} className="opacity-60" />
            ) : (
              <ChevronDown size={14} className="opacity-60" />
            )}
          </button>

          {showOutgoing && (
            <div className="flex flex-wrap gap-2 mt-1 px-1">
              {sends.map((p) => (
                <span
                  key={p.player_id || p.id}
                  className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                >
                  {p.name}
                  {onUndoPlayerTrade && (
                    <button
                      onClick={() => handleUndoPlayerTrade(p)}
                      className="ml-1 text-white/50 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {picks
                .filter((p) => p.fromTeamId === team.id)
                .map((p) => (
                  <span
                    key={`${p.year}-${p.round}-${p.via || ''}`}
                    className="bg-[#2a2a2a] text-white/70 text-[11px] px-2 py-0.5 rounded-full border border-white/10"
                  >
                    {formatPick(p)}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Incoming section */}
        <div>
          <button
            onClick={() => setShowIncoming((prev) => !prev)}
            className="w-full text-left bg-[#1c1c1c] px-3 py-1.5 rounded border border-white/10 hover:border-neutral-500 text-sm flex justify-between items-center text-white/80"
          >
            <span>Incoming Salary: {formatSalary(incomingSalary)}</span>
            {showIncoming ? (
              <ChevronUp size={14} className="opacity-60" />
            ) : (
              <ChevronDown size={14} className="opacity-60" />
            )}
          </button>

          {showIncoming && (
            <div className="flex flex-wrap gap-2 mt-1 px-1">
              {incomingPlayers.map((p) => (
                <span
                  key={p.player_id || p.id}
                  className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                >
                  {p.name}
                  {onUndoPlayerTrade && (
                    <button
                      onClick={() => handleUndoPlayerTrade(p)}
                      className="ml-1 text-white/50 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {incomingPicks.map((p) => (
                <span
                  key={`${p.year}-${p.round}-${p.via || ''}`}
                  className="bg-[#2a2a2a] text-white/70 text-[11px] px-2 py-0.5 rounded-full border border-white/10"
                >
                  {formatPick(p)}
                </span>
              ))}
            </div>
          )}
          {/* Show Allowable Incoming and TPEs side-by-side */}
          <div className="flex flex-wrap gap-4 text-xs text-white/60 mt-1 items-center">
            <div>
              Allowable Incoming:{' '}
              <span className="font-semibold text-white/80">
                {formatSalary(allowableIncomingNoTPE)}
              </span>
            </div>
            {team?.tradeExceptions?.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-white/60">Available TPEs:</span>
                {team.tradeExceptions
                  .filter(
                    (tpe) =>
                      !tpe.isUsed &&
                      (!tpe.expirationDate ||
                        new Date(tpe.expirationDate) > new Date())
                  )
                  .map((tpe, idx) => {
                    // Format amount as $11.1M style
                    const millions = tpe.amount / 1000000;
                    const formattedAmount = `$${millions.toFixed(1)}M`;
                    return (
                      <span
                        key={idx}
                        className="bg-[#2a2a2a] text-white/80 px-2 py-0.5 rounded-full border border-white/10"
                      >
                        {formattedAmount}
                        {tpe.expirationDate && (
                          <span className="ml-1 text-white/40">
                            exp.{' '}
                            {new Date(tpe.expirationDate).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    );
                  })}
                {team.tradeExceptions.filter(
                  (tpe) =>
                    !tpe.isUsed &&
                    (!tpe.expirationDate ||
                      new Date(tpe.expirationDate) > new Date())
                ).length === 0 && <span className="text-white/40">None</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 text-sm border-b border-white/10 pb-1">
        <button
          className={`pb-1 ${
            activeTab === 'players' ? 'text-white border-b-2' : 'text-white/60'
          }`}
          style={activeTab === 'players' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('players')}
        >
          Players ({playersCount})
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'picks' ? 'text-white border-b-2' : 'text-white/60'
          }`}
          style={activeTab === 'picks' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('picks')}
        >
          Picks ({picksCount})
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'exceptions'
              ? 'text-white border-b-2'
              : 'text-white/60'
          }`}
          style={activeTab === 'exceptions' ? { borderColor: primary } : {}}
          onClick={() => setActiveTab('exceptions')}
        >
          Exceptions ({team.tradeExceptions?.length || 0})
        </button>
      </div>

      {activeTab === 'players' && (
        <OutgoingPlayersList
          team={team}
          players={availablePlayers}
          sends={sends}
          incomingPlayers={filteredIncomingPlayers}
          yearKey={yearKey}
          otherTeams={otherTeams}
          playersMap={playersMap}
          onSetPlayerTrade={handleSetPlayerTrade}
          onUndoPlayerTrade={handleUndoPlayerTrade}
          tradeExceptions={team.tradeExceptions}
        />
      )}

      {activeTab === 'picks' && (
        <OutgoingPicksList
          team={team}
          picks={picks}
          incomingPicks={incomingPicks}
          otherTeams={otherTeams}
          onTogglePick={onTogglePick}
          onEditPick={onEditPick}
        />
      )}

      {activeTab === 'exceptions' && team.tradeExceptions?.length > 0 && (
        <TradeExceptionManager
          exceptions={team.tradeExceptions}
          teamId={team.id}
          eligiblePlayers={tpeEligiblePlayers}
          onApplyException={(tpe) => {
            if (tpeEligiblePlayers.length > 0) {
              onApplyTradeException(tpeEligiblePlayers[0], tpe);
            }
          }}
        />
      )}

      {(incomingPlayers.length > 0 || incomingPicks.length > 0) && (
        <div
          className="bg-[#222] border rounded p-3 text-sm"
          style={{ borderColor: primary }}
        >
          <h4 className="text-white/70 text-sm mb-2">Incoming</h4>
          <div className="text-white/90">
            {incomingPlayers.map((p) => (
              <div
                key={p.player_id || p.id}
                className="mb-1 flex items-center gap-2"
              >
                <span>• {p.name}</span>
                {validationFlags.faExceptionTrade !== 'off' && (
                  <>
                    <select
                      className="bg-[#333] text-xs rounded px-1"
                      value={p.absorptionMode || 'MATCH'}
                      onChange={(e) =>
                        onSetPlayerTrade &&
                        onSetPlayerTrade(p, 'setAbsorptionMode', e.target.value)
                      }
                    >
                      <option value="MATCH">Matching</option>
                      <option value="TPE">TPE</option>
                      <option value="FA_EXCEPTION">FA Exception</option>
                    </select>
                    {p.absorptionMode === 'FA_EXCEPTION' && (
                      <select
                        className="bg-[#333] text-xs rounded px-1"
                        value={p.bucketType || ''}
                        onChange={(e) =>
                          onSetPlayerTrade &&
                          onSetPlayerTrade(p, 'setFaBucket', e.target.value)
                        }
                      >
                        {faBuckets
                          .filter((b) =>
                            isFaExceptionEligibleType(b.type, validationFlags)
                          )
                          .map((b) => (
                            <option key={b.type} value={b.type}>
                              {b.type} (${b.remaining})
                            </option>
                          ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            ))}
            {incomingPicks.map((p) => (
              <div key={`${p.year}-${p.round}-${p.via || ''}`}>
                • {formatPick(p)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTeamCard;
