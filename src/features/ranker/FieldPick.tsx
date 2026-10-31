/**
 * FILE: src/features/ranker/FieldPick.tsx
 * PURPOSE: Field builder step 4: head-to-heads among the players left after the selection until exactly the open spots are settled (a newcomer first meets whoever is last so far)
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-31: Created; replaces the last-spots playoff
 *
 * LINKS:
 *  - Logic: src/features/ranker/utils/fieldBuilder.ts (pickStatus, finishPick)
 *  - Used in: src/features/ranker/FieldBuilder.tsx
 */
import React from 'react';
import { PlayerCompareCard } from './PlayerCompareCard';
import type { RankerPlayer } from './utils/rankingEngine';
import { finishPick, pickStatus, spotsLeft } from './utils/fieldBuilder';
import type { FieldStepProps } from './FieldBuilder';

export const FieldPick = ({
  playersById,
  bestFirst,
  state,
  closure,
  onChange,
  onAnswer,
  onUndo,
  undoLabel = 'Undo last answer',
}: FieldStepProps) => {
  const status = pickStatus(state, closure, bestFirst);
  const spots = spotsLeft(state);
  const running = state.bubble.length - status.cut.length;
  const [a, b] = status.pair
    ? status.pair.map((id) => playersById.get(id) as RankerPlayer)
    : [];

  return (
    <section aria-label="Last spots" className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Last spots: {state.bubble.length} players for {spots}
        </h1>
        <p className="text-sm text-white/45 mt-1 max-w-2xl">
          Head to head until exactly {spots} are left. A new player first
          faces whoever is last so far: lose and he&apos;s out, win and he
          takes a spot. Answers you already gave count, and every answer is
          kept for the ranking.
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
              {running} still in the running for {spots} spots
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-3 py-8 max-w-xl mx-auto">
            <h2 className="text-xl font-bold">
              Your field is set: {state.topN} players
            </h2>
            <p className="text-white/60">
              {status.cut.length} of the last {state.bubble.length} didn&apos;t
              make it.
            </p>
            <button
              onClick={() => onChange(finishPick(state, status))}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90"
            >
              Continue to ranking setup →
            </button>
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
    </section>
  );
};
