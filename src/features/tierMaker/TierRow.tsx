// src/features/tierMaker/TierRow.tsx
import React from 'react';
import { TierPlayerTile } from '@/features/lists/TierPlayerTile';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { ListDisplayPlayer } from '@/features/lists/ListPreviewModal/ListExportWrapper';

type TierRowPlayer = RosterManagerPlayer & {
  player_id?: string;
};

type TierRowProps = {
  tier: string;
  players?: TierRowPlayer[];
  screenshotMode: boolean;
  movePlayer: (playerId: string, fromTier: string, direction: 'up' | 'down') => void;
  removePlayer: (playerId: string, fromTier: string) => void;
  renameTier: (tier: string) => void;
  deleteTier: (tier: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveTierUp?: (tier: string) => void;
  onMoveTierDown?: (tier: string) => void;
  canPlayerMoveUp?: boolean;
  canPlayerMoveDown?: boolean;
  canRemovePlayer?: boolean;
};

export const TierRow = ({
  tier,
  players = [],
  screenshotMode,
  movePlayer,
  removePlayer,
  renameTier,
  deleteTier,
  canMoveUp = false,
  canMoveDown = false,
  onMoveTierUp,
  onMoveTierDown,
  canPlayerMoveUp = true,
  canPlayerMoveDown = true,
  canRemovePlayer = true,
}: TierRowProps) => (
  <div
    className={`flex items-center gap-2 border border-white/10 rounded-md min-h-[38px] ${
      tier === 'Pool' ? 'bg-neutral-950 mt-0' : 'bg-neutral-800'
    } p-0`}
  >
    <div className="w-[70px] text-sm text-white font-bold flex flex-col items-center justify-center px-1 py-0.5 gap-0.5">
      <div className="flex items-center justify-between w-full">
        {!screenshotMode && tier !== 'Pool' && (
          <button
            onClick={() => renameTier(tier)}
            className="text-xs text-white bg-black/40 px-[4px] rounded hover:bg-white/10"
          >
            ✎
          </button>
        )}
        <span className="flex-1 text-center">
          {tier === 'Pool' ? 'Pool' : tier}
        </span>
        {!screenshotMode && tier !== 'Pool' && (
          <button
            onClick={() => deleteTier(tier)}
            className="text-xs text-red-300 bg-black/40 px-[4px] rounded hover:bg-red-600"
          >
            🗑
          </button>
        )}
      </div>
      {!screenshotMode && tier !== 'Pool' && (
        <div className="flex gap-1">
          <button
            onClick={() => onMoveTierUp?.(tier)}
            disabled={!canMoveUp}
            className="text-[10px] text-white bg-black/40 px-[4px] rounded hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
            title="Move tier up"
          >
            ▲
          </button>
          <button
            onClick={() => onMoveTierDown?.(tier)}
            disabled={!canMoveDown}
            className="text-[10px] text-white bg-black/40 px-[4px] rounded hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
            title="Move tier down"
          >
            ▼
          </button>
        </div>
      )}
    </div>
    <div className="flex flex-wrap gap-[2px] flex-1">
      {players.map((player) => {
        const playerId = player.id;
        return (
          <div key={playerId} className="relative">
            <TierPlayerTile player={player as ListDisplayPlayer} />
            {!screenshotMode && (
              <div className="absolute top-1 right-1 flex flex-col gap-1">
                {canPlayerMoveUp && (
                  <button
                    onClick={() => movePlayer(playerId, tier, 'up')}
                    className="text-xs text-white bg-black/40 px-[6px] rounded hover:bg-white/10"
                  >
                    ↑
                  </button>
                )}
                {canPlayerMoveDown && (
                  <button
                    onClick={() => movePlayer(playerId, tier, 'down')}
                    className="text-xs text-white bg-black/40 px-[6px] rounded hover:bg-white/10"
                  >
                    ↓
                  </button>
                )}
                {canRemovePlayer && (
                  <button
                    onClick={() => removePlayer(playerId, tier)}
                    className="text-xs text-red-300 bg-black/40 px-[6px] rounded hover:bg-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

