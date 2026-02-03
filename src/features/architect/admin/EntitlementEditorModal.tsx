/**
 * FILE: src/features/architect/admin/EntitlementEditorModal.tsx
 * PURPOSE: Minimal admin modal for JSON entitlement editing (B1).
 * OWNERSHIP: Feature: architect/admin
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B1)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *
 * USAGE:
 *  - Requires feature flag VITE_FEATURE_ENTITLEMENT_AUTHORING=true
 *  - Only writes to architect_worlds/{worldId}/entitlements/{id}
 *  - Never modifies architect_baseEntitlements
 */

import React, { useState, useCallback } from 'react';
import { db } from '@/firebaseConfig';
import {
  writeWorldEntitlement,
  attachEntitlementToTeam,
  detachEntitlementFromTeam,
  validateEntitlementDocument,
  isEntitlementAuthoringEnabled,
  generateEntitlementId,
  getEntitlementPath,
} from '../utils/entitlements/entitlementWriter';

// =============================================================================
// TYPES
// =============================================================================

interface EntitlementEditorModalProps {
  worldId: string;
  entitlementId?: string;
  initialDocument?: Record<string, unknown>;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
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
  // Check feature flag
  const isEnabled = isEntitlementAuthoringEnabled();

  // State
  const [jsonInput, setJsonInput] = useState(
    initialDocument ? JSON.stringify(initialDocument, null, 2) : getDefaultEntitlementJson()
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastPath, setLastPath] = useState<string | null>(null);

  // Team attachment state
  const [attachTeamCode, setAttachTeamCode] = useState('');
  const [attachAction, setAttachAction] = useState<'attach' | 'detach'>('attach');
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Handle save
  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);

    try {
      // Parse JSON
      let document: Record<string, unknown>;
      try {
        document = JSON.parse(jsonInput);
      } catch (parseErr) {
        setError('Invalid JSON: ' + (parseErr instanceof Error ? parseErr.message : 'Parse error'));
        setSaving(false);
        return;
      }

      // Validate
      const validation = validateEntitlementDocument(document);
      if (!validation.valid) {
        setError(validation.error || 'Validation failed');
        setSaving(false);
        return;
      }

      // Derive entitlement ID
      const id = entitlementId || (document.id as string) || generateEntitlementId(
        document.holderTeam as string,
        document.seasonYear as number,
        document.round as number,
        document.kind as 'pick_ownership' | 'swap_right' | 'conveyance_right'
      );

      // Write
      const result = await writeWorldEntitlement(db, {
        worldId,
        entitlementId: id,
        document,
        userId,
      });

      if (!result.success) {
        setError(result.error || 'Write failed');
        setSaving(false);
        return;
      }

      setLastPath(result.path || null);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [jsonInput, entitlementId, worldId, userId, onSuccess]);

  // Handle team attachment
  const handleTeamAttachment = useCallback(async () => {
    setAttachError(null);
    setAttaching(true);

    try {
      // Parse JSON to get entitlement ID
      let document: Record<string, unknown>;
      try {
        document = JSON.parse(jsonInput);
      } catch {
        setAttachError('Parse JSON first to get entitlement ID');
        setAttaching(false);
        return;
      }

      const id = entitlementId || (document.id as string);
      if (!id) {
        setAttachError('Entitlement must have an ID');
        setAttaching(false);
        return;
      }

      if (!attachTeamCode || attachTeamCode.length !== 3) {
        setAttachError('Enter valid 3-letter team code');
        setAttaching(false);
        return;
      }

      const params = {
        worldId,
        teamCode: attachTeamCode.toUpperCase(),
        entitlementId: id,
        userId,
      };

      const result = attachAction === 'attach'
        ? await attachEntitlementToTeam(db, params)
        : await detachEntitlementFromTeam(db, params);

      if (!result.success) {
        setAttachError(result.error || 'Operation failed');
        setAttaching(false);
        return;
      }

      setAttachTeamCode('');
      setAttachError(null);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAttaching(false);
    }
  }, [jsonInput, entitlementId, attachTeamCode, attachAction, worldId, userId]);

  // Feature flag guard
  if (!isEnabled) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-4">Feature Disabled</h2>
          <p className="text-gray-300 mb-4">
            Entitlement authoring is not enabled.
          </p>
          <p className="text-gray-400 text-sm mb-4">
            Set <code className="bg-gray-900 px-1">VITE_FEATURE_ENTITLEMENT_AUTHORING=true</code> in your environment.
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
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold text-white mb-2">
          {entitlementId ? 'Edit' : 'Create'} World Entitlement
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Writes to: <code className="bg-gray-900 px-1">architect_worlds/{worldId}/entitlements/</code>
        </p>

        {/* JSON Editor */}
        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-1">
            Entitlement Document (JSON)
          </label>
          <textarea
            className="font-mono text-sm w-full h-80 p-2 bg-gray-900 text-gray-100 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            disabled={saving}
            spellCheck={false}
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="text-red-400 text-sm mb-4 p-2 bg-red-900 bg-opacity-20 rounded">
            {error}
          </div>
        )}

        {/* Success path display */}
        {lastPath && (
          <div className="text-green-400 text-sm mb-4 p-2 bg-green-900 bg-opacity-20 rounded">
            Saved to: {lastPath}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Entitlement'}
          </button>
        </div>

        {/* Team attachment section */}
        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold text-white mb-2">
            Team Inventory
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            Attach/detach this entitlement to a team&apos;s inventory.
          </p>

          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Team Code</label>
              <input
                type="text"
                value={attachTeamCode}
                onChange={(e) => setAttachTeamCode(e.target.value.toUpperCase())}
                placeholder="LAL"
                maxLength={3}
                className="w-20 px-2 py-1 bg-gray-900 text-gray-100 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                disabled={attaching}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Action</label>
              <select
                value={attachAction}
                onChange={(e) => setAttachAction(e.target.value as 'attach' | 'detach')}
                className="px-2 py-1 bg-gray-900 text-gray-100 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                disabled={attaching}
              >
                <option value="attach">Attach</option>
                <option value="detach">Detach</option>
              </select>
            </div>
            <button
              onClick={handleTeamAttachment}
              disabled={attaching || !attachTeamCode}
              className="px-4 py-1 bg-green-600 hover:bg-green-500 rounded disabled:opacity-50"
            >
              {attaching ? '...' : attachAction === 'attach' ? 'Add to Team' : 'Remove from Team'}
            </button>
          </div>

          {attachError && (
            <div className="text-red-400 text-sm mt-2">
              {attachError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultEntitlementJson(): string {
  const defaultDoc = {
    id: '',
    holderTeam: 'LAL',
    seasonYear: 2026,
    round: 1,
    kind: 'pick_ownership',
    underlyingPickId: 'LAL_2026_1st',
    description: 'LAL 2026 1st Round Pick',
    underlyingStatus: 'clean',
  };
  return JSON.stringify(defaultDoc, null, 2);
}

export default EntitlementEditorModal;
