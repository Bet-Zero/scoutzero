/**
 * FILE: src/features/ranker/PoolResultsHeader.tsx
 * PURPOSE: Above the pool builder results: the Top-N list's title and how it's picked, the players-without-a-team toggle and the past-season caveat
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Split out of PoolWorkbench.tsx
 *  - 2026-10-27: Candidates box keeps what's typed (a first digit no longer snaps to the minimum)
 *  - 2026-10-31: The list shows everyone; the candidates box moved below as "Tick the top N"
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolWorkbench.tsx
 */
import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { PoolFinder } from './hooks/usePoolFinder';

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 text-xs leading-relaxed text-white/45">
    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/30" />
    <div className="min-w-0">{children}</div>
  </div>
);

// Top-N size and explanation, and the past-season caveat, above the results
export const ResultsHeader = ({ finder }: { finder: PoolFinder }) => {
  const { topN, poolSize, isPastSeason, season } = finder;
  const [explained, setExplained] = useState(false);
  if (topN === null && !isPastSeason) return null;
  return (
    <div className="flex flex-shrink-0 flex-col gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.015]">
      {topN !== null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-semibold text-white">
            Top {topN} pool
          </span>
          <span className="text-xs text-white/45">
            Everyone is listed; the usual candidates start ticked. Untick
            anyone who won&apos;t make it, tick anyone missing.
          </span>
          {!isPastSeason &&
            (finder.hiddenTeamless > 0 || finder.includeTeamless) && (
              <label className="flex items-center gap-1.5 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={finder.includeTeamless}
                  onChange={(e) => finder.setIncludeTeamless(e.target.checked)}
                  className="accent-white"
                />
                Include players without a team
                {finder.hiddenTeamless > 0 ? ` (${finder.hiddenTeamless})` : ''}
              </label>
            )}
          <span className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setExplained((v) => !v)}
              aria-expanded={explained}
              className="text-xs text-white/50 hover:text-white"
            >
              How players are picked
            </button>
            <button
              onClick={() => finder.chooseTopN(null)}
              className="text-xs text-white/40 hover:text-white"
            >
              Clear
            </button>
          </span>
        </div>
      )}
      {topN !== null && explained && (
        <Note>
          Players are listed by their better place by Game Score per game
          {isPastSeason
            ? ` in ${season}`
            : ' (this season, leaning on last season until about 20 games are played)'}{' '}
          or by salary, after any filters. Everyone in the top {poolSize} by
          either starts ticked. A player&apos;s best of the three seasons
          before counts too, and pay catches stars box scores undervalue
          (defense, injuries). Rookies and second-year players often sit lower
          on both: sort by Yr to find them together.
        </Note>
      )}
      {isPastSeason && (
        <Note>
          Team, age, salary and stats are as of {season}; players without a{' '}
          {season} record are hidden. Position, roles, badges, height/weight and
          contract-status filters use current data.
        </Note>
      )}
    </div>
  );
};
