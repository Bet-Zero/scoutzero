/**
 * FILE: src/features/architect/GMDashboard/components/WorldTimeControls.tsx
 * PURPOSE: World date controls for Architect GM dashboard worlds.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { useEffect, useState, type ChangeEvent } from 'react';
import type { ArchitectWorldTimeOwner } from '@/features/architect/GMDashboard/hooks/useArchitectState';

type WorldTimeControlsProps = {
  worldTimeOwner: ArchitectWorldTimeOwner;
  disabled?: boolean;
};

export function WorldTimeControls({
  worldTimeOwner,
  disabled,
}: WorldTimeControlsProps) {
  const {
    worldId,
    asOfDate,
    isUpdatingAsOfDate,
    updateAsOfDate,
    advanceByOneDay,
  } = worldTimeOwner;
  const [draftDate, setDraftDate] = useState<string>(asOfDate || '');
  const [mutationError, setMutationError] = useState('');

  useEffect(() => {
    if (!isUpdatingAsOfDate) {
      setDraftDate(asOfDate || '');
    }
  }, [asOfDate, isUpdatingAsOfDate]);

  if (!worldId) return null;

  const hasAuthoritativeDate = Boolean(asOfDate);
  const isShowingPendingDate =
    isUpdatingAsOfDate && draftDate !== (asOfDate || '');
  const savedDateLabel = asOfDate || 'unset';

  const handleAdvanceDay = async () => {
    if (!hasAuthoritativeDate) {
      return;
    }

    setMutationError('');

    try {
      await advanceByOneDay();
    } catch (error) {
      console.error('Failed to advance world time:', error);
      setDraftDate(asOfDate || '');
      setMutationError(
        `Could not advance world date. Saved world date is still ${savedDateLabel}.`
      );
    }
  };

  const handleDateChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    setDraftDate(newDate);
    setMutationError('');

    if (!newDate) {
      setDraftDate(asOfDate || '');
      return;
    }

    try {
      await updateAsOfDate(newDate);
    } catch (error) {
      console.error('Failed to update world time:', error);
      setDraftDate(asOfDate || '');
      setMutationError(
        `Could not save world date. Saved world date is still ${savedDateLabel}.`
      );
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-l border-white/10 pl-4 ml-2"
      data-testid="world-time-controls"
    >
      <label className="text-xs text-white/70 font-medium">World Date</label>

      <input
        type="date"
        value={draftDate}
        onChange={handleDateChange}
        disabled={disabled || isUpdatingAsOfDate}
        className="bg-[#1a1a1a] text-white text-xs px-2 py-1.5 rounded border border-white/10 w-[110px] focus:border-blue-500 focus:outline-none transition-colors"
        title="Set world 'as of' date"
        data-testid="world-date-input"
      />

      <button
        type="button"
        onClick={handleAdvanceDay}
        disabled={disabled || isUpdatingAsOfDate || !hasAuthoritativeDate}
        className="px-2 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        title={
          hasAuthoritativeDate
            ? 'Advance one day'
            : 'Set a world date before advancing time'
        }
        data-testid="advance-day-button"
      >
        <span>+1 Day</span>
        {isUpdatingAsOfDate && <span className="animate-pulse">...</span>}
      </button>

      {mutationError ? (
        <span className="text-[10px] text-red-400" role="alert">
          {mutationError}
        </span>
      ) : isShowingPendingDate ? (
        <span className="text-[10px] text-blue-300/80" role="status">
          Saving {draftDate}...
        </span>
      ) : !hasAuthoritativeDate ? (
        <span
          className="text-[10px] text-yellow-500/80"
          title="Set a world date before advancing time"
        >
          Set a world date to enable +1 Day.
        </span>
      ) : null}
    </div>
  );
}
