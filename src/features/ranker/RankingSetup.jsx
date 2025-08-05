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

export const RankingSetup = ({ playerPool = [], onComplete }) => {
  const [topTier, setTopTier] = useState([]);
  const [bottomTier, setBottomTier] = useState([]);
  const [anchor, setAnchor] = useState(null);
  const [firstPlace, setFirstPlace] = useState(null);
  const [lastPlace, setLastPlace] = useState(null);

  const toggleMulti = (id, list, setter) => {
    setter((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 4)
    );
  };

  const handleReady = () => {
    onComplete({ topTier, bottomTier, anchor, firstPlace, lastPlace });
  };

  return (
    <div className="text-white p-4 max-w-[700px] mx-auto">
      <h2 className="text-2xl font-bold mb-4">Pre-Ranking Setup</h2>

      <div className="mb-4" data-testid="top-tier">
        <h3 className="font-semibold mb-2">Top Tier Selector (2–4 players)</h3>
        <div className="flex flex-wrap gap-2">
          {playerPool.map((p) => (
            <PlayerButton
              key={`top-${p.id}`}
              player={p}
              selected={topTier.includes(p.id)}
              onClick={() => toggleMulti(p.id, topTier, setTopTier)}
            />
          ))}
        </div>
      </div>

      <div className="mb-4" data-testid="bottom-tier">
        <h3 className="font-semibold mb-2">Bottom Tier Selector (2–4 players)</h3>
        <div className="flex flex-wrap gap-2">
          {playerPool.map((p) => (
            <PlayerButton
              key={`bottom-${p.id}`}
              player={p}
              selected={bottomTier.includes(p.id)}
              onClick={() => toggleMulti(p.id, bottomTier, setBottomTier)}
            />
          ))}
        </div>
      </div>

      <div className="mb-4" data-testid="anchor">
        <h3 className="font-semibold mb-2">Anchor Selector</h3>
        <div className="flex flex-wrap gap-2">
          {playerPool.map((p) => (
            <PlayerButton
              key={`anchor-${p.id}`}
              player={p}
              selected={anchor === p.id}
              onClick={() => setAnchor(anchor === p.id ? null : p.id)}
            />
          ))}
        </div>
      </div>

      <div className="mb-6 flex gap-8" data-testid="locks">
        <div>
          <h3 className="font-semibold mb-2">1st Place Lock-In</h3>
          <select
            value={firstPlace || ''}
            onChange={(e) => setFirstPlace(e.target.value || null)}
            className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
          >
            <option value="">None</option>
            {playerPool.map((p) => (
              <option key={`first-${p.id}`} value={p.id}>
                {p.display_name || p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Last Place Lock-In</h3>
          <select
            value={lastPlace || ''}
            onChange={(e) => setLastPlace(e.target.value || null)}
            className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
          >
            <option value="">None</option>
            {playerPool.map((p) => (
              <option key={`last-${p.id}`} value={p.id}>
                {p.display_name || p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleReady}
        className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
      >
        Ready to Rank
      </button>
    </div>
  );
};

export default RankingSetup;
