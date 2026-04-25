import React from 'react';
import type { ProfilePlayer } from '@/features/profile/profileUiTypes';

const formatStat = (
  stat: string | number | null | undefined,
  isInteger = false,
  multiply = false
) => {
  if (!stat && stat !== 0) return 'N/A';
  const cleanStat = typeof stat === 'string' ? stat.replace('%', '') : stat;
  let parsed = isInteger
    ? parseInt(String(cleanStat))
    : parseFloat(String(cleanStat));
  if (isNaN(parsed)) return 'N/A';
  if (multiply) parsed *= 100;
  return parsed.toFixed(1);
};

/**
 * Get the NBA stats season start year.
 * Uses ~Oct 20 rollover (when the regular season typically begins)
 * so the prior season is shown during the offseason (July–October).
 */
function getStatsSeasonYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 9=Oct
  const day = now.getDate();
  // Before Oct 20 → prior season; Oct 20+ → new season
  const isNewSeason = month > 9 || (month === 9 && day >= 20);
  return isNewSeason ? year : year - 1;
}

const PlayerStatsTable = ({ player }: { player: ProfilePlayer }) => {
  const stats = (player.latestSeasonStats || {}) as Record<
    string,
    string | number | null | undefined
  >;
  const gamesPlayed = stats.GP ?? 'N/A';

  // Get current stats season (Oct 20 rollover so offseason shows prior year)
  const seasonYear = getStatsSeasonYear();
  const seasonLabel = String(
    player.latestSeasonMeta?.statsSeasonTag ||
      `${seasonYear}-${(seasonYear + 1).toString().slice(-2)}`
  );

  return (
    <div className="w-full max-w-[750px] bg-[#1f1f1f] rounded-2xl shadow-lg px-6 pt-[0.5rem] pb-[0.75rem] text-white text-sm font-medium">
      <div className="flex justify-between items-center mb-[0.5rem] font-bold">
        <div className="w-[60px] font-bold whitespace-nowrap">
          {seasonLabel}
        </div>
        <div className="h-4 w-[1px] bg-neutral-700" />
        <div className="w-[50px] text-center">MIN</div>
        <div className="w-[50px] text-center">PTS</div>
        <div className="w-[50px] text-center">REB</div>
        <div className="w-[50px] text-center">AST</div>
        <div className="h-4 w-[1px] bg-neutral-700" />
        <div className="w-[50px] text-center">FG%</div>
        <div className="w-[50px] text-center">3PT%</div>
        <div className="w-[50px] text-center">FT%</div>
        <div className="w-[50px] text-center">eFG%</div>
      </div>
      <div className="h-[1px] bg-neutral-700 mb-[0.5rem]" />
      <div className="flex justify-between items-center font-light">
        <div className="w-[60px] text-center text-neutral-400 font-medium">
          G: {String(gamesPlayed)}
        </div>
        <div className="h-4 w-[1px] bg-neutral-700" />
        <div className="w-[50px] text-center">{formatStat(stats.MIN)}</div>
        <div className="w-[50px] text-center">{formatStat(stats.PTS)}</div>
        <div className="w-[50px] text-center">{formatStat(stats.REB)}</div>
        <div className="w-[50px] text-center">{formatStat(stats.AST)}</div>
        <div className="h-4 w-[1px] bg-neutral-700" />
        <div className="w-[50px] text-center">
          {formatStat(stats['FG%'], false, true)}
        </div>
        <div className="w-[50px] text-center">
          {formatStat(stats['3PT%'], false, true)}
        </div>
        <div className="w-[50px] text-center">
          {formatStat(stats['FT%'], false, true)}
        </div>
        <div className="w-[50px] text-center">
          {formatStat(stats['eFG%'], false, true)}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PlayerStatsTable);
