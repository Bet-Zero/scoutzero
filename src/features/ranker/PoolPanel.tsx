/**
 * FILE: src/features/ranker/PoolPanel.tsx
 * PURPOSE: The ranker workbench's pool column: count, list or headshot-tile view, per-player remove, clear-all and Start Ranking
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Pool grid and tile extracted from RankingBuilder.tsx (PoolGrid.tsx, PoolCard.tsx)
 *  - 2026-10-24: Workbench pool column with a remembered list / tiles switch
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useState } from 'react';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import { PoolRow, PoolTile } from './PoolPlayerItems';
import { Pane, PaneHeader } from './RankerPanel';

type PoolView = 'list' | 'tiles';
const VIEW_KEY = 'ranker.poolView';

// Remembered per browser; storage can be unavailable (private mode, blocked)
const readView = (): PoolView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'tiles' ? 'tiles' : 'list';
  } catch {
    return 'list';
  }
};
const saveView = (view: PoolView) => {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered; the switch still works for this visit
  }
};

type PoolPanelProps = {
  pool: RosterManagerPlayer[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onStart: () => void;
};

export const PoolPanel = ({
  pool,
  onRemove,
  onClear,
  onStart,
}: PoolPanelProps) => {
  const [view, setView] = useState<PoolView>(readView);
  const chooseView = (next: PoolView) => {
    setView(next);
    saveView(next);
  };
  const canStart = pool.length >= 2;

  return (
    <Pane
      aria-label="Your pool"
      className="lg:h-full max-h-[70vh] lg:max-h-none"
    >
      <PaneHeader
        title="Your pool"
        detail={`${pool.length} player${pool.length === 1 ? '' : 's'}`}
        aside={
          <>
            <div
              role="group"
              aria-label="Pool view"
              className="inline-flex p-0.5 rounded-md bg-white/[0.06]"
            >
              {(['list', 'tiles'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => chooseView(option)}
                  aria-pressed={view === option}
                  className={`h-6 px-2 rounded text-[11px] font-semibold capitalize transition-colors ${
                    view === option
                      ? 'bg-white/[0.16] text-white'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {pool.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-white/35 hover:text-red-400 transition-colors whitespace-nowrap"
              >
                Clear all
              </button>
            )}
          </>
        }
      />

      {pool.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center px-6 py-10">
          <p className="text-white/50 text-sm mb-1">No players yet</p>
          <p className="text-white/30 text-xs leading-relaxed">
            Players you add show up here.
          </p>
        </div>
      ) : (
        <ul
          className={`flex-1 min-h-0 overflow-y-auto ${
            view === 'tiles'
              ? 'grid grid-cols-3 auto-rows-max gap-2 p-3 content-start'
              : 'py-1.5'
          }`}
        >
          {pool.map((p) =>
            view === 'tiles' ? (
              <PoolTile key={p.id} player={p} onRemove={onRemove} />
            ) : (
              <PoolRow key={p.id} player={p} onRemove={onRemove} />
            )
          )}
        </ul>
      )}

      <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06]">
        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full h-11 rounded-xl bg-white text-black font-bold text-sm tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Start Ranking →
        </button>
        {!canStart && (
          <p className="text-white/30 text-xs text-center mt-2">
            Add at least 2 players to begin
          </p>
        )}
      </div>
    </Pane>
  );
};
