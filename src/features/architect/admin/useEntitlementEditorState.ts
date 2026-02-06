/**
 * FILE: src/features/architect/admin/useEntitlementEditorState.ts
 * PURPOSE: State and handlers for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { EntitlementFormState } from './entitlementEditorFormState';
import type { EntitlementEditorTabKey } from './EntitlementEditorFormTabs';

// =============================================================================
// FORM-LEVEL VALIDATION
// =============================================================================

export type FieldErrors = Record<string, string>;

/**
 * Validate form state and return a map of field-level errors.
 * Used for inline error display and blocking the save button.
 */
const validateFormState = (formState: EntitlementFormState): FieldErrors => {
  const errors: FieldErrors = {};

  // Basics validations
  if (!formState.holderTeam || formState.holderTeam.trim().length !== 3) {
    errors.holderTeam = 'Must be a 3-letter team code';
  }

  const year = Number(formState.seasonYear);
  if (
    !formState.seasonYear ||
    !Number.isFinite(year) ||
    year < 2020 ||
    year > 2040
  ) {
    errors.seasonYear = 'Must be between 2020 and 2040';
  }

  if (
    !formState.round ||
    (formState.round !== '1' && formState.round !== '2')
  ) {
    errors.round = 'Must be 1 or 2';
  }

  if (!formState.kind) {
    errors.kind = 'Kind is required';
  }

  // Kind-specific validations
  if (formState.kind === 'pick_ownership') {
    if (!formState.underlyingPickId?.trim()) {
      errors.underlyingPickId = 'Required for pick ownership';
    }
  }

  if (formState.kind === 'swap_right') {
    if (!formState.swapControllerPickId?.trim()) {
      errors.swapControllerPickId = 'Required for swap right';
    }
    if (!formState.swapTargetDefinition?.trim()) {
      errors.swapTargetDefinition = 'Required for swap right';
    }
  }

  if (formState.kind === 'conveyance_right') {
    const poolIds = formState.poolUnderlyingPickIdsText
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);
    if (poolIds.length < 2) {
      errors.poolUnderlyingPickIds = 'Pool must have at least 2 picks';
    }
    if (!formState.receivesComparator) {
      errors.receivesComparator = 'Selection method required';
    }
    const ranks = formState.receivesRankText
      .split(/[\n,]/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (ranks.length === 0) {
      errors.receivesRank = 'At least one rank required';
    }
  }

  // Protection ladder validation (check for year ordering issues)
  if (formState.protectionLadder.length > 0) {
    let prevYear = -Infinity;
    for (let i = 0; i < formState.protectionLadder.length; i++) {
      const tier = formState.protectionLadder[i];
      if (!tier.year || tier.year.trim() === '') {
        errors[`protectionLadder.${i}.year`] = 'Year required';
      } else {
        const y = Number(tier.year);
        if (y <= prevYear) {
          errors[`protectionLadder.${i}.year`] = 'Years must be ascending';
        }
        prevYear = y;
      }
      if (tier.ifTriggered === 'roll' && !tier.rollToYear?.trim()) {
        errors[`protectionLadder.${i}.rollToYear`] = 'Roll year required';
      }
      if (tier.ifTriggered === 'convert' && !tier.convertToRound?.trim()) {
        errors[`protectionLadder.${i}.convertToRound`] = 'Round required';
      }
    }
  }

  return errors;
};

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

  // Compute field-level errors reactively
  const fieldErrors = useMemo(() => validateFormState(formState), [formState]);
  const isValid = useMemo(
    () => Object.keys(fieldErrors).length === 0,
    [fieldErrors]
  );

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
    const nextState = createEntitlementFormState(
      parsed.document,
      entitlementId
    );
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
        const nextErrors = validation.errors || [
          validation.error || 'Validation failed',
        ];
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
    fieldErrors,
    isValid,
    saving,
    lastPath,
    handleApplyJson,
    handleSave,
  };
};
