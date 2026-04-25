// TieramidPlayerTile.tsx
// Compact headshot-only tile for pyramid display mode
import React from 'react';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

type TieramidTilePlayer = RosterManagerPlayer & {
  headshot?: string | null;
  original?: RosterManagerPlayer & {
    headshot?: string | null;
  };
};

type TieramidPlayerTileProps = {
  player?: TieramidTilePlayer | null;
};

const TieramidPlayerTile = ({ player }: TieramidPlayerTileProps) => {
  if (!player) return null;

  const headshot =
    player.headshotUrl ||
    player.headshot ||
    player.original?.headshotUrl ||
    player.original?.headshot ||
    `/assets/headshots/${player.bio?.playerId || player.original?.bio?.playerId || player.id}.png`;

  const position = getPlayerPositionLabel(
    player.bio?.position ||
      player.original?.bio?.position ||
      player.formattedPosition
  );
  
  const displayName =
    player.bio?.displayName ||
    player.original?.bio?.displayName ||
    player.name ||
    'Unknown Player';

  return (
    <div className="relative overflow-visible p-[2px]">
      <div
        className="relative bg-gradient-to-br from-[#1e1e1e] to-[#111] border border-white/10 rounded-md overflow-hidden w-[80px] h-[80px] transition-all duration-200 group"
        style={{ boxShadow: '0 6px 14px rgba(0,0,0,0.35)' }}
        title={displayName}
      >
        <img
          src={headshot}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/assets/headshots/default.png';
          }}
        />
        <div className="absolute top-0.5 left-0.5 px-[3px] py-[1px] bg-black/60 text-white/80 text-[10px] font-semibold uppercase rounded-sm tracking-wider">
          {position}
        </div>
        {/* Name tooltip on hover */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[9px] px-1 py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity truncate">
          {displayName}
        </div>
      </div>
    </div>
  );
};

export default TieramidPlayerTile;
