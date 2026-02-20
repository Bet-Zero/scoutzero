/**
 * FILE: src/features/architect/admin/EntitlementEditorModal.tsx
 * PURPOSE: Entitlement editor modal with tabbed form and advanced JSON editor.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B1)
 *  - 2026-02-05: Upgraded to tabbed form editor (TM-4)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 */

import React from 'react';
import { isEntitlementAuthoringEnabled } from '../utils/entitlements/entitlementWriter';
import { EntitlementEditorFormTabs } from './EntitlementEditorFormTabs';
import { EntitlementEditorTeamInventorySection } from './EntitlementEditorTeamInventorySection';
import { PickTermsPreview } from './PickTermsPreview';
import { useEntitlementEditorState } from './useEntitlementEditorState';

// =============================================================================
// TYPES
// =============================================================================

interface EntitlementEditorModalProps {
  worldId: string;
  entitlementId?: string;
  initialDocument?: Record<string, unknown>;
  userId: string;
  onClose: () => void;
  onSuccess: (payload: {
    entitlementId: string;
    document: Record<string, unknown>;
  }) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EntitlementEditorModal: React.FC<EntitlementEditorModalProps> = ({
  worldId,
  entitlementId,
  initialDocument,
  userId,
  onClose,
  onSuccess,
}) => {
  const isEnabled = isEntitlementAuthoringEnabled();
  const {
    activeTab,
    setActiveTab,
    formState,
    setFormState,
    errors,
    fieldErrors,
    isValid,
    saving,
    lastPath,
    handleApplyJson,
    handleSave,
  } = useEntitlementEditorState({
    worldId,
    entitlementId,
    initialDocument,
    userId,
    onSuccess,
  });

  if (!isEnabled) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-4">
            Feature Disabled
          </h2>
          <p className="text-gray-300 mb-4">
            Entitlement authoring is not enabled.
          </p>
          <p className="text-gray-400 text-sm mb-4">
            Set{' '}
            <code className="bg-gray-900 px-1">
              VITE_FEATURE_ENTITLEMENT_AUTHORING=true
            </code>{' '}
            in your environment.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold text-white mb-1">
          Entitlement Editor (Advanced)
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Writes to:{' '}
          <code className="bg-gray-900 px-1">
            architect_worlds/{worldId}/entitlements/
          </code>
        </p>

        {/* Split layout: Form (left) + Preview (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Form tabs (3/5 width on large screens) */}
          <div className="lg:col-span-3">
            <EntitlementEditorFormTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              formState={formState}
              onChange={setFormState}
              onApplyJson={handleApplyJson}
              fieldErrors={fieldErrors}
              disabled={saving}
              isEditMode={!!entitlementId}
            />
          </div>

          {/* Right: Live Preview (2/5 width on large screens) */}
          <div className="lg:col-span-2 lg:sticky lg:top-0 lg:self-start">
            <PickTermsPreview formState={formState} />
          </div>
        </div>

        {errors.length > 0 && (
          <div
            className="text-red-300 text-xs mt-4 p-3 bg-red-900/20 border border-red-900/40 rounded"
            data-testid="entitlement-errors"
          >
            <div className="font-semibold mb-1">Validation Errors</div>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {lastPath && (
          <div className="text-green-400 text-xs mt-4 p-2 bg-green-900/20 rounded">
            Saved to: {lastPath}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
            title={!isValid ? 'Fix validation errors before saving' : ''}
          >
            {saving ? 'Saving...' : 'Save Entitlement'}
          </button>
        </div>

        <EntitlementEditorTeamInventorySection
          worldId={worldId}
          entitlementId={entitlementId}
          formState={formState}
          userId={userId}
        />
      </div>
    </div>
  );
};
