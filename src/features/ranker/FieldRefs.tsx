/**
 * FILE: src/features/ranker/FieldRefs.tsx
 * PURPOSE: Field builder step 2: rank five reference players around the open spots plus a buffer (by Game Score); the middle one of the user's order becomes the line
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-31: Created; replaces the cut-line rounds
 *
 * LINKS:
 *  - Logic: src/features/ranker/utils/fieldBuilder.ts (pickReferences, refsStatus, startSelect)
 *  - Used in: src/features/ranker/FieldBuilder.tsx
 */
import React from 'react';
import { PlayerCompareCard } from './PlayerCompareCard';
import type { RankerPlayer } from './utils/rankingEngine';
import {
  lineOf,
  refsStatus,
  spotsLeft,
  startSelect,
} from './utils/fieldBuilder';
import { getPlayerName } from './utils/playerDisplay';
import type { FieldStepProps } from './FieldBuilder';
import { PlayerChip } from './FieldLocks';

export const FieldRefs = ({
  playersById,
  bestFirst,
  state,
  closure,
  comparisonCount,
  onChange,
  onAnswer,
  onUndo,
  undoLabel = 'Undo last answer',
}: FieldStepProps) => {
  const status = refsStatus(state, closure);
  const player = (id: string) => playersById.get(id) as RankerPlayer;
  const name = (id: string) => getPlayerName(player(id));
  const locks = new Set(state.locks);
  const candidates = bestFirst.filter((id) => !locks.has(id));
  const at = (id: string) => candidates.indexOf(id) + 1;
  const first = at(state.refs[0]);
  const last = at(state.refs[state.refs.length - 1]);
  const spots = spotsLeft(state);
  const buffer = Math.round((first + last) / 2) - spots;
  const line = lineOf(status.ranked);
  const untouched = comparisonCount === state.roundStart;
  const [a, b] = status.pair ? status.pair.map(player) : [];

  return (
    <section aria-label="Set the line" className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set the line</h1>
        <p className="text-sm text-white/45 mt-1 max-w-2xl">
          These {state.refs.length} players are candidates #{first}–{last} of{' '}
          {candidates.length} by Game Score (about #{state.locks.length + first}–
          {state.locks.length + last} counting your locks): your {spots} open
          spots plus a {buffer}-player buffer. Put them in order. Your middle
          one becomes the line for the next step, so if Game Score badly
          misjudged one, he lands first or last instead.
        </p>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
        {a && b ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-white/50">Who&apos;s better?</p>
            <PlayerCompareCard
              left={a}
              right={b}
              onSelect={onAnswer}
              onUndo={onUndo}
            />
            <p className="text-xs text-white/40 tabular-nums">
              {status.ranked.length} of {state.refs.length} in order
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 px-4">
            <h2 className="text-xl font-bold">Your order</h2>
            <ol aria-label="Your order" className="w-full max-w-sm flex flex-col gap-1.5">
              {status.ranked.map((id, i) => (
                <li
                  key={id}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
                    id === line
                      ? 'border-sky-300/60 bg-sky-300/[0.08]'
                      : 'border-white/[0.07] bg-white/[0.02]'
                  }`}
                >
                  <span className="w-5 text-right text-sm font-bold tabular-nums text-white/50">
                    {i + 1}
                  </span>
                  <PlayerChip player={player(id)} />
                  {id === line && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                      The line
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {line && (
              <button
                onClick={() =>
                  onChange(startSelect(state, status.ranked, comparisonCount))
                }
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90"
              >
                Next: select everyone better than {name(line)} →
              </button>
            )}
            {onUndo && (
              <button
                onClick={onUndo}
                className="text-xs text-white/40 hover:text-white"
              >
                {undoLabel}
              </button>
            )}
          </div>
        )}
      </div>
      {untouched && onUndo && (
        <button
          onClick={onUndo}
          className="self-start text-sm text-white/45 hover:text-white"
        >
          ← Back to locks
        </button>
      )}
    </section>
  );
};
