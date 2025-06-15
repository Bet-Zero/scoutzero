// src/features/lists/PlayerListPresentation.jsx

import React from 'react';
import PlayerNameMini from '@/features/table/PlayerNameMini';
import TeamLogo from '@/components/shared/TeamLogo';

const PlayerListPresentation = ({ player }) => {
  const nameParts = (
    player.display_name ||
    player.name ||
    'Unknown Player'
  ).split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  return (
    <div className="w-[calc(50%-6px)] h-[90px] bg-[#1e1e1e] rounded-sm flex items-center overflow-hidden border border-neutral-800 mb-3">
      {/* Position Bar */}
      <div className="h-full w-12 flex items-center justify-center bg-[#111]">
        <div className="text-md font-semibold text-white/50 uppercase tracking-wide">
          {player.formattedPosition || '—'}
        </div>
      </div>

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
        <div className="flex items-center gap-2 text-white/50 text-[13px]">
          <TeamLogo teamAbbr={player.bio?.Team} className="w-5 h-5" />
          <div>
            {player.bio?.HT || '—'} <span className="text-white/30">|</span>{' '}
            {player.bio?.WT || '—'} lbs
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerListPresentation;
