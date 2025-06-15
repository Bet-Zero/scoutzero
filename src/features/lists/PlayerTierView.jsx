// src/features/lists/PlayerTierView.jsx

import React from 'react';
import PlayerTierPresentation from '@/features/lists/PlayerTierPresentation';

const PlayerTierView = ({ tieredPlayers = {} }) => {
  const tierNames = Object.keys(tieredPlayers).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return (
    <div className="flex flex-col items-center w-full pt-2">
      <div className="w-full max-w-[950px] flex flex-col gap-[4px]">
        {tierNames.map((tierName) => (
          <div key={tierName} className="relative clear-both w-full">
            <h2 className="text-white text-[12px] font-semibold mb-[2px]">
              {tierName}
            </h2>

            <div className="flex flex-wrap items-start gap-[2px]">
              {tieredPlayers[tierName].map((player) => (
                <PlayerTierPresentation
                  key={player.player_id}
                  player={player}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerTierView;
