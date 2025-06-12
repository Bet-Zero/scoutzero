// src/components/roster/PlayerCard.jsx
import React from 'react';
import PlayerNameMini from '@/features/table/PlayerNameMini';
import PlayerHeadshot from '@/components/shared/PlayerHeadshot';
import { getPlayerPositionLabel } from '@/utils/roles';

// PlayerCard – Clean visual core with full image + Anton name + position
const PlayerCard = ({ player, size = 'starter', onRemove }) => {
  if (!player) return null;

  const sizeClasses = {
    starter: 'w-40 h-60 text-base',
    rotation: 'w-32 h-48 text-sm',
    bench: 'w-28 h-40 text-xs',
  };

  const headshot = player.headshot || '/default_headshot.png';

  return (
    <div className="relative overflow-visible p-[2px]">
      <div
        className={
          (size === 'rotation'
            ? 'scale-[0.87]'
            : size === 'bench'
              ? 'scale-[0.77]'
              : 'scale-100') + ' transform origin-top will-change-transform'
        }
      >
        <div
          className={`relative bg-gradient-to-br from-[#1e1e1e] to-[#111] border border-white/10 rounded-md overflow-hidden shadow-md flex flex-col w-40 h-60 text-base hover:shadow-xl transition-all duration-200`}
        >
          {/* Full Image Area */}
          <div className="flex-1 relative">
            <PlayerHeadshot src={headshot} className="w-full h-full" />

            {/* Remove Button */}
            <button
              onClick={onRemove}
              className="absolute top-1 right-1 text-white/10 hover:text-white text-xs bg-black/10 rounded-sm px-[4px]"
            >
              ✕
            </button>

            {/* Position Tag (Top-Left Overlay) */}
            <div className="absolute top-1 left-1 px-1 py-[2px] bg-black/00 text-white/40 text-[16px] font-semibold uppercase rounded-sm tracking-wider shadow-md">
              {getPlayerPositionLabel(player.bio?.Position)}
            </div>
          </div>

          {/* Info Panel (Name Only – Locked Height) */}
          <div className="bg-[#0f0f0f] px-2 pt-1 pb-2 h-[60px] flex flex-col items-center justify-center text-center border-t border-white/10">
            <PlayerNameMini name={player.display_name || player.name} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
