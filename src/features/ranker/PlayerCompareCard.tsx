import React from 'react';
import PlayerHeadshot from '@/shared/components/PlayerHeadshot';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import type { RankerPlayer } from './utils/rankingEngine';

type PlayerCompareCardProps = {
  left: RankerPlayer;
  right: RankerPlayer;
  onSelect: (winner: RankerPlayer, loser: RankerPlayer) => void;
  onSkip?: () => void;
  onUndo?: () => void;
};

const PlayerCompareCard = ({
  left,
  right,
  onSelect,
  onSkip,
  onUndo,
}: PlayerCompareCardProps) => {
  if (!left || !right) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-8">
        <button
          className="compare-button flex flex-col items-center"
          onClick={() => onSelect(left, right)}
        >
          <PlayerHeadshot playerId={left.id} />
          <PlayerNameMini name={left.bio?.displayName || left.name || 'Unknown Player'} />
        </button>
        <span className="text-xl font-bold text-white">vs</span>
        <button
          className="compare-button flex flex-col items-center"
          onClick={() => onSelect(right, left)}
        >
          <PlayerHeadshot playerId={right.id} />
          <PlayerNameMini name={right.bio?.displayName || right.name || 'Unknown Player'} />
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
    </div>
  );
};

export default PlayerCompareCard;
