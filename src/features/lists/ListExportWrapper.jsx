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
  twoColumn = true,
  title = '',
  subtitle = '',
}) => {
  if (!isExport) return null;

  const flattenTieredPlayers = () => {
    return tiers.flatMap((tier) =>
      tier.players.map((p) => playersMap[p.id] || p).filter(Boolean)
    );
  };

  const Row = compact ? ListExportRowCompact : ListExportPlayerRow;

  const renderColumn = (plist, startIdx) => (
    <div className="flex flex-col gap-0 w-1/2 items-center">
      {plist.map((player, idx) => (
        <Row
          key={player.player_id || startIdx + idx}
          player={player}
          rank={exportType === 'list' ? startIdx + idx + 1 : null}
        />
      ))}
    </div>
  );

  const renderSingleFlat = () => (
    <div className="flex flex-col gap-0 items-center w-full">
      {players.map((player, idx) => (
        <Row
          key={player.player_id || idx}
          player={player}
          rank={exportType === 'list' ? idx + 1 : null}
        />
      ))}
    </div>
  );

  const renderSingleRanked = () => {
    let rankCounter = 1;
    return (
      <div className="flex flex-col gap-2 items-center w-full">
        {tiers.map((tier, tIdx) => (
          <React.Fragment key={tier.label || `tier-${tIdx}`}>
            <h2 className="text-black text-xs font-semibold uppercase w-full text-center">
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
  };

  const renderTwoColumnFlat = () => {
    const limited = players.slice(0, 30);
    const left = limited.slice(0, 15);
    const right = limited.slice(15);

    return (
      <div className="relative flex w-full">
        {renderColumn(left, 0)}
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-black" />
        {renderColumn(right, 15)}
      </div>
    );
  };

  const renderTwoColumnRanked = () => {
    let rankCounter = 1;
    let remaining = 30;
    return (
      <div className="flex flex-col gap-2 w-full items-center">
        {tiers.map((tier, tIdx) => {
          if (remaining <= 0) return null;
          const tierPlayers = tier.players
            .map((p) => playersMap[p.id] || p)
            .filter(Boolean)
            .slice(0, remaining);
          remaining -= tierPlayers.length;
          const left = tierPlayers.slice(0, 15);
          const right = tierPlayers.slice(15);

          const startRank = rankCounter;
          rankCounter += tierPlayers.length;

          return (
            <React.Fragment key={tier.label || `tier-${tIdx}`}>
              <h2 className="text-black text-xs font-semibold uppercase w-full text-center">
                {tier.label || `Tier ${tIdx + 1}`}
              </h2>
              <div className="relative flex w-full">
                {renderColumn(left, startRank - 1)}
                <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-black" />
                {renderColumn(right, startRank - 1 + left.length)}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderFlatOrRanked = () => {
    if (twoColumn) {
      if (isRanked && tiers.length > 0) return renderTwoColumnRanked();
      return renderTwoColumnFlat();
    }
    if (isRanked && tiers.length > 0) return renderSingleRanked();
    return renderSingleFlat();
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
