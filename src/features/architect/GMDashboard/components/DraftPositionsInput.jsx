/**
 * FILE: src/features/architect/GMDashboard/components/DraftPositionsInput.jsx
 * PURPOSE: Minimal UI for entering/importing draft positions for a given year
 *          Phase 5: Enables real-world draft results input for conveyance/swap resolution
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2026-01-07: Phase 5 - Created for draft positions input
 *
 * LINKS:
 *  - worldManager.js: getDraftPositions, saveDraftPositions, validateDraftPositionsMap
 *  - seasonManager.js: auto-resolves picks when positionsMap exists
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  getDraftPositions,
  saveDraftPositions,
  validateDraftPositionsMap,
} from '@/features/architect/utils/worldManager';

// ==============================================================================
// CONSTANTS
// ==============================================================================

// Generate sample JSON template with all 30 NBA teams
const SAMPLE_POSITIONS_TEMPLATE = {
  ATL: 1, BOS: 2, BKN: 3, CHA: 4, CHI: 5,
  CLE: 6, DAL: 7, DEN: 8, DET: 9, GSW: 10,
  HOU: 11, IND: 12, LAC: 13, LAL: 14, MEM: 15,
  MIA: 16, MIL: 17, MIN: 18, NOP: 19, NYK: 20,
  OKC: 21, ORL: 22, PHI: 23, PHX: 24, POR: 25,
  SAC: 26, SAS: 27, TOR: 28, UTA: 29, WAS: 30,
};

// ==============================================================================
// COMPONENT
// ==============================================================================

/**
 * DraftPositionsInput - Minimal UI for entering draft positions JSON
 *
 * @param {Object} props
 * @param {string|null} props.worldId - Current world ID (required)
 * @param {number} props.currentYear - Current season end year (for default year - should be worldDraftYear)
 * @param {string|null} [props.worldSeason] - World's actual current season (for display)
 */
export function DraftPositionsInput({ worldId, currentYear, worldSeason }) {
  // State - initialize selectedYear from currentYear (which should be worldDraftYear from parent)
  const [selectedYear, setSelectedYear] = useState(currentYear || new Date().getFullYear());
  const [jsonText, setJsonText] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Phase 5 PATCH: Update selectedYear when currentYear prop changes (e.g., after season advance)
  useEffect(() => {
    if (currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  // Available years for dropdown (current year to +7 years out)
  const availableYears = useMemo(() => {
    const startYear = currentYear || new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => startYear + i);
  }, [currentYear]);

  // ===========================================================================
  // LOAD EXISTING POSITIONS
  // ===========================================================================

  useEffect(() => {
    async function loadPositions() {
      if (!worldId || !selectedYear) return;

      setIsLoading(true);
      setSaveMessage('');
      setValidationErrors([]);

      try {
        const data = await getDraftPositions(worldId, selectedYear);
        if (data?.positionsMap) {
          setJsonText(JSON.stringify(data.positionsMap, null, 2));
          setLastSaved({
            method: data.method,
            updatedAtIso: data.updatedAtIso,
          });
        } else {
          // No data - show template
          setJsonText(JSON.stringify(SAMPLE_POSITIONS_TEMPLATE, null, 2));
          setLastSaved(null);
        }
      } catch (error) {
        console.error('Failed to load draft positions:', error);
        setSaveMessage(`Error loading: ${error.message}`);
        setJsonText(JSON.stringify(SAMPLE_POSITIONS_TEMPLATE, null, 2));
        setLastSaved(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadPositions();
  }, [worldId, selectedYear]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleValidate = useCallback(() => {
    setValidationErrors([]);
    setSaveMessage('');

    if (!jsonText.trim()) {
      setValidationErrors(['JSON is empty']);
      return false;
    }

    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setValidationErrors([`Invalid JSON: ${e.message}`]);
      return false;
    }

    // Validate structure
    const validation = validateDraftPositionsMap(parsed);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return false;
    }

    setSaveMessage('✅ JSON is valid!');
    return true;
  }, [jsonText]);

  const handleSave = useCallback(async () => {
    if (!worldId) {
      setSaveMessage('Error: No world selected');
      return;
    }

    // Validate first
    if (!handleValidate()) {
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const positionsMap = JSON.parse(jsonText);
      const result = await saveDraftPositions(worldId, selectedYear, positionsMap, {
        method: 'manual',
      });

      if (result.success) {
        setLastSaved({
          method: 'manual',
          updatedAtIso: new Date().toISOString(),
        });
        setSaveMessage(`✅ Saved draft positions for ${selectedYear}!`);
      } else {
        setSaveMessage(`Error: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save draft positions:', error);
      setSaveMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [worldId, selectedYear, jsonText, handleValidate]);

  const handleReset = useCallback(() => {
    setJsonText(JSON.stringify(SAMPLE_POSITIONS_TEMPLATE, null, 2));
    setValidationErrors([]);
    setSaveMessage('');
  }, []);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (!worldId) {
    return (
      <div className="p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
        <p className="text-sm text-white/50">Select a world to enter draft positions.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Draft Positions Input</h3>
          <p className="text-sm text-white/60 mt-1">
            Enter real draft positions to auto-resolve pick swaps and conveyance during season advance.
          </p>
          {/* Phase 5 PATCH: Show world season context */}
          {worldSeason && (
            <p className="text-xs text-purple-400 mt-1">
              World Season: {worldSeason} — Default draft year: {currentYear}
            </p>
          )}
        </div>
      </div>

      {/* Year Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Draft Year
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="w-32 bg-[#0d0d0d] border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* JSON Textarea */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Positions JSON <span className="text-white/40">(TeamCode: Position 1-60)</span>
        </label>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          disabled={isLoading}
          className="w-full h-64 bg-[#0d0d0d] border border-white/20 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
          placeholder='{"ATL": 1, "BOS": 2, ...}'
        />
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-sm font-medium text-red-400 mb-1">Validation Errors:</p>
          <ul className="text-xs text-red-300 list-disc list-inside">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Save Message */}
      {saveMessage && !validationErrors.length && (
        <div className={`mb-4 p-3 rounded ${saveMessage.startsWith('✅') ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
          <p className={`text-sm ${saveMessage.startsWith('✅') ? 'text-green-400' : 'text-yellow-400'}`}>
            {saveMessage}
          </p>
        </div>
      )}

      {/* Last Saved Info */}
      {lastSaved && (
        <div className="mb-4 text-xs text-white/40">
          Last saved: {new Date(lastSaved.updatedAtIso).toLocaleString()} ({lastSaved.method})
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleValidate}
          disabled={isLoading || isSaving}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition-colors disabled:opacity-50"
        >
          Validate
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading || isSaving}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded text-sm transition-colors disabled:opacity-50"
        >
          Reset to Template
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-xs text-white/40 border-t border-white/10 pt-4">
        <p className="mb-2">
          <strong>How it works:</strong> Enter draft positions as JSON mapping team codes (ATL, BOS, etc.) to pick positions (1-60).
        </p>
        <p className="mb-2">
          <strong>When you advance the season:</strong> If draft positions exist for the current draft year, 
          swaps and protected picks will auto-resolve based on these positions.
        </p>
        <p>
          <strong>NO-OP guarantee:</strong> If no positions are saved, season advance behaves as before (no changes to picks).
        </p>
      </div>
    </div>
  );
}

DraftPositionsInput.propTypes = {
  worldId: PropTypes.string,
  currentYear: PropTypes.number.isRequired,
  worldSeason: PropTypes.string,
};

DraftPositionsInput.defaultProps = {
  worldId: null,
  worldSeason: null,
};

export default DraftPositionsInput;
