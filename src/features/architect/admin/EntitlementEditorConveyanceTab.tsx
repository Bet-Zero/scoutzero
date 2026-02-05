/**
 * FILE: src/features/architect/admin/EntitlementEditorConveyanceTab.tsx
 * PURPOSE: Render the Conveyance tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import React from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';

interface EntitlementEditorConveyanceTabProps {
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  disabled?: boolean;
}

export const EntitlementEditorConveyanceTab: React.FC<
  EntitlementEditorConveyanceTabProps
> = ({ formState, onChange, disabled = false }) => {
  const updateField = (key: keyof EntitlementFormState, value: string) => {
    onChange({
      ...formState,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
        Not yet simulated in trade validation. Saved conveyance terms are
        displayed and used by resolution tooling only.
      </div>

      <div>
        <label
          htmlFor="entitlement-conveyancePool"
          className="block text-xs text-white/60 mb-1"
        >
          Pool Underlying Pick IDs
        </label>
        <textarea
          id="entitlement-conveyancePool"
          value={formState.poolUnderlyingPickIdsText}
          onChange={(e) => updateField('poolUnderlyingPickIdsText', e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="ATL_2026_1st\nSAS_2026_1st"
          className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
        />
        <p className="text-[10px] text-white/40 mt-1">
          One pick ID per line or comma-separated.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="entitlement-receivesRank"
            className="block text-xs text-white/60 mb-1"
          >
            Receives Rank
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
            Comma-separated ranks (e.g., 1 or 1, 2).
          </p>
        </div>
        <div>
          <label
            htmlFor="entitlement-receivesComparator"
            className="block text-xs text-white/60 mb-1"
          >
            Receives Comparator
          </label>
          <select
            id="entitlement-receivesComparator"
            value={formState.receivesComparator}
            onChange={(e) => updateField('receivesComparator', e.target.value)}
            disabled={disabled}
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
          >
            <option value="">Select...</option>
            <option value="less_favorable">Less Favorable</option>
            <option value="more_favorable">More Favorable</option>
            <option value="middle">Middle</option>
          </select>
        </div>
      </div>
    </div>
  );
};
