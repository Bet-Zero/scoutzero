import React, { useEffect } from 'react';
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

const fallbackHeadshot = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = '/assets/headshots/default.png';
};

// One side of the matchup. On phones both sides fit across the screen (40%
// of its width each, name scaled to match); from `sm` up they're 200px.
const Side = ({ player, onClick }: { player: RankerPlayer; onClick: () => void }) => (
  <button
    className="compare-button flex flex-col items-center w-[40vw] max-w-[200px] sm:w-[200px]"
    onClick={onClick}
  >
    <span className="block w-full aspect-square rounded-xl overflow-hidden border-2 border-black">
      <img
        src={`/assets/headshots/${player.id}.png`}
        alt=""
        onError={fallbackHeadshot}
        className="w-full h-full object-cover"
      />
    </span>
    <div className="max-sm:[zoom:0.75]">
      <PlayerNameMini name={getPlayerName(player)} />
    </div>
  </button>
);

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
      <div className="flex items-center gap-3 sm:gap-8">
        <Side player={left} onClick={() => onSelect(left, right)} />
        <span className="text-base sm:text-xl font-bold text-white">vs</span>
        <Side player={right} onClick={() => onSelect(right, left)} />
      </div>
      {/* Padded into proper tap targets on phones */}
      <div className="flex gap-2 sm:gap-4 mt-3 sm:mt-4 text-sm text-white/70">
        {onSkip && (
          <button onClick={onSkip} className="hover:text-white max-sm:px-4 max-sm:py-2">
            Skip
          </button>
        )}
        {onUndo && (
          <button onClick={onUndo} className="hover:text-white max-sm:px-4 max-sm:py-2">
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
