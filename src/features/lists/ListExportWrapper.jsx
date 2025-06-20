// src/features/lists/ListExportWrapper.jsx
import React from 'react';
import ListExportPlayerRow from './ListExportPlayerRow';
import ListExportRowCompact from './ListExportRowCompact';
import ListTierExport from './ListTierExport';

const ListExportWrapper = ({
  players = [],
  tiers = [],
  playersMap = {},
  isExport = false,
  isRanked = false,
  exportType = 'list',
  compact = false,
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
      const Row = compact ? ListExportRowCompact : ListExportPlayerRow;
      return (
        <div className="flex flex-col gap-2 w-full">
          {tiers.map((tier, tIdx) => (
            <React.Fragment key={tier.label || `tier-${tIdx}`}>
              <h2 className="text-black text-xs font-semibold uppercase">
                {tier.label || `Tier ${tIdx + 1}`}
              </h2>
              {tier.players.map((player, pIdx) => (
                <Row
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
    const limited = flatPlayers.slice(0, 30);
    const left = limited.slice(0, 15);
    const right = limited.slice(15);

    const Row = compact ? ListExportRowCompact : ListExportPlayerRow;
    const renderColumn = (plist, offset) => (
      <div className="flex flex-col gap-0 w-1/2">
        {plist.map((player, idx) => (
          <Row
            key={player.player_id || idx + offset}
            player={player}
            rank={exportType === 'list' ? idx + offset + 1 : null}
          />
        ))}
      </div>
    );

    return (
      <div className="relative flex w-full">
        {renderColumn(left, 0)}
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-black" />
        {renderColumn(right, 15)}
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
