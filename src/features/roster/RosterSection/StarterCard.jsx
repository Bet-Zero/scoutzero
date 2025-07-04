import React from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import { getPlayerPositionLabel } from '@/utils/roles';

const StarterCard = ({ player, onRemove, showRemove = true, isExport = false }) => {
  if (!player) return null;

  const headshot = player.headshot || '/default_headshot.png';

  return (
    <div className="relative overflow-visible p-[2px]">
      <div className="relative bg-gradient-to-br from-[#1e1e1e] to-[#111] border border-white/10 rounded-md overflow-hidden shadow-md flex flex-col w-40 h-60 text-base hover:shadow-xl transition-all duration-200">
        <div className="flex-1 relative">
          <img
            src={headshot}
            alt={player.name}
            className="w-full h-full object-cover"
          />
          {showRemove && (
            <button
              onClick={onRemove}
              className="absolute top-1 right-1 text-white/10 hover:text-white text-xs bg-black/10 rounded-sm px-[4px]"
            >
              ✕
            </button>
          )}
          <div
            className={`absolute top-1 left-1 px-1 py-[2px] bg-black/00 text-white/40 text-[16px] ${isExport ? 'font-normal' : 'font-semibold'} uppercase rounded-sm tracking-wider shadow-md`}
          >
            {getPlayerPositionLabel(player.bio?.Position)}
          </div>
        </div>
        <div className="bg-[#0f0f0f] px-2 pt-1 pb-2 h-[60px] flex flex-col items-center justify-center text-center border-t border-white/10">
          <PlayerNameMini
            name={player.display_name || player.name}
            firstWeightClass={isExport ? 'font-normal' : 'font-light'}
            lastWeightClass={isExport ? 'font-normal' : 'font-bold'}
          />
        </div>
      </div>
    </div>
  );
};

export default StarterCard;
