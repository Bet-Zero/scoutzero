/**
 * FILE: src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx
 * PURPOSE: Compact single-screen Quick Builder for Pick Right Wizard.
 *          No-scroll, single-screen UX menu with Protect/Swap toggles.
 *          Edit mode shows locked identity, no PickSelector.
 *          Pool/conveyance is Advanced Editor only.
 * OWNERSHIP: Feature: architect/admin
 *
 * HISTORY:
 *  - 2026-02-13: Created for TM-WIZARD-SIMPLIFY-E1 — Quick Builder UX Overhaul.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Edit mode shows locked identity summary
 *                instead of PickSelector. Create mode unchanged.
 *  - 2026-02-14: UI cleanup — removed duplicate buttons, streamlined layout.
 *                Apply button moved to modal footer.
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
  onOpenAdvanced: () => void;
  disabled?: boolean;
  isEditMode?: boolean;
  lockIdentityFields?: boolean;
}

export const QuickBuilder: React.FC<QuickBuilderProps> = ({
  wizardModel,
  formState,
  fieldErrors,
  isValid,
  saving,
  onChange,
  onOpenAdvanced,
  disabled = false,
  isEditMode = false,
  lockIdentityFields = false,
}) => {
  const intent = wizardModel.intent;
  const baseYear = wizardModel.pick.year || 2026;
  const errorCount = Object.keys(fieldErrors).length;

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
      let updated = { ...wizardModel, intent: newIntent };
      // Auto-populate swap targetDescription when switching to create_swap,
      // so the "Required for swap right" validation error doesn't fire immediately.
      if (newIntent === 'create_swap' && !updated.swap.targetDescription) {
        const cp = wizardModel.swap.controllerPick;
        const autoDesc = `${cp.team} own ${cp.round === 1 ? '1st' : '2nd'} round pick`;
        updated = {
          ...updated,
          swap: { ...updated.swap, targetDescription: autoDesc },
        };
      }
      onChange(updated);
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
          <>
            <div
              data-testid="edit-identity-summary"
              className="flex items-center gap-2 px-3 py-2 rounded bg-[#141414] border border-white/10"
            >
              <span
                className="text-sm font-medium text-white"
                data-testid="edit-identity-primary"
              >
                {wizardModel.pick.team || '???'}{' '}
                {wizardModel.pick.year || '????'}{' '}
                {ROUND_LABELS[String(wizardModel.pick.round)] ||
                  `R${wizardModel.pick.round}`}
              </span>
              <span className="text-white/20 text-xs">{'\uD83D\uDD12'}</span>
            </div>
            <p
              className="text-[10px] text-white/40 mt-1"
              data-testid="identity-lock-hint"
            >
              To change the pick/right, use {'\u201C'}Create new from this
              {'\u2026\u201D'}
            </p>
          </>
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
              {/* Swap direction - always show these options */}
              <div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleSwapTypeChange('best_of')}
                    disabled={disabled}
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
                    disabled={disabled}
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
                    <span className="text-xs text-white/50">
                      {WIZARD_LABELS.otherPick}:
                    </span>
                    <span className="text-sm font-medium text-white">
                      {wizardModel.swap.controllerPick.team || '???'}
                    </span>
                    <span className="text-white/20 text-xs ml-auto">🔒</span>
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
            </div>
          )}
        </div>
      )}

      {/* Pool mode: show message to use Advanced view */}
      {intent === 'create_conveyance' && (
        <div
          className="px-3 py-2 rounded bg-[#141414] border border-white/10 text-xs text-white/50"
          data-testid="quick-pool-section"
        >
          Pool editing is available in the Advanced view.
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="ml-2 text-blue-400 hover:text-blue-300 underline"
          >
            Advanced
          </button>
        </div>
      )}

      {/* ── Bottom Bar: Validity + Advanced ── */}
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
