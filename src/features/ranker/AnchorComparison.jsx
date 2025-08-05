import React, { useState } from 'react';

const PlayerButton = ({ player, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded border text-sm text-white ${
      selected ? 'bg-blue-600 border-blue-400' : 'bg-white/10 border-white/20'
    }`}
  >
    {player.display_name || player.name}
  </button>
);

export const AnchorComparison = ({ anchor, players = [], onComplete }) => {
  const [better, setBetter] = useState([]);

  const toggle = (id) => {
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
        Select all players better than {anchor.display_name || anchor.name}
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
      <button
        onClick={handleConfirm}
        className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
      >
        Confirm
      </button>
    </div>
  );
};

export default AnchorComparison;
