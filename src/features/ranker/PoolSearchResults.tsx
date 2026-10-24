/**
 * FILE: src/features/ranker/PoolSearchResults.tsx
 * PURPOSE: Results pane of the ranker workbench: the results table, near misses for the Top-N preset, and add-selected / add-all actions
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created; replaces FilterMatchPreview (name chips with add-all only) (PR #565)
 *  - 2026-10-22: Rank and score columns, and pre-ticked rows for the Top-N preset
 *  - 2026-10-22: Stats and pay rank columns, and a tap-to-add near-miss list
 *  - 2026-10-24: Fills a fixed-height pane: table scrolls, near misses and actions stay pinned below
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/565
 *  - Used in: src/features/ranker/PoolWorkbench.tsx
 */
import React, { useMemo, useState } from 'react';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import { PoolResultsTable, type PoolSearchRow } from './PoolResultsTable';
import { NearMissStrip } from './NearMissStrip';

const PAGE_SIZE = 50;

export type { PoolSearchRow } from './PoolResultsTable';

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
  // Notes and controls shown above the table
  header?: React.ReactNode;
};

const Message = ({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'error';
}) => (
  <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
    <p
      className={`max-w-sm text-sm leading-relaxed ${tone === 'error' ? 'text-red-300' : 'text-white/35'}`}
    >
      {children}
    </p>
  </div>
);

export const PoolSearchResults = ({
  active,
  loading,
  error,
  season,
  rows,
  onAdd,
  preselect = false,
  nearMisses = [],
  header = null,
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
  const allSelected =
    addable.length > 0 && selectedRows.length === addable.length;
  const alreadyIn = rows.length - addable.length;
  const remaining = rows.length - limit;

  let body: React.ReactNode;
  if (!active) {
    body = (
      <Message>
        <span className="block">
          Search for a player or set a filter to see players.
        </span>
        <span className="block mt-1 text-white/25">
          You can also pull a Top-N pool, or add a whole team or one of your
          lists from the top bar.
        </span>
      </Message>
    );
  } else if (error) {
    body = (
      <Message tone="error">
        Couldn&apos;t load {season} data: {error}
      </Message>
    );
  } else if (loading) {
    body = <Message>Loading {season} data…</Message>;
  } else if (rows.length === 0) {
    body = (
      <Message>No players match. Loosen a filter or clear the search.</Message>
    );
  } else {
    body = (
      <div className="relative flex-1 min-h-0 overflow-auto">
        <PoolResultsTable
          rows={rows.slice(0, limit)}
          ranked={rows.some((r) => r.rank !== undefined)}
          isSelected={isSelected}
          allSelected={allSelected}
          canSelectAll={addable.length > 0}
          onToggle={toggle}
          onToggleAll={() => {
            // Select all (or none): with preselect that's an empty
            // (or full) set of unticked ids
            const all = new Set(addable.map((r) => r.player.id));
            setToggled(allSelected === preselect ? all : new Set());
          }}
          onAdd={(player) => add([player])}
        />
        {remaining > 0 && (
          <button
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="w-full py-2.5 text-xs text-white/50 hover:text-white hover:bg-white/[0.03]"
          >
            {remaining > PAGE_SIZE
              ? `Show ${PAGE_SIZE} more of ${remaining}`
              : `Show the last ${remaining}`}
          </button>
        )}
      </div>
    );
  }

  const showResults = active && !error && !loading;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {header}
      {body}

      {showResults && <NearMissStrip nearMisses={nearMisses} onAdd={onAdd} />}

      {showResults && rows.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-white/[0.06]">
          <p className="text-sm text-white/65">
            <span className="text-white font-semibold">{rows.length}</span>{' '}
            player
            {rows.length === 1 ? '' : 's'}
            {alreadyIn > 0 && (
              <span className="text-white/40">
                {' '}
                · {alreadyIn} already in pool
              </span>
            )}
          </p>
          <div className="flex gap-2">
            {/* Top-N lists start fully ticked, so "add all" would quietly
                bring back players the user unticked: only offer the ticked */}
            <button
              onClick={() => add(selectedRows.map((r) => r.player))}
              disabled={selectedRows.length === 0}
              className={`h-8 px-3 text-sm rounded-lg disabled:opacity-25 disabled:cursor-not-allowed transition-colors ${
                preselect
                  ? 'bg-white text-black font-semibold hover:bg-white/90'
                  : 'border border-white/20 text-white hover:bg-white/10'
              }`}
            >
              Add selected ({selectedRows.length})
            </button>
            {!preselect && (
              <button
                onClick={() => add(addable.map((r) => r.player))}
                disabled={addable.length === 0}
                className="h-8 px-3 text-sm rounded-lg bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                Add all {addable.length}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
