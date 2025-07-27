// TradeTeamCard.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getTeamColors } from '@/utils/formatting';
import { getSalaryForYear, formatPick } from '@/utils/architect/tradeHelpers';
import { formatSalary } from '@/utils/formatting';
import CapImpactTiles from './CapImpactTiles';
import { SelectTeamCard } from './SelectTeamCard';
import { OutgoingPlayersList } from './OutgoingPlayersList';
import { OutgoingPicksList } from './OutgoingPicksList';
import TeamSelectDropdown from '@/components/shared/TeamSelectDropdown';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
    () => getTeamColors(team?.id),
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

  if (!team) {
    return <SelectTeamCard onSelectTeam={onSelectTeam} onRemove={onRemove} />;
  }

  return (
    <div
      className="flex-1 rounded-lg p-4 bg-[#111] relative space-y-4 shadow-inner border"
      style={{ borderColor: primary }}
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
        {/* Outgoing */}
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
                  key={p.id || p.name}
                  className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                >
                  {p.name}
                  {onUndoPlayerTrade && (
                    <button
                      onClick={() => onUndoPlayerTrade(p)}
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

        {/* Incoming */}
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
                  key={p.id || p.name}
                  className="bg-[#2a2a2a] text-white/90 text-[11px] px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1"
                >
                  {p.name}
                  {onUndoPlayerTrade && (
                    <button
                      onClick={() => onUndoPlayerTrade(p)}
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
        </div>
      </div>

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
      </div>

      {activeTab === 'players' && (
        <OutgoingPlayersList
          team={team}
          sends={sends}
          incomingPlayers={incomingPlayers}
          yearKey={yearKey}
          otherTeams={otherTeams}
          playersMap={playersMap}
          onSetPlayerTrade={onSetPlayerTrade}
          onUndoPlayerTrade={onUndoPlayerTrade}
        />
      )}

      {activeTab === 'picks' && (
        <OutgoingPicksList
          team={team}
          picks={picks}
          otherTeams={otherTeams}
          onTogglePick={onTogglePick}
          onEditPick={onEditPick}
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
              <div key={p.id || p.name} className="mb-1">
                • {p.name}
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
