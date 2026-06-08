// src/features/lists/ListExportWrapper/ListExportRowCompact.tsx
// Consolidated compact-height export row. Replaces ListExportRowCompactSingle and
// ListExportRowCompactTwoColumn — both were identical; column layout is handled by the parent.
import React from 'react';
import { TeamLogo } from '@/shared/components/TeamLogo';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import type { ListDisplayPlayer } from '.';

type ListExportRowCompactProps = {
  player: ListDisplayPlayer;
  rank: number | null;
};

export const ListExportRowCompact = ({ player, rank }: ListExportRowCompactProps) => {
  const name = player.bio?.displayName || player.name || 'Unknown Player';
  const nameParts = name.split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  const rawPosition = player.bio?.position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  const formatHeight = (inches: number | null | undefined) => {
    if (!inches || inches === 0) return '—';
    return `${Math.floor(inches / 12)}-${inches % 12}`;
  };

  const height = formatHeight(player.bio?.height);
  const weight = player.bio?.weight ? `${player.bio.weight} lbs` : '— lbs';

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
            player.headshotUrl ||
            `/assets/headshots/${player.bio?.playerId || player.player_id}.png`
          }
          onError={(e) => {
            e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
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
          style={{ fontSize: '17px', maxWidth: '300px' }}
        >
          {firstName}{' '}
          <span className="text-white/70 font-light">{lastName}</span>
        </div>

        {/* HT / WT / Team Logo */}
        <div className="flex items-center justify-end text-white/50 text-[13px] w-[130px] gap-2">
          <TeamLogo teamAbbr={player.bio?.display?.team} className="w-4 h-4" />
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

