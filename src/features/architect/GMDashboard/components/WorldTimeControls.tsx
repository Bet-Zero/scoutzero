/**
 * FILE: src/features/architect/GMDashboard/components/WorldTimeControls.tsx
 * PURPOSE: World date controls for Architect GM dashboard worlds.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { useState, type ChangeEvent } from 'react';
import { updateWorldMetadata } from '@/features/architect/utils/worldManager';

type WorldTimeControlsProps = {
  worldId?: string | null;
  asOfDate?: string | null;
  setAsOfDate: (value: string) => void;
  disabled?: boolean;
};

export function WorldTimeControls({
  worldId,
  asOfDate,
  setAsOfDate,
  disabled,
}: WorldTimeControlsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!worldId) return null;

  const displayDate = asOfDate || new Date().toISOString().slice(0, 10);

  const handleAdvanceDay = async () => {
    setIsSubmitting(true);
    try {
      const current = new Date(displayDate);
      current.setDate(current.getDate() + 1);
      const nextDate = current.toISOString().slice(0, 10);

      await updateWorldMetadata(worldId, { asOfDate: nextDate });
      setAsOfDate(nextDate);
    } catch (error) {
      console.error('Failed to advance world time:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    if (!newDate) return;

    setIsSubmitting(true);
    try {
      await updateWorldMetadata(worldId, { asOfDate: newDate });
      setAsOfDate(newDate);
    } catch (error) {
      console.error('Failed to update world time:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex items-center gap-2 border-l border-white/10 pl-4 ml-2"
      data-testid="world-time-controls"
    >
      <label className="text-xs text-white/70 font-medium">World Date</label>

      <input
        type="date"
        value={displayDate}
        onChange={handleDateChange}
        disabled={disabled || isSubmitting}
        className="bg-[#1a1a1a] text-white text-xs px-2 py-1.5 rounded border border-white/10 w-[110px] focus:border-blue-500 focus:outline-none transition-colors"
        title="Set world 'as of' date"
        data-testid="world-date-input"
      />

      <button
        type="button"
        onClick={handleAdvanceDay}
        disabled={disabled || isSubmitting}
        className="px-2 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Advance one day"
        data-testid="advance-day-button"
      >
        <span>+1 Day</span>
        {isSubmitting && <span className="animate-pulse">...</span>}
      </button>

      {!asOfDate && (
        <span
          className="text-[10px] text-yellow-500/80"
          title="Using current system time (default)"
        >
          (System)
        </span>
      )}
    </div>
  );
}
