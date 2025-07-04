// src/features/lists/ListExportPlayerRowTwoColumn.jsx
import React from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import TeamLogo from '@/components/shared/TeamLogo';
import { getPlayerPositionLabel } from '@/utils/roles';

const ListExportPlayerRowTwoColumn = ({ player, rank }) => {
  const nameParts = (
    player.display_name ||
    player.name ||
    'Unknown Player'
  ).split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  const rawPosition = player.bio?.Position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  return (
    <div className="w-full h-[90px] bg-neutral-800 rounded-sm flex items-center overflow-hidden border border-black mb-0 pr-4">
      {/* Rank Bar */}
      {rank !== null && (
        <div className="h-full w-12 flex flex-col items-center justify-center bg-neutral-700 text-white font-bold text-xl font-mono relative">
          <div>{rank}</div>
          <div className="absolute right-0 top-0 h-full w-[2px] bg-neutral-950"></div>
        </div>
      )}

      {/* Headshot */}
      <div className="h-full w-[70px] bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
        <img
          src={
            player.headshotUrl || `/assets/headshots/${player.player_id}.png`
          }
          onError={(e) => {
            e.target.src = '/assets/headshots/default.png';
          }}
          alt={player.name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Main Info */}
      <div className="flex flex-col justify-center ml-3">
        <div className="h-[40px] flex items-center">
          <PlayerNameMini name={player.display_name || player.name} />
        </div>
        <div className="flex items-center mt-[11px] -mb-1 gap-2 text-white/50 text-[13px]">
          <TeamLogo teamAbbr={player.bio?.Team} className="w-5 h-5" />
          <div>
            {player.bio?.HT || '—'} <span className="text-white/30">|</span>{' '}
            {player.bio?.WT || '—'} lbs
          </div>
        </div>
      </div>

      {/* Position – Far Right */}
      <div className="ml-auto text-white/60 text-xl font-semibold pr-1">
        {position}
      </div>
    </div>
  );
};

export default ListExportPlayerRowTwoColumn;
