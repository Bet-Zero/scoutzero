/**
 * FILE: src/features/ranker/PoolSearchResults.tsx
 * PURPOSE: Results pane of the ranker workbench: the results table, bulk ticking (shift-click or drag a run, tick or untick everyone shown, tick the top N) and add-selected / add-all actions
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Created; replaces FilterMatchPreview (name chips with add-all only) (PR #565)
 *  - 2026-10-22: Rank and score columns, and pre-ticked rows for the Top-N preset
 *  - 2026-10-22: Stats and pay rank columns, and a tap-to-add near-miss list
 *  - 2026-10-24: Fills a fixed-height pane: table scrolls, near misses and actions stay pinned below
 *  - 2026-10-27: Top-N lists show every candidate (no paging), so nobody ticked is out of sight
 *  - 2026-10-31: Top-N lists show everyone (near-miss list gone); bulk ticking; sortable columns; ticks survive a search
 *
 * LINKS:
 *  - PR: https://github.com/Bet-Zero/scoutzero/pull/565
 *  - Used in: src/features/ranker/PoolWorkbench.tsx
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import {
  nextSort,
  PoolResultsTable,
  sortRows,
  type PoolSearchRow,
  type PoolSort,
} from './PoolResultsTable';
import { fieldClass } from './RankerPanel';

const PAGE_SIZE = 50;

export type { PoolSearchRow } from './PoolResultsTable';

type PoolSearchResultsProps = {
  active: boolean;
  loading: boolean;
  error: string | null;
  season: string;
  // What's shown
  rows: PoolSearchRow[];
  // Everyone the list is about (a Top-N list's whole ranking, which a search
  // only narrows); defaults to `rows`
  universe?: PoolSearchRow[];
  onAdd: (players: RosterManagerPlayer[]) => void;
  // Top-N list: everyone is shown, ranked, and these start ticked
  preselect?: boolean;
  defaultTicked?: readonly string[];
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

const smallButton =
  'h-7 px-2.5 text-xs rounded-md border border-white/15 text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed';

export const PoolSearchResults = ({
  active,
  loading,
  error,
  season,
  rows,
  universe = rows,
  onAdd,
  preselect = false,
  defaultTicked = [],
  header = null,
}: PoolSearchResultsProps) => {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(defaultTicked)
  );
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<PoolSort | null>(
    preselect ? { key: 'rank', dir: 'asc' } : null
  );
  // "Tick the top N": what's typed, or null for the usual candidates
  const [topTyped, setTopTyped] = useState<string | null>(null);
  // The last box clicked, for shift-click runs
  const anchor = useRef<string | null>(null);
  // A drag down the boxes: the value it paints and the last box it reached
  const drag = useRef<{ value: boolean; start: string; last: string; moved: boolean } | null>(null);

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  // Top-N lists show everyone: a ticked player below a "show more" button
  // would be added without ever being seen
  const shown = preselect ? sorted : sorted.slice(0, limit);
  const remaining = sorted.length - shown.length;
  const inPool = useMemo(
    () => new Set(universe.filter((r) => r.inPool).map((r) => r.player.id)),
    [universe]
  );
  const addable = useMemo(() => universe.filter((r) => !r.inPool), [universe]);
  const selectedRows = useMemo(
    () => addable.filter((r) => ticked.has(r.player.id)),
    [addable, ticked]
  );
  const shownIds = new Set(shown.map((r) => r.player.id));
  const shownAddable = shown.filter((r) => !r.inPool);
  const allShownTicked =
    shownAddable.length > 0 && shownAddable.every((r) => ticked.has(r.player.id));
  const tickedOutOfView = selectedRows.filter((r) => !shownIds.has(r.player.id)).length;

  const setMany = (ids: Iterable<string>, value: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (inPool.has(id)) continue;
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  // The shown players from one box to another, in the order on screen
  const run = (from: string, to: string): string[] => {
    const ids = shown.map((r) => r.player.id);
    const a = ids.indexOf(from);
    const b = ids.indexOf(to);
    if (a === -1 || b === -1) return [to];
    return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
  };

  const toggle = (id: string, shiftKey: boolean) => {
    // The click that ends a drag was already painted
    if (drag.current?.moved) {
      drag.current = null;
      return;
    }
    drag.current = null;
    const value = !ticked.has(id);
    setMany(shiftKey && anchor.current ? run(anchor.current, id) : [id], value);
    anchor.current = id;
  };
  const paintStart = (id: string) => {
    drag.current = { value: !ticked.has(id), start: id, last: id, moved: false };
  };
  const paintOver = (id: string) => {
    const d = drag.current;
    if (!d || id === d.last) return;
    // Everything between the last box reached and this one, so a fast drag
    // doesn't skip rows
    setMany(run(d.last, id), d.value);
    if (!d.moved) setMany([d.start], d.value);
    d.moved = true;
    d.last = id;
    anchor.current = id;
  };
  useEffect(() => {
    // Let the click that ends the drag see it, then forget it
    const end = () =>
      setTimeout(() => {
        drag.current = null;
      }, 0);
    window.addEventListener('pointerup', end);
    return () => window.removeEventListener('pointerup', end);
  }, []);

  const tickTop = (n: number) => {
    const top = universe.slice(0, Math.max(0, n)).map((r) => r.player.id);
    setTicked(new Set(top.filter((id) => !inPool.has(id))));
  };
  const topValue = topTyped ?? String(defaultTicked.length);
  const topN = Number.parseInt(topValue, 10);

  const add = (players: RosterManagerPlayer[]) => {
    if (players.length === 0) return;
    onAdd(players);
    setTicked(new Set());
  };

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
      <Message>
        {universe.length > 0
          ? 'Nobody in this list matches the search.'
          : 'No players match. Loosen a filter or clear the search.'}
      </Message>
    );
  } else {
    body = (
      <div className="relative flex-1 min-h-0 overflow-auto">
        <PoolResultsTable
          rows={shown}
          ranked={rows.some((r) => r.rank !== undefined)}
          isSelected={(id) => ticked.has(id)}
          allSelected={allShownTicked}
          canSelectAll={shownAddable.length > 0}
          onToggle={toggle}
          onToggleAll={() =>
            setMany(shownAddable.map((r) => r.player.id), !allShownTicked)
          }
          onPaintStart={paintStart}
          onPaintOver={paintOver}
          onAdd={(player) => add([player])}
          sort={sort}
          onSort={(key) => setSort((s) => nextSort(s, key))}
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
  const alreadyIn = universe.length - addable.length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {header}
      {showResults && rows.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-white/[0.06]">
          <button
            type="button"
            className={smallButton}
            disabled={shownAddable.length === 0 || allShownTicked}
            onClick={() => setMany(shownAddable.map((r) => r.player.id), true)}
          >
            Tick all shown
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={!shownAddable.some((r) => ticked.has(r.player.id))}
            onClick={() => setMany(shownAddable.map((r) => r.player.id), false)}
          >
            Untick all shown
          </button>
          {preselect && (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                className={smallButton}
                disabled={!(topN >= 0)}
                onClick={() => tickTop(topN)}
              >
                Tick only the top
              </button>
              <input
                type="number"
                min={0}
                max={universe.length}
                value={topValue}
                onChange={(e) => setTopTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && topN >= 0) tickTop(topN);
                }}
                aria-label="How many of the top to tick"
                className={`${fieldClass} !h-7 w-16 px-2 text-xs`}
              />
            </span>
          )}
          {/* Mouse only: touch has the buttons above, sorting and search */}
          <span className="hidden md:inline text-[11px] text-white/35">
            Shift-click, or drag down the boxes, to tick or untick a run.
          </span>
        </div>
      )}
      {body}

      {showResults && rows.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-white/[0.06]">
          <p className="text-sm text-white/65">
            <span className="text-white font-semibold">{universe.length}</span>{' '}
            player
            {universe.length === 1 ? '' : 's'}
            <span className="text-white/40">
              {' '}
              · <span className="text-white/80 font-semibold">{selectedRows.length}</span> ticked
            </span>
            {tickedOutOfView > 0 && (
              <span className="text-white/40">
                {' '}
                ({tickedOutOfView} not shown)
              </span>
            )}
            {alreadyIn > 0 && (
              <span className="text-white/40">
                {' '}
                · {alreadyIn} already in pool
              </span>
            )}
          </p>
          <div className="flex gap-2">
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
            {/* Top-N lists start ticked, so "add all" would quietly bring
                back players the user unticked: only offer the ticked */}
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
