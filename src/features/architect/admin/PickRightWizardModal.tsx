/**
 * FILE: src/features/architect/admin/PickRightWizardModal.tsx
 * PURPOSE: Unified Entitlement Editor modal with Simple (QuickBuilder) and
 *          Advanced (tabbed editor) views sharing a SINGLE session state.
 * OWNERSHIP: Feature: architect/admin (Entitlement Editor Unification)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Added WizardModel state management alongside formState.
 *  - 2026-02-13: TM-WIZARD-SIMPLIFY-E1 — Quick Builder single-screen UX overhaul.
 *  - 2026-02-14: TM-WIZARD-SIMPLIFY-E2 — Added "Convert to Swap" functionality.
 *  - 2026-02-20: UNIFIED — Single modal, two views (Simple ↔ Advanced),
 *                shared session state, unified save semantics.
 *                Removed separate Advanced modal + vacuum-only guard.
 *
 * INVARIANTS:
 *  - R1: One Editor, One Working State — both views use the same formState.
 *  - R2: One Save Semantics — Apply calls the unified save function.
 *  - R3: Context is Implementation Detail — no user-facing vacuum/world distinction.
 */

import React, { useCallback } from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import { buildEntitlementDocument } from './entitlementEditorFormState';
import { wizardPickToId } from './pickRightWizardModel';
import { useEntitlementEditorSession } from './useEntitlementEditorSession';
import { QuickBuilder } from './PickRightWizardSteps/QuickBuilder';
import { EntitlementEditorFormTabs } from './EntitlementEditorFormTabs';
import { PickTermsPreview } from './PickTermsPreview';
import { EntitlementEditorTeamInventorySection } from './EntitlementEditorTeamInventorySection';

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
  /** @deprecated No longer needed — Advanced view is inline. Kept for API compat. */
  onOpenAdvanced?: (formState: EntitlementFormState) => void;
  onDuplicateAsNew?: (document: Record<string, unknown>) => void;
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
  onDuplicateAsNew,
}) => {
  const session = useEntitlementEditorSession({
    worldId,
    entitlementId,
    initialDocument,
    userId,
    vacuumMode,
    onSuccess,
    onClose,
    onVacuumSessionMutation,
  });

  const {
    openView,
    setOpenView,
    formState,
    setFormState,
    wizardModel,
    setWizardModel,
    activeTab,
    setActiveTab,
    fieldErrors,
    isValid,
    saving,
    sessionMutating,
    isEditMode,
    isVacuumSession,
    handleApply,
    handleSaveDraft,
    handleApplyJson,
    handleRevertThisEdit,
    handleDeleteSessionPickRight,
    canRevertThisEdit,
    canDeleteSessionPickRight,
  } = session;

  const isDisabled = saving || sessionMutating;

  // ── Duplicate as new handler (TM-VACUUM-E3) ──
  const handleDuplicateAsNew = useCallback(() => {
    if (!onDuplicateAsNew) return;
    const doc = buildEntitlementDocument(formState);
    const { id: _id, ...rest } = doc;
    onDuplicateAsNew(rest);
  }, [formState, onDuplicateAsNew]);

  // ── Convert to Swap handler (TM-WIZARD-SIMPLIFY-E2) ──
  const handleConvertToSwap = useCallback(() => {
    if (!onDuplicateAsNew) return;
    const doc = buildEntitlementDocument(formState);
    const { id: _id, ...rest } = doc;
    rest.kind = 'swap_right';
    rest.swapControllerPickId = wizardPickToId(wizardModel.pick);
    rest.swapType = 'best_of';
    onDuplicateAsNew(rest);
  }, [formState, wizardModel, onDuplicateAsNew]);

  // ── View toggle handler (Simple ↔ Advanced) — no state loss ──
  const handleToggleView = () => {
    setOpenView(openView === 'simple' ? 'advanced' : 'simple');
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  const isAdvanced = openView === 'advanced';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="pick-right-wizard-modal"
    >
      <div
        className={`bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col ${
          isAdvanced ? 'max-w-5xl' : 'max-w-2xl'
        }`}
      >
        {/* Header — shared across views */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Entitlement Editor
              </h2>
              {entitlementId && (
                <p className="text-xs text-white/50">
                  {wizardModel.pick.team || '???'}{' '}
                  {wizardModel.pick.year || '????'}{' '}
                  {wizardModel.pick.round === 1
                    ? '1st'
                    : wizardModel.pick.round === 2
                      ? '2nd'
                      : `R${wizardModel.pick.round}`}
                </p>
              )}
            </div>
            {/* View toggle pill */}
            <div className="flex items-center rounded-lg bg-white/5 border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setOpenView('simple')}
                className={`px-2.5 py-1 rounded-l-lg transition-colors ${
                  !isAdvanced
                    ? 'bg-blue-600/30 text-blue-300'
                    : 'text-white/40 hover:text-white/60'
                }`}
                data-testid="view-toggle-simple"
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setOpenView('advanced')}
                className={`px-2.5 py-1 rounded-r-lg transition-colors ${
                  isAdvanced
                    ? 'bg-blue-600/30 text-blue-300'
                    : 'text-white/40 hover:text-white/60'
                }`}
                data-testid="view-toggle-advanced"
              >
                Advanced
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-xl leading-none"
            data-testid="wizard-close"
          >
            ×
          </button>
        </div>

        {/* Vacuum mode banner */}
        {isVacuumSession && (
          <div
            data-testid="vacuum-mode-banner"
            className="mx-6 mt-3 px-3 py-2 rounded bg-amber-900/20 border border-amber-500/20 text-amber-200 text-xs"
          >
            Changes are not saved to a world — session-only editing.
          </div>
        )}

        {/* Body — view-dependent rendering */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!isAdvanced ? (
            /* ── Simple View: QuickBuilder ── */
            <QuickBuilder
              wizardModel={wizardModel}
              formState={formState}
              fieldErrors={fieldErrors}
              isValid={isValid}
              saving={isDisabled}
              onChange={setWizardModel}
              onOpenAdvanced={handleToggleView}
              disabled={isDisabled}
              isEditMode={isEditMode}
              lockIdentityFields={isEditMode}
              onConvertToSwap={
                isEditMode &&
                (initialDocument?.kind as string) === 'pick_ownership' &&
                onDuplicateAsNew
                  ? handleConvertToSwap
                  : undefined
              }
            />
          ) : (
            /* ── Advanced View: Tabbed Editor + Preview ── */
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
                  disabled={isDisabled}
                  isEditMode={isEditMode}
                />
              </div>

              {/* Right: Live Preview (2/5 width on large screens) */}
              <div className="lg:col-span-2 lg:sticky lg:top-0 lg:self-start">
                <PickTermsPreview formState={formState} />
              </div>
            </div>
          )}
        </div>

        {/* Advanced: Team inventory section (world mode only) */}
        {isAdvanced && worldId && userId && (
          <div className="px-6">
            <EntitlementEditorTeamInventorySection
              worldId={worldId}
              entitlementId={entitlementId}
              formState={formState}
              userId={userId}
            />
          </div>
        )}

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
            {/* Duplicate as new (TM-VACUUM-E3) — edit mode only */}
            {isEditMode && onDuplicateAsNew && (
              <button
                type="button"
                onClick={handleDuplicateAsNew}
                disabled={isDisabled}
                className="px-3 py-1.5 rounded border border-white/20 text-white/50 text-xs hover:bg-white/5 disabled:opacity-50"
                data-testid="wizard-duplicate-as-new"
              >
                Create new from this…
              </button>
            )}

            {isVacuumSession && isEditMode && (
              <>
                {canRevertThisEdit && (
                  <button
                    type="button"
                    onClick={handleRevertThisEdit}
                    disabled={isDisabled}
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
                    disabled={isDisabled}
                    className="px-3 py-1.5 rounded border border-red-500/40 text-red-300 text-xs hover:bg-red-900/20 disabled:opacity-50"
                    data-testid="wizard-delete-session-pick-right"
                  >
                    Delete this session pick right
                  </button>
                )}
              </>
            )}

            {/* Save Draft */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isDisabled}
              className="px-3 py-1.5 rounded border border-white/20 text-white/50 text-xs hover:bg-white/5 disabled:opacity-50"
              data-testid="wizard-save-draft"
            >
              Save Draft
            </button>

            {/* Apply button — SAME semantics in both views */}
            <button
              type="button"
              onClick={handleApply}
              disabled={!isValid || isDisabled}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isValid && !isDisabled
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
              data-testid="wizard-apply"
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
