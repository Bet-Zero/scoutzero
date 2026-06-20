/**
 * FILE: src/features/profile/PlayerDetails/OverallBlurbBox.tsx
 * PURPOSE: Overall scouting blurb and grade editor with modal access.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Added modal entry point for overall breakdown (Phase 3)
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React from 'react';
import { OverallGradeBlock } from '@/shared/components/ui/grades/OverallGradeBlock';
import { NotebookText } from 'lucide-react';
import type { OpenProfileModal } from '../profileUiTypes';

export const OverallBlurbBox = ({
  overallBlurb,
  setOverallBlurb,
  overallGrade,
  setOverallGrade,
  setOpenModal,
}: {
  overallBlurb: string;
  setOverallBlurb: (value: string) => void;
  overallGrade: number | null;
  setOverallGrade: (value: number | null) => void;
  setOpenModal?: OpenProfileModal;
}) => {
  return (
    <div className="w-full max-w-[750px] bg-neutral-800 rounded-xl p-4 flex flex-col gap-3">
      <label className="text-white text-sm mb-1 flex items-center gap-2">
        Overall
        <button
          type="button"
          onClick={() => setOpenModal?.('overall')}
          className="text-white/80 hover:text-white"
          aria-label="Edit overall breakdown"
          title="Edit overall breakdown"
        >
          <NotebookText size={14} strokeWidth={1.25} />
        </button>
      </label>

      <div className="flex w-full gap-4">
        <textarea
          value={overallBlurb}
          onChange={(e) => setOverallBlurb(e.target.value)}
          placeholder="Write your overall scouting summary..."
          className="flex-grow h-32 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
        />

        <div className="flex flex-col items-center pr-1 -mt-6">
          <label className="text-white text-sm mb-[4px] text-center">
            Grade
          </label>
          <OverallGradeBlock
            grade={overallGrade}
            onGradeChange={(val) => {
              setOverallGrade(val);
            }}
          />
        </div>
      </div>
    </div>
  );
};
