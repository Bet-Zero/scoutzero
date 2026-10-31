/**
 * FILE: src/features/ranker/FieldLocks.tsx
 * PURPOSE: Field builder step 1: tap the players who are definitely on the list; they take guaranteed spots and step aside
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created
 *  - 2026-10-31: Leads into setting the line instead of the cut-line rounds
 *
 * LINKS:
 *  - Used in: src/features/ranker/FieldBuilder.tsx
 */
import React from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import { pickReferences, spotsLeft, startRefs } from './utils/fieldBuilder';
import {
  getHeadshotSrc,
  getPlayerName,
  getTeamLabel,
} from './utils/playerDisplay';
import type { FieldStepProps } from './FieldBuilder';

const fallbackHeadshot = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = '/assets/headshots/default.png';
};

export const PlayerChip = ({ player }: { player: RankerPlayer }) => (
  <>
    <img
      src={getHeadshotSrc(player)}
      alt=""
      onError={fallbackHeadshot}
      className="w-8 h-8 rounded-full object-cover bg-white/[0.06] flex-shrink-0"
    />
    <span className="flex-1 min-w-0 text-left">
      <span className="block text-sm text-white truncate">
        {getPlayerName(player)}
      </span>
      <span className="block text-[11px] text-white/35">
        {getTeamLabel(player) ?? '—'}
      </span>
    </span>
  </>
);

export const FieldLocks = ({
  playersById,
  bestFirst,
  state,
  comparisonCount,
  onChange,
}: FieldStepProps) => {
  const locked = new Set(state.locks);
  const rest = bestFirst.filter((id) => !locked.has(id));
  const full = spotsLeft(state) === 0;

  const toggle = (id: string) => {
    if (locked.has(id))
      onChange({ ...state, locks: state.locks.filter((l) => l !== id) });
    else if (!full) onChange({ ...state, locks: [...state.locks, id] });
  };

  return (
    <section aria-label="Locks" className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Tap the players who are definitely in
        </h1>
        <p className="text-sm text-white/45 mt-1 max-w-2xl">
          Locks take a guaranteed spot on your Top {state.topN} and step aside,
          so the next steps only deal with the other candidates. They come back for the
          ranking.
        </p>
      </div>

      {state.locks.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-xs text-white/40 mb-2">
            Locked ({state.locks.length}): tap to unlock
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bestFirst
              .filter((id) => locked.has(id))
              .map((id) => (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 text-xs hover:bg-emerald-500/25"
                >
                  {getPlayerName(playersById.get(id) as RankerPlayer)}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
        {rest.map((id) => {
          const player = playersById.get(id);
          if (!player) return null;
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={full}
              aria-label={`Lock ${getPlayerName(player)}`}
              className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-emerald-400/40 hover:bg-emerald-500/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PlayerChip player={player} />
              <span className="text-[11px] font-semibold text-white/30 group-hover:text-emerald-300">
                Lock
              </span>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-neutral-900/95 backdrop-blur border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          {full
            ? `Your locks fill all ${state.topN} spots.`
            : `${rest.length} candidates for ${spotsLeft(state)} open spots.`}
        </p>
        <button
          onClick={() =>
            onChange(startRefs(state, bestFirst, comparisonCount))
          }
          className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90"
        >
          {full || rest.length <= spotsLeft(state)
            ? 'Continue to ranking setup →'
            : pickReferences(rest, spotsLeft(state)).length
              ? 'Next: set the line →'
              : 'Next: last spots →'}
        </button>
      </div>
    </section>
  );
};
