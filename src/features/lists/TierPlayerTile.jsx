// TierPlayerTile.jsx
// Small visual player card used in tier layouts (ListTierExport and TierMaker).
import React from 'react';
import { getPlayerPositionLabel } from '@/utils/roles';
import { formatHeight } from '@/utils/formatting';

const TierPlayerTile = ({ player }) => {
  if (!player) return null;

  const headshot =
    player.headshot ||
    player.headshotUrl ||
    `/assets/headshots/${player.player_id}.png`;

  const height = player.bio?.HT ? player.bio.HT.replace('-', `'`) : '—';

  const position = getPlayerPositionLabel(
    player.bio?.Position || player.formattedPosition
  );
  const nameParts = (
    player.display_name ||
    player.name ||
    'Unknown Player'
  ).split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  return (
    <div className="relative overflow-visible p-[1px]">
      <div className="relative bg-gradient-to-br from-[#1e1e1e] to-[#111] border border-white/10 rounded-md overflow-hidden shadow-md flex flex-col w-[92px] h-[112px] text-[10px] hover:shadow-xl transition-all duration-200">
        <div className="flex-1 relative">
          <img
            src={headshot}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = '/assets/headshots/default.png';
            }}
          />
          <div className="absolute top-1 left-1 px-[4px] py-[1px] bg-black/00 text-white/40 text-[12px] font-semibold uppercase rounded-sm tracking-wider shadow-md">
            {position}
          </div>
        </div>
        <div className="bg-[#0f0f0f] px-[6px] pt-[4px] pb-[6px] h-[34px] flex flex-col justify-center text-white border-t border-white/10">
          <div className="flex justify-between text-[10px] text-white/70 leading-[12px]">
            <span className="truncate">{firstName}</span>
            <span className="text-white/50">{height}</span>
          </div>
          <div className="text-[10px] font-bold text-white leading-[12px] truncate">
            {lastName}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierPlayerTile;
