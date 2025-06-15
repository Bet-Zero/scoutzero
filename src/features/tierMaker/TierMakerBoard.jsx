// src/features/tierMaker/TierMakerBoard.jsx
import React, { useState } from 'react';
import PlayerTierPresentation from '@/features/lists/PlayerTierPresentation';

const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D'];

const TierMakerBoard = ({ players = [] }) => {
  const initial = DEFAULT_TIERS.reduce(
    (acc, tier) => ({ ...acc, [tier]: [] }),
    { Pool: [...players] }
  );

  const [tiers, setTiers] = useState(initial);
  const [screenshotMode, setScreenshotMode] = useState(false);

  const movePlayer = (playerId, fromTier, direction) => {
    const tierKeys = ['Pool', ...DEFAULT_TIERS];
    const currentIndex = tierKeys.indexOf(fromTier);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= tierKeys.length) return;

    const sourceItems = [...tiers[fromTier]];
    const player = sourceItems.find((p) => p.player_id === playerId);
    const newItems = [...tiers[tierKeys[newIndex]]];

    setTiers((prev) => ({
      ...prev,
      [fromTier]: sourceItems.filter((p) => p.player_id !== playerId),
      [tierKeys[newIndex]]: [...newItems, player],
    }));
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-[950px] mx-auto py-4">
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setScreenshotMode((prev) => !prev)}
          className="px-3 py-1 text-sm rounded bg-white/10 hover:bg-white/20 transition-all text-white"
        >
          {screenshotMode ? 'Exit Screenshot View' : 'Screenshot View'}
        </button>
      </div>

      {Object.keys(tiers).map((tier) => (
        <div
          key={tier}
          className="min-h-[120px] border border-white/10 rounded-md p-2 bg-neutral-800"
        >
          <div className="text-white text-sm font-semibold mb-1">
            {tier === 'Pool' ? 'Player Pool' : `${tier} Tier`}
          </div>
          <div className="flex gap-[2px] flex-wrap">
            {tiers[tier].map((player) => (
              <div key={player.player_id} className="relative">
                <PlayerTierPresentation player={player} />
                {!screenshotMode && (
                  <div className="absolute top-1 right-1 flex flex-col gap-1">
                    <button
                      onClick={() => movePlayer(player.player_id, tier, 'up')}
                      className="text-xs text-white bg-black/40 px-[6px] rounded hover:bg-white/10"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePlayer(player.player_id, tier, 'down')}
                      className="text-xs text-white bg-black/40 px-[6px] rounded hover:bg-white/10"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TierMakerBoard;
