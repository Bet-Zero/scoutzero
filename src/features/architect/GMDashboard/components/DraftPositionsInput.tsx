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
import type { SeasonAdvanceDraftContext } from '@/features/architect/utils/seasonFormat';

type DraftPositionsInputProps = {
  persistenceAuthority: DraftPositionsPersistenceAuthority;
  validateDraftPositionsMap: (
    positionsMap: Record<string, unknown>
  ) => DraftPositionsValidationResult;
  worldId?: string | null;
  seasonAdvanceDraftContext?: SeasonAdvanceDraftContext | null;
};

export type DraftPositionsMap = Record<string, number>;

export type DraftPositionsValidationResult = {
  valid: boolean;
  errors: string[];
};

export type DraftPositionsCommittedState = {
  positionsMap: DraftPositionsMap;
  method?: string;
  updatedAtIso?: string;
} | null;

export type DraftPositionsPersistenceAuthority = {
  loadCommittedDraftPositions: (
    draftYear: number
  ) => Promise<DraftPositionsCommittedState>;
  saveCommittedDraftPositions: (
    draftYear: number,
    positionsMap: DraftPositionsMap
  ) => Promise<DraftPositionsCommittedState>;
  clearCommittedDraftPositions: (draftYear: number) => Promise<void>;
};

type DraftPositionsStatusMessage = {
  tone: 'success' | 'warning' | 'info';
  text: string;
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

const SAMPLE_POSITIONS_TEMPLATE_TEXT = JSON.stringify(
  SAMPLE_POSITIONS_TEMPLATE,
  null,
  2
);

const STATUS_STYLES = {
  success: {
    container: 'bg-green-500/10 border border-green-500/30',
    text: 'text-green-400',
  },
  warning: {
    container: 'bg-yellow-500/10 border border-yellow-500/30',
    text: 'text-yellow-400',
  },
  info: {
    container: 'bg-blue-500/10 border border-blue-500/30',
    text: 'text-blue-300',
  },
} as const;

function formatPositionsMap(positionsMap: DraftPositionsMap) {
  return JSON.stringify(positionsMap, null, 2);
}

export function DraftPositionsInput({
  persistenceAuthority,
  validateDraftPositionsMap,
  worldId = null,
  seasonAdvanceDraftContext = null,
}: DraftPositionsInputProps) {
  const nextUsedDraftYear =
    seasonAdvanceDraftContext?.nextUsedDraftYear ?? null;
  const authoritativeSeason =
    seasonAdvanceDraftContext?.authoritativeSeason ?? null;
  const nextSeason = seasonAdvanceDraftContext?.nextSeason ?? null;
  const [selectedSavedDraftYear, setSelectedSavedDraftYear] =
    useState<number | null>(nextUsedDraftYear);
  const [jsonText, setJsonText] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [committedDraftPositions, setCommittedDraftPositions] =
    useState<DraftPositionsCommittedState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] =
    useState<DraftPositionsStatusMessage>(null);

  useEffect(() => {
    setSelectedSavedDraftYear(nextUsedDraftYear);
  }, [nextUsedDraftYear]);

  const availableSavedDraftYears = useMemo(() => {
    if (!nextUsedDraftYear) {
      return [];
    }

    return Array.from({ length: 8 }, (_, index) => nextUsedDraftYear + index);
  }, [nextUsedDraftYear]);

  const isEditingNextUsedDraftYear =
    selectedSavedDraftYear != null &&
    selectedSavedDraftYear === nextUsedDraftYear;

  const restoreEditorFromCommittedState = useCallback(
    (draftPositions: DraftPositionsCommittedState) => {
      if (draftPositions?.positionsMap) {
        setJsonText(formatPositionsMap(draftPositions.positionsMap));
        return;
      }

      setJsonText(SAMPLE_POSITIONS_TEMPLATE_TEXT);
    },
    []
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadPositions() {
      if (!worldId || !selectedSavedDraftYear) {
        return;
      }

      setIsLoading(true);
      setStatusMessage(null);
      setValidationErrors([]);
      setCommittedDraftPositions(null);

      try {
        const data = await persistenceAuthority.loadCommittedDraftPositions(
          selectedSavedDraftYear
        );

        if (isCancelled) {
          return;
        }

        setCommittedDraftPositions(data);
        restoreEditorFromCommittedState(data);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const errorLike = error as ErrorLike;
        console.error('Failed to load draft positions:', error);
        setStatusMessage({
          tone: 'warning',
          text: `Error loading: ${errorLike.message}`,
        });
        setCommittedDraftPositions(null);
        setJsonText(SAMPLE_POSITIONS_TEMPLATE_TEXT);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPositions();
    return () => {
      isCancelled = true;
    };
  }, [
    persistenceAuthority,
    restoreEditorFromCommittedState,
    selectedSavedDraftYear,
    worldId,
  ]);

  const parseAndValidateEditorJson = useCallback(
    (announceValidEditorState: boolean) => {
      setValidationErrors([]);
      setStatusMessage(null);

      if (!jsonText.trim()) {
        setValidationErrors(['JSON is empty']);
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        const errorLike = error as ErrorLike;
        setValidationErrors([`Invalid JSON: ${errorLike.message}`]);
        return null;
      }

      const validation = validateDraftPositionsMap(
        parsed as Record<string, unknown>
      );
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        return null;
      }

      if (announceValidEditorState) {
        setStatusMessage({
          tone: 'info',
          text: 'Editor JSON is valid but not yet saved.',
        });
      }

      return parsed as DraftPositionsMap;
    },
    [jsonText, validateDraftPositionsMap]
  );

  const handleValidate = useCallback(() => {
    return parseAndValidateEditorJson(true) !== null;
  }, [parseAndValidateEditorJson]);

  const handleSave = useCallback(async () => {
    if (!worldId) {
      setStatusMessage({
        tone: 'warning',
        text: 'Error: No world selected',
      });
      return;
    }

    if (!selectedSavedDraftYear) {
      setStatusMessage({
        tone: 'warning',
        text: 'Error: World season must load before draft positions can be saved.',
      });
      return;
    }

    const positionsMap = parseAndValidateEditorJson(false);
    if (!positionsMap) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const committedDraftPositionsResult =
        await persistenceAuthority.saveCommittedDraftPositions(
          selectedSavedDraftYear,
          positionsMap
        );

      if (!committedDraftPositionsResult?.positionsMap) {
        throw new Error(
          `Committed draft positions were unavailable after save for ${selectedSavedDraftYear}`
        );
      }

      setCommittedDraftPositions(committedDraftPositionsResult);
      restoreEditorFromCommittedState(committedDraftPositionsResult);
      setStatusMessage({
        tone: 'success',
        text: `✅ Saved draft positions for ${selectedSavedDraftYear}. Editor refreshed from committed world data.`,
      });
    } catch (error) {
      const errorLike = error as ErrorLike;
      console.error('Failed to save draft positions:', error);
      setStatusMessage({
        tone: 'warning',
        text: `Error: ${errorLike.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    parseAndValidateEditorJson,
    persistenceAuthority,
    restoreEditorFromCommittedState,
    selectedSavedDraftYear,
    worldId,
  ]);

  const handleResetEditor = useCallback(() => {
    restoreEditorFromCommittedState(committedDraftPositions);
    setValidationErrors([]);
    setStatusMessage({
      tone: 'info',
      text: committedDraftPositions?.positionsMap
        ? 'Editor reset to the last saved draft positions. Saved positions were not cleared.'
        : 'Editor reset to the template. No saved positions were cleared.',
    });
  }, [committedDraftPositions, restoreEditorFromCommittedState]);

  const handleClearSavedPositions = useCallback(async () => {
    if (!worldId) {
      setStatusMessage({
        tone: 'warning',
        text: 'Error: No world selected',
      });
      return;
    }

    if (!selectedSavedDraftYear) {
      setStatusMessage({
        tone: 'warning',
        text: 'Error: World season must load before saved draft positions can be cleared.',
      });
      return;
    }

    setIsSaving(true);
    setValidationErrors([]);
    setStatusMessage(null);

    try {
      await persistenceAuthority.clearCommittedDraftPositions(
        selectedSavedDraftYear
      );
      setCommittedDraftPositions(null);
      setJsonText(SAMPLE_POSITIONS_TEMPLATE_TEXT);
      setStatusMessage({
        tone: 'success',
        text: `✅ Cleared saved draft positions for ${selectedSavedDraftYear}. The editor is now showing the template.`,
      });
    } catch (error) {
      const errorLike = error as ErrorLike;
      console.error('Failed to clear draft positions:', error);
      setStatusMessage({
        tone: 'warning',
        text: `Error: ${errorLike.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [persistenceAuthority, selectedSavedDraftYear, worldId]);

  const handleYearChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSavedDraftYear(parseInt(event.target.value, 10));
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

  if (!seasonAdvanceDraftContext) {
    return (
      <div
        data-testid="draft-positions-input-locked"
        className="p-4 bg-[#1a1a1a] rounded-lg border border-white/10"
      >
        <h3 className="text-lg font-semibold text-white">
          Draft Positions Input
        </h3>
        <p className="text-sm text-white/60 mt-1">
          Enter real draft positions to auto-resolve pick swaps and conveyance
          during season advance.
        </p>
        <p className="text-xs text-yellow-300 mt-3">
          World season unavailable. Saved draft positions stay locked until the
          authoritative world season loads.
        </p>
        <p className="text-xs text-white/40 mt-2">
          No next-used draft year is assumed while world metadata is missing.
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
          <p className="text-xs text-purple-400 mt-1">
            World Season: {authoritativeSeason}
          </p>
          <p className="text-xs text-blue-300 mt-1">
            Next-used Draft Year: {nextUsedDraftYear}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Saved Draft Positions Year
        </label>
        <select
          value={selectedSavedDraftYear ?? ''}
          onChange={handleYearChange}
          className="w-32 bg-[#0d0d0d] border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {availableSavedDraftYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {!isEditingNextUsedDraftYear && selectedSavedDraftYear != null && (
          <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="text-xs text-yellow-300">
              You are editing saved draft positions for{' '}
              {selectedSavedDraftYear}. The next season advance will still use{' '}
              {nextUsedDraftYear} from world season {authoritativeSeason}
              {' '}unless the world season changes first.
            </p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-white/70 mb-1">
          Positions JSON{' '}
          <span className="text-white/40">(TeamCode: Position 1-60)</span>
        </label>
        <textarea
          value={jsonText}
          onChange={handleJsonChange}
          disabled={isLoading || isSaving}
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

      {statusMessage && !validationErrors.length && (
        <div
          className={`mb-4 p-3 rounded ${
            STATUS_STYLES[statusMessage.tone].container
          }`}
        >
          <p className={`text-sm ${STATUS_STYLES[statusMessage.tone].text}`}>
            {statusMessage.text}
          </p>
        </div>
      )}

      <div className="mb-4 text-xs text-white/40">
        {committedDraftPositions?.positionsMap ? (
          <>
            Last saved:{' '}
            {committedDraftPositions.updatedAtIso
              ? new Date(committedDraftPositions.updatedAtIso).toLocaleString()
              : 'Unknown time'}{' '}
            ({committedDraftPositions.method || 'unknown'})
          </>
        ) : (
          <>
            No saved draft positions for {selectedSavedDraftYear}. Editor is
            showing the template.
          </>
        )}
      </div>

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
          onClick={handleResetEditor}
          disabled={isLoading || isSaving}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded text-sm transition-colors disabled:opacity-50"
        >
          Reset Editor
        </button>
        <button
          type="button"
          onClick={handleClearSavedPositions}
          disabled={isLoading || isSaving || !committedDraftPositions}
          className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded text-sm transition-colors disabled:opacity-50"
        >
          Clear Saved Positions
        </button>
      </div>

      <div className="mt-4 text-xs text-white/40 border-t border-white/10 pt-4">
        <p className="mb-2">
          <strong>How it works:</strong> Enter draft positions as JSON mapping
          team codes (ATL, BOS, etc.) to pick positions (1-60).
        </p>
        <p className="mb-2">
          <strong>When you advance the season:</strong> Advancing from{' '}
          {authoritativeSeason} to {nextSeason} will use the committed draft
          positions saved for {nextUsedDraftYear}.
        </p>
        <p className="mb-2">
          <strong>If you save another year:</strong> Saving draft positions for
          a different year stores future data only. It does not change the
          next-used draft year derived from the current world season.
        </p>
        <p className="mb-2">
          <strong>Editor vs saved state:</strong> Reset Editor only changes the
          local JSON editor. Clear Saved Positions removes the committed record
          for the selected draft year.
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
  persistenceAuthority: PropTypes.shape({
    loadCommittedDraftPositions: PropTypes.func.isRequired,
    saveCommittedDraftPositions: PropTypes.func.isRequired,
    clearCommittedDraftPositions: PropTypes.func.isRequired,
  }).isRequired,
  validateDraftPositionsMap: PropTypes.func.isRequired,
  worldId: PropTypes.string,
  seasonAdvanceDraftContext: PropTypes.shape({
    authoritativeSeason: PropTypes.string.isRequired,
    nextUsedDraftYear: PropTypes.number.isRequired,
    nextSeason: PropTypes.string.isRequired,
  }),
};

