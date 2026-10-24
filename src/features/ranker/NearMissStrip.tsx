/**
 * FILE: src/features/ranker/NearMissStrip.tsx
 * PURPOSE: Top-N preset's "just missed the cut" players, tap to add one to the ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-22: Created as part of PoolSearchResults.tsx
 *  - 2026-10-24: Extracted; pinned under the workbench results table
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolSearchResults.tsx
 */
import React from 'react';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { PoolSearchRow } from './PoolSearchResults';
import { playerName } from './PoolResultsTable';

export const NearMissStrip = ({
  nearMisses,
  onAdd,
}: {
  nearMisses: PoolSearchRow[];
  onAdd: (players: RosterManagerPlayer[]) => void;
}) => {
  if (nearMisses.length === 0) return null;
  return (
    <div className="flex-shrink-0 max-h-20 overflow-y-auto px-4 py-2.5 border-t border-dashed border-white/10">
      <p className="text-xs text-white/45 mb-1.5">
        Not in the pool · just missed the cut ({nearMisses.length}): tap anyone
        who could make your list
      </p>
      <div className="flex flex-wrap gap-1.5">
        {nearMisses.map((row) =>
          row.inPool ? (
            <span
              key={row.player.id}
              className="px-2 py-1 rounded-md text-xs text-white/30 border border-white/[0.06]"
            >
              {playerName(row.player)} ✓
            </span>
          ) : (
            <button
              key={row.player.id}
              onClick={() => onAdd([row.player])}
              aria-label={`Add ${playerName(row.player)} (near miss)`}
              className="px-2 py-1 rounded-md text-xs text-white/75 bg-white/[0.06] hover:bg-white/15 transition-colors"
            >
              + {playerName(row.player)}
            </button>
          )
        )}
      </div>
    </div>
  );
};
