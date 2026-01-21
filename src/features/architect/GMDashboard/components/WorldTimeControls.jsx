import React, { useState } from 'react';
import { updateWorldMetadata } from '@/features/architect/utils/worldManager';

/**
 * WorldTimeControls
 * 
 * Provides UI to view and update the world's "as of" date.
 * This drives timing-based CBA rules (e.g. 48-hour offer sheet window, stretch provision timing).
 * 
 * @param {Object} props
 * @param {string} props.worldId - Active world ID
 * @param {string|null} props.asOfDate - Current world date (YYYY-MM-DD)
 * @param {Function} props.setAsOfDate - Setter for local optimistic update
 * @param {boolean} [props.disabled] - Whether controls are disabled
 */
export function WorldTimeControls({ worldId, asOfDate, setAsOfDate, disabled }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If no world active, do not render
  if (!worldId) return null;

  // Default to today if not set, but visual indication of "System Time" vs "World Time" is handled by lack of persistence?
  // We'll just show the date being used.
  const displayDate = asOfDate || new Date().toISOString().slice(0, 10);

  const handleAdvanceDay = async () => {
    setIsSubmitting(true);
    try {
      const current = new Date(displayDate);
      // Add 1 day
      current.setDate(current.getDate() + 1);
      const nextDate = current.toISOString().slice(0, 10);
      
      await updateWorldMetadata(worldId, { asOfDate: nextDate });
      setAsOfDate(nextDate);
    } catch (e) {
      console.error('Failed to advance world time:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = async (e) => {
    const newDate = e.target.value;
    if (!newDate) return;
    
    setIsSubmitting(true);
    try {
      await updateWorldMetadata(worldId, { asOfDate: newDate });
      setAsOfDate(newDate);
    } catch (e) {
      console.error('Failed to update world time:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-2">
      <label className="text-xs text-white/70 font-medium">
        World Date
      </label>
      
      {/* Date Picker */}
      <input 
        type="date" 
        value={displayDate} 
        onChange={handleDateChange}
        disabled={disabled || isSubmitting}
        className="bg-[#1a1a1a] text-white text-xs px-2 py-1.5 rounded border border-white/10 w-[110px] focus:border-blue-500 focus:outline-none transition-colors"
        title="Set world 'as of' date"
      />
      
      {/* Advance Button */}
      <button
        type="button"
        onClick={handleAdvanceDay}
        disabled={disabled || isSubmitting}
        className="px-2 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Advance one day"
      >
        <span>+1 Day</span>
        {isSubmitting && <span className="animate-pulse">...</span>}
      </button>

      {/* Warning indicator if using defaulted system time (optional visual cue) */}
      {!asOfDate && (
        <span className="text-[10px] text-yellow-500/80" title="Using current system time (default)">
          (System)
        </span>
      )}
    </div>
  );
}
