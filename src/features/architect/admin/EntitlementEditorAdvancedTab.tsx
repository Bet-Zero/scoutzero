/**
 * FILE: src/features/architect/admin/EntitlementEditorAdvancedTab.tsx
 * PURPOSE: Render the Advanced JSON tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import React, { useState } from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import { serializeEntitlementDocument } from './entitlementEditorFormState';

interface EntitlementEditorAdvancedTabProps {
  formState: EntitlementFormState;
  onApplyJson: (jsonInput: string) => { success: boolean; error?: string };
  disabled?: boolean;
}

export const EntitlementEditorAdvancedTab: React.FC<
  EntitlementEditorAdvancedTabProps
> = ({ formState, onApplyJson, disabled = false }) => {
  const [jsonInput, setJsonInput] = useState(() =>
    serializeEntitlementDocument(formState)
  );
  const [error, setError] = useState<string | null>(null);

  const handleSyncFromForm = () => {
    setJsonInput(serializeEntitlementDocument(formState));
    setError(null);
  };

  const handleApply = () => {
    const result = onApplyJson(jsonInput);
    if (!result.success) {
      setError(result.error || 'Failed to apply JSON');
      return;
    }
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Advanced JSON</h3>
          <p className="text-xs text-white/50">
            Power users can edit the raw entitlement document.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSyncFromForm}
            disabled={disabled}
            className="px-3 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50"
          >
            Sync from form
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={disabled}
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            Apply JSON
          </button>
        </div>
      </div>

      <textarea
        className="font-mono text-xs w-full h-72 p-2 bg-gray-900 text-gray-100 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        disabled={disabled}
        spellCheck={false}
      />

      {error && (
        <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/40 rounded px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
};
