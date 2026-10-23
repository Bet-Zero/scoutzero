/**
 * FILE: src/features/ranker/PoolSearchResults.tsx
 * PURPOSE: Result list for the ranker's Find Players panel: each player's team, age, salary and stats for the chosen season, with add-one, add-selected and add-all actions
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created; replaces FilterMatchPreview (name chips with add-all only) (PR #565)
 *  - 2026-10-22: Rank and score columns, and pre-ticked rows for the Top-N preset
 *  - 2026-10-22: Stats and pay rank columns, and a tap-to-add near-miss list
 *  - 2026-10-23: Results scroll in a fixed-height box with a sticky header
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/565
 *  - Used in: src/features/ranker/FilterPoolPanel.tsx
 */
import React, { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { formatSalary } from '@/shared/utils/formatting/basicFormatting';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const PAGE_SIZE = 50;

export type PoolSearchRow = {
  player: RosterManagerPlayer;
  team: string | null;
  age: number | null;
  salary: number | null;
  stats: Record<string, number | string | null | undefined> | null;
  inPool: boolean;
  // Set by the Top-N preset: position by score, and the score itself
  rank?: number;
  score?: number;
  // Top-N preset: place by stats score and by salary among all matches
  statsRank?: number | null;
  payRank?: number | null;
};

const playerName = (player: RosterManagerPlayer): string =>
  player.bio?.displayName || player.name || 'Unknown';

// Stat feeds mark a traded player's full-season line as TOT / 2TM / 3TM
const teamLabel = (team: string | null): string => {
  if (!team) return '—';
  return /^(TOT|\dTM)$/i.test(team) ? 'Multiple' : team.toUpperCase();
};

const statLabel = (
  stats: PoolSearchRow['stats'],
  field: string
): string => {
  const value = Number(stats?.[field]);
  return stats?.[field] != null && Number.isFinite(value) ? value.toFixed(1) : '—';
};

type PoolSearchResultsProps = {
  active: boolean;
  loading: boolean;
  error: string | null;
  season: string;
  rows: PoolSearchRow[];
  onAdd: (players: RosterManagerPlayer[]) => void;
  // Start with every row ticked (untick to leave a player out)
  preselect?: boolean;
  // Top-N preset: the next players after the pool, to add by hand
  nearMisses?: PoolSearchRow[];
};

export const PoolSearchResults = ({
  active,
  loading,
  error,
  season,
  rows,
  onAdd,
  preselect = false,
  nearMisses = [],
}: PoolSearchResultsProps) => {
  // Ticked ids, or with `preselect` the unticked ones
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [lastPreselect, setLastPreselect] = useState(preselect);
  if (lastPreselect !== preselect) {
    setLastPreselect(preselect);
    setToggled(new Set());
  }
  const isSelected = (id: string) => toggled.has(id) !== preselect;

  const addable = useMemo(() => rows.filter((r) => !r.inPool), [rows]);
  // Only count selections that are still in the results and not yet added
  const selectedRows = useMemo(
    () => addable.filter((r) => toggled.has(r.player.id) !== preselect),
    [addable, toggled, preselect]
  );
  const ranked = rows.some((r) => r.rank !== undefined);

  if (!active) {
    return (
      <p className="px-4 py-6 rounded-lg border border-dashed border-white/[0.08] text-center text-white/30 text-xs">
        Search for a player or set a filter to see players.
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-red-300 text-xs">
        Couldn&apos;t load {season} data: {error}
      </p>
    );
  }
  if (loading) {
    return <p className="px-4 py-6 text-center text-white/40 text-xs">Loading {season} data…</p>;
  }

  const add = (players: RosterManagerPlayer[]) => {
    if (players.length === 0) return;
    onAdd(players);
    setToggled(new Set());
  };
  const toggle = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = addable.length > 0 && selectedRows.length === addable.length;
  const alreadyIn = rows.length - addable.length;
  const shown = rows.slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm text-white/70">
          <span className="text-white font-semibold">{rows.length}</span> player
          {rows.length === 1 ? '' : 's'}
          {alreadyIn > 0 && (
            <span className="text-white/40"> · {alreadyIn} already in pool</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => add(selectedRows.map((r) => r.player))}
            disabled={selectedRows.length === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-white/20 text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            Add selected ({selectedRows.length})
          </button>
          <button
            onClick={() => add(addable.map((r) => r.player))}
            disabled={addable.length === 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            Add all {addable.length}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-white/30 text-xs">No players match.</p>
      ) : (
        <div className="rounded-lg border border-white/[0.07] overflow-auto max-h-[480px]">
          <table className="w-full text-xs text-white/70 tabular-nums whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-[#1e1e1e] text-white/35 text-[10px] uppercase tracking-wider">
              <tr className="border-b border-white/[0.07]">
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    disabled={addable.length === 0}
                    onChange={() => {
                      // Select all (or none): with preselect that's an empty
                      // (or full) set of unticked ids
                      const all = new Set(addable.map((r) => r.player.id));
                      setToggled(allSelected === preselect ? all : new Set());
                    }}
                  />
                </th>
                {ranked && <th className="text-right px-2 py-2">#</th>}
                <th className="text-left px-2 py-2">Player</th>
                <th className="text-left px-2 py-2">Team</th>
                <th className="text-right px-2 py-2">Age</th>
                <th className="text-right px-2 py-2">Salary</th>
                <th className="text-right px-2 py-2">PPG</th>
                <th className="text-right px-2 py-2">RPG</th>
                <th className="text-right px-2 py-2">APG</th>
                <th className="text-right px-2 py-2">GP</th>
                {ranked && (
                  <>
                    <th className="text-right px-2 py-2" title="Game Score per game">
                      Score
                    </th>
                    <th className="text-right px-2 py-2" title="Place by Game Score among all matches">
                      Stats #
                    </th>
                    <th className="text-right px-2 py-2" title="Place by salary among all matches">
                      Pay #
                    </th>
                  </>
                )}
                <th className="w-16 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const id = row.player.id;
                const name = playerName(row.player);
                return (
                  <tr
                    key={id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={!row.inPool && isSelected(id)}
                        disabled={row.inPool}
                        onChange={() => toggle(id)}
                      />
                    </td>
                    {ranked && (
                      <td className="px-2 py-1.5 text-right text-white/40">{row.rank}</td>
                    )}
                    <td className="px-2 py-1.5 text-white">{name}</td>
                    <td className="px-2 py-1.5">{teamLabel(row.team)}</td>
                    <td className="px-2 py-1.5 text-right">{row.age ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{formatSalary(row.salary)}</td>
                    <td className="px-2 py-1.5 text-right">{statLabel(row.stats, 'PTS')}</td>
                    <td className="px-2 py-1.5 text-right">{statLabel(row.stats, 'REB')}</td>
                    <td className="px-2 py-1.5 text-right">{statLabel(row.stats, 'AST')}</td>
                    <td className="px-2 py-1.5 text-right">
                      {row.stats?.GP != null ? String(row.stats.GP) : '—'}
                    </td>
                    {ranked && (
                      <>
                        <td className="px-2 py-1.5 text-right">
                          {row.score !== undefined ? row.score.toFixed(1) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right text-white/50">
                          {row.statsRank ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right text-white/50">
                          {row.payRank ?? '—'}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1.5 text-right">
                      {row.inPool ? (
                        <span className="inline-flex items-center gap-1 text-white/35">
                          <Check className="w-3 h-3" /> In pool
                        </span>
                      ) : (
                        <button
                          onClick={() => add([row.player])}
                          aria-label={`Add ${name}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white hover:bg-white/20"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > limit && (
        <button
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
          className="mt-2 text-xs text-white/50 hover:text-white"
        >
          {rows.length - limit > PAGE_SIZE
            ? `Show ${PAGE_SIZE} more of ${rows.length - limit}`
            : `Show the last ${rows.length - limit}`}
        </button>
      )}

      {nearMisses.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-dashed border-white/10">
          <p className="text-xs text-white/50 mb-2">
            Not in the pool · just missed the cut ({nearMisses.length}): tap anyone who could make your list
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nearMisses.map((row) =>
              row.inPool ? (
                <span
                  key={row.player.id}
                  className="px-2 py-1 rounded-md text-xs text-white/30 border border-white/[0.06]"
                >
                  {playerName(row.player)} ✓
                </span>
              ) : (
                <button
                  key={row.player.id}
                  onClick={() => onAdd([row.player])}
                  aria-label={`Add ${playerName(row.player)} (near miss)`}
                  className="px-2 py-1 rounded-md text-xs text-white/75 bg-white/[0.06] hover:bg-white/15 transition-colors"
                >
                  + {playerName(row.player)}
                </button>
              )
            )}
          </div>
        </div>
      )}

    </div>
  );
};
