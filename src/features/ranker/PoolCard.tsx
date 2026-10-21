/**
 * FILE: src/features/ranker/PoolCard.tsx
 * PURPOSE: Player tile with a remove button for the Player Ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created in the Player Ranker audit fix pass (PR #562)
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/562
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React from 'react';
import { TierPlayerTile } from '@/features/lists/TierPlayerTile';
import type { ListDisplayPlayer } from '@/features/lists/ListPreviewModal/ListExportWrapper';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

export const PoolCard = ({
  player,
  onRemove,
}: {
  player: RosterManagerPlayer;
  onRemove: (id: string) => void;
}) => (
  <div className="relative group">
    <TierPlayerTile
      player={
        {
          ...player,
          team: String(player.team ?? player.bio?.display?.team ?? ''),
          player_id: player.id,
        } as ListDisplayPlayer
      }
    />
    {/* Always visible on touch screens; revealed on hover with a mouse */}
    <button
      onClick={() => onRemove(player.id)}
      title="Remove player"
      aria-label="Remove player"
      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-700 border border-white/20 text-white/50 hover:bg-red-600 hover:text-white hover:border-red-500 flex items-center justify-center [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all z-10 text-[10px] font-bold leading-none"
    >
      ✕
    </button>
  </div>
);
