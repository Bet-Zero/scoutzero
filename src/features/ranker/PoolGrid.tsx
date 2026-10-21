/**
 * FILE: src/features/ranker/PoolGrid.tsx
 * PURPOSE: The ranker's current player pool, with per-player remove and clear-all
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React from 'react';
import { PoolCard } from './PoolCard';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

type PoolGridProps = {
  pool: RosterManagerPlayer[];
  onRemove: (id: string) => void;
  onClear: () => void;
};

export const PoolGrid = ({ pool, onRemove, onClear }: PoolGridProps) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35">
        Pool
      </span>
      {pool.length > 0 && (
        <button
          onClick={onClear}
          className="text-xs text-white/25 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>

    {pool.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-white/[0.08]">
        <p className="text-white/20 text-sm mb-1">
          No players in the pool
        </p>
        <p className="text-white/12 text-xs">
          Add a team, import a list, or use the drawer on the left
        </p>
      </div>
    ) : (
      <div className="flex flex-wrap gap-3">
        {pool.map((p) => (
          <PoolCard key={p.id} player={p} onRemove={onRemove} />
        ))}
      </div>
    )}
  </div>
);
