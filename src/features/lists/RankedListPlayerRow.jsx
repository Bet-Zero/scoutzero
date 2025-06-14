// RankedListPlayerRow.jsx
import React from 'react';
import PlayerRow from '@/features/table/PlayerRow';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { POSITION_MAP } from '@/utils/roles';

const RankedListPlayerRow = ({
  player,
  index,
  note,
  onNoteChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  showReorder = true,
}) => {
  const processedPlayer = {
    ...player,
    id: player.player_id,
    formattedPosition:
      player.formattedPosition || POSITION_MAP[player.bio?.Position] || '—',
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
      {/* Reorder Arrows */}
      {showReorder && (
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
            className="text-white/30 hover:text-white disabled:opacity-20"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* X button – top-left */}
      {showReorder && (
        <div className="absolute top-0 left-0.5 z-10">
          <button
            onClick={() => onRemove(index)}
            title="Remove from List"
            className="text-[#1e1e1e] hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Player Row */}
      <PlayerRow player={processedPlayer} />

      {/* Optional Notes */}
      {/*
      <textarea
        value={note || ''}
        onChange={(e) => onNoteChange(player.id, e.target.value)}
        placeholder="Optional notes..."
        className="w-full mt-1 text-sm bg-neutral-800 text-white p-2 rounded border border-white/10 resize-none"
      />
      */}

      {/* Divider */}
      <div className="w-full h-[2px] bg-purple-800/30 rounded mt-3" />
    </div>
  );
};

export default RankedListPlayerRow;
