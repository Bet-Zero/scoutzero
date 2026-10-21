import React, { useEffect } from 'react';
import { PlayerHeadshot } from '@/shared/components/PlayerHeadshot';
import { PlayerNameMini } from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import type { RankerPlayer } from './utils/rankingEngine';
import { getPlayerName } from './utils/playerDisplay';

type PlayerCompareCardProps = {
  left: RankerPlayer;
  right: RankerPlayer;
  onSelect: (winner: RankerPlayer, loser: RankerPlayer) => void;
  onSkip?: () => void;
  onUndo?: () => void;
};

export const PlayerCompareCard = ({
  left,
  right,
  onSelect,
  onSkip,
  onUndo,
}: PlayerCompareCardProps) => {
  // Keyboard: ← / → pick a side
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      if (e.key === 'ArrowLeft') onSelect(left, right);
      else if (e.key === 'ArrowRight') onSelect(right, left);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [left, right, onSelect]);

  if (!left || !right) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-8">
        <button
          className="compare-button flex flex-col items-center"
          onClick={() => onSelect(left, right)}
        >
          <PlayerHeadshot playerId={left.id} />
          <PlayerNameMini name={getPlayerName(left)} />
        </button>
        <span className="text-xl font-bold text-white">vs</span>
        <button
          className="compare-button flex flex-col items-center"
          onClick={() => onSelect(right, left)}
        >
          <PlayerHeadshot playerId={right.id} />
          <PlayerNameMini name={getPlayerName(right)} />
        </button>
      </div>
      <div className="flex gap-4 mt-4 text-sm text-white/70">
        {onSkip && (
          <button onClick={onSkip} className="hover:text-white">
            Skip
          </button>
        )}
        {onUndo && (
          <button onClick={onUndo} className="hover:text-white">
            Undo
          </button>
        )}
      </div>
      <p className="hidden sm:block mt-2 text-xs text-white/30">
        Tip: use the ← and → keys to pick
      </p>
    </div>
  );
};
