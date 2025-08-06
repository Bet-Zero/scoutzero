import React from 'react';
import PlayerHeadshot from '@/components/shared/PlayerHeadshot';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';

const PlayerCompareCard = ({ left, right, onSelect, onSkip, onUndo }) => {
  if (!left || !right) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-8">
        <button
          className="compare-button flex flex-col items-center"
          onClick={() => onSelect(left, right)}
        >
          <PlayerHeadshot playerId={left.id} />
          <PlayerNameMini name={left.display_name || left.name} />
        </button>
        <span className="text-xl font-bold text-white">vs</span>
        <button
          className="compare-button flex flex-col items-center"
          onClick={() => onSelect(right, left)}
        >
          <PlayerHeadshot playerId={right.id} />
          <PlayerNameMini name={right.display_name || right.name} />
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
