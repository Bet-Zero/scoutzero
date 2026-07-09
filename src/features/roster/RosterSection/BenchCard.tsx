import React from 'react';
import type { MouseEvent } from 'react';
import { PlayerNameMini } from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import { getPlayerPositionLabel } from '@/shared/utils/roles';

type BenchCardProps = {
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
  variant?: 'legacy' | 'architect';
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
  isHighlighted?: boolean;
  /** Optional corner overlay (e.g. the shared PlayerActionMenu). Additive —
   *  when omitted the card is unchanged (roster builder passes nothing). */
  menuSlot?: React.ReactNode;
};

export const BenchCard = ({
  player,
  onRemove,
  showRemove = true,
  isExport = false,
  variant = 'legacy',
  onSelect,
  isHighlighted = false,
  menuSlot,
}: BenchCardProps) => {
  if (!player) return null;
  const isArchitect = variant === 'architect';

  const playerId = player.bio?.playerId || player.id;
  // Normalize special characters for headshot lookup
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

  const innerCardClass = isArchitect
    ? `relative flex h-[6.3rem] w-[5.2rem] flex-col overflow-hidden rounded-md border bg-[#10131A] text-xs shadow-[0_10px_24px_-18px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 ${
        isHighlighted
          ? 'border-amber-300/70 ring-2 ring-amber-300/30'
          : 'border-white/10'
      }`
    : `relative bg-gradient-to-br from-[#1e1e1e] to-[#111] border ${
        isHighlighted
          ? 'border-green-400/70 ring-2 ring-green-400/40'
          : 'border-white/10'
      } rounded-md overflow-hidden shadow-md flex flex-col w-[7.7rem] h-[11.55rem] text-xs hover:shadow-xl transition-all duration-200`;

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
        data-testid="roster-card-bench"
      >
        <div className="flex-1 relative">
          <img
            src={headshot}
            alt={player.name ?? undefined}
            className={`h-full w-full object-cover ${
              isArchitect ? 'object-top saturate-110' : ''
            }`}
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
            className={
              isArchitect
                ? 'absolute left-[3px] top-[3px] flex h-[16px] w-[24px] items-center justify-center rounded border border-white/10 bg-black/60 text-[9px] font-bold uppercase tracking-normal text-white/80 shadow-sm backdrop-blur'
                : `absolute top-1 left-1 px-1 py-[2px] bg-black/00 text-white/40 text-[12px] ${isExport ? 'font-normal' : 'font-semibold'} uppercase rounded-sm tracking-wider shadow-md`
            }
          >
            {(
              getPlayerPositionLabel(
                player.bio?.position || player.formattedPosition
              ) || ''
            ).replace(/-/g, '/')}
          </div>
        </div>
        <div
          className={
            isArchitect
              ? 'flex h-[28px] flex-col items-center justify-center border-t border-white/10 bg-[#080B10]/95 px-1 py-1 text-center'
              : 'bg-[#0f0f0f] px-2 pt-1 pb-2 h-[46px] flex flex-col items-center justify-center text-center border-t border-white/10'
          }
        >
          <PlayerNameMini
            name={player.bio?.displayName || player.name || undefined}
            scale={isArchitect ? 0.54 : 0.77}
            firstWeightClass={isExport ? 'font-normal' : 'font-light'}
            lastWeightClass={isExport ? 'font-normal' : 'font-bold'}
          />
        </div>
      </div>
      {menuSlot ? (
        <div
          className="absolute right-[3px] top-[3px] z-30"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {menuSlot}
        </div>
      ) : null}
    </div>
  );
};
