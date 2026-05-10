import React, { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, Save, X, Edit3 } from 'lucide-react';
import type { RankerPlayer } from './utils/rankingEngine';

type AdjustableRankingsProps = {
  initialRanking?: RankerPlayer[];
  onSave: (ranking: RankerPlayer[]) => void;
  onCancel: () => void;
};

const getPlayerName = (player: RankerPlayer) =>
  player.bio?.displayName || player.display_name || player.name || '—';

const getHeadshotSrc = (player: RankerPlayer) =>
  player.headshot ||
  player.headshotUrl ||
  `/assets/headshots/${player.player_id || player.id}.png`;

const getLogoSrc = (player: RankerPlayer) => {
  const team = player.team;
  if (!team) return null;
  return `/assets/logos/${String(team).toLowerCase()}.png`;
};

export const AdjustableRankings = ({
  initialRanking = [],
  onSave,
  onCancel,
}: AdjustableRankingsProps) => {
  const [adjustedRanking, setAdjustedRanking] =
    useState<RankerPlayer[]>(initialRanking);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const movePlayer = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setAdjustedRanking((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const moveUp = useCallback(
    (index: number) => {
      if (index > 0) movePlayer(index, index - 1);
    },
    [movePlayer]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index < adjustedRanking.length - 1) movePlayer(index, index + 1);
    },
    [movePlayer, adjustedRanking.length]
  );

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      movePlayer(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const hasChanges =
    JSON.stringify(adjustedRanking.map((p) => p.id)) !==
    JSON.stringify(initialRanking.map((p) => p.id));

  return (
    <div className="mt-6 mx-auto max-w-4xl px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Edit3 size={22} className="text-orange-400" />
            Adjust Your Rankings
          </h2>
          <p className="text-white/60 text-sm">
            Drag players or use the arrow buttons to fine-tune your results
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-4">
          <button
            onClick={() => onSave(adjustedRanking)}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-all"
          >
            <Save size={16} />
            Save Adjustments
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium text-white transition-all"
          >
            <X size={16} />
            Cancel
          </button>
        </div>

        {hasChanges && (
          <div className="text-center text-sm mb-2">
            <span className="bg-orange-600/20 text-orange-400 px-3 py-1 rounded-full">
              You have unsaved changes
            </span>
          </div>
        )}
      </div>

      {/* Rankings List */}
      <div className="space-y-2">
        {adjustedRanking.map((player, index) => {
          const logoSrc = getLogoSrc(player);
          const headshot = getHeadshotSrc(player);

          return (
            <div
              key={player.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`relative flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border rounded-lg transition-all cursor-move
                ${draggedIndex === index ? 'opacity-50' : ''}
                ${dragOverIndex === index && draggedIndex !== index ? 'border-orange-400 bg-orange-400/10' : 'border-white/10'}
              `}
            >
              {/* Rank */}
              <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full font-bold text-white text-base flex-shrink-0">
                {index + 1}
              </div>

              {/* Headshot */}
              <img
                src={headshot}
                alt={getPlayerName(player)}
                className="w-12 h-12 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.src = '/assets/headshots/default.png';
                }}
              />

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {getPlayerName(player)}
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-sm mt-0.5">
                  {logoSrc && (
                    <img
                      src={logoSrc}
                      alt=""
                      className="w-4 h-4 object-contain flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span>{String(player.team || 'FA').toUpperCase()}</span>
                </div>
              </div>

              {/* Arrow Buttons */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="p-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
                  title="Move up"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === adjustedRanking.length - 1}
                  className="p-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
                  title="Move down"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {/* Drag Handle */}
              <div className="flex flex-col justify-center gap-0.5 text-white/30 flex-shrink-0">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-4 h-px bg-current" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-white/5 rounded-lg text-center text-white/50 text-sm">
        <strong className="text-white/70">How to adjust:</strong>
        <span className="ml-1">
          Drag rows to reorder · Use ↑ ↓ buttons to nudge · Save when done
        </span>
      </div>
    </div>
  );
};

