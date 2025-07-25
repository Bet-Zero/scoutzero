// TradeTeamCard.jsx

import React, { useState } from 'react';
import TeamLogo from '@/components/shared/TeamLogo';
import { getTeamColors } from '@/utils/formatting';
import {
  getSalaryForYear,
  formatPick,
  formatCurrency,
} from '@/utils/architect/tradeHelpers';
import CapImpactTiles from './CapImpactTiles';
import { SelectTeamCard } from './SelectTeamCard';
import { OutgoingPlayersList } from './OutgoingPlayersList';
import { OutgoingPicksList } from './OutgoingPicksList';

const TradeTeamCard = ({
  team,
  sends,
  picks,
  yearKey,
  otherTeams = [],
  playersMap = {},
  incomingPlayers = [],
  incomingPicks = [],
  capImpact = null,
  onSetPlayerTrade,
  onTogglePick,
  onEditPick,
  onSelectTeam,
  onRemove,
}) => {
  const [activeTab, setActiveTab] = useState('players');
  if (!team) {
    return <SelectTeamCard onSelectTeam={onSelectTeam} onRemove={onRemove} />;
  }

  const outgoingSalary = getSalaryForYear(sends, yearKey);
  const { primary } = getTeamColors(team.id);

  const playersCount =
    (team.players?.length || 0) - sends.length + incomingPlayers.length;
  const picksCount =
    (team.picks?.length || 0) - picks.length + incomingPicks.length;

  return (
    <div
      className="flex-1 rounded-lg p-4 bg-[#111] relative space-y-4 shadow-inner border"
      style={{ borderColor: primary }}
    >
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 text-red-400 text-xs"
        >
          ✕
        </button>
      )}

      {/* Team Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <TeamLogo teamAbbr={team.id} className="w-8 h-8" />
          <h3 className="text-lg font-semibold" style={{ color: primary }}>
            {team.teamName}
          </h3>
        </div>
        <div className="text-sm text-white/60">
          Outgoing Salary:{' '}
          <span className="font-medium">{formatCurrency(outgoingSalary)}</span>
        </div>
      </div>

      <CapImpactTiles
        team={team}
        sends={sends}
        incomingPlayers={incomingPlayers}
        yearKey={yearKey}
      />

      {/* Tabs */}
      <div className="flex gap-4 text-sm border-b border-white/10 pb-1">
        <button
          className={`pb-1 ${
            activeTab === 'players'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-white/60'
          }`}
          onClick={() => setActiveTab('players')}
        >
          Players ({playersCount})
        </button>
        <button
          className={`pb-1 ${
            activeTab === 'picks'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-white/60'
          }`}
          onClick={() => setActiveTab('picks')}
        >
          Picks ({picksCount})
        </button>
      </div>

      {/* Outgoing Players */}
      {activeTab === 'players' && (
        <OutgoingPlayersList
          team={team}
          sends={sends}
          yearKey={yearKey}
          otherTeams={otherTeams}
          playersMap={playersMap}
          onSetPlayerTrade={onSetPlayerTrade}
        />
      )}

      {/* Outgoing Picks */}
      {activeTab === 'picks' && (
        <OutgoingPicksList
          team={team}
          picks={picks}
          otherTeams={otherTeams}
          onTogglePick={onTogglePick}
          onEditPick={onEditPick}
        />
      )}

      {/* Incoming Summary */}
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
