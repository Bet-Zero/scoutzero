/**
 * FILE: src/features/architect/admin/EntitlementEditorBasicsTab.tsx
 * PURPOSE: Render the Basics tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 *  - 2026-02-14: TM-ENTITLEMENTS-ADV-E1 - Added linkedEntitlementIds, coveredByEntitlementIds fields
 */

import React from 'react';
import type {
  EntitlementFormState,
  EntitlementKind,
} from './entitlementEditorFormState';
import type { FieldErrors } from './useEntitlementEditorState';

interface EntitlementEditorBasicsTabProps {
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  fieldErrors?: FieldErrors;
  disabled?: boolean;
}

export const EntitlementEditorBasicsTab: React.FC<
  EntitlementEditorBasicsTabProps
> = ({ formState, onChange, fieldErrors = {}, disabled = false }) => {
  const updateField = (key: keyof EntitlementFormState, value: string) => {
    onChange({
      ...formState,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="entitlement-id"
          className="block text-xs text-white/60 mb-1"
        >
          Entitlement ID (read-only)
        </label>
        <input
          id="entitlement-id"
          value={formState.id}
          disabled
          className="w-full px-2 py-1 rounded bg-[#1f1f1f] text-white/50 border border-white/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="entitlement-holderTeam"
            className="block text-xs text-white/60 mb-1"
          >
            Holder Team
          </label>
          <input
            id="entitlement-holderTeam"
            value={formState.holderTeam}
            onChange={(e) =>
              updateField('holderTeam', e.target.value.toUpperCase())
            }
            maxLength={3}
            disabled={disabled}
            className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
              fieldErrors.holderTeam ? 'border-red-500' : 'border-white/10'
            }`}
          />
          {fieldErrors.holderTeam && (
            <p className="text-[10px] text-red-400 mt-0.5">
              {fieldErrors.holderTeam}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="entitlement-seasonYear"
            className="block text-xs text-white/60 mb-1"
          >
            Season Year
          </label>
          <input
            id="entitlement-seasonYear"
            type="number"
            value={formState.seasonYear}
            onChange={(e) => updateField('seasonYear', e.target.value)}
            disabled={disabled}
            className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
              fieldErrors.seasonYear ? 'border-red-500' : 'border-white/10'
            }`}
          />
          {fieldErrors.seasonYear && (
            <p className="text-[10px] text-red-400 mt-0.5">
              {fieldErrors.seasonYear}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="entitlement-round"
            className="block text-xs text-white/60 mb-1"
          >
            Round
          </label>
          <select
            id="entitlement-round"
            value={formState.round}
            onChange={(e) => updateField('round', e.target.value)}
            disabled={disabled}
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
          >
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="entitlement-kind"
            className="block text-xs text-white/60 mb-1"
          >
            Kind
          </label>
          <select
            id="entitlement-kind"
            value={formState.kind}
            onChange={(e) =>
              updateField('kind', e.target.value as EntitlementKind)
            }
            disabled={disabled}
            className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
              fieldErrors.kind ? 'border-red-500' : 'border-white/10'
            }`}
          >
            <option value="pick_ownership">Pick Ownership</option>
            <option value="swap_right">Swap Right</option>
            <option value="conveyance_right">Conveyance Right</option>
          </select>
          {fieldErrors.kind && (
            <p className="text-[10px] text-red-400 mt-0.5">
              {fieldErrors.kind}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="entitlement-description"
          className="block text-xs text-white/60 mb-1"
        >
          Description
        </label>
        <input
          id="entitlement-description"
          value={formState.description}
          onChange={(e) => updateField('description', e.target.value)}
          disabled={disabled}
          className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="entitlement-underlyingPickId"
            className="block text-xs text-white/60 mb-1"
          >
            Underlying Pick ID
          </label>
          <input
            id="entitlement-underlyingPickId"
            value={formState.underlyingPickId}
            onChange={(e) => updateField('underlyingPickId', e.target.value)}
            disabled={disabled}
            className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
              fieldErrors.underlyingPickId
                ? 'border-red-500'
                : 'border-white/10'
            }`}
          />
          {fieldErrors.underlyingPickId && (
            <p className="text-[10px] text-red-400 mt-0.5">
              {fieldErrors.underlyingPickId}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="entitlement-underlyingStatus"
            className="block text-xs text-white/60 mb-1"
          >
            Underlying Status
          </label>
          <select
            id="entitlement-underlyingStatus"
            value={formState.underlyingStatus}
            onChange={(e) => updateField('underlyingStatus', e.target.value)}
            disabled={disabled}
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
          >
            <option value="clean">Clean</option>
            <option value="encumbered">Encumbered</option>
            <option value="pooled">Pooled</option>
          </select>
        </div>
      </div>

      {/* TM-ENTITLEMENTS-ADV-E1: Chained/linked entitlement fields */}
      <div className="pt-3 border-t border-white/10 mt-3 space-y-4">
        <div className="text-xs text-white/60 uppercase tracking-wide">
          Linkage (Advanced)
        </div>

        <div>
          <label
            htmlFor="entitlement-linkedEntitlementIds"
            className="block text-xs text-white/60 mb-1"
          >
            Linked Entitlement IDs
          </label>
          <textarea
            id="entitlement-linkedEntitlementIds"
            value={formState.linkedEntitlementIdsText}
            onChange={(e) =>
              updateField('linkedEntitlementIdsText', e.target.value)
            }
            disabled={disabled}
            rows={2}
            placeholder="One entitlement ID per line (e.g., ent:HOU:2026:1:swap:residual)"
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10 text-xs font-mono"
          />
          <p className="text-[10px] text-white/40 mt-1">
            Related entitlements that form a package (e.g., Houston-style
            multi-pick deals).
          </p>
        </div>

        <div>
          <label
            htmlFor="entitlement-coveredByEntitlementIds"
            className="block text-xs text-white/60 mb-1"
          >
            Covered By Entitlement IDs
          </label>
          <textarea
            id="entitlement-coveredByEntitlementIds"
            value={formState.coveredByEntitlementIdsText}
            onChange={(e) =>
              updateField('coveredByEntitlementIdsText', e.target.value)
            }
            disabled={disabled}
            rows={2}
            placeholder="One entitlement ID per line"
            className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10 text-xs font-mono"
          />
          <p className="text-[10px] text-white/40 mt-1">
            IDs of swap_rights covering this pick (used for encumbered warning
            logic).
          </p>
        </div>
      </div>
    </div>
  );
};
