/**
 * FILE: src/features/architect/admin/EntitlementEditorSwapTab.tsx
 * PURPOSE: Render the Swap tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 *  - 2026-02-14: TM-ENTITLEMENTS-ADV-E1 - Added residualOfEntitlementId field
 */

import React from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import type { FieldErrors } from './useEntitlementEditorState';

interface EntitlementEditorSwapTabProps {
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  fieldErrors?: FieldErrors;
  disabled?: boolean;
}

export const EntitlementEditorSwapTab: React.FC<
  EntitlementEditorSwapTabProps
> = ({ formState, onChange, fieldErrors = {}, disabled = false }) => {
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
          htmlFor="entitlement-swapType"
          className="block text-xs text-white/60 mb-1"
        >
          Swap Type
        </label>
        <select
          id="entitlement-swapType"
          value={formState.swapType}
          onChange={(e) => updateField('swapType', e.target.value)}
          disabled={disabled}
          className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
        >
          <option value="">Select swap type...</option>
          <option value="best_of">Best of (more favorable)</option>
          <option value="worst_of">Worst of (less favorable)</option>
        </select>
        <p className="text-[10px] text-white/40 mt-1">
          Determines which pick is selected when the swap is resolved.
        </p>
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
          className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
            fieldErrors.swapControllerPickId
              ? 'border-red-500'
              : 'border-white/10'
          }`}
        />
        {fieldErrors.swapControllerPickId && (
          <p className="text-[10px] text-red-400 mt-0.5">
            {fieldErrors.swapControllerPickId}
          </p>
        )}
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
          className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
            fieldErrors.swapTargetDefinition
              ? 'border-red-500'
              : 'border-white/10'
          }`}
        />
        {fieldErrors.swapTargetDefinition && (
          <p className="text-[10px] text-red-400 mt-0.5">
            {fieldErrors.swapTargetDefinition}
          </p>
        )}
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
          onChange={(e) =>
            updateField('poolUnderlyingPickIdsText', e.target.value)
          }
          disabled={disabled}
          rows={3}
          placeholder="ATL_2026_1st\nSAS_2026_1st"
          className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
        />
        <p className="text-[10px] text-white/40 mt-1">
          One pick ID per line or comma-separated.
        </p>
      </div>

      {/* TM-ENTITLEMENTS-ADV-E1: Residual entitlement field */}
      <div className="pt-3 border-t border-white/10 mt-3">
        <div className="text-xs text-white/60 uppercase tracking-wide mb-3">
          Linkage (Advanced)
        </div>
        <div>
          <label
            htmlFor="entitlement-residualOfEntitlementId"
            className="block text-xs text-white/60 mb-1"
          >
            Residual Of Entitlement ID
          </label>
          <input
            id="entitlement-residualOfEntitlementId"
            value={formState.residualOfEntitlementId}
            onChange={(e) =>
              updateField('residualOfEntitlementId', e.target.value)
            }
            disabled={disabled}
            placeholder="ent:HOU:2026:1:conv:best_of_dal_phx_bkn"
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10 text-xs font-mono"
          />
          <p className="text-[10px] text-white/40 mt-1">
            For "residual" swaps: the conveyance_right entitlement this swap
            targets the remainder of.
          </p>
        </div>
      </div>
