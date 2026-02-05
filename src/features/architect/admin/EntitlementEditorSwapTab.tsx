/**
 * FILE: src/features/architect/admin/EntitlementEditorSwapTab.tsx
 * PURPOSE: Render the Swap tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import React from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';

interface EntitlementEditorSwapTabProps {
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  disabled?: boolean;
}

export const EntitlementEditorSwapTab: React.FC<EntitlementEditorSwapTabProps> = ({
  formState,
  onChange,
  disabled = false,
}) => {
  const updateField = (key: keyof EntitlementFormState, value: string) => {
    onChange({
      ...formState,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
        Not yet simulated in trade validation. Saved swap definitions are
        displayed and used by resolution tooling only.
      </div>

      <div>
        <label
          htmlFor="entitlement-swapControllerPickId"
          className="block text-xs text-white/60 mb-1"
        >
          Swap Controller Pick ID
        </label>
        <input
          id="entitlement-swapControllerPickId"
          value={formState.swapControllerPickId}
          onChange={(e) => updateField('swapControllerPickId', e.target.value)}
          disabled={disabled}
          className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
        />
      </div>

      <div>
        <label
          htmlFor="entitlement-swapTargetDefinition"
          className="block text-xs text-white/60 mb-1"
        >
          Swap Target Definition
        </label>
        <textarea
          id="entitlement-swapTargetDefinition"
          value={formState.swapTargetDefinition}
          onChange={(e) => updateField('swapTargetDefinition', e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
        />
      </div>

      <div>
        <label
          htmlFor="entitlement-swapPool"
          className="block text-xs text-white/60 mb-1"
        >
          Pool Underlying Pick IDs (optional)
        </label>
        <textarea
          id="entitlement-swapPool"
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
    </div>
  );
};
