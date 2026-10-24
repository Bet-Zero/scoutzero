/**
 * FILE: src/features/ranker/PoolPlayerItems.tsx
 * PURPOSE: One player in the ranker pool column, as a list row or a headshot tile, each with a remove button
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Headshot tile created as PoolCard.tsx (PR #562)
 *  - 2026-10-24: List row and fluid tile for the workbench pool column
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolPanel.tsx
 */
import React from 'react';
import { X } from 'lucide-react';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { formatHeight } from '@/shared/utils/formatting';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import {
  getHeadshotSrc,
  getPlayerName,
  getTeamLabel,
} from './utils/playerDisplay';

const fallbackHeadshot = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = '/assets/headshots/default.png';
};

const positionOf = (player: RosterManagerPlayer) =>
  getPlayerPositionLabel(player.bio?.position || player.formattedPosition);

const RemoveButton = ({
  name,
  onClick,
  className = '',
}: {
  name: string;
  onClick: () => void;
  className?: string;
}) => (
  // Always visible on touch screens; revealed on hover with a mouse
  <button
    onClick={onClick}
    title="Remove player"
    aria-label={`Remove ${name}`}
    className={`p-1 rounded-md text-white/45 hover:text-red-300 hover:bg-red-500/20 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all ${className}`}
  >
    <X className="w-3.5 h-3.5" />
  </button>
);

export const PoolRow = ({
  player,
  onRemove,
}: {
  player: RosterManagerPlayer;
  onRemove: (id: string) => void;
}) => {
  const name = getPlayerName(player);
  const details = [positionOf(player), getTeamLabel(player)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="group flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/[0.04]">
      <img
        src={getHeadshotSrc(player)}
        alt=""
        onError={fallbackHeadshot}
        className="w-8 h-8 rounded-full object-cover bg-white/[0.06] flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{name}</p>
        {details && (
          <p className="text-[11px] text-white/35 truncate">{details}</p>
        )}
      </div>
      <RemoveButton name={name} onClick={() => onRemove(player.id)} />
    </li>
  );
};

// Same look as the tier-list player tile, sized to fit three across
export const PoolTile = ({
  player,
  onRemove,
}: {
  player: RosterManagerPlayer;
  onRemove: (id: string) => void;
}) => {
  const name = getPlayerName(player);
  const [first = '', ...rest] = name.split(' ');
  const height = player.bio?.height ? formatHeight(player.bio.height) : '';
  return (
    <li className="group relative rounded-md overflow-hidden border border-white/10 bg-gradient-to-br from-[#1e1e1e] to-[#111]">
      <img
        src={getHeadshotSrc(player)}
        alt=""
        onError={fallbackHeadshot}
        className="block w-full aspect-square object-cover"
      />
      <span className="absolute top-1 left-1.5 text-[11px] font-semibold tracking-wider text-white/45">
        {positionOf(player)}
      </span>
      <RemoveButton
        name={name}
        onClick={() => onRemove(player.id)}
        className="absolute top-1 right-1 bg-black/60"
      />
      <div className="bg-[#0f0f0f] border-t border-white/10 px-1.5 pt-1 pb-1.5 text-[10px] leading-[12px]">
        <div className="flex justify-between gap-1 text-white/65">
          <span className="truncate">{first.toUpperCase()}</span>
          <span className="text-white/40 flex-shrink-0">{height}</span>
        </div>
        <div className="font-bold text-white truncate">
          {rest.join(' ').toUpperCase()}
        </div>
      </div>
    </li>
  );
};
