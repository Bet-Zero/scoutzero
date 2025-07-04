// src/features/lists/ListExportRowCompactTwoColumn.jsx
import React from 'react';
import TeamLogo from '@/components/shared/TeamLogo';
import { getPlayerPositionLabel } from '@/utils/roles';

const ListExportRowCompactTwoColumn = ({ player, rank }) => {
  const name = player.display_name || player.name || 'Unknown Player';
  const nameParts = name.split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  const rawPosition = player.bio?.Position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  const height = player.bio?.HT || '—';
  const weight = player.bio?.WT ? `${player.bio.WT} lbs` : '— lbs';

  return (
    <div className="w-full h-[45px] bg-neutral-800 rounded-sm flex items-center border border-black mb-0 pr-0 overflow-hidden">
      {/* Rank Bar */}
      {rank !== null && (
        <div className="h-full w-10 flex flex-col items-center justify-center bg-neutral-700 text-white font-bold text-base font-mono relative">
          <div>{rank}</div>
          <div className="absolute right-0 top-0 h-full w-[2px] bg-neutral-950"></div>
        </div>
      )}

      {/* Headshot */}
      <div className="h-[45px] w-[50px] bg-[#2a2a2a] flex items-center justify-center overflow-hidden rounded-sm">
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

      {/* Main Info Block */}
      <div className="flex items-center ml-3 mr-4 flex-1 justify-between">
        {/* Name */}
        <div
          className="text-white font-anton font-bold uppercase tracking-normal leading-none whitespace-nowrap overflow-visible"
          style={{ fontSize: `17px`, maxWidth: '300px' }}
        >
          {firstName}{' '}
          <span className="text-white/70 font-light">{lastName}</span>
        </div>

        {/* HT / WT / Team Logo */}
        <div className="flex items-center justify-end text-white/50 text-[13px] w-[130px] gap-2">
          <TeamLogo teamAbbr={player.bio?.Team} className="w-4 h-4" />
          <div className="whitespace-nowrap tabular-nums flex gap-1 items-center">
            <span className="w-[32px] text-right">{height}</span>
            <span className="text-white/30">|</span>
            <span className="w-[48px] text-left">{weight}</span>
          </div>
        </div>
      </div>

      {/* Position */}
      <div className="w-[70px] flex items-center justify-center text-white/60 text-sm font-semibold -mr-3">
        {position}
      </div>
    </div>
  );
};

export default ListExportRowCompactTwoColumn;
