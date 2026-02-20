/**
 * FILE: src/features/architect/admin/useEntitlementEditorSession.ts
 * PURPOSE: Unified session state for the Entitlement Editor — shared by Simple and Advanced views.
 *          ONE editor, ONE working state, ONE save semantics (R1, R2, R3).
 * OWNERSHIP: Feature: architect/admin (Entitlement Editor Unification)
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Editor Unification (Simple ↔ Advanced).
 *  - 2026-02-20: Added R4 double-submit protection in handleApply.
 *
 * INVARIANTS:
 *  - R1: One Editor, One Working State — both views use the same formState/wizardModel.
 *  - R2: One Save Semantics — save function is context-agnostic (storageMode routes).
 *  - R3: Context is Implementation Detail — no user-facing vacuum/world distinction.
 *  - R4: Double-submit protection — handleApply ignores calls while save is in progress.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import { createEntitlementFormState } from './entitlementEditorFormState';
import type { FieldErrors } from './useEntitlementEditorState';
import type { WizardModel } from './pickRightWizardModel';
import {
  createDefaultWizardModel,
  formStateToWizardModel,
} from './pickRightWizardModel';
import { wizardToFormState } from './wizardToEntitlement';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
} from './pickRightWizardDraft';
import {
  hasEdit,
  hasCreate,
  removeEdit,
  removeCreate,
} from '../utils/entitlements/vacuumEntitlementOverlayStore';
import { saveEntitlementFromFormState } from './saveEntitlementFromFormState';
import type { StorageMode } from './saveEntitlementFromFormState';
import type { EntitlementEditorTabKey } from './EntitlementEditorFormTabs';
import { parseEntitlementDocument } from './entitlementEditorFormState';
import { toast } from 'react-hot-toast';

// ─── types ───────────────────────────────────────────────────────────────────

export type EditorView = 'simple' | 'advanced';

export interface EntitlementEditorSessionArgs {
  worldId: string | null;
  entitlementId?: string;
  initialDocument?: Record<string, unknown>;
  userId: string | null;
  vacuumMode?: boolean;
  onSuccess: (payload: {
    entitlementId: string;
    document: Record<string, unknown>;
  }) => void;
  onClose: () => void;
  onVacuumSessionMutation?: () => void;
}

export interface EntitlementEditorSession {
  // ── View state ──
  openView: EditorView;
  setOpenView: (view: EditorView) => void;

  // ── Shared form state (the single source of truth) ──
  formState: EntitlementFormState;
  setFormState: React.Dispatch<React.SetStateAction<EntitlementFormState>>;

  // ── Wizard model (for simple view) ──
  wizardModel: WizardModel;
  setWizardModel: (model: WizardModel) => void;

  // ── Advanced editor tab state ──
  activeTab: EntitlementEditorTabKey;
  setActiveTab: (tab: EntitlementEditorTabKey) => void;

  // ── Validation ──
  fieldErrors: FieldErrors;
  isValid: boolean;

  // ── Save state ──
  saving: boolean;
  sessionMutating: boolean;
  storageMode: StorageMode;

  // ── Flags ──
  isEditMode: boolean;
  isVacuumSession: boolean;
  isDirty: boolean;

  // ── Actions ──
  handleApply: () => Promise<void>;
  handleSaveDraft: () => void;
  handleApplyJson: (jsonInput: string) => { success: boolean; error?: string };
  handleRevertThisEdit: () => void;
  handleDeleteSessionPickRight: () => void;
  canRevertThisEdit: boolean;
  canDeleteSessionPickRight: boolean;

  // ── Context data ──
  entitlementId: string | undefined;
}

// ─── validation (shared between views) ───────────────────────────────────────

function validateFormState(formState: EntitlementFormState): FieldErrors {
  const errors: FieldErrors = {};

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
  // Protection ladder validation
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
}

// ─── hook ────────────────────────────────────────────────────────────────────

export function useEntitlementEditorSession(
  args: EntitlementEditorSessionArgs
): EntitlementEditorSession {
  const {
    worldId,
    entitlementId,
    initialDocument,
    userId,
    vacuumMode = false,
    onSuccess,
    onClose,
    onVacuumSessionMutation,
  } = args;

  const isEditMode = entitlementId !== null && entitlementId !== undefined;
  const isVacuumSession = vacuumMode || !worldId;
  const storageMode: StorageMode = isVacuumSession ? 'vacuum' : 'world';

  // ── View state ──
  const [openView, setOpenView] = useState<EditorView>('simple');

  // ── Advanced tab state ──
  const [activeTab, setActiveTab] = useState<EntitlementEditorTabKey>('basics');

  // ── WizardModel (simple view source of truth) ──
  const [wizardModel, setWizardModelRaw] = useState<WizardModel>(() => {
    if (initialDocument) {
      const fs = createEntitlementFormState(initialDocument, entitlementId);
      const model = formStateToWizardModel(fs);
      return model || createDefaultWizardModel();
    }
    return createDefaultWizardModel();
  });

  // ── FormState (the canonical shared state) ──
  const [formState, setFormState] = useState<EntitlementFormState>(() =>
    createEntitlementFormState(initialDocument, entitlementId)
  );

  // ── Saving states ──
  const [saving, setSaving] = useState(false);
  const [sessionMutating, setSessionMutating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Draft restoration ──
  const [draftChecked, setDraftChecked] = useState(false);

  // ── Sync WizardModel → formState when simple view changes the wizard ──
  const setWizardModel = useCallback(
    (next: WizardModel) => {
      setWizardModelRaw(next);
      if (next.intent) {
        const translated = wizardToFormState(next);
        translated.id = formState.id || entitlementId || '';
        setFormState(translated);
        setIsDirty(true);
      }
    },
    [formState.id, entitlementId]
  );

  // ── When formState changes externally (e.g. from Advanced JSON apply), sync back to wizard ──
  // This ensures round-trip: Advanced edits → switch to Simple → wizardModel reflects changes
  const setFormStateWithSync = useCallback(
    (updater: React.SetStateAction<EntitlementFormState>) => {
      setFormState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        // Try to sync back to wizard model
        const model = formStateToWizardModel(next);
        if (model) {
          setWizardModelRaw(model);
        }
        setIsDirty(true);
        return next;
      });
    },
    []
  );

  // ── Field-level validation ──
  const fieldErrors = useMemo(() => validateFormState(formState), [formState]);
  const isValid = useMemo(
    () => Object.keys(fieldErrors).length === 0,
    [fieldErrors]
  );

  // ── Draft check on mount ──
  useEffect(() => {
    if (draftChecked) return;
    setDraftChecked(true);
    const draftWorldKey = worldId || 'vacuum';
    const draftId = entitlementId || 'new';
    if (!hasDraft(draftWorldKey, draftId)) return;

    const draft = loadDraft(draftWorldKey, draftId);
    if (!draft) return;

    if ('wizardModel' in draft && 'formState' in draft) {
      const v2 = draft as {
        wizardModel: WizardModel;
        formState: EntitlementFormState;
      };
      setWizardModelRaw(v2.wizardModel);
      setFormState(v2.formState);
      toast.success('Draft restored');
    } else {
      const fs = draft as EntitlementFormState;
      setFormState(fs);
      const model = formStateToWizardModel(fs);
      if (model) {
        setWizardModelRaw(model);
        toast.success('Draft restored (migrated from v1)');
      } else {
        toast.success('Draft restored — open Advanced view for full access');
      }
    }
  }, [worldId, entitlementId, draftChecked]);

  // ── Team code for overlay operations ──
  const teamCodeForOverlay = String(
    formState.holderTeam ||
      (typeof initialDocument?.holderTeam === 'string'
        ? initialDocument.holderTeam
        : '')
  ).trim();

  const canRevertThisEdit = useMemo(() => {
    if (!isVacuumSession || !isEditMode || !entitlementId) return false;
    if (!teamCodeForOverlay) return false;
    if (entitlementId.startsWith('vacuum:')) return false;
    return hasEdit(teamCodeForOverlay, entitlementId);
  }, [isVacuumSession, isEditMode, entitlementId, teamCodeForOverlay]);

  const canDeleteSessionPickRight = useMemo(() => {
    if (!isVacuumSession || !isEditMode || !entitlementId) return false;
    if (!teamCodeForOverlay) return false;
    if (!entitlementId.startsWith('vacuum:')) return false;
    return hasCreate(teamCodeForOverlay, entitlementId);
  }, [isVacuumSession, isEditMode, entitlementId, teamCodeForOverlay]);

  // ── Apply (unified save for both views) ──
  // R4: Double-submit protection — ignore rapid clicks while save is in progress
  const handleApply = useCallback(async () => {
    // Guard: If already saving, ignore the call to prevent duplicate writes
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      const result = await saveEntitlementFromFormState({
        storageMode,
        worldId,
        userId,
        entitlementId,
        formState,
      });

      if (!result.success) {
        setSaving(false);
        return;
      }

      // Clear draft on successful save
      clearDraft(worldId || 'vacuum', entitlementId || 'new');
      setIsDirty(false);
      onSuccess({
        entitlementId: result.entitlementId,
        document: result.document,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    storageMode,
    worldId,
    userId,
    entitlementId,
    formState,
    onSuccess,
  ]);

  // ── Save draft ──
  const handleSaveDraft = useCallback(() => {
    const draftWorldKey = worldId || 'vacuum';
    const draftId = entitlementId || 'new';
    saveDraft(draftWorldKey, draftId, wizardModel, formState);
    toast.success('Draft saved');
  }, [worldId, entitlementId, wizardModel, formState]);

  // ── Apply JSON (Advanced tab) ──
  const handleApplyJson = useCallback(
    (jsonInput: string) => {
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
      // Sync wizard model
      const model = formStateToWizardModel(nextState);
      if (model) {
        setWizardModelRaw(model);
      }
      setIsDirty(true);
      toast.success('JSON applied to form');
      return { success: true };
    },
    [entitlementId]
  );

  // ── Revert vacuum edit ──
  const handleRevertThisEdit = useCallback(() => {
    if (!entitlementId || !teamCodeForOverlay) return;
    setSessionMutating(true);
    try {
      removeEdit(teamCodeForOverlay, entitlementId);
      clearDraft(worldId || 'vacuum', entitlementId);
      onVacuumSessionMutation?.();
      toast.success('Session edit reverted');
      onClose();
    } finally {
      setSessionMutating(false);
    }
  }, [
    entitlementId,
    teamCodeForOverlay,
    worldId,
    onVacuumSessionMutation,
    onClose,
  ]);

  // ── Delete vacuum session pick right ──
  const handleDeleteSessionPickRight = useCallback(() => {
    if (!entitlementId || !teamCodeForOverlay) return;
    setSessionMutating(true);
    try {
      removeCreate(teamCodeForOverlay, entitlementId);
      clearDraft(worldId || 'vacuum', entitlementId);
      onVacuumSessionMutation?.();
      toast.success('Session pick right deleted');
      onClose();
    } finally {
      setSessionMutating(false);
    }
  }, [
    entitlementId,
    teamCodeForOverlay,
    worldId,
    onVacuumSessionMutation,
    onClose,
  ]);

  return {
    openView,
    setOpenView,
    formState,
    setFormState: setFormStateWithSync,
    wizardModel,
    setWizardModel,
    activeTab,
    setActiveTab,
    fieldErrors,
    isValid,
    saving,
    sessionMutating,
    storageMode,
    isEditMode,
    isVacuumSession,
    isDirty,
    handleApply,
    handleSaveDraft,
    handleApplyJson,
    handleRevertThisEdit,
    handleDeleteSessionPickRight,
    canRevertThisEdit,
    canDeleteSessionPickRight,
    entitlementId,
  };
}
