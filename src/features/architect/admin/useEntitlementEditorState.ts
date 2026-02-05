/**
 * FILE: src/features/architect/admin/useEntitlementEditorState.ts
 * PURPOSE: State and handlers for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { db } from '@/firebaseConfig';
import {
  generateEntitlementId,
  getEntitlementPath,
  validateEntitlementDocument,
  writeWorldEntitlement,
} from '../utils/entitlements/entitlementWriter';
import {
  buildEntitlementDocument,
  createEntitlementFormState,
  parseEntitlementDocument,
} from './entitlementEditorFormState';
import type { EntitlementEditorTabKey } from './EntitlementEditorFormTabs';

interface UseEntitlementEditorStateArgs {
  worldId: string;
  entitlementId?: string;
  initialDocument?: Record<string, unknown>;
  userId: string;
  onSuccess: (payload: {
    entitlementId: string;
    document: Record<string, unknown>;
  }) => void;
}

export const useEntitlementEditorState = ({
  worldId,
  entitlementId,
  initialDocument,
  userId,
  onSuccess,
}: UseEntitlementEditorStateArgs) => {
  const [activeTab, setActiveTab] = useState<EntitlementEditorTabKey>('basics');
  const [formState, setFormState] = useState(() =>
    createEntitlementFormState(initialDocument, entitlementId)
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastPath, setLastPath] = useState<string | null>(null);

  useEffect(() => {
    setFormState(createEntitlementFormState(initialDocument, entitlementId));
    setErrors([]);
    setLastPath(null);
    setActiveTab('basics');
  }, [initialDocument, entitlementId]);

  const handleApplyJson = (jsonInput: string) => {
    const parsed = parseEntitlementDocument(jsonInput);
    if (parsed.error) {
      toast.error(parsed.error);
      return { success: false, error: parsed.error };
    }
    const nextState = createEntitlementFormState(parsed.document, entitlementId);
    setFormState(nextState);
    setErrors([]);
    toast.success('JSON applied to form');
    return { success: true };
  };

  const handleSave = useCallback(async () => {
    setErrors([]);
    setSaving(true);

    try {
      const document = buildEntitlementDocument(formState);
      const validation = validateEntitlementDocument(document);
      if (!validation.valid) {
        const nextErrors = validation.errors || [validation.error || 'Validation failed'];
        setErrors(nextErrors);
        toast.error(nextErrors[0] || 'Validation failed');
        setSaving(false);
        return;
      }

      const id =
        entitlementId ||
        (document.id as string) ||
        generateEntitlementId(
          document.holderTeam as string,
          document.seasonYear as number,
          document.round as number,
          document.kind as 'pick_ownership' | 'swap_right' | 'conveyance_right'
        );

      if (!id) {
        setErrors(['Entitlement ID could not be determined.']);
        toast.error('Entitlement ID could not be determined.');
        setSaving(false);
        return;
      }

      const result = await writeWorldEntitlement(db, {
        worldId,
        entitlementId: id,
        document,
        userId,
      });

      if (!result.success) {
        const message = result.error || 'Write failed';
        setErrors([message]);
        toast.error(message);
        setSaving(false);
        return;
      }

      setLastPath(result.path || getEntitlementPath(worldId, id));
      toast.success('Entitlement saved');
      onSuccess({ entitlementId: id, document: { ...document, id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrors([message]);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [formState, entitlementId, worldId, userId, onSuccess]);

  return {
    activeTab,
    setActiveTab,
    formState,
    setFormState,
    errors,
    saving,
    lastPath,
    handleApplyJson,
    handleSave,
  };
};
