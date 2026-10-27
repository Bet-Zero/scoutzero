/**
 * FILE: src/features/ranker/ListSizePicker.tsx
 * PURPOSE: Choose how long the ranked list is (everyone, a Top-N preset or a custom N) right above Start Ranking
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created; list length moved here from the ranking setup screen
 *  - 2026-10-27: A custom size past the pool shows the size used once you leave the box
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolPanel.tsx
 */
import React, { useEffect, useRef, useState } from 'react';

const PRESETS = [10, 20, 50, 100];

type ListSizePickerProps = {
  poolCount: number;
  // null ranks everyone
  listSize: number | null;
  onChange: (listSize: number | null) => void;
};

// A list size only counts from 2 up, and when it's shorter than the pool
export const effectiveListSize = (
  listSize: number | null,
  poolCount: number
): number | null =>
  listSize !== null && listSize >= 2 && listSize < poolCount ? listSize : null;

export const ListSizePicker = ({
  poolCount,
  listSize,
  onChange,
}: ListSizePickerProps) => {
  const size = effectiveListSize(listSize, poolCount);
  const presets = PRESETS.filter((n) => n < poolCount);
  const [custom, setCustom] = useState(false);
  // What's typed, so a first digit like the 1 of 15 isn't wiped out
  const [typed, setTyped] = useState('');
  // A size set from outside (a Top-N pull) leaves custom entry
  const emitted = useRef(listSize);
  const emit = (next: number | null) => {
    emitted.current = next;
    onChange(next);
  };
  useEffect(() => {
    if (listSize !== emitted.current) {
      emitted.current = listSize;
      setCustom(false);
    }
  }, [listSize]);
  const value =
    custom || (size !== null && !presets.includes(size))
      ? 'custom'
      : size === null
        ? 'all'
        : String(size);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor="ranker-list-size"
          className="text-xs text-white/50 whitespace-nowrap"
        >
          List
        </label>
        <select
          id="ranker-list-size"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setCustom(next === 'custom');
            setTyped(size === null ? '' : String(size));
            if (next === 'all') emit(null);
            else if (next !== 'custom') emit(Number(next));
          }}
          className="flex-1 min-w-0 h-8 bg-white/[0.05] text-white text-sm rounded-lg border border-white/[0.1] px-2"
        >
          <option value="all" className="bg-[#1a1a1a]">
            Rank everyone ({poolCount})
          </option>
          {presets.map((n) => (
            <option key={n} value={String(n)} className="bg-[#1a1a1a]">
              Top {n}
            </option>
          ))}
          {poolCount > 2 && (
            <option value="custom" className="bg-[#1a1a1a]">
              Custom…
            </option>
          )}
        </select>
        {value === 'custom' && (
          <input
            type="number"
            min={2}
            max={Math.max(2, poolCount - 1)}
            value={typed}
            placeholder="N"
            aria-label="Custom list size"
            onChange={(e) => {
              setTyped(e.target.value);
              const n = Number.parseInt(e.target.value, 10);
              emit(
                Number.isFinite(n) && n >= 2 ? Math.min(n, poolCount - 1) : null
              );
            }}
            // Show the size actually used (e.g. 500 in a pool of 120 is 119)
            onBlur={() => setTyped(size === null ? '' : String(size))}
            className="w-16 h-8 bg-white/[0.05] text-white text-sm rounded-lg border border-white/[0.1] px-2"
          />
        )}
      </div>
      {size !== null && (
        <p className="mt-1.5 text-[11px] leading-snug text-white/40">
          Builds your Top {size} first (locks, then quick cut-line matchups),
          then ranks it.
        </p>
      )}
    </div>
  );
};
