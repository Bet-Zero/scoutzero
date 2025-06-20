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
  title = '',
  subtitle = '',
}) => {
  if (!isExport) return null;

  const flattenTieredPlayers = () => {
    return tiers.flatMap((tier) =>
      tier.players.map((p) => playersMap[p.id] || p).filter(Boolean)
    );
  };

  const renderFlatOrRanked = () => {
    if (isRanked && tiers.length > 0) {
      let rankCounter = 1;
      return (
        <div className="flex flex-col gap-2 w-full">
          {tiers.map((tier, tIdx) => (
            <React.Fragment key={tier.label || `tier-${tIdx}`}>
              <h2 className="text-black text-xs font-semibold uppercase">
                {tier.label || `Tier ${tIdx + 1}`}
              </h2>
              {tier.players.map((player, pIdx) => (
                <ListExportPlayerRow
                  key={player.player_id || pIdx}
                  player={player}
                  rank={rankCounter++}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      );
    }

    const flatPlayers = isRanked ? flattenTieredPlayers() : players;

    return (
      <div className="flex flex-col gap-0 w-full">
        {flatPlayers.map((player, idx) => (
          <ListExportPlayerRow
            key={player.player_id || idx}
            player={player}
            rank={exportType === 'list' ? idx + 1 : null}
          />
        ))}
      </div>
    );
  };

  const renderTiered = () => {
    return (
      <div className="flex flex-col gap-2 items-center w-full">
        {(title || subtitle) && (
          <div className="text-center mb-4">
            {title && (
              <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
            )}
            {subtitle && (
              <p className="text-sm text-black whitespace-pre-line">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <ListTierExport tiers={tiers} />
      </div>
    );
  };

  return (
    <div className="w-full overflow-auto p-4 bg-white rounded-lg border border-neutral-700 shadow-sm">
      {exportType === 'tier' ? renderTiered() : renderFlatOrRanked()}
    </div>
  );
};

export default ListExportWrapper;
