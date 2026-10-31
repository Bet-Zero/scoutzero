/**
 * FILE: src/features/ranker/PoolResultsTable.tsx
 * PURPOSE: The ranker workbench's results table: each player's team, season in the league, age, salary and stats for the chosen season, with sortable columns, tick boxes (shift-click or drag for a run) and add-one controls
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created as part of PoolSearchResults.tsx (PR #565)
 *  - 2026-10-22: Rank, score, stats-rank and pay-rank columns for the Top-N preset
 *  - 2026-10-24: Extracted from PoolSearchResults.tsx; sticky header and compact add button
 *  - 2026-10-31: Sortable columns, a season-in-the-league column, shift-click and drag to tick a run
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolSearchResults.tsx
 */
import React from 'react';
import { ArrowDown, ArrowUp, Check, Plus } from 'lucide-react';
import { formatSalary } from '@/shared/utils/formatting/basicFormatting';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import { getHeadshotSrc } from './utils/playerDisplay';

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
  // Season in the league that season (1 = rookie), when known
  exp?: number | null;
};

export const playerName = (player: RosterManagerPlayer): string =>
  player.bio?.displayName || player.name || 'Unknown';

// Stat feeds mark a traded player's full-season line as TOT / 2TM / 3TM
const teamLabel = (team: string | null): string => {
  if (!team) return '—';
  return /^(TOT|\dTM)$/i.test(team) ? 'Multiple' : team.toUpperCase();
};

const statValue = (stats: PoolSearchRow['stats'], field: string): number | null => {
  const value = Number(stats?.[field]);
  return stats?.[field] != null && Number.isFinite(value) ? value : null;
};

const statLabel = (stats: PoolSearchRow['stats'], field: string): string => {
  const value = statValue(stats, field);
  return value === null ? '—' : value.toFixed(1);
};

export const expLabel = (exp: number | null | undefined): string =>
  exp == null ? '—' : exp === 1 ? 'R' : String(exp);

export type SortKey =
  | 'rank'
  | 'name'
  | 'team'
  | 'exp'
  | 'age'
  | 'salary'
  | 'PTS'
  | 'REB'
  | 'AST'
  | 'GP'
  | 'score'
  | 'statsRank'
  | 'payRank';
export type PoolSort = { key: SortKey; dir: 'asc' | 'desc' };

// Columns where bigger is better sort high-to-low on the first click
const DESC_FIRST = new Set<SortKey>(['salary', 'PTS', 'REB', 'AST', 'GP', 'score']);
export const nextSort = (current: PoolSort | null, key: SortKey): PoolSort =>
  current?.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: DESC_FIRST.has(key) ? 'desc' : 'asc' };

const sortValue = (row: PoolSearchRow, key: SortKey): number | string | null => {
  switch (key) {
    case 'name':
      return playerName(row.player).toLowerCase();
    case 'team':
      return row.team ? teamLabel(row.team) : null;
    case 'PTS':
    case 'REB':
    case 'AST':
    case 'GP':
      return statValue(row.stats, key);
    default: {
      const value = row[key];
      return typeof value === 'number' ? value : null;
    }
  }
};

// Sorted copy; players without a value always go last; ties keep list order
export const sortRows = (rows: readonly PoolSearchRow[], sort: PoolSort | null): PoolSearchRow[] => {
  if (!sort) return [...rows];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: sortValue(row, sort.key) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const cmp =
        typeof a.v === 'string' || typeof b.v === 'string'
          ? String(a.v).localeCompare(String(b.v))
          : a.v - b.v;
      return cmp * sign || a.i - b.i;
    })
    .map(({ row }) => row);
};

type PoolResultsTableProps = {
  rows: PoolSearchRow[];
  ranked: boolean;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  canSelectAll: boolean;
  // A click on one box; with shift, everything from the last clicked box
  onToggle: (id: string, shiftKey: boolean) => void;
  onToggleAll: () => void;
  // Mouse drag down the boxes: pressed on one, then moving over others
  onPaintStart: (id: string) => void;
  onPaintOver: (id: string) => void;
  onAdd: (player: RosterManagerPlayer) => void;
  sort: PoolSort | null;
  onSort: (key: SortKey) => void;
};

const th = 'px-1.5 py-2 text-right font-semibold';
const thLeft = 'px-1.5 py-2 text-left font-semibold';
const td = 'px-1.5 py-1.5 text-right';

const SortHeader = ({
  label,
  sortKey,
  sort,
  onSort,
  left = false,
  title,
}: {
  label: string;
  sortKey: SortKey;
  sort: PoolSort | null;
  onSort: (key: SortKey) => void;
  left?: boolean;
  title?: string;
}) => {
  const active = sort?.key === sortKey;
  const Arrow = sort?.dir === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th
      className={left ? thLeft : th}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wider hover:text-white ${
          active ? 'text-white' : ''
        }`}
      >
        {label}
        {active && <Arrow className="w-3 h-3" aria-hidden />}
      </button>
    </th>
  );
};

export const PoolResultsTable = ({
  rows,
  ranked,
  isSelected,
  allSelected,
  canSelectAll,
  onToggle,
  onToggleAll,
  onPaintStart,
  onPaintOver,
  onAdd,
  sort,
  onSort,
}: PoolResultsTableProps) => {
  const header = (label: string, key: SortKey, left = false, title?: string) => (
    <SortHeader label={label} sortKey={key} sort={sort} onSort={onSort} left={left} title={title} />
  );
  return (
    <table className="w-full text-xs text-white/70 tabular-nums whitespace-nowrap">
      <thead className="sticky top-0 z-10 bg-[#1d1d1d] text-white/35 text-[10px] uppercase tracking-wider">
        <tr className="border-b border-white/[0.07]">
          <th className="w-8 pl-3 pr-1.5 py-2">
            <input
              type="checkbox"
              aria-label="Select all shown"
              checked={allSelected}
              disabled={!canSelectAll}
              onChange={onToggleAll}
            />
          </th>
          {ranked && header('#', 'rank')}
          {header('Player', 'name', true)}
          {header('Team', 'team', true)}
          {header('Yr', 'exp', false, 'Season in the league (R = rookie)')}
          {header('Age', 'age')}
          {header('Salary', 'salary')}
          {header('PPG', 'PTS')}
          {header('RPG', 'REB')}
          {header('APG', 'AST')}
          {header('GP', 'GP')}
          {ranked && (
            <>
              {header('Score', 'score', false, 'Game Score per game')}
              {header('Stats #', 'statsRank', false, 'Place by Game Score among all matches')}
              {header('Pay #', 'payRank', false, 'Place by salary among all matches')}
            </>
          )}
          <th className="w-10 pl-1.5 pr-3 py-2">
            <span className="sr-only">Add</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const id = row.player.id;
          const name = playerName(row.player);
          return (
            <tr
              key={id}
              className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]"
            >
              <td
                className="pl-3 pr-1.5 py-1.5 text-center select-none"
                onPointerDown={(e) => {
                  // Touch scrolls; only the main mouse button paints
                  if (row.inPool || e.pointerType === 'touch' || e.button > 0) return;
                  // No text selection while dragging down the boxes
                  e.preventDefault();
                  onPaintStart(id);
                }}
                onPointerOver={() => {
                  if (!row.inPool) onPaintOver(id);
                }}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${name}`}
                  checked={!row.inPool && isSelected(id)}
                  disabled={row.inPool}
                  onChange={() => undefined}
                  onClick={(e) => onToggle(id, e.shiftKey)}
                />
              </td>
              {ranked && <td className={`${td} text-white/35`}>{row.rank}</td>}
              <td className="px-1.5 py-1.5 text-white">
                <span className="flex items-center gap-2">
                  <img
                    src={getHeadshotSrc(row.player)}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover bg-white/[0.06] flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/assets/headshots/default.png';
                    }}
                  />
                  {name}
                </span>
              </td>
              <td className="px-1.5 py-1.5">{teamLabel(row.team)}</td>
              <td className={`${td} ${row.exp === 1 ? 'text-amber-200' : ''}`}>{expLabel(row.exp)}</td>
              <td className={td}>{row.age ?? '—'}</td>
              <td className={td}>{formatSalary(row.salary)}</td>
              <td className={td}>{statLabel(row.stats, 'PTS')}</td>
              <td className={td}>{statLabel(row.stats, 'REB')}</td>
              <td className={td}>{statLabel(row.stats, 'AST')}</td>
              <td className={td}>
                {row.stats?.GP != null ? String(row.stats.GP) : '—'}
              </td>
              {ranked && (
                <>
                  <td className={td}>
                    {row.score !== undefined ? row.score.toFixed(1) : '—'}
                  </td>
                  <td className={`${td} text-white/45`}>
                    {row.statsRank ?? '—'}
                  </td>
                  <td className={`${td} text-white/45`}>{row.payRank ?? '—'}</td>
                </>
              )}
              <td className="pl-1.5 pr-3 py-1.5 text-right">
                {row.inPool ? (
                  <span
                    className="inline-flex w-6 h-6 items-center justify-center text-emerald-300/70"
                    title="In pool"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden />
                    <span className="sr-only">In pool</span>
                  </span>
                ) : (
                  <button
                    onClick={() => onAdd(row.player)}
                    aria-label={`Add ${name}`}
                    title="Add to pool"
                    className="inline-flex w-6 h-6 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white hover:text-black transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
