/**
 * FILE: src/features/ranker/PoolPanel.tsx
 * PURPOSE: The ranker's current player pool beside the builder: count, per-player remove, clear-all and the Start Ranking action
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx (as PoolGrid.tsx)
 *  - 2026-10-23: Compact list in a sticky side panel, with the Start Ranking action kept in view
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React from 'react';
import { X } from 'lucide-react';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import { getHeadshotSrc, getPlayerName, getTeamLabel } from './utils/playerDisplay';

type PoolPanelProps = {
  pool: RosterManagerPlayer[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onStart: () => void;
};

const PoolRow = ({
  player,
  onRemove,
}: {
  player: RosterManagerPlayer;
  onRemove: (id: string) => void;
}) => {
  const name = getPlayerName(player);
  const details = [
    getPlayerPositionLabel(player.bio?.position || player.formattedPosition),
    getTeamLabel(player),
  ].filter(Boolean);

  return (
    <li className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05]">
      <img
        src={getHeadshotSrc(player)}
        alt=""
        className="w-8 h-8 rounded-full object-cover bg-white/[0.06] flex-shrink-0"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/assets/headshots/default.png';
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{name}</p>
        {details.length > 0 && (
          <p className="text-[11px] text-white/35 truncate">
            {details.join(' · ')}
          </p>
        )}
      </div>
      {/* Always visible on touch screens; revealed on hover with a mouse */}
      <button
        onClick={() => onRemove(player.id)}
        title="Remove player"
        aria-label={`Remove ${name}`}
        className="p-1 rounded-md text-white/40 hover:text-red-300 hover:bg-red-500/15 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </li>
  );
};

const StartButton = ({
  disabled,
  onStart,
  className = '',
}: {
  disabled: boolean;
  onStart: () => void;
  className?: string;
}) => (
  <button
    onClick={onStart}
    disabled={disabled}
    className={`px-6 py-3 rounded-xl bg-white text-black font-bold text-sm tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
  >
    Start Ranking →
  </button>
);

export const PoolPanel = ({ pool, onRemove, onClear, onStart }: PoolPanelProps) => {
  const canStart = pool.length >= 2;
  const countLabel = `${pool.length} player${pool.length === 1 ? '' : 's'}`;

  return (
    <>
      <section
        aria-label="Your pool"
        className="flex flex-col rounded-xl bg-white/[0.03] border border-white/[0.07] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-semibold text-white">Your pool</h2>
            <p className="text-xs text-white/40 mt-0.5">{countLabel}</p>
          </div>
          {pool.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-white/35 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {pool.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <p className="text-white/45 text-sm mb-1">No players yet</p>
            <p className="text-white/25 text-xs leading-relaxed">
              Add a team, import a list, search for players, or use the drawer on
              the left.
            </p>
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto px-3 py-2 max-h-[420px] lg:max-h-none">
            {pool.map((p) => (
              <PoolRow key={p.id} player={p} onRemove={onRemove} />
            ))}
          </ul>
        )}

        <div className="px-5 py-4 border-t border-white/[0.06]">
          <StartButton disabled={!canStart} onStart={onStart} className="w-full" />
          {!canStart && (
            <p className="text-white/30 text-xs text-center mt-2">
              Add at least 2 players to begin
            </p>
          )}
        </div>
      </section>

      {/* Small screens: keep the count and Start Ranking in reach while adding */}
      {pool.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 flex items-center justify-between gap-3 px-4 py-3 bg-neutral-900/95 backdrop-blur border-t border-white/10">
          <span className="text-sm text-white/70">{countLabel}</span>
          <StartButton disabled={!canStart} onStart={onStart} />
        </div>
      )}
    </>
  );
};
