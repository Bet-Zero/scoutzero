import React, { useState } from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import { getPlayerName } from './utils/playerDisplay';

type PlayerButtonProps = {
  player: RankerPlayer;
  selected: boolean;
  onClick: () => void;
};

const PlayerButton = ({ player, selected, onClick }: PlayerButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded border text-sm text-white ${
      selected ? 'bg-blue-600 border-blue-400' : 'bg-white/10 border-white/20'
    }`}
  >
    {getPlayerName(player)}
  </button>
);

type AnchorComparisonProps = {
  anchor: RankerPlayer | undefined;
  players?: RankerPlayer[];
  onComplete: (betterIds: string[]) => void;
  // Picks made before undo came back to this screen
  initialBetter?: string[] | null;
  // Back to the ranking setup
  onBack?: () => void;
};

export const AnchorComparison = ({
  anchor,
  players = [],
  onComplete,
  initialBetter = null,
  onBack,
}: AnchorComparisonProps) => {
  const [better, setBetter] = useState<string[]>(() => initialBetter ?? []);

  if (!anchor) return null;

  const toggle = (id: string) => {
    setBetter((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onComplete(better);
  };

  return (
    <div className="text-white p-4 max-w-[700px] mx-auto">
      <h2 className="text-2xl font-bold mb-4">Anchor Comparison</h2>
      <h3 className="font-semibold mb-2">
        Select all players better than {getPlayerName(anchor)}
      </h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {players.map((p) => (
          <PlayerButton
            key={p.id}
            player={p}
            selected={better.includes(p.id)}
            onClick={() => toggle(p.id)}
          />
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleConfirm}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
        >
          Confirm
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            ← Back to ranking setup
          </button>
        )}
      </div>
    </div>
  );
};

