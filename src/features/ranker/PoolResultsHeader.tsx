/**
 * FILE: src/features/ranker/PoolResultsHeader.tsx
 * PURPOSE: Above the pool builder results: Top-N candidate count, the players-without-a-team toggle and the past-season caveat
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Split out of PoolWorkbench.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolWorkbench.tsx
 */
import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { PoolFinder } from './hooks/usePoolFinder';
import { fieldClass } from './RankerPanel';

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 text-xs leading-relaxed text-white/45">
    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/30" />
    <div className="min-w-0">{children}</div>
  </div>
);

// Top-N size and explanation, and the past-season caveat, above the results
export const ResultsHeader = ({ finder }: { finder: PoolFinder }) => {
  const { topN, poolSize, setPoolSize, isPastSeason, season } = finder;
  const [explained, setExplained] = useState(false);
  if (topN === null && !isPastSeason) return null;
  return (
    <div className="flex flex-shrink-0 flex-col gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.015]">
      {topN !== null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-semibold text-white">
            Top {topN} pool
          </span>
          <label className="flex items-center gap-2 text-xs text-white/55">
            Candidates
            <input
              type="number"
              min={topN}
              value={poolSize}
              onChange={(e) =>
                setPoolSize(Math.max(topN, Number(e.target.value) || topN))
              }
              aria-label="Candidates to pull"
              className={`${fieldClass} !h-8 w-20 px-2.5`}
            />
          </label>
          <span className="text-xs text-white/45">
            Untick anyone who won&apos;t make it.
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
          Everyone in the top {poolSize} by Game Score per game
          {isPastSeason
            ? ` in ${season}`
            : ' (this season, leaning on last season until about 20 games are played)'}
          , plus everyone in the top {poolSize} by salary, after any search or
          filters. A player&apos;s best of the three seasons before counts too,
          and pay catches stars box scores undervalue (defense, injuries). Check
          the &ldquo;just missed&rdquo; list under the table for anyone else.
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
