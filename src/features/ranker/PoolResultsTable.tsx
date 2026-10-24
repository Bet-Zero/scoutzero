/**
 * FILE: src/features/ranker/PoolResultsTable.tsx
 * PURPOSE: The ranker workbench's results table: each player's team, age, salary and stats for the chosen season, with select and add-one controls
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created as part of PoolSearchResults.tsx (PR #565)
 *  - 2026-10-22: Rank, score, stats-rank and pay-rank columns for the Top-N preset
 *  - 2026-10-24: Extracted from PoolSearchResults.tsx; sticky header and compact add button
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolSearchResults.tsx
 */
import React from 'react';
import { Check, Plus } from 'lucide-react';
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
};

export const playerName = (player: RosterManagerPlayer): string =>
  player.bio?.displayName || player.name || 'Unknown';

// Stat feeds mark a traded player's full-season line as TOT / 2TM / 3TM
const teamLabel = (team: string | null): string => {
  if (!team) return '—';
  return /^(TOT|\dTM)$/i.test(team) ? 'Multiple' : team.toUpperCase();
};

const statLabel = (stats: PoolSearchRow['stats'], field: string): string => {
  const value = Number(stats?.[field]);
  return stats?.[field] != null && Number.isFinite(value)
    ? value.toFixed(1)
    : '—';
};

type PoolResultsTableProps = {
  rows: PoolSearchRow[];
  ranked: boolean;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  canSelectAll: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onAdd: (player: RosterManagerPlayer) => void;
};

const th = 'px-1.5 py-2 text-right font-semibold';
const thLeft = 'px-1.5 py-2 text-left font-semibold';
const td = 'px-1.5 py-1.5 text-right';

export const PoolResultsTable = ({
  rows,
  ranked,
  isSelected,
  allSelected,
  canSelectAll,
  onToggle,
  onToggleAll,
  onAdd,
}: PoolResultsTableProps) => (
  <table className="w-full text-xs text-white/70 tabular-nums whitespace-nowrap">
    <thead className="sticky top-0 z-10 bg-[#1d1d1d] text-white/35 text-[10px] uppercase tracking-wider">
      <tr className="border-b border-white/[0.07]">
        <th className="w-8 pl-3 pr-1.5 py-2">
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allSelected}
            disabled={!canSelectAll}
            onChange={onToggleAll}
          />
        </th>
        {ranked && <th className={th}>#</th>}
        <th className={thLeft}>Player</th>
        <th className={thLeft}>Team</th>
        <th className={th}>Age</th>
        <th className={th}>Salary</th>
        <th className={th}>PPG</th>
        <th className={th}>RPG</th>
        <th className={th}>APG</th>
        <th className={th}>GP</th>
        {ranked && (
          <>
            <th className={th} title="Game Score per game">
              Score
            </th>
            <th className={th} title="Place by Game Score among all matches">
              Stats #
            </th>
            <th className={th} title="Place by salary among all matches">
              Pay #
            </th>
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
            <td className="pl-3 pr-1.5 py-1.5 text-center">
              <input
                type="checkbox"
                aria-label={`Select ${name}`}
                checked={!row.inPool && isSelected(id)}
                disabled={row.inPool}
                onChange={() => onToggle(id)}
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
