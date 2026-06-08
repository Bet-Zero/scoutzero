import React from 'react';
import type { MouseEvent } from 'react';
import { PlayerNameMini } from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import { getPlayerPositionLabel } from '@/shared/utils/roles';

type StarterCardProps = {
  player: {
    bio?: { displayName?: string | null; playerId?: string | number | null; position?: string | null } | null;
    formattedPosition?: string | null;
    headshot?: string | null;
    headshotUrl?: string | null;
    id?: string | number | null;
    name?: string | null;
  };
  onRemove?: (event: MouseEvent<HTMLElement>) => void;
  showRemove?: boolean;
  isExport?: boolean;
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
  isHighlighted?: boolean;
  /** Optional corner overlay (e.g. the shared PlayerActionMenu). Additive —
   *  when omitted the card is unchanged (roster builder passes nothing). */
  menuSlot?: React.ReactNode;
};

export const StarterCard = ({
  player,
  onRemove,
  showRemove = true,
  isExport = false,
  onSelect,
  isHighlighted = false,
  menuSlot,
}: StarterCardProps) => {
  if (!player) return null;

  const playerId = player.bio?.playerId || player.id;
  // Normalize special characters for headshot lookup (e.g., kristaps_porzingis -> kristaps_porziņģis)
  const normalizedId = playerId
    ? String(playerId)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
    : 'default';
  const headshot =
    player.headshot ||
    player.headshotUrl ||
    `/assets/headshots/${normalizedId}.png`;

  const innerCardClass = `relative bg-gradient-to-br from-[#1e1e1e] to-[#111] border ${
    isHighlighted ? 'border-green-400/70 ring-2 ring-green-400/40' : 'border-white/10'
  } rounded-md overflow-hidden shadow-md flex flex-col w-40 h-60 text-base hover:shadow-xl transition-all duration-200`;

  const handleSelect = onSelect
    ? (event: MouseEvent<HTMLElement>) => onSelect(event)
    : undefined;
  const handleKeyDown = onSelect
    ? (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(event as unknown as MouseEvent<HTMLElement>);
        }
      }
    : undefined;

  return (
    <div className="relative overflow-visible p-[2px]">
      <div
        className={`${innerCardClass} ${onSelect ? 'cursor-pointer' : ''}`}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        data-roster-card-highlighted={isHighlighted ? 'true' : undefined}
        data-testid="roster-card-starter"
      >
        <div className="flex-1 relative">
          <img
            src={headshot}
            alt={player.name ?? undefined}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
            }}
          />
          {showRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.(e);
              }}
              className="absolute top-1 right-1 text-white/10 hover:text-white text-xs bg-black/10 rounded-sm px-[4px]"
            >
              ✕
            </button>
          )}
          <div
            className={`absolute top-1 left-1 px-1 py-[2px] bg-black/00 text-white/40 text-[16px] ${isExport ? 'font-normal' : 'font-semibold'} uppercase rounded-sm tracking-wider shadow-md`}
          >
            {getPlayerPositionLabel(
              player.bio?.position || player.formattedPosition
            )}
          </div>
        </div>
        <div className="bg-[#0f0f0f] px-2 pt-1 pb-2 h-[60px] flex flex-col items-center justify-center text-center border-t border-white/10">
          <PlayerNameMini
            name={player.bio?.displayName || player.name || undefined}
            firstWeightClass={isExport ? 'font-normal' : 'font-light'}
            lastWeightClass={isExport ? 'font-normal' : 'font-bold'}
          />
        </div>
      </div>
      {menuSlot ? (
        <div
          className="absolute right-0 top-0 z-30"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {menuSlot}
        </div>
      ) : null}
    </div>
  );
};

