// src/features/lists/ListExportWrapper.jsx
import React from 'react';
import ListExportPlayerRow from './ListExportPlayerRow';
import ListTierExport from './ListTierExport';

const ListExportWrapper = ({
  players = [],
  tiers = [],
  playersMap = {},
  isExport = false,
  isRanked = false,
  exportType = 'list',
}) => {
  if (!isExport) return null;

  const flattenTieredPlayers = () => {
    return tiers.flatMap((tier) =>
      tier.players.map((p) => playersMap[p.id]).filter(Boolean)
    );
  };

  const renderFlatOrRanked = () => {
    const flatPlayers = isRanked ? flattenTieredPlayers() : players;

    return (
      <div className="flex flex-col gap-2 w-full">
        {flatPlayers.map((player, idx) => (
          <ListExportPlayerRow
            key={player.player_id || idx}
            player={player}
            rank={isRanked ? idx + 1 : null}
          />
        ))}
      </div>
    );
  };

  const renderTiered = () => {
    return <ListTierExport tiers={tiers} />;
  };

  return (
    <div className="w-full overflow-auto p-4 bg-white rounded-lg border border-zinc-200 shadow-sm">
      {exportType === 'tier' ? renderTiered() : renderFlatOrRanked()}
    </div>
  );
};

export default ListExportWrapper;
