// src/features/lists/ListExportWrapper.tsx
import React from 'react';
import ListExportPlayerRow from './ListExportPlayerRow';
import ListExportRowCompact from './ListExportRowCompact';
import ListTierExport from './ListTierExport';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';

export type ListExportType = 'list' | 'tier';

export type ListDisplayPlayer = SimplePlayer & {
  player_id?: string;
  headshot?: string | null;
};

export type ListExportTier = {
  label: string;
  players: ListDisplayPlayer[];
};

export type ListExportWrapperProps = {
  players?: ListDisplayPlayer[];
  tiers?: ListExportTier[];
  playersMap?: Record<string, ListDisplayPlayer>;
  isExport?: boolean;
  isRanked?: boolean;
  exportType?: ListExportType;
  compact?: boolean;
  twoColumn?: boolean;
  title?: string;
  subtitle?: string;
};

type RankedColumnItem =
  | { type: 'heading'; label: string }
  | { type: 'player'; player: ListDisplayPlayer; rank: number };

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
}: ListExportWrapperProps) => {
  if (!isExport) return null;

  const Row = compact ? ListExportRowCompact : ListExportPlayerRow;

  const renderColumn = (plist: ListDisplayPlayer[], startIdx: number) => (
    <div className="flex flex-col gap-[3px] w-1/2 items-center">
      {plist.map((player, idx) => (
        <Row
          key={player.player_id || startIdx + idx}
          player={player}
          rank={isRanked && exportType === 'list' ? startIdx + idx + 1 : null}
        />
      ))}
    </div>
  );

  const renderSingleFlat = () => (
    <div className="flex flex-col gap-[3px] items-center w-full">
      {players.map((player, idx) => (
        <Row
          key={player.player_id || idx}
          player={player}
          rank={isRanked && exportType === 'list' ? idx + 1 : null}
        />
      ))}
    </div>
  );

  const renderSingleRanked = () => {
    let rankCounter = 1;
    return (
      <div className="flex flex-col gap-[3px] items-center w-full">
        {tiers.map((tier, tIdx) => (
          <React.Fragment key={tier.label || `tier-${tIdx}`}>
            <h2 className="text-white text-xs font-semibold uppercase w-full text-center">
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
      <div className="flex w-full gap-6">
        {renderColumn(left, 0)}
        {renderColumn(right, 15)}
      </div>
    );
  };

  const renderRankedColumn = (items: RankedColumnItem[]) => (
    <div className="flex flex-col gap-[1px] w-1/2 items-start">
      {items.map((it, idx) =>
        it.type === 'heading' ? (
          <h2
            key={`h-${idx}`}
            className="text-white text-xs font-semibold uppercase m-1"
          >
            {it.label}
          </h2>
        ) : (
          <Row
            key={it.player.player_id || it.rank}
            player={it.player}
            rank={exportType === 'list' ? it.rank : null}
          />
        )
      )}
    </div>
  );

  const renderTwoColumnRanked = () => {
    let rankCounter = 1;
    const left: RankedColumnItem[] = [];
    const right: RankedColumnItem[] = [];

    tiers.forEach((tier, tIdx) => {
      if (rankCounter > 30) return;
      const tierPlayers = tier.players
        .map((p) => playersMap[p.id] || p)
        .filter(Boolean);
      if (tierPlayers.length === 0) return;

      const targetColumn = rankCounter <= 15 ? left : right;
      targetColumn.push({
        type: 'heading',
        label: tier.label || `Tier ${tIdx + 1}`,
      });

      for (const player of tierPlayers) {
        if (rankCounter > 30) break;
        const column = rankCounter <= 15 ? left : right;
        column.push({ type: 'player', player, rank: rankCounter });
        rankCounter += 1;
      }
    });

    return (
      <div className="flex w-full gap-6">
        {renderRankedColumn(left)}
        {renderRankedColumn(right)}
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

  const containerPadding = twoColumn ? 'p-12' : 'p-24';

  const totalPlayerCount = isRanked && tiers.length > 0
    ? tiers.reduce((sum, t) => sum + t.players.length, 0)
    : players.length;
  const isTruncated = twoColumn && exportType !== 'tier' && totalPlayerCount > 30;

  return (
    <div
      className={`w-full overflow-auto ${containerPadding} bg-gradient-to-br from-[#1e1e1e] to-[#111] rounded-lg border border-neutral-700 shadow-sm`}
    >
      {title && exportType !== 'tier' && (
        <div className="w-full max-w-[1100px] mx-auto px-4 mb-6">
          <div className="h-[5px] w-24 bg-gradient-to-r from-neutral-500 to-neutral-900 rounded-full mb-4 shadow-lg"></div>
          <h1 className="text-5xl font-extrabold tracking-tight text-neutral-100 mb-3">
            {title}
          </h1>
        </div>
      )}
      {exportType === 'tier' ? renderTiered() : renderFlatOrRanked()}
      {isTruncated && (
        <p className="text-white/30 text-xs text-center mt-4">
          Showing first 30 of {totalPlayerCount} players
        </p>
      )}
    </div>
  );
};

export default ListExportWrapper;
