/**
 * FILE: src/features/ranker/FieldCutRound.tsx
 * PURPOSE: Field builder step 2: each bubble player is placed against the cut-line player once (clear calls in a quick sort, close calls head to head); better stays, not better is cut. Repeats with a stronger (or lower) cut line until the bubble fits.
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created
 *  - 2026-10-26: "Back to locks" takes back the step through undo
 *  - 2026-10-31: Quick sort for the clear calls before the head-to-head close calls
 *
 * LINKS:
 *  - Used in: src/features/ranker/FieldBuilder.tsx
 */
import React from 'react';
import { PlayerCompareCard } from './PlayerCompareCard';
import type { RankerPlayer } from './utils/rankingEngine';
import { changeCutLine, quickSort, roundStatus } from './utils/fieldBuilder';
import { getPlayerName } from './utils/playerDisplay';
import type { FieldStepProps } from './FieldBuilder';
import { PlayerChip } from './FieldLocks';
import { FieldRoundSummary } from './FieldRoundSummary';
import { FieldQuickSort } from './FieldQuickSort';

export const FieldCutRound = (props: FieldStepProps) => {
  const {
    playersById,
    bestFirst,
    state,
    closure,
    comparisonCount,
    onChange,
    onAnswer,
    onQuickSort,
    onUndo,
  } = props;
  const status = roundStatus(state, closure, bestFirst);
  const cutLine = playersById.get(state.cutLine ?? '');
  const name = (id: string) =>
    getPlayerName(playersById.get(id) as RankerPlayer);
  if (!cutLine) return null;

  const answered = status.stayed.length + status.out.length;
  const untouched =
    comparisonCount === state.roundStart && state.sortedAt === undefined;
  const sort = onQuickSort ? quickSort(state, status, bestFirst) : null;

  const next = status.next ? playersById.get(status.next) : null;

  let body: React.ReactNode;
  if (sort && onQuickSort && state.cutLine) {
    body = (
      <FieldQuickSort
        // A new cut line starts the sort over
        key={state.cutLine}
        playersById={playersById}
        bestFirst={bestFirst}
        cutLine={state.cutLine}
        sort={sort}
        onConfirm={onQuickSort}
      />
    );
  } else if (next) {
    body = (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm text-white/50">
          {state.sortedAt !== undefined ? 'Close call: who' : 'Who'}&apos;s
          better?{' '}
          <span className="text-white/30">
            (left: bubble player · right: cut line)
          </span>
        </p>
        <PlayerCompareCard
          left={next}
          right={cutLine}
          onSelect={onAnswer}
          onUndo={onUndo}
        />
        <div className="w-full max-w-sm h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-sky-400"
            style={{
              width: `${(answered / Math.max(1, status.queue.length)) * 100}%`,
            }}
          />
        </div>
        <p className="text-xs text-white/40 tabular-nums">
          {status.queue.length - answered} to go this round ·{' '}
          {status.stayed.length} stayed · {status.out.length} out
        </p>
      </div>
    );
  } else {
    body = <FieldRoundSummary {...props} status={status} />;
  }

  return (
    <section aria-label="Cut the bubble" className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Cut the bubble against a cut-line player
        </h1>
        <p className="text-sm text-white/45 mt-1 max-w-2xl">
          Each bubble player is placed against the cut-line player once: the
          clear calls in a quick sort, the close ones head to head. Better
          stays; not better is cut. Every answer is kept for the ranking.
        </p>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              Round {state.round} · cut line
            </span>
            <span className="flex items-center gap-2 min-w-0">
              <PlayerChip player={cutLine} />
            </span>
          </div>
          {untouched && next && (
            <label className="flex items-center gap-2 text-xs text-white/50">
              Change
              <select
                aria-label="Cut-line player"
                value={state.cutLine ?? ''}
                onChange={(e) => onChange(changeCutLine(state, e.target.value))}
                className="h-8 max-w-[200px] bg-white/[0.05] text-white rounded-lg border border-white/[0.12] px-2"
              >
                {bestFirst
                  .filter((id) => state.bubble.includes(id))
                  .map((id) => (
                    <option key={id} value={id} className="bg-[#1a1a1a]">
                      {name(id)}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        {body}
      </div>
      {untouched && state.round === 1 && (
        <button
          onClick={
            // Undo returns to the locks step; sessions from before step undo reset by hand
            onUndo ??
            (() =>
              onChange({
                ...state,
                stage: 'locks',
                round: 0,
                cutLine: null,
                bubble: [],
              }))
          }
          className="self-start text-sm text-white/45 hover:text-white"
        >
          ← Back to locks
        </button>
      )}
    </section>
  );
};
