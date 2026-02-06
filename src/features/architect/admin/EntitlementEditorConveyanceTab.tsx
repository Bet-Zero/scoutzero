/**
 * FILE: src/features/architect/admin/EntitlementEditorConveyanceTab.tsx
 * PURPOSE: Render the Conveyance tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 *  - 2026-02-05: TM-7 enhancements: structured pool picker, improved labels, validation.
 */

import React, { useMemo } from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import type { FieldErrors } from './useEntitlementEditorState';

interface EntitlementEditorConveyanceTabProps {
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  fieldErrors?: FieldErrors;
  disabled?: boolean;
}

// Parse pool text to array
const parsePoolIds = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter(Boolean);

// Convert pool array back to text
const poolIdsToText = (ids: string[]): string => ids.join('\n');

export const EntitlementEditorConveyanceTab: React.FC<
  EntitlementEditorConveyanceTabProps
> = ({ formState, onChange, fieldErrors = {}, disabled = false }) => {
  const updateField = (key: keyof EntitlementFormState, value: string) => {
    onChange({
      ...formState,
      [key]: value,
    });
  };

  // Parse pool IDs from text
  const poolIds = useMemo(
    () => parsePoolIds(formState.poolUnderlyingPickIdsText),
    [formState.poolUnderlyingPickIdsText]
  );

  const updatePoolId = (index: number, value: string) => {
    const newIds = [...poolIds];
    newIds[index] = value;
    onChange({
      ...formState,
      poolUnderlyingPickIdsText: poolIdsToText(newIds),
    });
  };

  const addPoolId = () => {
    const newIds = [...poolIds, ''];
    onChange({
      ...formState,
      poolUnderlyingPickIdsText: poolIdsToText(newIds),
    });
  };

  const removePoolId = (index: number) => {
    const newIds = poolIds.filter((_, i) => i !== index);
    onChange({
      ...formState,
      poolUnderlyingPickIdsText: poolIdsToText(newIds),
    });
  };

  // Validation
  const hasPool = poolIds.length > 0;
  const poolTooSmall = hasPool && poolIds.filter(Boolean).length < 2;
  const missingComparator = hasPool && !formState.receivesComparator;

  return (
    <div className="space-y-4">
      <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
        Not yet simulated in trade validation. Saved conveyance terms are
        displayed and used by resolution tooling only.
      </div>

      {/* Pool of Picks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="block text-xs text-white/60">Pool of Picks</label>
            <p className="text-[10px] text-white/40">
              Add picks to the conveyance pool (minimum 2 required).
            </p>
          </div>
          <button
            type="button"
            onClick={addPoolId}
            disabled={disabled}
            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            Add Pick
          </button>
        </div>

        {poolIds.length === 0 ? (
          <div className="text-xs text-white/40 border border-dashed border-white/20 rounded p-3 text-center">
            No picks in pool. Click "Add Pick" to start.
          </div>
        ) : (
          <div className="space-y-2">
            {poolIds.map((pickId, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-4">
                  {index + 1}.
                </span>
                <input
                  value={pickId}
                  onChange={(e) => updatePoolId(index, e.target.value)}
                  disabled={disabled}
                  placeholder="e.g., ATL_2026_1st"
                  className={`flex-1 px-2 py-1 rounded bg-[#141414] text-white text-sm border ${
                    !pickId ? 'border-amber-500/50' : 'border-white/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => removePoolId(index)}
                  disabled={disabled}
                  className="px-2 py-1 text-xs text-red-300 hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {poolTooSmall && (
          <p className="text-[10px] text-red-400 mt-1">
            Pool must have at least 2 picks for conveyance to work.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="entitlement-receivesRank"
            className="block text-xs text-white/60 mb-1"
          >
            Selection Rank
          </label>
          <input
            id="entitlement-receivesRank"
            value={formState.receivesRankText}
            onChange={(e) => updateField('receivesRankText', e.target.value)}
            disabled={disabled}
            placeholder="1"
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
          />
          <p className="text-[10px] text-white/40 mt-1">
            Which rank(s) to receive (e.g., 1 for best, or 1, 2 for top 2).
          </p>
        </div>
        <div>
          <label
            htmlFor="entitlement-receivesComparator"
            className="block text-xs text-white/60 mb-1"
          >
            Selection Method
          </label>
          <select
            id="entitlement-receivesComparator"
            value={formState.receivesComparator}
            onChange={(e) => updateField('receivesComparator', e.target.value)}
            disabled={disabled}
            className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
              missingComparator ? 'border-red-500' : 'border-white/10'
            }`}
          >
            <option value="">Select...</option>
            <option value="more_favorable">Best (most favorable)</option>
            <option value="less_favorable">Worst (least favorable)</option>
            <option value="middle">Middle</option>
          </select>
          {missingComparator && (
            <p className="text-[10px] text-red-400 mt-1">
              Selection method required when pool has picks.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
