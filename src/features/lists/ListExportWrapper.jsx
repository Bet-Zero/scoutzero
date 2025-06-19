// ListExportWrapper.jsx
// Wrapper component that chooses which export layout to display (flat or tiered).

import React from 'react';
import PlayerListPresentation from '@/features/lists/ListExportPlayerRow';
import PlayerTierPresentation from '@/features/lists/TierPlayerTile';

const ListDisplayWrapper = ({ players = [], view = 'list' }) => {
  if (!players || players.length === 0) {
    return (
      <div className="text-white/40 text-center py-8 italic">
        No players to display.
      </div>
    );
  }

  return (
    <div className="w-full px-4">
      {view === 'list' ? (
        <div className="flex flex-col items-center gap-2">
          {players.map((player, i) => (
            <PlayerListPresentation
              key={player.player_id || i}
              player={player}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
          {players.map((player, i) => (
            <PlayerTierPresentation
              key={player.player_id || i}
              player={player}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ListDisplayWrapper;
