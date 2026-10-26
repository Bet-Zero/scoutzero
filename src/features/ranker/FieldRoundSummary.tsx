/**
 * FILE: src/features/ranker/FieldRoundSummary.tsx
 * PURPOSE: End of a cut-line round: how many stayed and were cut, who the answers already settle, and the next step (field set, lower cut line, playoff or another round)
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Split out of FieldCutRound.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/FieldCutRound.tsx
 */
import React from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import {
  finishCut,
  lowerCutLine,
  nextRound,
  planCut,
  spotsLeft,
  type RoundStatus,
} from './utils/fieldBuilder';
import { getPlayerName } from './utils/playerDisplay';
import type { FieldStepProps } from './FieldBuilder';

const btn = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors';
const primary = `${btn} bg-white text-black hover:bg-white/90`;
const secondary = `${btn} border border-white/20 text-white hover:bg-white/10`;

export const FieldRoundSummary = ({
  playersById,
  bestFirst,
  state,
  closure,
  comparisonCount,
  onChange,
  onUndo,
  undoLabel = 'Undo last answer',
  status,
}: FieldStepProps & { status: RoundStatus }) => {
  const cutLine = playersById.get(state.cutLine ?? '') as RankerPlayer;
  const name = (id: string) =>
    getPlayerName(playersById.get(id) as RankerPlayer);
  const spots = spotsLeft(state);
  const plan = planCut(state, status, closure, bestFirst);
  const lower = () =>
    onChange(lowerCutLine(state, status, bestFirst, comparisonCount));
  const finish = () =>
    onChange(finishCut(state, status, plan, comparisonCount));
  const settledParts = [
    plan.sureIn.length ? `${plan.sureIn.length} in for sure` : '',
    plan.sureOut.length ? `${plan.sureOut.length} out` : '',
  ].filter(Boolean);
  const left = `${
    settledParts.length
      ? `Your answers already put ${settledParts.join(' and ')}, so `
      : ''
  }${plan.open.length} players are left for ${plan.spots} ${
    plan.spots === 1 ? 'spot' : 'spots'
  }.`;
  return (
    <div className="flex flex-col items-center text-center gap-3 py-8 max-w-xl mx-auto">
      <h2 className="text-xl font-bold">
        {status.stayed.length} beat {getPlayerName(cutLine)} ·{' '}
        {status.out.length} cut
      </h2>
      {plan.next === 'done' ? (
        <>
          <p className="text-white/60">
            That settles all {spots} spots. Your field is set.
          </p>
          <button onClick={finish} className={primary}>
            Continue to ranking setup →
          </button>
        </>
      ) : plan.next === 'lower' ? (
        <>
          <p className="text-white/60">
            {plan.open.length} left (counting {getPlayerName(cutLine)}) for{' '}
            {spots} spots, so the cut line was a little high. A lower cut line
            finds the rest fastest; answers you already gave still count.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={finish} className={secondary}>
              Fill the last {spots - plan.open.length} with a playoff
            </button>
            <button onClick={lower} className={primary}>
              Try a lower cut line →
            </button>
          </div>
        </>
      ) : plan.next === 'playoff' ? (
        <>
          <p className="text-white/60">
            {left} That&apos;s close: a short playoff decides who takes the last
            spots.
          </p>
          <button onClick={finish} className={primary}>
            Continue to the last spots →
          </button>
        </>
      ) : (
        <>
          <p className="text-white/60">
            {left} Another round with a stronger cut line narrows it further.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={finish} className={secondary}>
              Go to the playoff now
            </button>
            <button
              onClick={() =>
                onChange(nextRound(state, status, plan, comparisonCount))
              }
              className={primary}
            >
              Run round {state.round + 1} with{' '}
              {plan.cutLine ? name(plan.cutLine) : 'a stronger cut line'} →
            </button>
          </div>
        </>
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
  );
};
