/**
 * FILE: src/features/ranker/FilterMatchPreview.tsx
 * PURPOSE: Live count, preview and "add all" action for the ranker's filter-based pool builder
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created for the Player Ranker filter-based pool builder
 *
 * LINKS:
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 */
import React, { useState } from 'react';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const PREVIEW_COUNT = 12;

const playerName = (player: RosterManagerPlayer): string =>
  player.bio?.displayName || player.name || 'Unknown';

type FilterMatchPreviewProps = {
  anyFilter: boolean;
  loading: boolean;
  error: string | null;
  season: string;
  matches: RosterManagerPlayer[];
  newMatches: RosterManagerPlayer[];
  onAdd: () => void;
};

export const FilterMatchPreview = ({
  anyFilter,
  loading,
  error,
  season,
  matches,
  newMatches,
  onAdd,
}: FilterMatchPreviewProps) => {
  const [showAll, setShowAll] = useState(false);

  if (!anyFilter) {
    return (
      <p className="text-white/30 text-xs">Set a filter to see matching players.</p>
    );
  }
  if (error) {
    return (
      <p className="text-red-300 text-xs">
        Couldn&apos;t load {season} stats: {error}
      </p>
    );
  }
  if (loading) {
    return <p className="text-white/40 text-xs">Loading {season} stats…</p>;
  }

  const alreadyIn = matches.length - newMatches.length;
  const shown = showAll ? matches : matches.slice(0, PREVIEW_COUNT);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <p className="text-sm text-white/70">
          <span className="text-white font-semibold">{matches.length}</span> match
          {matches.length === 1 ? '' : 'es'}
          {alreadyIn > 0 && (
            <span className="text-white/40"> · {alreadyIn} already in pool</span>
          )}
        </p>
        <button
          onClick={onAdd}
          disabled={newMatches.length === 0}
          className="px-4 py-2 text-sm rounded-lg bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-25 disabled:cursor-not-allowed"
        >
          Add {newMatches.length} to pool
        </button>
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((p) => (
            <span
              key={p.id}
              className="px-2 py-0.5 rounded bg-white/[0.06] text-white/70 text-xs"
            >
              {playerName(p)}
            </span>
          ))}
          {matches.length > PREVIEW_COUNT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="px-2 py-0.5 rounded text-xs text-white/50 hover:text-white"
            >
              {showAll ? 'Show less' : `+${matches.length - PREVIEW_COUNT} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
