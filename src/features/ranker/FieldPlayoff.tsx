/**
 * FILE: src/features/ranker/FieldPlayoff.tsx
 * PURPOSE: Field builder step 3: a short either/or playoff among only the closest players until exactly the open spots are filled
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created
 *
 * LINKS:
 *  - Used in: src/features/ranker/FieldBuilder.tsx
 */
import React from 'react';
import { PlayerCompareCard } from './PlayerCompareCard';
import type { RankerPlayer } from './utils/rankingEngine';
import { finishPlayoff, playoffStatus, spotsLeft } from './utils/fieldBuilder';
import { getPlayerName } from './utils/playerDisplay';
import type { FieldStepProps } from './FieldBuilder';

export const FieldPlayoff = ({
  playersById,
  bestFirst,
  state,
  closure,
  onChange,
  onAnswer,
  onUndo,
}: FieldStepProps) => {
  const playoff = state.playoff;
  if (!playoff) return null;
  const status = playoffStatus(playoff, closure, bestFirst);
  const names = (ids: string[]) =>
    ids
      .map((id) => getPlayerName(playersById.get(id) as RankerPlayer))
      .join(', ');
  const [a, b] = status.pair
    ? status.pair.map((id) => playersById.get(id))
    : [];

  return (
    <section aria-label="Last spots" className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Playoff for the last spots
        </h1>
        <p className="text-sm text-white/45 mt-1 max-w-2xl">
          {playoff.mode === 'drop'
            ? `${playoff.set.length} players for ${spotsLeft(state)} spots: ${playoff.count} more must drop out.`
            : `${playoff.keep.length} players for ${spotsLeft(state)} spots: ${playoff.count} more come back from the cut.`}{' '}
          Only the closest players face each other, and answers you already gave
          count.
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
              {status.decided.length} of {playoff.count} settled
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-3 py-8 max-w-xl mx-auto">
            <h2 className="text-xl font-bold">
              Your field is set: {state.topN} players
            </h2>
            <p className="text-white/60">
              {names(status.decided)}{' '}
              {playoff.mode === 'drop' ? 'drop out.' : 'come back.'}
            </p>
            <button
              onClick={() => onChange(finishPlayoff(state, status.decided))}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90"
            >
              Continue to ranking setup →
            </button>
            {onUndo && (
              <button
                onClick={onUndo}
                className="text-xs text-white/40 hover:text-white"
              >
                Undo last answer
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
