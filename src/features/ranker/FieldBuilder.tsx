/**
 * FILE: src/features/ranker/FieldBuilder.tsx
 * PURPOSE: "Build the field" screens for a Top-N list (locks, set the line, select, last spots), shown before the ranking setup
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created; trimming the pool no longer borrows the ranking's tools
 *  - 2026-10-26: Undo also takes back step buttons (next round, playoff, continue)
 *  - 2026-10-31: Reference line + one selection screen replace the cut-line rounds; trim meter
 *
 * LINKS:
 *  - Logic: src/features/ranker/utils/fieldBuilder.ts
 *  - Used in: src/features/ranker/RankingSession.tsx
 */
import React from 'react';
import type { RankerGraph, RankerPlayer } from './utils/rankingEngine';
import {
  spotsLeft,
  trimCount,
  type FieldAnswer,
  type FieldState,
} from './utils/fieldBuilder';
import { FieldLocks } from './FieldLocks';
import { FieldRefs } from './FieldRefs';
import { FieldSelect } from './FieldSelect';
import { FieldPick } from './FieldPick';

export type FieldStepProps = {
  playersById: Map<string, RankerPlayer>;
  // Pool ids by stats, best first (drives suggestions and order)
  bestFirst: string[];
  state: FieldState;
  closure: RankerGraph;
  comparisonCount: number;
  onChange: (state: FieldState) => void;
  onAnswer: (winner: RankerPlayer, loser: RankerPlayer) => void;
  // Records many answers at once and moves to the step `next` works out from
  // them (given the updated history and answer count); undone as one step
  onAnswers?: (
    answers: FieldAnswer[],
    next: (closure: RankerGraph, comparisonCount: number) => FieldState
  ) => void;
  // Takes back the last answer, or the last step button once the step has none
  onUndo?: () => void;
  undoLabel?: string;
};

const STEPS: Array<{ stages: FieldState['stage'][]; label: string }> = [
  { stages: ['locks'], label: 'Locks' },
  { stages: ['refs'], label: 'Set the line' },
  { stages: ['select'], label: 'Select' },
  { stages: ['pick'], label: 'Last spots' },
];

const Stepper = ({ stage }: { stage: FieldState['stage'] }) => {
  const current = STEPS.findIndex((s) => s.stages.includes(stage));
  return (
    <ol
      className="flex flex-wrap items-center gap-1.5 text-xs"
      aria-label="Steps"
    >
      <li className="mr-1 font-semibold uppercase tracking-[0.08em] text-white/50">
        Build the field
      </li>
      {STEPS.map((s, i) => (
        <li
          key={s.label}
          aria-current={i === current ? 'step' : undefined}
          className={`px-2.5 py-1 rounded-full border ${
            i === current
              ? 'bg-white text-black border-white font-semibold'
              : i < current
                ? 'border-white/15 text-white/60'
                : 'border-white/[0.08] text-white/30'
          }`}
        >
          {i + 1}. {s.label}
        </li>
      ))}
      <li className="mx-1 text-white/25">→</li>
      <li className="font-semibold uppercase tracking-[0.08em] text-white/30">
        Rank the field
      </li>
    </ol>
  );
};

export const FieldCount = ({
  value,
  label,
  tone = 'plain',
}: {
  value: number;
  label: string;
  tone?: 'plain' | 'lock' | 'cut' | 'out';
}) => {
  const color =
    tone === 'lock'
      ? 'text-emerald-300'
      : tone === 'cut'
        ? 'text-sky-300'
        : tone === 'out'
          ? 'text-red-300'
          : 'text-white';
  return (
    <span className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-white/60">
      <b className={`${color} font-bold tabular-nums`}>{value}</b> {label}
    </span>
  );
};

// How far the pool still is from the list size
const TrimMeter = ({ state, closure, bestFirst }: FieldStepProps) => {
  const { total, cut, left } = trimCount(state, closure, bestFirst);
  const stillIn = bestFirst.length - cut;
  const share = total > 0 ? Math.min(1, cut / total) : 1;
  return (
    <div
      role="status"
      aria-label="Trim progress"
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold tabular-nums ${
              left > 0 ? 'text-white' : 'text-emerald-300'
            }`}
          >
            {left > 0 ? left : state.topN}
          </span>
          <span className="text-sm text-white/70">
            {left > 0
              ? left === 1
                ? 'player left to trim'
                : 'players left to trim'
              : 'players: trimmed to your list size'}
          </span>
        </p>
        <p className="text-xs text-white/45 tabular-nums">
          {cut} of {total} cut · {stillIn} still in for {state.topN} spots
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-red-400/80 transition-[width]"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
};

export const FieldBuilder = (props: FieldStepProps) => {
  const { state } = props;
  return (
    <div className="text-white max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Stepper stage={state.stage} />
        <TrimMeter {...props} />
        <div className="flex flex-wrap items-center gap-2">
          <FieldCount value={state.topN} label="spots on your list" />
          <FieldCount value={state.locks.length} label="locked" tone="lock" />
          {state.inIds.length > 0 && (
            <FieldCount
              value={state.inIds.length}
              label="in from your answers"
              tone="lock"
            />
          )}
          <FieldCount value={spotsLeft(state)} label="open spots" />
        </div>
      </div>
      {state.stage === 'locks' && <FieldLocks {...props} />}
      {state.stage === 'refs' && <FieldRefs {...props} />}
      {state.stage === 'select' && (
        // A new screen starts with nobody selected
        <FieldSelect key={`${state.round}-${state.cutLine}`} {...props} />
      )}
      {state.stage === 'pick' && <FieldPick {...props} />}
    </div>
  );
};
