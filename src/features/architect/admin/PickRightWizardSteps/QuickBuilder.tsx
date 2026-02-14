/**
 * FILE: src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx
 * PURPOSE: Compact single-screen Quick Builder for Pick Right Wizard.
 *          TM-WIZARD-SIMPLIFY-E2: No-scroll, single-screen UX menu.
 *          Edit mode shows locked identity, no PickSelector.
 *          Edit mode shows Protect + Swap action buttons.
 *          "Convert to Swap" available when editing non-swap entitlements.
 *          Pool/conveyance is Advanced Editor only.
 * OWNERSHIP: Feature: architect/admin
 *
 * HISTORY:
 *  - 2026-02-13: Created for TM-WIZARD-SIMPLIFY-E1 — Quick Builder UX Overhaul.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Edit mode shows locked identity summary
 *                instead of PickSelector. Create mode unchanged.
 *  - 2026-02-14: TM-WIZARD-SIMPLIFY-E2 — Compact no-scroll menu layout.
 *                Removed pool/conveyance from quick screen (advanced only).
 *                Removed Plain English, Terms Summary, and Tradability blocks.
 *                Added Protect+Swap action buttons in edit mode.
 *                Added "Convert to Swap" CTA for non-swap entitlements.
 */

import React, { useCallback, useMemo } from 'react';
import type { WizardModel, WizardIntent } from '../pickRightWizardModel';
import { pickIdToWizardPick, wizardPickToId } from '../pickRightWizardModel';
import type { FieldErrors } from '../useEntitlementEditorState';
import type { EntitlementFormState } from '../entitlementEditorFormState';
import { PickSelector } from '../PickSelector';
import {
  WIZARD_PRESETS,
  applyProtectionTemplate,
} from '../ProtectionLadderTemplates';
import type { ProtectionTemplate } from '../ProtectionLadderTemplates';
import { WIZARD_LABELS } from '../pickEditorCopy';
import type { EntitlementKind } from '../entitlementEditorFormState';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ROUND_LABELS: Record<string, string> = {
  '1': '1st',
  '2': '2nd',
};

// ─── component ───────────────────────────────────────────────────────────────

interface QuickBuilderProps {
  wizardModel: WizardModel;
  formState: EntitlementFormState;
  fieldErrors: FieldErrors;
  isValid: boolean;
  saving: boolean;
  onChange: (next: WizardModel) => void;
  onApply: () => void;
  onSaveDraft: () => void;
  onOpenAdvanced: () => void;
  disabled?: boolean;
  isEditMode?: boolean;
  lockIdentityFields?: boolean;
  /** Current entitlement kind (for edit mode to detect if conversion is needed) */
  currentEntitlementKind?: EntitlementKind | '';
  /** Called when user wants to convert a non-swap entitlement to swap_right */
  onConvertToSwap?: () => void;
}

export const QuickBuilder: React.FC<QuickBuilderProps> = ({
  wizardModel,
  formState,
  fieldErrors,
  isValid,
  saving,
  onChange,
  onApply,
  onSaveDraft,
  onOpenAdvanced,
  disabled = false,
  isEditMode = false,
  lockIdentityFields = false,
  currentEntitlementKind = '',
  onConvertToSwap,
}) => {
  const intent = wizardModel.intent;
  const baseYear = wizardModel.pick.year || 2026;
  const errorCount = Object.keys(fieldErrors).length;

  // Determine if we're editing a swap_right (vs pick_ownership or conveyance_right)
  const isEditingSwapRight =
    isEditMode && currentEntitlementKind === 'swap_right';
  const isEditingNonSwap =
    isEditMode &&
    currentEntitlementKind &&
    currentEntitlementKind !== 'swap_right';

  // Primary pick ID
  const primaryPickId = useMemo(
    () => wizardPickToId(wizardModel.pick),
    [wizardModel.pick]
  );

  // ── Handlers ──

  const handlePrimaryPickChange = useCallback(
    (pickId: string) => {
      const parsed = pickIdToWizardPick(pickId, wizardModel.pick);
      onChange({ ...wizardModel, pick: parsed });
    },
    [wizardModel, onChange]
  );

  const handleSelectIntent = useCallback(
    (newIntent: WizardIntent) => {
      onChange({ ...wizardModel, intent: newIntent });
    },
    [wizardModel, onChange]
  );

  // Protection
  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const template = WIZARD_PRESETS.find(
        (t: ProtectionTemplate) => t.id === templateId
      );
      if (!template) return;
      const tiers = applyProtectionTemplate(template, baseYear);
      onChange({
        ...wizardModel,
        protection: { templateId, customLadder: tiers },
      });
    },
    [wizardModel, onChange, baseYear]
  );

  // Swap
  const handleSwapTypeChange = useCallback(
    (swapType: 'best_of' | 'worst_of') => {
      onChange({
        ...wizardModel,
        swap: { ...wizardModel.swap, swapType },
      });
    },
    [wizardModel, onChange]
  );

  const handleControllerPickChange = useCallback(
    (pickId: string) => {
      const parsed = pickIdToWizardPick(
        pickId,
        wizardModel.swap.controllerPick
      );
      // Auto-fill target description from the selected pick
      const autoDesc = pickId
        ? `${parsed.team} own ${parsed.round === 1 ? '1st' : '2nd'} round pick`
        : '';
      onChange({
        ...wizardModel,
        swap: {
          ...wizardModel.swap,
          controllerPick: parsed,
          targetDescription: wizardModel.swap.targetDescription || autoDesc,
        },
      });
    },
    [wizardModel, onChange]
  );

  // Description
  const handleDescriptionChange = useCallback(
    (description: string) => {
      onChange({ ...wizardModel, description });
    },
    [wizardModel, onChange]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Compact no-scroll layout (TM-WIZARD-SIMPLIFY-E2)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-3" data-testid="quick-builder">
      {/* ── Pick Label (Edit: locked, Create: selector) ── */}
      <div data-testid="quick-builder-pick-section">
        {isEditMode ? (
          <div
            data-testid="edit-identity-summary"
            className="flex items-center gap-2 px-3 py-2 rounded bg-[#141414] border border-white/10"
          >
            <span
              className="text-sm font-medium text-white"
              data-testid="edit-identity-primary"
            >
              {wizardModel.pick.team || '???'} {wizardModel.pick.year || '????'}{' '}
              {ROUND_LABELS[String(wizardModel.pick.round)] ||
                `R${wizardModel.pick.round}`}
            </span>
            {primaryPickId && (
              <span
                className="text-[10px] text-white/25 font-mono ml-auto"
                data-testid="edit-identity-pick-id"
              >
                {primaryPickId}
              </span>
            )}
            <span className="text-white/20 text-xs">🔒</span>
          </div>
        ) : (
          <PickSelector
            value={primaryPickId}
            onChange={handlePrimaryPickChange}
            defaultTeam={wizardModel.pick.team}
            defaultYear={wizardModel.pick.year}
            label={WIZARD_LABELS.pickIdentity}
            disabled={disabled || lockIdentityFields}
            error={
              fieldErrors.holderTeam ||
              fieldErrors.seasonYear ||
              fieldErrors.round
            }
          />
        )}
      </div>

      {/* ── Action Toggle (Both Create and Edit Mode) ── */}
      {/* TM-WIZARD-SIMPLIFY-E2: Edit mode shows Protect + Swap buttons */}
      <div data-testid="quick-builder-actions" className="flex gap-2">
        <button
          type="button"
          onClick={() => handleSelectIntent('protect_pick')}
          disabled={disabled}
          className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            intent === 'protect_pick'
              ? 'bg-blue-600 text-white'
              : 'bg-[#1a1a1a] border border-white/10 text-white/60 hover:border-white/20'
          }`}
          data-testid="action-protect_pick"
        >
          🛡️ Protect
        </button>
        <button
          type="button"
          onClick={() => handleSelectIntent('create_swap')}
          disabled={disabled}
          className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            intent === 'create_swap'
              ? 'bg-blue-600 text-white'
              : 'bg-[#1a1a1a] border border-white/10 text-white/60 hover:border-white/20'
          }`}
          data-testid="action-create_swap"
        >
          🔄 Swap
        </button>
        {!isEditMode && (
          <button
            type="button"
            onClick={() => handleSelectIntent('create_conveyance')}
            disabled={disabled}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              intent === 'create_conveyance'
                ? 'bg-blue-600 text-white'
                : 'text-white/40 hover:text-white/60 border border-white/5 hover:border-white/10'
            }`}
            data-testid="action-create_conveyance"
            title="Pool/conveyance is available in Advanced Editor"
          >
            📦 Pool…
          </button>
        )}
      </div>

      {/* Edit mode: Pool redirect (when editing conveyance_right) */}
      {isEditMode && currentEntitlementKind === 'conveyance_right' && (
        <div
          className="px-3 py-2 rounded bg-[#141414] border border-white/10 text-xs text-white/50"
          data-testid="quick-builder-active-type"
        >
          This pick right is advanced.
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="ml-2 text-blue-400 hover:text-blue-300 underline"
          >
            Open Advanced Editor
          </button>
        </div>
      )}

      {/* ── Action-Specific Controls ── */}
      {intent && intent !== 'create_conveyance' && (
        <div className="space-y-2" data-testid="quick-builder-controls">
          {/* ════ PROTECT ════ */}
          {intent === 'protect_pick' && (
            <div data-testid="quick-protect-section">
              <div className="grid grid-cols-4 gap-1">
                {WIZARD_PRESETS.map((tmpl: ProtectionTemplate) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleTemplateSelect(tmpl.id)}
                    disabled={disabled}
                    className={`px-2 py-1.5 rounded text-[11px] font-medium transition-colors ${
                      wizardModel.protection.templateId === tmpl.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1a1a1a] border border-white/10 text-white/60 hover:border-white/20'
                    }`}
                    data-testid={`template-${tmpl.id}`}
                    title={tmpl.description}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ════ SWAP ════ */}
          {intent === 'create_swap' && (
            <div className="space-y-2" data-testid="quick-swap-section">
              {/* TM-WIZARD-SIMPLIFY-E2: If editing a non-swap entitlement, show Convert to Swap CTA */}
              {isEditingNonSwap && onConvertToSwap ? (
                <div
                  className="flex flex-col items-center gap-2 p-4 rounded bg-[#141414] border border-white/10"
                  data-testid="swap-convert-section"
                >
                  <p className="text-xs text-white/50 text-center">
                    This pick right is not currently a swap. Convert it to
                    create a new swap right.
                  </p>
                  <button
                    type="button"
                    onClick={onConvertToSwap}
                    disabled={disabled}
                    className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                    data-testid="convert-to-swap-btn"
                  >
                    Convert to Swap
                  </button>
                </div>
              ) : (
                <>
                  {/* Swap direction */}
                  <div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSwapTypeChange('best_of')}
                        disabled={
                          disabled || (isEditMode && isEditingSwapRight)
                        }
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          wizardModel.swap.swapType === 'best_of'
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#1a1a1a] border border-white/10 text-white/60 hover:border-white/20'
                        }`}
                        data-testid="swap-type-best_of"
                      >
                        {WIZARD_LABELS.swapBestOf}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwapTypeChange('worst_of')}
                        disabled={
                          disabled || (isEditMode && isEditingSwapRight)
                        }
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          wizardModel.swap.swapType === 'worst_of'
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#1a1a1a] border border-white/10 text-white/60 hover:border-white/20'
                        }`}
                        data-testid="swap-type-worst_of"
                      >
                        {WIZARD_LABELS.swapWorstOf}
                      </button>
                    </div>
                  </div>

                  {/* Other team's pick (controller) */}
                  <div>
                    {isEditMode ? (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded bg-[#141414] border border-white/10"
                        data-testid="swap-other-pick-readonly"
                      >
                        <span className="text-sm text-white">
                          {wizardModel.swap.controllerPick.team || '???'}{' '}
                          {wizardModel.swap.controllerPick.year || '????'}{' '}
                          {ROUND_LABELS[
                            String(wizardModel.swap.controllerPick.round)
                          ] || `R${wizardModel.swap.controllerPick.round}`}
                        </span>
                        <span className="text-white/20 text-xs ml-auto">
                          🔒
                        </span>
                      </div>
                    ) : (
                      <PickSelector
                        value={wizardPickToId(wizardModel.swap.controllerPick)}
                        onChange={handleControllerPickChange}
                        defaultTeam={wizardModel.pick.team}
                        defaultYear={wizardModel.pick.year}
                        label={WIZARD_LABELS.otherPick}
                        disabled={disabled}
                        error={fieldErrors.swapControllerPickId}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Optional Description */}
          <div>
            <input
              type="text"
              value={wizardModel.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              disabled={disabled}
              placeholder="Description (optional)"
              className="w-full px-2.5 py-1.5 rounded bg-[#141414] text-white text-xs border border-white/10 focus:border-blue-500 focus:outline-none placeholder:text-white/25"
              data-testid="wizard-description"
            />
          </div>
        </div>
      )}

      {/* Pool mode: show message to use Advanced Editor */}
      {intent === 'create_conveyance' && (
        <div
          className="px-3 py-2 rounded bg-[#141414] border border-white/10 text-xs text-white/50"
          data-testid="quick-pool-section"
        >
          Pool editing is available in the Advanced Editor.
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="ml-2 text-blue-400 hover:text-blue-300 underline"
          >
            Open Advanced Editor
          </button>
        </div>
      )}

      {/* ── Bottom Bar: Validity + Actions ── */}
      {intent && (
        <div
          className="flex items-center gap-2 pt-2 border-t border-white/5"
          data-testid="quick-builder-apply-bar"
        >
          {/* Compact validity indicator */}
          <div
            className={`text-xs px-2 py-1 rounded ${
              isValid
                ? 'bg-green-900/30 text-green-400'
                : 'bg-red-900/30 text-red-400'
            }`}
            data-testid="validity-indicator"
          >
            {isValid
              ? '✓ Valid'
              : `Fix ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="px-2.5 py-1.5 rounded text-[11px] font-medium border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 transition-colors"
            data-testid="wizard-save-draft"
          >
            {WIZARD_LABELS.saveDraft}
          </button>

          <button
            type="button"
            onClick={onApply}
            disabled={!isValid || saving}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
              isValid && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
            data-testid="wizard-apply"
          >
            {saving ? WIZARD_LABELS.applying : WIZARD_LABELS.apply}
          </button>

          <button
            type="button"
            onClick={onOpenAdvanced}
            className="px-2.5 py-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors"
            data-testid="wizard-open-advanced"
          >
            Advanced
          </button>
        </div>
      )}
    </div>
  );
};
