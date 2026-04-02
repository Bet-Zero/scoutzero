/**
 * FILE: src/features/architect/GMDashboard/components/DraftPositionsInput.tsx
 * PURPOSE: Minimal UI for entering/importing draft positions for a given year.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ChangeEvent,
} from 'react';
import PropTypes from 'prop-types';
import {
  getDraftPositions,
  saveDraftPositions,
  validateDraftPositionsMap,
} from '@/features/architect/utils/worldManager';

type DraftPositionsInputProps = {
  worldId?: string | null;
  defaultDraftYear: number;
  worldSeason?: string | null;
};

type DraftPositionsMap = Record<string, number>;

type DraftPositionsValidationResult = {
  valid: boolean;
  errors: string[];
};

type DraftPositionsLoadResult = {
  positionsMap?: DraftPositionsMap;
  method?: string;
  updatedAtIso?: string;
} | null;

type DraftPositionsSaveResult = {
  success: boolean;
  errors?: string[];
};

type LastSavedState = {
  method?: string;
  updatedAtIso?: string;
} | null;

type ErrorLike = {
  message?: string;
};

const SAMPLE_POSITIONS_TEMPLATE: DraftPositionsMap = {
  ATL: 1,
  BOS: 2,
  BKN: 3,
  CHA: 4,
  CHI: 5,
  CLE: 6,
  DAL: 7,
  DEN: 8,
  DET: 9,
  GSW: 10,
  HOU: 11,
  IND: 12,
  LAC: 13,
  LAL: 14,
  MEM: 15,
  MIA: 16,
  MIL: 17,
  MIN: 18,
  NOP: 19,
  NYK: 20,
  OKC: 21,
  ORL: 22,
  PHI: 23,
  PHX: 24,
  POR: 25,
  SAC: 26,
  SAS: 27,
  TOR: 28,
  UTA: 29,
  WAS: 30,
};

export function DraftPositionsInput({
  worldId = null,
  defaultDraftYear,
  worldSeason = null,
}: DraftPositionsInputProps) {
  const [selectedYear, setSelectedYear] = useState(
    defaultDraftYear || new Date().getFullYear()
  );
  const [jsonText, setJsonText] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<LastSavedState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (defaultDraftYear) {
      setSelectedYear(defaultDraftYear);
    }
  }, [defaultDraftYear]);

  const availableYears = useMemo(() => {
    const startYear = defaultDraftYear || new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => startYear + index);
  }, [defaultDraftYear]);

  useEffect(() => {
    async function loadPositions() {
      if (!worldId || !selectedYear) return;

      setIsLoading(true);
      setSaveMessage('');
      setValidationErrors([]);

      try {
        const data = (await getDraftPositions(
          worldId,
          selectedYear
        )) as DraftPositionsLoadResult;

        if (data?.positionsMap) {
          setJsonText(JSON.stringify(data.positionsMap, null, 2));
          setLastSaved({
            method: data.method,
            updatedAtIso: data.updatedAtIso,
          });
        } else {
          setJsonText(JSON.stringify(SAMPLE_POSITIONS_TEMPLATE, null, 2));
          setLastSaved(null);
        }
      } catch (error) {
        const errorLike = error as ErrorLike;
        console.error('Failed to load draft positions:', error);
        setSaveMessage(`Error loading: ${errorLike.message}`);
        setJsonText(JSON.stringify(SAMPLE_POSITIONS_TEMPLATE, null, 2));
        setLastSaved(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPositions();
  }, [worldId, selectedYear]);

  const handleValidate = useCallback(() => {
    setValidationErrors([]);
    setSaveMessage('');

    if (!jsonText.trim()) {
      setValidationErrors(['JSON is empty']);
      return false;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      const errorLike = error as ErrorLike;
      setValidationErrors([`Invalid JSON: ${errorLike.message}`]);
      return false;
    }

    const validation = validateDraftPositionsMap(
      parsed as Record<string, unknown>
    ) as DraftPositionsValidationResult;
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

    if (!handleValidate()) {
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const positionsMap = JSON.parse(jsonText) as DraftPositionsMap;
      const result = (await saveDraftPositions(
        worldId,
        selectedYear,
        positionsMap,
        {
          method: 'manual',
        }
      )) as DraftPositionsSaveResult;

      if (result.success) {
        setLastSaved({
          method: 'manual',
          updatedAtIso: new Date().toISOString(),
        });
        setSaveMessage(`✅ Saved draft positions for ${selectedYear}!`);
      } else {
        setSaveMessage(
          `Error: ${result.errors?.join(', ') || 'Unknown error'}`
        );
      }
    } catch (error) {
      const errorLike = error as ErrorLike;
      console.error('Failed to save draft positions:', error);
      setSaveMessage(`Error: ${errorLike.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [worldId, selectedYear, jsonText, handleValidate]);

  const handleReset = useCallback(() => {
    setJsonText(JSON.stringify(SAMPLE_POSITIONS_TEMPLATE, null, 2));
    setValidationErrors([]);
    setSaveMessage('');
  }, []);

  const handleYearChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(event.target.value, 10));
  };

  const handleJsonChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(event.target.value);
  };

  if (!worldId) {
    return (
      <div className="p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
        <p className="text-sm text-white/50">
          Select a world to enter draft positions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Draft Positions Input
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Enter real draft positions to auto-resolve pick swaps and conveyance
            during season advance.
          </p>
          {worldSeason && (
            <p className="text-xs text-purple-400 mt-1">
              World Season: {worldSeason} — Default draft year: {defaultDraftYear}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Draft Year
        </label>
        <select
          value={selectedYear}
          onChange={handleYearChange}
          className="w-32 bg-[#0d0d0d] border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Positions JSON{' '}
          <span className="text-white/40">(TeamCode: Position 1-60)</span>
        </label>
        <textarea
          value={jsonText}
          onChange={handleJsonChange}
          disabled={isLoading}
          className="w-full h-64 bg-[#0d0d0d] border border-white/20 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
          placeholder='{"ATL": 1, "BOS": 2, ...}'
        />
      </div>

      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-sm font-medium text-red-400 mb-1">
            Validation Errors:
          </p>
          <ul className="text-xs text-red-300 list-disc list-inside">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {saveMessage && !validationErrors.length && (
        <div
          className={`mb-4 p-3 rounded ${
            saveMessage.startsWith('✅')
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-yellow-500/10 border border-yellow-500/30'
          }`}
        >
          <p
            className={`text-sm ${
              saveMessage.startsWith('✅')
                ? 'text-green-400'
                : 'text-yellow-400'
            }`}
          >
            {saveMessage}
          </p>
        </div>
      )}

      {lastSaved && (
        <div className="mb-4 text-xs text-white/40">
          Last saved: {new Date(lastSaved.updatedAtIso as string).toLocaleString()} (
          {lastSaved.method})
        </div>
      )}

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

      <div className="mt-4 text-xs text-white/40 border-t border-white/10 pt-4">
        <p className="mb-2">
          <strong>How it works:</strong> Enter draft positions as JSON mapping
          team codes (ATL, BOS, etc.) to pick positions (1-60).
        </p>
        <p className="mb-2">
          <strong>When you advance the season:</strong> If draft positions exist
          for the current draft year, swaps and protected picks will
          auto-resolve based on these positions.
        </p>
        <p>
          <strong>NO-OP guarantee:</strong> If no positions are saved, season
          advance behaves as before (no changes to picks).
        </p>
      </div>
    </div>
  );
}

DraftPositionsInput.propTypes = {
  worldId: PropTypes.string,
  defaultDraftYear: PropTypes.number.isRequired,
  worldSeason: PropTypes.string,
};

export default DraftPositionsInput;
