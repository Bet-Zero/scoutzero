/**
 * FILE: src/features/ranker/LocalDraftBanner.tsx
 * PURPOSE: Resume/discard banner for the Player Ranker draft kept in this browser tab
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created in the Player Ranker audit fix pass (PR #562)
 *  - 2026-10-23: Single-row layout
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/562
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React from 'react';
import { Play, Trash2, RotateCcw } from 'lucide-react';

type RankerDraftBannerData = {
  name?: string | null;
  results?: unknown[] | null;
  playerPoolIds?: string[] | null;
  isFinished?: boolean | null;
  draftUpdatedAt?: number | null;
};

const formatDate = (date: Date | null) => {
  if (!date) return 'unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Refresh/crash recovery banner for the draft kept in this browser tab
export const LocalDraftBanner = ({
  draft,
  onResume,
  onDiscard,
  loading,
}: {
  draft: RankerDraftBannerData | null;
  onResume: () => void;
  onDiscard: () => void;
  loading: boolean;
}) => {
  if (!draft) return null;

  const resultsCount = draft.results?.length || 0;
  const playerCount = draft.playerPoolIds?.length || 0;
  const isFinished = draft.isFinished || false;
  const lastUpdated = draft.draftUpdatedAt
    ? new Date(draft.draftUpdatedAt)
    : null;

  const confirmDiscard = () => {
    if (
      window.confirm(
        'Discard this ranking? You will lose all progress. This cannot be undone.'
      )
    ) {
      onDiscard();
    }
  };

  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <RotateCcw className="w-4 h-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-medium text-sm">
            {isFinished
              ? 'You have a completed ranking'
              : 'You have an in-progress session'}
          </p>
          <p className="text-white/50 text-xs truncate">
            &quot;{draft.name || 'Untitled'}&quot; · {resultsCount} comparisons ·{' '}
            {playerCount} players · Last updated {formatDate(lastUpdated)}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onResume}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          Resume
        </button>
        <button
          onClick={confirmDiscard}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
};
