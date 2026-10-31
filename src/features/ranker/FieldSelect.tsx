/**
 * FILE: src/features/ranker/FieldSelect.tsx
 * PURPOSE: Field builder step 3: one screen to select everyone better than the line player (nobody pre-selected); the rest are cut. A backup screen against the next reference covers a line that came out inside the list.
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-31: Created; replaces the cut-line rounds
 *
 * LINKS:
 *  - Logic: src/features/ranker/utils/fieldBuilder.ts (selectStatus, selectionAnswers, afterSelect)
 *  - Used in: src/features/ranker/FieldBuilder.tsx
 */
import React, { useState } from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import {
  afterSelect,
  lineOf,
  refsStatus,
  selectionAnswers,
  selectStatus,
  spotsLeft,
} from './utils/fieldBuilder';
import { getPlayerName } from './utils/playerDisplay';
import type { FieldStepProps } from './FieldBuilder';
import { PlayerChip } from './FieldLocks';

export const FieldSelect = ({
  playersById,
  bestFirst,
  state,
  closure,
  onAnswers,
  onUndo,
  undoLabel = 'Go back a step',
}: FieldStepProps) => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const line = state.cutLine;
  if (!line || !onAnswers) return null;
  const player = (id: string) => playersById.get(id) as RankerPlayer;
  const name = (id: string) => getPlayerName(player(id));
  const status = selectStatus(state, closure, bestFirst);
  const ranked = refsStatus(state, closure).ranked;
  const backup = line !== lineOf(ranked);
  const previous = backup ? state.inIds[state.inIds.length - 1] : null;
  const nextRef = ranked.slice(ranked.indexOf(line) + 1)[0] ?? null;
  const spots = spotsLeft(state);

  const better = selected.size + status.better.length;
  const cut = status.open.length - selected.size + status.worse.length + 1;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const confirm = () =>
    onAnswers(selectionAnswers(line, status.open, selected), (c, count) =>
      afterSelect(state, c, bestFirst, count)
    );

  let outcome: string;
  if (better >= spots)
    outcome = `${better} go on to the last spots for ${spots}; ${cut} cut.`;
  else if (better + 1 === spots)
    outcome = `${name(line)} and the ${better} selected fill the ${spots} open spots; everyone else is cut.`;
  else if (cut - 1 <= spots - better - 1)
    outcome = `Fewer than ${spots}: everyone here makes it.`;
  else
    outcome = `Fewer than ${spots}: ${name(line)} and the ${better} selected are in, and ${
      nextRef
        ? `one more screen asks about the rest against ${name(nextRef)}.`
        : 'the rest go on to the last spots.'
    }`;

  return (
    <section aria-label="Select" className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {backup ? 'One more: select' : 'Select'} everyone better than{' '}
          {name(line)}
        </h1>
        <p className="text-sm text-white/45 mt-1 max-w-2xl">
          {backup && previous
            ? `Fewer than your open spots were better than ${name(previous)}, so he and everyone selected over him are in. ${spots} ${spots === 1 ? 'spot is' : 'spots are'} left among the players below him. `
            : `${name(line)} is your line: the middle of your five. `}
          Tap every player you think is better than {name(line)}. Everyone you
          don&apos;t select is cut.
        </p>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-sky-300/50 bg-sky-300/[0.06] px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            The line
          </span>
          <span className="flex items-center gap-2.5 min-w-0 flex-1">
            <PlayerChip player={player(line)} />
          </span>
        </div>
        {(status.better.length > 0 || status.worse.length > 0) && (
          <p className="text-xs text-white/45">
            {status.better.length > 0 &&
              `Already better from your answers: ${status.better.map(name).join(', ')}. `}
            {status.worse.length > 0 &&
              `Already below: ${status.worse.map(name).join(', ')}.`}
          </p>
        )}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {status.open.map((id) => {
            const on = selected.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  aria-label={name(id)}
                  className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    on
                      ? 'border-emerald-400/60 bg-emerald-500/[0.12] hover:bg-emerald-500/[0.18]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.07]'
                  }`}
                >
                  <PlayerChip player={player(id)} />
                  <span
                    className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                      on ? 'text-emerald-300' : 'text-white/25'
                    }`}
                  >
                    {on ? 'Better' : 'Select'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-neutral-900/95 backdrop-blur rounded-b-xl">
          <div className="text-xs text-white/55 tabular-nums">
            <p>
              <b className="text-emerald-300">{better}</b> better than{' '}
              {name(line)} · <b className="text-white">{spots}</b> open spots
            </p>
            <p className="text-white/40">{outcome}</p>
          </div>
          <button
            type="button"
            onClick={confirm}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90"
          >
            Confirm selection →
          </button>
        </div>
      </div>
      {onUndo && (
        <button
          onClick={onUndo}
          className="self-start text-sm text-white/45 hover:text-white"
        >
          {undoLabel}
        </button>
      )}
    </section>
  );
};
