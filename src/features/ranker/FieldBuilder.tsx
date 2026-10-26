/**
 * FILE: src/features/ranker/FieldBuilder.tsx
 * PURPOSE: "Build the field" screens for a Top-N list (locks, cut-line rounds, last-spots playoff), shown before the ranking setup
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created; trimming the pool no longer borrows the ranking's tools
 *  - 2026-10-26: Undo also takes back step buttons (next round, playoff, continue)
 *
 * LINKS:
 *  - Logic: src/features/ranker/utils/fieldBuilder.ts
 *  - Used in: src/features/ranker/RankingSession.tsx
 */
import React from 'react';
import type { RankerGraph, RankerPlayer } from './utils/rankingEngine';
import { spotsLeft, type FieldState } from './utils/fieldBuilder';
import { FieldLocks } from './FieldLocks';
import { FieldCutRound } from './FieldCutRound';
import { FieldPlayoff } from './FieldPlayoff';

export type FieldStepProps = {
  playersById: Map<string, RankerPlayer>;
  // Pool ids by stats, best first (drives suggestions and order)
  bestFirst: string[];
  state: FieldState;
  closure: RankerGraph;
  comparisonCount: number;
  onChange: (state: FieldState) => void;
  onAnswer: (winner: RankerPlayer, loser: RankerPlayer) => void;
  // Takes back the last answer, or the last step button once the step has none
  onUndo?: () => void;
  undoLabel?: string;
};

const STEPS: Array<{ stage: FieldState['stage']; label: string }> = [
  { stage: 'locks', label: 'Locks' },
  { stage: 'cut', label: 'Cut the bubble' },
  { stage: 'playoff', label: 'Last spots' },
];

const Stepper = ({ stage }: { stage: FieldState['stage'] }) => {
  const current = STEPS.findIndex((s) => s.stage === stage);
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
          key={s.stage}
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

export const FieldBuilder = (props: FieldStepProps) => {
  const { state } = props;
  return (
    <div className="text-white max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Stepper stage={state.stage} />
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
          <FieldCount value={spotsLeft(state)} label="spots left" />
          {state.cutIds.length > 0 && (
            <FieldCount value={state.cutIds.length} label="cut" tone="out" />
          )}
        </div>
      </div>
      {state.stage === 'locks' && <FieldLocks {...props} />}
      {state.stage === 'cut' && <FieldCutRound {...props} />}
      {state.stage === 'playoff' && <FieldPlayoff {...props} />}
    </div>
  );
};
