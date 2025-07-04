// ListTierHeader.jsx
// Displays a tier label (e.g. "Tier 1") and wraps a group of ListPlayerRow entries.
import React from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import RankedListPlayerRow from './ListPlayerRow';

const RankedListTier = ({
  label,
  headerIndex,
  players,
  playersMap,
  notes,
  showReorder,
  onLabelChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onNoteChange,
  orderLength,
}) => {
  return (
    <div className="w-full">
      {headerIndex !== null && (
        <div className="relative w-full max-w-[1100px] mx-auto mb-6">
          {showReorder && (
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10">
              <button
                onClick={() => onMoveUp(headerIndex)}
                disabled={headerIndex === 0}
                className="text-white/30 hover:text-white disabled:opacity-20"
              >
                <ChevronUp size={16} />
              </button>
              <div className="text-xs font-bold text-white/40">—</div>
              <button
                onClick={() => onMoveDown(headerIndex)}
                disabled={headerIndex === orderLength - 1}
                className="text-white/30 hover:text-white disabled:opacity-20"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 text-left px-4 py-2 bg-white/5 border border-white/10 rounded">
            <input
              type="text"
              value={label}
              onChange={(e) => onLabelChange(headerIndex, e.target.value)}
              className="text-xl font-bold tracking-wide bg-transparent text-white w-full focus:outline-none"
            />
            <button
              onClick={() => onRemove(headerIndex)}
              title="Delete Tier"
              className="text-neutral-800 hover:text-white/70"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {players.map(({ id, index, rankIndex }) => {
        const player = playersMap[id];
        if (!player) return null;
        return (
          <RankedListPlayerRow
            key={id}
            player={player}
            index={index}
            rank={rankIndex}
            note={notes[id] || ''}
            onNoteChange={onNoteChange}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
            showReorder={showReorder}
          />
        );
      })}
    </div>
  );
};

export default RankedListTier;
