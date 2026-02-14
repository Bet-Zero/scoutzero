/**
 * FILE: src/features/architect/admin/PickRightWizardModal.tsx
 * PURPOSE: Pick Right Wizard modal — Quick Builder single-screen UX
 *          (TM-WIZARD-SIMPLIFY-E1, TM-WIZARD-SIMPLIFY-E2).
 * OWNERSHIP: Feature: architect/admin (TM-8 / TM-9 / TM-WIZARD-SIMPLIFY-E1 / TM-WIZARD-SIMPLIFY-E2)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Added WizardModel state management alongside formState.
 *  - 2026-02-13: TM-WIZARD-SIMPLIFY-E1 — Replaced 3-step wizard with Quick Builder.
 *                Single screen: pick + action cards + controls + preview + apply.
 *                Preserves all save/draft/vacuum logic intact.
 *  - 2026-02-14: TM-WIZARD-SIMPLIFY-E2 — Added "Convert to Swap" functionality.
 *                Edit mode now shows Protect + Swap action buttons.
 *                Non-swap entitlements can be converted to swap_right via duplicate-as-new flow.
 *
 * Quick Builder mode is the default. "Open Advanced Editor" passes the translated
 * formState to EntitlementEditorModal, preserving all data for power-user editing.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import type {
  EntitlementFormState,
  EntitlementKind,
} from './entitlementEditorFormState';
import {
  createEntitlementFormState,
  buildEntitlementDocument,
} from './entitlementEditorFormState';
import type { FieldErrors } from './useEntitlementEditorState';
import { db } from '@/firebaseConfig';
import {
  generateEntitlementId,
  validateEntitlementDocument,
  writeWorldEntitlement,
} from '../utils/entitlements/entitlementWriter';
import type { WizardModel, WizardIntent } from './pickRightWizardModel';
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
  applyVacuumEdit,
  applyVacuumCreate,
  removeEdit,
  removeCreate,
  hasEdit,
  hasCreate,
  makeVacuumEntitlementId,
} from '../utils/entitlements/vacuumEntitlementOverlayStore';
import { QuickBuilder } from './PickRightWizardSteps/QuickBuilder';

// ─── component ───────────────────────────────────────────────────────────────

interface PickRightWizardModalProps {
  worldId: string | null;
  entitlementId?: string;
  initialDocument?: Record<string, unknown>;
  userId: string | null;
  vacuumMode?: boolean;
  onClose: () => void;
  onSuccess: (payload: {
    entitlementId: string;
    document: Record<string, unknown>;
  }) => void;
  onVacuumSessionMutation?: () => void;
  onOpenAdvanced?: (formState: EntitlementFormState) => void;
}

const PickRightWizardModal: React.FC<PickRightWizardModalProps> = ({
  worldId,
  entitlementId,
  initialDocument,
  userId,
  vacuumMode = false,
  onClose,
  onSuccess,
  onVacuumSessionMutation,
  onOpenAdvanced,
}) => {
  const isEditMode = entitlementId !== null && entitlementId !== undefined;
  const isVacuumSession = vacuumMode || !worldId;

  // ── State ──
  const [saving, setSaving] = useState(false);
  const [sessionMutating, setSessionMutating] = useState(false);

  // WizardModel = wizard-mode source of truth (TM-9)
  const [wizardModel, setWizardModel] = useState<WizardModel>(() => {
    if (initialDocument) {
      const fs = createEntitlementFormState(initialDocument, entitlementId);
      const model = formStateToWizardModel(fs);
      return model || createDefaultWizardModel();
    }
    return createDefaultWizardModel();
  });

  // FormState = derived from WizardModel, used for validation & save pipeline
  const [formState, setFormState] = useState<EntitlementFormState>(() =>
    createEntitlementFormState(initialDocument, entitlementId)
  );

  // Draft restoration flag
  const [draftChecked, setDraftChecked] = useState(false);

  // ── Sync WizardModel → formState on every wizard change ──
  useEffect(() => {
    if (wizardModel.intent) {
      const translated = wizardToFormState(wizardModel);
      // Preserve the existing entitlement ID
      translated.id = formState.id || entitlementId || '';
      setFormState(translated);
    }
  }, [wizardModel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field-level validation ──
  const fieldErrors: FieldErrors = useMemo(() => {
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

    return errors;
  }, [formState]);

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

    // v2 format: { wizardModel, formState }
    if ('wizardModel' in draft && 'formState' in draft) {
      const v2 = draft as {
        wizardModel: WizardModel;
        formState: EntitlementFormState;
      };
      setWizardModel(v2.wizardModel);
      setFormState(v2.formState);
      toast.success('Draft restored');
    } else {
      // v1 format: raw EntitlementFormState
      const fs = draft as EntitlementFormState;
      setFormState(fs);
      const model = formStateToWizardModel(fs);
      if (model) {
        setWizardModel(model);
        toast.success('Draft restored (migrated from v1)');
      } else {
        toast.success('Draft restored — open Advanced Editor for full access');
      }
    }
  }, [worldId, entitlementId, draftChecked]);

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

  // ── WizardModel change handler (passed to QuickBuilder) ──
  const handleWizardModelChange = useCallback((next: WizardModel) => {
    setWizardModel(next);
  }, []);

  // ── Draft save ──
  const handleSaveDraft = useCallback(() => {
    const draftWorldKey = worldId || 'vacuum';
    const draftId = entitlementId || 'new';
    saveDraft(draftWorldKey, draftId, wizardModel, formState);
    toast.success('Draft saved');
  }, [worldId, entitlementId, wizardModel, formState]);

  // ── Apply (save to Firestore or vacuum overlay) ──
  const handleApply = useCallback(async () => {
    setSaving(true);
    try {
      const document = buildEntitlementDocument(formState);
      const validation = validateEntitlementDocument(document);
      if (!validation.valid) {
        const errors = validation.errors || [
          validation.error || 'Validation failed',
        ];
        toast.error(errors[0] || 'Validation failed');
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
          document.kind as EntitlementKind
        );

      if (!id && !vacuumMode) {
        toast.error('Entitlement ID could not be determined.');
        setSaving(false);
        return;
      }

      // ── Vacuum mode: persist to localStorage overlay (NO Firestore writes) ──
      if (vacuumMode || !worldId) {
        const teamCode = document.holderTeam as string;
        if (!teamCode) {
          toast.error('Holder team is required.');
          setSaving(false);
          return;
        }

        let finalId: string;
        if (entitlementId && !entitlementId.startsWith('vacuum:')) {
          // Editing an existing base entitlement — store as an edit overlay
          applyVacuumEdit(teamCode, entitlementId, document);
          finalId = entitlementId;
        } else if (entitlementId && entitlementId.startsWith('vacuum:')) {
          // Re-editing an existing vacuum create — overwrite the create entry
          applyVacuumCreate(teamCode, entitlementId, document);
          finalId = entitlementId;
        } else {
          // Creating new — generate a vacuum-prefixed ID
          finalId = makeVacuumEntitlementId({
            teamCode,
            seasonYear: document.seasonYear as number,
            round: document.round as number,
            kind: (document.kind as string) || 'pick_ownership',
          });
          applyVacuumCreate(teamCode, finalId, document);
        }

        const draftWorldKey = worldId || 'vacuum';
        clearDraft(draftWorldKey, entitlementId || 'new');
        toast.success('Saved (this session only)');
        onSuccess({
          entitlementId: finalId,
          document: { ...document, id: finalId },
        });
        return;
      }

      // ── World mode: persist to Firestore (existing path) ──
      const result = await writeWorldEntitlement(db, {
        worldId,
        entitlementId: id,
        document,
        userId: userId || '',
      });

      if (!result.success) {
        toast.error(result.error || 'Write failed');
        setSaving(false);
        return;
      }

      // Clear draft on successful save
      clearDraft(worldId || 'vacuum', entitlementId || 'new');
      toast.success('Entitlement saved');
      onSuccess({ entitlementId: id, document: { ...document, id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [formState, entitlementId, worldId, userId, vacuumMode, onSuccess]);

  // ── Open Advanced Editor ──
  const handleOpenAdvanced = useCallback(() => {
    if (onOpenAdvanced) {
      onOpenAdvanced(formState);
    }
  }, [formState, onOpenAdvanced]);

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

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="pick-right-wizard-modal"
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {entitlementId
              ? `${wizardModel.pick.team || '???'} ${wizardModel.pick.year || '????'} ${wizardModel.pick.round === 1 ? '1st' : wizardModel.pick.round === 2 ? '2nd' : `R${wizardModel.pick.round}`}`
              : 'New Pick Right'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-xl leading-none"
            data-testid="wizard-close"
          >
            ×
          </button>
        </div>

        {/* Body: Quick Builder (single screen) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <QuickBuilder
            wizardModel={wizardModel}
            formState={formState}
            fieldErrors={fieldErrors}
            isValid={isValid}
            saving={saving || sessionMutating}
            onChange={handleWizardModelChange}
            onOpenAdvanced={handleOpenAdvanced}
            disabled={saving || sessionMutating}
            isEditMode={isEditMode}
            lockIdentityFields={isEditMode}
          />
        </div>

        {/* Footer — cancel, session actions, apply */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
            data-testid="wizard-back"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {isVacuumSession && isEditMode && (
              <>
                {canRevertThisEdit && (
                  <button
                    type="button"
                    onClick={handleRevertThisEdit}
                    disabled={saving || sessionMutating}
                    className="px-3 py-1.5 rounded border border-amber-500/40 text-amber-300 text-xs hover:bg-amber-900/20 disabled:opacity-50"
                    data-testid="wizard-revert-edit"
                  >
                    Revert this edit
                  </button>
                )}
                {canDeleteSessionPickRight && (
                  <button
                    type="button"
                    onClick={handleDeleteSessionPickRight}
                    disabled={saving || sessionMutating}
                    className="px-3 py-1.5 rounded border border-red-500/40 text-red-300 text-xs hover:bg-red-900/20 disabled:opacity-50"
                    data-testid="wizard-delete-session-pick-right"
                  >
                    Delete this session pick right
                  </button>
                )}
              </>
            )}

            {/* Apply button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={!isValid || saving || sessionMutating}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isValid && !saving && !sessionMutating
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
              data-testid="wizard-apply-footer"
            >
              {saving ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PickRightWizardModal };
