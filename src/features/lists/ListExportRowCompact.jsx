// src/features/lists/ListExportRowCompact.jsx
import React from 'react';
import TeamLogo from '@/components/shared/TeamLogo';
import { getPlayerPositionLabel } from '@/utils/roles';

const ListExportRowCompact = ({ player, rank }) => {
  const name = player.display_name || player.name || 'Unknown Player';
  const nameParts = name.split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  const rawPosition = player.bio?.Position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  return (
    <div className="w-[900px] h-[45px] bg-neutral-800 rounded-sm flex items-center overflow-hidden border border-black mb-0 pr-0">
      {/* Rank Bar */}
      {rank !== null && (
        <div className="h-full w-10 flex flex-col items-center justify-center bg-neutral-700 text-white font-bold text-base font-mono relative">
          <div>{rank}</div>
          <div className="absolute right-0 top-0 h-full w-[2px] bg-neutral-950"></div>
        </div>
      )}

      {/* Headshot */}
      <div className="h-[45px] w-[50px] bg-[#2a2a2a] mt-0 flex items-center justify-center overflow-hidden rounded-sm">
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

      {/* Main Info - Single Line */}
      <div className="flex items-center justify-between ml-3 w-full max-w-[calc(100%-175px)]">
        {/* Name */}
        <div
          className="text-white font-anton font-bold uppercase tracking-normal leading-none truncate max-w-[150px]"
          style={{ fontSize: `17px` }}
        >
          {firstName}{' '}
          <span className="text-white/70 font-light">{lastName}</span>
        </div>

        {/* HT/WT/Team */}
        <div className="flex items-center gap-2 text-white/50 text-[13px]">
          <TeamLogo teamAbbr={player.bio?.Team} className="w-4 h-4" />
          <div>
            {player.bio?.HT || '—'} <span className="text-white/30">|</span>{' '}
            {player.bio?.WT || '—'} lbs
          </div>
        </div>
      </div>

      {/* Position Column */}
      <div className="w-[80px] flex items-center justify-center text-white/60 text-sm font-semibold -mr-3">
        {position}
      </div>
    </div>
  );
};

export default ListExportRowCompact;
