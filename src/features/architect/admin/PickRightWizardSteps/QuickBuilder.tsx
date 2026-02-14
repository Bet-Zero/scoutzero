/**
 * FILE: src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx
 * PURPOSE: Single-screen Quick Builder for Pick Right Wizard (TM-WIZARD-SIMPLIFY-E1).
 *          Combines pick identity, action cards, action-specific controls,
 *          inline preview, and Apply button into one view.
 * OWNERSHIP: Feature: architect/admin
 *
 * HISTORY:
 *  - 2026-02-13: Created for TM-WIZARD-SIMPLIFY-E1 — Quick Builder UX Overhaul.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Edit mode shows locked identity summary
 *                instead of PickSelector. Create mode unchanged.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type {
  WizardModel,
  WizardPick,
  WizardIntent,
  WizardSelectionMethod,
} from '../pickRightWizardModel';
import {
  createDefaultWizardPick,
  pickIdToWizardPick,
  wizardPickToId,
} from '../pickRightWizardModel';
import type { FieldErrors } from '../useEntitlementEditorState';
import type { EntitlementFormState } from '../entitlementEditorFormState';
import { PickSelector } from '../PickSelector';
import {
  WIZARD_PRESETS,
  applyProtectionTemplate,
} from '../ProtectionLadderTemplates';
import type { ProtectionTemplate } from '../ProtectionLadderTemplates';
import {
  WIZARD_LABELS,
  WIZARD_INTENT_LABELS,
  WIZARD_INTENT_DESCRIPTIONS,
  POOL_CHIP_PRESETS,
  detectPoolChip,
  deriveTradabilityStatus,
  TRADABILITY_STYLES,
} from '../pickEditorCopy';
import { PlainEnglishPreview } from '../PlainEnglishPreview';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ROUND_LABELS: Record<string, string> = {
  '1': '1st Round',
  '2': '2nd Round',
};

const ACTION_ICONS: Record<WizardIntent, string> = {
  protect_pick: '🛡️',
  create_swap: '🔄',
  create_conveyance: '📦',
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
}) => {
  const intent = wizardModel.intent;
  const baseYear = wizardModel.pick.year || 2026;
  const [showSwapDetails, setShowSwapDetails] = useState(false);

  // Primary pick ID
  const primaryPickId = useMemo(
    () => wizardPickToId(wizardModel.pick),
    [wizardModel.pick]
  );

  // Detected pool chip for current conveyance config
  const activePoolChip = useMemo(() => {
    if (intent !== 'create_conveyance') return null;
    const comparatorMap: Record<string, string> = {
      most_favorable: 'more_favorable',
      least_favorable: 'less_favorable',
      middle: 'middle',
    };
    const comparator =
      comparatorMap[wizardModel.conveyance.selectionMethod] ||
      wizardModel.conveyance.selectionMethod;
    return detectPoolChip(comparator, wizardModel.conveyance.selectionRanks);
  }, [
    intent,
    wizardModel.conveyance.selectionMethod,
    wizardModel.conveyance.selectionRanks,
  ]);

  // Tradability badge
  const tradability = useMemo(
    () => deriveTradabilityStatus(wizardModel),
    [wizardModel]
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

  const handleTargetDescriptionChange = useCallback(
    (targetDescription: string) => {
      onChange({
        ...wizardModel,
        swap: { ...wizardModel.swap, targetDescription },
      });
    },
    [wizardModel, onChange]
  );

  // Pool
  const handleUpdatePoolPick = useCallback(
    (index: number, pickId: string) => {
      const parsed = pickIdToWizardPick(pickId);
      const next = [...wizardModel.conveyance.poolPicks];
      next[index] = parsed;
      onChange({
        ...wizardModel,
        conveyance: { ...wizardModel.conveyance, poolPicks: next },
      });
    },
    [wizardModel, onChange]
  );

  const handleAddPoolPick = useCallback(() => {
    const newPick = createDefaultWizardPick(
      wizardModel.pick.team,
      wizardModel.pick.year,
      wizardModel.pick.round
    );
    onChange({
      ...wizardModel,
      conveyance: {
        ...wizardModel.conveyance,
        poolPicks: [...wizardModel.conveyance.poolPicks, newPick],
      },
    });
  }, [wizardModel, onChange]);

  const handleRemovePoolPick = useCallback(
    (index: number) => {
      const next = wizardModel.conveyance.poolPicks.filter(
        (_, i) => i !== index
      );
      onChange({
        ...wizardModel,
        conveyance: { ...wizardModel.conveyance, poolPicks: next },
      });
    },
    [wizardModel, onChange]
  );

  const handlePoolChipSelect = useCallback(
    (chipId: string) => {
      const chip = POOL_CHIP_PRESETS.find((c) => c.id === chipId);
      if (!chip) return;
      // Map comparator to wizard selection method
      const methodMap: Record<string, WizardSelectionMethod> = {
        more_favorable: 'most_favorable',
        less_favorable: 'least_favorable',
        middle: 'middle',
      };
      onChange({
        ...wizardModel,
        conveyance: {
          ...wizardModel.conveyance,
          selectionMethod: methodMap[chip.comparator] || 'most_favorable',
          selectionRanks: chip.ranks,
        },
      });
    },
    [wizardModel, onChange]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4" data-testid="quick-builder">
      {/* ── Section A: Pick Identity ── */}
      <div data-testid="quick-builder-pick-section">
        {isEditMode ? (
          /* TM-WIZARD-UX-E2: Locked identity summary in edit mode (no PickSelector) */
          <div data-testid="edit-identity-summary" className="space-y-1">
            <div className="text-xs text-white/60 font-medium">
              {WIZARD_LABELS.pickIdentity}
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#141414] border border-white/10">
              <div className="flex-1">
                <div
                  className="text-sm font-semibold text-white"
                  data-testid="edit-identity-primary"
                >
                  {wizardModel.pick.team || '???'}{' '}
                  {wizardModel.pick.year || '????'}{' '}
                  {ROUND_LABELS[String(wizardModel.pick.round)] ||
                    `Round ${wizardModel.pick.round}`}
                </div>
                <div
                  className="text-[11px] text-white/55 mt-0.5"
                  data-testid="edit-identity-owner"
                >
                  Owner: {wizardModel.pick.team || '???'} (changes when traded)
                </div>
                {primaryPickId && (
                  <div
                    className="text-[10px] text-white/30 mt-0.5 font-mono"
                    data-testid="edit-identity-pick-id"
                  >
                    Pick ID: {primaryPickId}
                  </div>
                )}
              </div>
              <div className="text-white/20 text-xs">🔒</div>
            </div>
            <div className="text-[11px] text-white/55">
              To change the pick itself or type, create a new pick right.
            </div>
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

      {/* ── Section B: Action Cards ── */}
      {!isEditMode && (
        <div data-testid="quick-builder-actions">
          <div className="text-xs text-white/50 mb-2 font-medium">
            What would you like to do?
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              ['protect_pick', 'create_swap', 'create_conveyance'] as const
            ).map((actionIntent) => (
              <button
                key={actionIntent}
                type="button"
                onClick={() => handleSelectIntent(actionIntent)}
                disabled={disabled}
                className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  intent === actionIntent
                    ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                    : 'border-white/10 bg-[#141414] text-white/70 hover:border-white/20 hover:bg-[#1a1a1a]'
                }`}
                data-testid={`action-${actionIntent}`}
              >
                <div className="text-lg mb-0.5">
                  {ACTION_ICONS[actionIntent]}
                </div>
                <div className="font-medium text-xs">
                  {WIZARD_INTENT_LABELS[actionIntent]}
                </div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">
                  {WIZARD_INTENT_DESCRIPTIONS[actionIntent]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit mode: show which type is active */}
      {isEditMode && intent && (
        <div
          className="flex items-center gap-2 text-xs text-white/50"
          data-testid="quick-builder-active-type"
        >
          <span>{ACTION_ICONS[intent as WizardIntent]}</span>
          <span className="font-medium text-white/70">
            {WIZARD_INTENT_LABELS[intent as WizardIntent]}
          </span>
        </div>
      )}

      {/* ── Section C: Action-Specific Controls ── */}
      {intent && (
        <div className="space-y-3" data-testid="quick-builder-controls">
          {/* ════ PROTECT ════ */}
          {intent === 'protect_pick' && (
            <div className="space-y-3" data-testid="quick-protect-section">
              <div className="text-xs text-white/50 font-medium">
                {WIZARD_LABELS.protectionPattern}
              </div>
              <p className="text-[10px] text-white/30 -mt-2">
                {WIZARD_LABELS.protectionPatternHelp}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {WIZARD_PRESETS.map((tmpl: ProtectionTemplate) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleTemplateSelect(tmpl.id)}
                    disabled={disabled}
                    className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
                      wizardModel.protection.templateId === tmpl.id
                        ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                        : 'border-white/10 bg-[#141414] text-white/70 hover:border-white/20'
                    }`}
                    data-testid={`template-${tmpl.id}`}
                  >
                    <div className="font-medium">{tmpl.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {tmpl.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Ladder preview (collapsed by default when present) */}
              {wizardModel.protection.customLadder.length > 0 && (
                <div className="bg-[#111] border border-white/10 rounded-lg p-3 space-y-1.5">
                  {wizardModel.protection.customLadder.map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-xs text-white/80"
                      data-testid={`ladder-tier-${idx}`}
                    >
                      <span className="text-white/40 font-mono w-10">
                        {tier.year}
                      </span>
                      <span className="flex-1">
                        {tier.condition || 'Unprotected'}
                        {tier.ifTriggered === 'roll' && tier.rollToYear && (
                          <span className="text-white/40">
                            {' '}
                            → rolls to {tier.rollToYear}
                          </span>
                        )}
                        {tier.ifTriggered === 'convert' &&
                          tier.convertToRound && (
                            <span className="text-white/40">
                              {' '}
                              → converts to{' '}
                              {ROUND_LABELS[tier.convertToRound] ||
                                `Round ${tier.convertToRound}`}
                            </span>
                          )}
                        {tier.ifTriggered === 'cancel' && (
                          <span className="text-white/40"> → pick conveys</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Link to advanced for custom protections */}
              <button
                type="button"
                onClick={onOpenAdvanced}
                className="text-[10px] text-white/30 hover:text-white/50 underline"
                data-testid="protect-advanced-link"
              >
                Custom protections (Advanced)
              </button>
            </div>
          )}

          {/* ════ SWAP ════ */}
          {intent === 'create_swap' && (
            <div className="space-y-3" data-testid="quick-swap-section">
              {/* Swap direction */}
              <div className="flex gap-2">
                {(['best_of', 'worst_of'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSwapTypeChange(type)}
                    disabled={disabled || lockIdentityFields}
                    className={`flex-1 px-3 py-2 rounded border text-xs font-medium transition-colors ${
                      wizardModel.swap.swapType === type
                        ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                        : 'border-white/10 bg-[#141414] text-white/70 hover:border-white/20'
                    }`}
                    data-testid={`swap-type-${type}`}
                  >
                    {type === 'best_of'
                      ? WIZARD_LABELS.swapBestOf
                      : WIZARD_LABELS.swapWorstOf}
                  </button>
                ))}
              </div>

              {/* Their pick (controller) */}
              <div>
                <div className="text-xs text-white/50 mb-1 font-medium">
                  {WIZARD_LABELS.theirPick}
                </div>
                <p className="text-[10px] text-white/30 mb-1.5">
                  {WIZARD_LABELS.controllerPickHelp}
                </p>
                <PickSelector
                  value={wizardPickToId(wizardModel.swap.controllerPick)}
                  onChange={handleControllerPickChange}
                  defaultTeam={wizardModel.pick.team}
                  defaultYear={wizardModel.pick.year}
                  label=""
                  disabled={disabled || lockIdentityFields}
                  error={fieldErrors.swapControllerPickId}
                />
              </div>

              {/* Collapsible Details */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSwapDetails(!showSwapDetails)}
                  className="text-[10px] text-white/40 hover:text-white/60 flex items-center gap-1"
                  data-testid="swap-details-toggle"
                >
                  <span
                    className={`inline-block transition-transform ${showSwapDetails ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  Details
                </button>
                {showSwapDetails && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={wizardModel.swap.targetDescription}
                      onChange={(e) =>
                        handleTargetDescriptionChange(e.target.value)
                      }
                      disabled={disabled}
                      placeholder={WIZARD_LABELS.targetDescriptionPlaceholder}
                      className="w-full px-3 py-2 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
                      data-testid="swap-target-description"
                    />
                    {fieldErrors.swapTargetDefinition && (
                      <p className="text-[10px] text-red-400 mt-0.5">
                        {fieldErrors.swapTargetDefinition}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ POOL ════ */}
          {intent === 'create_conveyance' && (
            <div className="space-y-3" data-testid="quick-pool-section">
              <div className="text-xs text-white/50 font-medium">
                {WIZARD_LABELS.poolOfPicks}
              </div>
              <p className="text-[10px] text-white/30 -mt-2">
                {WIZARD_LABELS.poolOfPicksHelp}
              </p>

              {/* Pool picks list */}
              <div className="space-y-2">
                {wizardModel.conveyance.poolPicks.map((poolPick, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1">
                      <PickSelector
                        value={wizardPickToId(poolPick)}
                        onChange={(pickId) => handleUpdatePoolPick(idx, pickId)}
                        defaultTeam={wizardModel.pick.team}
                        defaultYear={wizardModel.pick.year}
                        disabled={disabled || lockIdentityFields}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePoolPick(idx)}
                      disabled={disabled || lockIdentityFields}
                      className="px-2 py-1.5 text-red-400 hover:text-red-300 text-xs"
                      data-testid={`remove-pool-pick-${idx}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddPoolPick}
                disabled={disabled || lockIdentityFields}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
                data-testid="add-pool-pick"
              >
                {WIZARD_LABELS.addPick}
              </button>
              {fieldErrors.poolUnderlyingPickIds && (
                <p className="text-[10px] text-red-400">
                  {fieldErrors.poolUnderlyingPickIds}
                </p>
              )}

              {/* Receives chips */}
              <div>
                <div className="text-xs text-white/50 mb-1.5 font-medium">
                  {wizardModel.pick.team || 'Team'} receives:
                </div>
                <div className="flex flex-wrap gap-2" data-testid="pool-chips">
                  {POOL_CHIP_PRESETS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handlePoolChipSelect(chip.id)}
                      disabled={disabled}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        activePoolChip === chip.id
                          ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                          : 'border-white/10 bg-[#141414] text-white/60 hover:border-white/20'
                      }`}
                      data-testid={`pool-chip-${chip.id}`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description — collapsed "More details" */}
          <details className="text-xs">
            <summary className="text-white/40 hover:text-white/60 cursor-pointer select-none">
              More details
            </summary>
            <div className="mt-2">
              <input
                type="text"
                value={wizardModel.description}
                onChange={(e) =>
                  onChange({ ...wizardModel, description: e.target.value })
                }
                disabled={disabled}
                placeholder={WIZARD_LABELS.descriptionPlaceholder}
                className="w-full px-3 py-2 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
                data-testid="wizard-description"
              />
            </div>
          </details>
        </div>
      )}

      {/* ── Inline Preview (always visible when intent is set) ── */}
      {intent && (
        <div
          className="border-t border-white/5 pt-3"
          data-testid="quick-builder-preview"
        >
          <PlainEnglishPreview
            formState={formState}
            fieldErrors={fieldErrors}
          />

          {/* Tradability badge */}
          <div
            className={`flex items-center gap-2 px-3 py-2 mt-3 rounded text-xs ${TRADABILITY_STYLES[tradability.variant]}`}
            data-testid="tradability-badge"
          >
            <span>{tradability.icon}</span>
            <span className="font-medium">{tradability.label}</span>
            <span className="text-white/50 text-[10px]">
              — {tradability.reason}
            </span>
          </div>
        </div>
      )}

      {/* ── Apply bar (always visible) ── */}
      {intent && (
        <div
          className="flex items-center gap-3 pt-2 border-t border-white/5"
          data-testid="quick-builder-apply-bar"
        >
          <button
            type="button"
            onClick={onApply}
            disabled={!isValid || saving}
            className={`px-5 py-2 rounded text-sm font-medium transition-colors ${
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
            onClick={onSaveDraft}
            disabled={saving}
            className="px-3 py-2 rounded text-xs font-medium border border-white/15 text-white/50 hover:text-white/70 hover:border-white/25 transition-colors"
            data-testid="wizard-save-draft"
          >
            {WIZARD_LABELS.saveDraft}
          </button>

          <button
            type="button"
            onClick={onOpenAdvanced}
            className="ml-auto text-[10px] text-white/30 hover:text-white/50 transition-colors"
            data-testid="wizard-open-advanced"
          >
            {WIZARD_LABELS.openAdvanced}
          </button>
        </div>
      )}
    </div>
  );
};
