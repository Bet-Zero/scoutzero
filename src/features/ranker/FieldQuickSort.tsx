/**
 * FILE: src/features/ranker/FieldQuickSort.tsx
 * PURPOSE: Start of a cut round: players far from the cut line by stats are placed in one go (tap the ones on the wrong side), so only the close calls are asked one at a time
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-31: Created
 *
 * LINKS:
 *  - Logic: src/features/ranker/utils/fieldBuilder.ts (quickSort, quickSortAnswers)
 *  - Used in: src/features/ranker/FieldCutRound.tsx
 */
import React, { useState } from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import { quickSortAnswers, type QuickSort } from './utils/fieldBuilder';
import { getPlayerName } from './utils/playerDisplay';
import { PlayerChip } from './FieldLocks';
import type { FieldStepProps } from './FieldBuilder';

type Props = Pick<FieldStepProps, 'playersById' | 'bestFirst'> & {
  cutLine: string;
  sort: QuickSort;
  onConfirm: NonNullable<FieldStepProps['onQuickSort']>;
};

const Group = ({
  title,
  hint,
  ids,
  moved,
  tone,
  playersById,
  onMove,
}: {
  title: string;
  hint: string;
  ids: string[];
  moved: ReadonlySet<string>;
  tone: 'stay' | 'out';
  playersById: Props['playersById'];
  onMove: (id: string) => void;
}) => (
  <section aria-label={title} className="flex flex-col gap-2">
    <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-semibold">
      <span className={tone === 'stay' ? 'text-emerald-300' : 'text-red-300'}>
        {title}
      </span>
      <span className="text-white/40 tabular-nums">{ids.length}</span>
      <span className="text-xs font-normal text-white/35">{hint}</span>
    </h3>
    {ids.length === 0 ? (
      <p className="text-xs text-white/35 px-1">Nobody</p>
    ) : (
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {ids.map((id) => {
          const player = playersById.get(id) as RankerPlayer;
          const isMoved = moved.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onMove(id)}
                aria-label={`${getPlayerName(player)}: move to ${
                  tone === 'stay' ? 'not better' : 'better'
                }`}
                className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                  isMoved
                    ? 'border-amber-300/50 bg-amber-300/[0.08] hover:bg-amber-300/[0.14]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.07]'
                }`}
              >
                <PlayerChip player={player} />
                {isMoved && (
                  <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Moved
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export const FieldQuickSort = ({
  playersById,
  bestFirst,
  cutLine,
  sort,
  onConfirm,
}: Props) => {
  const [moved, setMoved] = useState<ReadonlySet<string>>(() => new Set());
  const cutName = getPlayerName(playersById.get(cutLine) as RankerPlayer);
  const rank = new Map(bestFirst.map((id, i) => [id, i]));
  const byStats = (ids: string[]) =>
    [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  const better = byStats([
    ...sort.above.filter((id) => !moved.has(id)),
    ...sort.below.filter((id) => moved.has(id)),
  ]);
  const worse = byStats([
    ...sort.below.filter((id) => !moved.has(id)),
    ...sort.above.filter((id) => moved.has(id)),
  ]);
  const toggle = (id: string) =>
    setMoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const placed = sort.above.length + sort.below.length;
  const close = sort.close.length;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="text-lg font-bold">Quick sort: the clear calls</h2>
        <p className="text-sm text-white/50 mt-1 max-w-2xl">
          By stats, these {placed} players aren&apos;t close to {cutName}.
          Check each side and tap anyone who&apos;s on the wrong one.{' '}
          {close > 0
            ? `The ${close} close ${close === 1 ? 'call comes' : 'calls come'} next, one at a time.`
            : 'Nobody else is close, so this settles the round.'}
        </p>
      </div>
      <Group
        title={`Better than ${cutName}`}
        hint="stay in the running"
        ids={better}
        moved={moved}
        tone="stay"
        playersById={playersById}
        onMove={toggle}
      />
      <Group
        title={`Not better than ${cutName}`}
        hint="cut"
        ids={worse}
        moved={moved}
        tone="out"
        playersById={playersById}
        onMove={toggle}
      />
      <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-neutral-900/95 backdrop-blur rounded-b-xl z-10">
        <p className="text-xs text-white/50 tabular-nums">
          Confirming cuts <b className="text-red-300">{worse.length}</b> and
          keeps <b className="text-emerald-300">{better.length}</b>
          {moved.size > 0 && (
            <>
              {' '}
              · <b className="text-amber-300">{moved.size}</b> moved from stats
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => onConfirm(quickSortAnswers(cutLine, sort, moved))}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90"
        >
          {close > 0
            ? `Confirm, then the ${close} close ${close === 1 ? 'call' : 'calls'} →`
            : 'Confirm →'}
        </button>
      </div>
    </div>
  );
};
