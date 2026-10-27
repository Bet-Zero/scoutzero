/**
 * FILE: src/features/ranker/LocalDraftBanner.tsx
 * PURPOSE: Resume/discard banner for the Player Ranker draft kept in this browser
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created in the Player Ranker audit fix pass (PR #562)
 *  - 2026-10-24: Slim one-line strip above the pool workbench
 *  - 2026-10-27: Counts the user's answers, not results added by lock-ins/anchor; wraps on phones
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/562
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React from 'react';
import { Play, Trash2, RotateCcw } from 'lucide-react';
import { countAnswers } from './utils/rankerLocalDraft';

type RankerDraftBannerData = {
  name?: string | null;
  results?: unknown[] | null;
  seedCount?: number | null;
  setupData?: Parameters<typeof countAnswers>[0]['setupData'];
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

// Refresh/crash recovery banner for the draft kept in this browser
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

  const answers = countAnswers({
    results: draft.results ?? [],
    seedCount: draft.seedCount,
    setupData: draft.setupData,
  });
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
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <RotateCcw className="w-4 h-4 text-amber-400 flex-shrink-0" />
      {/* On phones the text wraps and the buttons drop to their own row */}
      <p className="flex-1 min-w-[12rem] text-sm text-white sm:truncate">
        {isFinished ? 'Completed ranking' : 'In-progress ranking'}{' '}
        <span className="font-medium">
          &quot;{draft.name || 'Untitled'}&quot;
        </span>
        <span className="text-white/45">
          {' '}
          · {answers} {answers === 1 ? 'answer' : 'answers'} · {playerCount}{' '}
          players · last updated{' '}
          {formatDate(lastUpdated)}
        </span>
      </p>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onResume}
          disabled={loading}
          className="h-8 px-3 text-sm rounded-md bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          Resume
        </button>
        <button
          onClick={confirmDiscard}
          disabled={loading}
          className="h-8 px-3 text-sm rounded-md bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
};
