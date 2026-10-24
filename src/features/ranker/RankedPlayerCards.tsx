/**
 * FILE: src/features/ranker/RankedPlayerCards.tsx
 * PURPOSE: Ranked player card (grid) and row (list) used on the Player Ranker results screen and its image export
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Extracted from RankingResults.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingResults.tsx, src/features/ranker/RankingExport.tsx
 */
import React from 'react';
import type { RankerPlayer } from './utils/rankingEngine';
import {
  getHeadshotSrc,
  getLogoSrc,
  getPlayerName,
  getTeamLabel,
} from './utils/playerDisplay';

export type RankedColumnItem = {
  player: RankerPlayer;
  rank: number;
};

// ─── Grid Card ────────────────────────────────────────────────────────────────

export const GridCard = ({ player, rank }: RankedColumnItem) => {
  const headshot = getHeadshotSrc(player);
  const logoSrc = getLogoSrc(player);

  return (
    <div className="bg-gradient-to-b from-[#2a2a2a] to-[#1f1f1f] rounded-lg overflow-hidden border border-white/25 shadow-xl">
      {/* Headshot with rank overlay */}
      <div className="aspect-square w-full overflow-hidden bg-[#0a0a0a] relative border-b border-white/15">
        <img
          src={headshot}
          alt={getPlayerName(player)}
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/assets/headshots/default.png';
          }}
        />
        <div className="absolute top-2 left-2 bg-neutral-900/80 backdrop-blur-sm text-white font-bold text-lg px-1.5 py-0.5 rounded shadow-xl border border-white/20">
          {rank}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-gradient-to-b from-[#1f1f1f] to-[#1a1a1a] border-t border-white/20">
        <div className="text-white font-medium truncate text-sm mb-1">
          {getPlayerName(player)}
        </div>
        <div className="flex items-center gap-1.5">
          {logoSrc && (
            <img
              src={logoSrc}
              alt=""
              className="w-4 h-4 object-contain flex-shrink-0"
              loading="eager"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className="text-white/60 text-xs truncate">
            {getTeamLabel(player) ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── List Row ─────────────────────────────────────────────────────────────────

export const ListRow = ({ player, rank }: RankedColumnItem) => {
  const headshot = getHeadshotSrc(player);
  const logoSrc = getLogoSrc(player);

  return (
    <div className="bg-white/5 rounded p-2 flex items-center gap-2">
      <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full font-bold text-white/80 text-sm flex-shrink-0">
        {rank}
      </div>
      <img
        src={headshot}
        alt=""
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        loading="eager"
        decoding="async"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/assets/headshots/default.png';
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate text-sm">
          {getPlayerName(player)}
        </div>
        <div className="flex items-center gap-1 text-white/60 text-xs">
          {logoSrc && (
            <img
              src={logoSrc}
              alt=""
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span>{getTeamLabel(player) ?? '—'}</span>
        </div>
      </div>
    </div>
  );
};
