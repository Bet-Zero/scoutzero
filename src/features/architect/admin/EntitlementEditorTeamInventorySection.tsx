/**
 * FILE: src/features/architect/admin/EntitlementEditorTeamInventorySection.tsx
 * PURPOSE: Attach/detach entitlement IDs to team inventory in EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import React, { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { db } from '@/firebaseConfig';
import {
  attachEntitlementToTeam,
  detachEntitlementFromTeam,
} from '../utils/entitlements/entitlementWriter';
import {
  getEntitlementIdFromForm,
  type EntitlementFormState,
} from './entitlementEditorFormState';

interface EntitlementEditorTeamInventorySectionProps {
  worldId: string;
  entitlementId?: string;
  formState: EntitlementFormState;
  userId: string;
}

export const EntitlementEditorTeamInventorySection: React.FC<
  EntitlementEditorTeamInventorySectionProps
> = ({ worldId, entitlementId, formState, userId }) => {
  const [attachTeamCode, setAttachTeamCode] = useState('');
  const [attachAction, setAttachAction] = useState<'attach' | 'detach'>('attach');
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const handleTeamAttachment = useCallback(async () => {
    setAttachError(null);
    setAttaching(true);

    try {
      const id = getEntitlementIdFromForm(formState, entitlementId);
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

      const result =
        attachAction === 'attach'
          ? await attachEntitlementToTeam(db, params)
          : await detachEntitlementFromTeam(db, params);

      if (!result.success) {
        setAttachError(result.error || 'Operation failed');
        setAttaching(false);
        return;
      }

      setAttachTeamCode('');
      setAttachError(null);
      toast.success(
        attachAction === 'attach'
          ? 'Entitlement added to team'
          : 'Entitlement removed from team'
      );
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAttaching(false);
    }
  }, [formState, entitlementId, attachTeamCode, attachAction, worldId, userId]);

  return (
    <div className="border-t border-gray-700 pt-4 mt-6">
      <h3 className="text-sm font-semibold text-white mb-2">Team Inventory</h3>
      <p className="text-xs text-gray-400 mb-3">
        Attach/detach this entitlement to a team&apos;s inventory.
      </p>

      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-xs text-gray-300 mb-1">Team Code</label>
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
          <label className="block text-xs text-gray-300 mb-1">Action</label>
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
          {attaching
            ? '...'
            : attachAction === 'attach'
              ? 'Add to Team'
              : 'Remove from Team'}
        </button>
      </div>

      {attachError && (
        <div className="text-red-400 text-xs mt-2">{attachError}</div>
      )}
    </div>
  );
};
