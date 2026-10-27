/**
 * FILE: src/features/ranker/RankingExport.tsx
 * PURPOSE: Image layouts for downloading a Player Ranker result: large cards, a compact grid, or a featured Top 10 plus numbered list, chosen to fit the list size
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created; replaces the single 6-column export that stopped at 42 players
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingResults.tsx
 */
import React, { forwardRef } from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import {
  getHeadshotSrc,
  getLogoSrc,
  getPlayerName,
  getTeamLabel,
} from './utils/playerDisplay';
import { GridCard } from './RankedPlayerCards';

export type ExportLayout = 'cards' | 'compact' | 'featured';

export const EXPORT_LAYOUTS: Array<{
  id: ExportLayout;
  label: string;
  hint: string;
}> = [
  { id: 'cards', label: 'Large cards', hint: 'Best up to about 40 players' },
  {
    id: 'compact',
    label: 'Compact grid',
    hint: 'Best for about 40–60 players',
  },
  {
    id: 'featured',
    label: 'Top 10 + list',
    hint: 'Best for 60 or more players',
  },
];

// The layout that fits a list of this size best
export const recommendedExportLayout = (count: number): ExportLayout => {
  if (count <= 42) return 'cards';
  if (count <= 60) return 'compact';
  return 'featured';
};

const FEATURED_COUNT = 10;

const fallbackHeadshot = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = '/assets/headshots/default.png';
};

const hideBrokenLogo = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none';
};

const TeamLogo = ({
  player,
  className,
}: {
  player: RankerPlayer;
  className: string;
}) => {
  const src = getLogoSrc(player);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="eager"
      onError={hideBrokenLogo}
      className={`object-contain flex-shrink-0 ${className}`}
    />
  );
};

const splitName = (player: RankerPlayer) => {
  const [first = '', ...rest] = getPlayerName(player).split(' ');
  return { first, last: rest.join(' ') || first };
};

// Small card: headshot with rank, first name over bold last name
const CompactCard = ({
  player,
  rank,
}: {
  player: RankerPlayer;
  rank: number;
}) => {
  const { first, last } = splitName(player);
  return (
    <div className="rounded-md overflow-hidden border border-white/20 bg-[#1c1c1c]">
      <div className="relative aspect-square bg-[#0a0a0a]">
        <img
          src={getHeadshotSrc(player)}
          alt=""
          loading="eager"
          onError={fallbackHeadshot}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-1 left-1 px-1 rounded bg-neutral-900/85 border border-white/20 text-white text-xs font-bold leading-5">
          {rank}
        </span>
        <TeamLogo player={player} className="absolute top-1 right-1 w-5 h-5" />
      </div>
      <div className="px-1.5 pt-1 pb-1.5 border-t border-white/15 leading-tight">
        <div className="text-[10px] text-white/55 truncate">{first}</div>
        <div className="text-[12px] font-bold text-white truncate">{last}</div>
      </div>
    </div>
  );
};

// Numbered row for the list part of the featured layout
const ExportRow = ({
  player,
  rank,
}: {
  player: RankerPlayer;
  rank: number;
}) => (
  <div className="flex items-center gap-2.5 h-9 px-2 rounded bg-white/[0.04]">
    <span className="w-8 text-right text-sm font-bold text-white/70 tabular-nums">
      {rank}
    </span>
    <img
      src={getHeadshotSrc(player)}
      alt=""
      loading="eager"
      onError={fallbackHeadshot}
      className="w-7 h-7 rounded-full object-cover bg-white/10 flex-shrink-0"
    />
    <span className="flex-1 min-w-0 text-sm text-white truncate">
      {getPlayerName(player)}
    </span>
    <TeamLogo player={player} className="w-4 h-4" />
    <span className="text-xs text-white/45">{getTeamLabel(player) ?? ''}</span>
  </div>
);

// Fill columns top to bottom, so ranks read down each column
const toColumns = <T,>(items: T[], columns: number): T[][] => {
  const perColumn = Math.ceil(items.length / columns);
  return Array.from({ length: columns }, (_, i) =>
    items.slice(i * perColumn, (i + 1) * perColumn)
  );
};

const Featured = ({ ranking }: { ranking: RankerPlayer[] }) => {
  const top = ranking.slice(0, FEATURED_COUNT);
  const rest = ranking
    .slice(FEATURED_COUNT)
    .map((player, idx) => ({ player, rank: FEATURED_COUNT + idx + 1 }));
  const columns = rest.length > 120 ? 4 : 3;
  return (
    <>
      <div className="grid grid-cols-10 gap-3">
        {top.map((p, idx) => (
          <CompactCard key={p.id} player={p} rank={idx + 1} />
        ))}
      </div>
      {rest.length > 0 && (
        <div
          className="mt-6 grid gap-x-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {toColumns(rest, columns).map((column, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {column.map(({ player, rank }) => (
                <ExportRow key={player.id} player={player} rank={rank} />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

type RankingExportProps = {
  ranking: RankerPlayer[];
  layout: ExportLayout;
  title: string;
};

// Rendered offscreen at a fixed 1200px width and captured as the downloaded image
export const RankingExport = forwardRef<HTMLDivElement, RankingExportProps>(
  ({ ranking, layout, title }, ref) => (
    <div ref={ref} className="bg-neutral-950 p-12 w-[1200px]">
      <div className="mb-8">
        <h1 className="text-5xl font-black uppercase tracking-wide text-white">
          {title}
        </h1>
        <div className="mt-3 h-0.5 w-1/4 bg-white/20" />
        <div className="mt-3 text-base text-white/60">
          {new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}{' '}
          · {ranking.length} players
        </div>
      </div>
      {layout === 'cards' && (
        <div className="grid grid-cols-6 gap-4">
          {ranking.map((p, idx) => (
            <GridCard key={p.id} player={p} rank={idx + 1} />
          ))}
        </div>
      )}
      {layout === 'compact' && (
        <div className="grid grid-cols-10 gap-3">
          {ranking.map((p, idx) => (
            <CompactCard key={p.id} player={p} rank={idx + 1} />
          ))}
        </div>
      )}
      {layout === 'featured' && <Featured ranking={ranking} />}
    </div>
  )
);
RankingExport.displayName = 'RankingExport';
