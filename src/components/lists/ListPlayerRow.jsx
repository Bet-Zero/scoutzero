// ListPlayerRow.jsx
import React from 'react';
import PlayerRow from '@/components/table/PlayerRow';
import { ChevronUp, ChevronDown } from 'lucide-react';

const positionAbbreviations = {
  'Point Guard': 'PG',
  'Shooting Guard': 'SG',
  Guard: 'G',
  'Small Forward': 'SF',
  'Power Forward': 'PF',
  Forward: 'F',
  Center: 'C',
  'Forward-Center': 'F/C',
  'Guard-Forward': 'G/F',
  'Forward-Guard': 'F',
  'Center-Forward': 'C',
};

const calculateHeight = (ht = '0-0') => {
  const parts = ht.split('-');
  return parseInt(parts[0]) * 12 + parseInt(parts[1]);
};

const ListPlayerRow = ({
  player,
  index,
  note,
  onNoteChange,
  onMoveUp,
  onMoveDown,
}) => {
  const processedPlayer = {
    ...player,
    id: player.player_id,
    formattedPosition:
      player.formattedPosition ||
      positionAbbreviations[player.bio?.Position] ||
      '—',
    headshotUrl:
      player.headshotUrl || `/assets/headshots/${player.player_id}.png`,
    offenseRole: player.roles?.offense1 || player.offenseRole || '—',
    defenseRole: player.roles?.defense1 || player.defenseRole || '—',
    shootingProfile: player.shootingProfile || '—',
    PPG: player.PPG ?? player.system?.stats?.PTS ?? null,
    RPG: player.RPG ?? player.system?.stats?.TRB ?? null,
    APG: player.APG ?? player.system?.stats?.AST ?? null,
  };

  return (
    <div className="relative w-full max-w-[1100px] mx-auto mb-6">
      {/* Overlay Controls */}
      <div className="absolute -left-6 top-[22px] flex flex-col items-center z-10">
        <button
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          className="text-white/30 hover:text-white disabled:opacity-20"
        >
          <ChevronUp size={16} />
        </button>
        <div className="text-xs font-bold text-white/40">{index + 1}</div>
        <button
          onClick={() => onMoveDown(index)}
          disabled={false}
          className="text-white/30 hover:text-white disabled:opacity-20"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Player Row */}
      <PlayerRow player={processedPlayer} />

      {/* Optional Notes – commented out */}
      {/*
      <textarea
        value={note || ''}
        onChange={(e) => onNoteChange(player.id, e.target.value)}
        placeholder="Optional notes..."
        className="w-full mt-1 text-sm bg-neutral-800 text-white p-2 rounded border border-white/10 resize-none"
      />
      */}

      {/* Purple visual divider */}
      <div className="w-full h-[2px] bg-purple-800/30 rounded mt-3" />
    </div>
  );
};

export default ListPlayerRow;
