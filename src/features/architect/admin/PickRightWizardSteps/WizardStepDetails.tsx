/**
 * FILE: src/features/architect/admin/PickRightWizardSteps/WizardStepDetails.tsx
 * PURPOSE: Step 2 of Pick Right Wizard — configure the pick right details.
 * OWNERSHIP: Feature: architect/admin (TM-8 Pick Editor UX / TM-9 Translation Layer)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Rewrote to use WizardModel instead of raw EntitlementFormState.
 *                Removed all schema jargon from user-facing labels.
 *
 * Renders kind-specific inputs using PickSelector components and
 * reuses existing protection ladder templates. All state is expressed
 * as WizardModel — translation to EntitlementFormState happens in the parent.
 */

import React, { useCallback, useMemo } from 'react';
import type {
  WizardModel,
  WizardPick,
  WizardSelectionMethod,
} from '../pickRightWizardModel';
import {
  createDefaultWizardPick,
  pickIdToWizardPick,
  wizardPickToId,
} from '../pickRightWizardModel';
import type { FieldErrors } from '../useEntitlementEditorState';
import { PickSelector } from '../PickSelector';
import {
  PROTECTION_TEMPLATES,
  applyProtectionTemplate,
} from '../ProtectionLadderTemplates';
import type { ProtectionTemplate } from '../ProtectionLadderTemplates';
import {
  WIZARD_LABELS,
  WIZARD_KIND_LABELS,
  SELECTION_METHOD_OPTIONS,
  deriveTradabilityStatus,
  TRADABILITY_STYLES,
} from '../pickEditorCopy';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ROUND_LABELS: Record<string, string> = {
  '1': '1st Round',
  '2': '2nd Round',
};

// ─── component ───────────────────────────────────────────────────────────────

interface WizardStepDetailsProps {
  wizardModel: WizardModel;
  onChange: (next: WizardModel) => void;
  fieldErrors: FieldErrors;
  disabled?: boolean;
}

export const WizardStepDetails: React.FC<WizardStepDetailsProps> = ({
  wizardModel,
  onChange,
  fieldErrors,
  disabled = false,
}) => {
  const intent = wizardModel.intent;
  const baseYear = wizardModel.pick.year || 2026;

  // Map intent → display kind for the badge
  const displayKind =
    intent === 'protect_pick'
      ? 'pick_ownership'
      : intent === 'create_swap'
        ? 'swap_right'
        : intent === 'create_conveyance'
          ? 'conveyance_right'
          : '';

  // ── Update helpers ──

  // The primary pick ID is derived from the wizard pick
  const primaryPickId = useMemo(
    () => wizardPickToId(wizardModel.pick),
    [wizardModel.pick]
  );

  // Sync pick from PickSelector back to WizardModel
  const handlePrimaryPickChange = useCallback(
    (pickId: string) => {
      const parsed = pickIdToWizardPick(pickId, wizardModel.pick);
      onChange({ ...wizardModel, pick: parsed });
    },
    [wizardModel, onChange]
  );

  // Protection template handler
  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const template = PROTECTION_TEMPLATES.find(
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

  const handleClearLadder = useCallback(() => {
    onChange({
      ...wizardModel,
      protection: { templateId: '', customLadder: [] },
    });
  }, [wizardModel, onChange]);

  // ── Swap helpers ──

  const handleControllerPickChange = useCallback(
    (pickId: string) => {
      const parsed = pickIdToWizardPick(
        pickId,
        wizardModel.swap.controllerPick
      );
      onChange({
        ...wizardModel,
        swap: { ...wizardModel.swap, controllerPick: parsed },
      });
    },
    [wizardModel, onChange]
  );

  const handleSwapTypeChange = useCallback(
    (swapType: 'best_of' | 'worst_of') => {
      onChange({
        ...wizardModel,
        swap: { ...wizardModel.swap, swapType },
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

  // ── Conveyance helpers ──

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

  const handleSelectionMethodChange = useCallback(
    (method: string) => {
      onChange({
        ...wizardModel,
        conveyance: {
          ...wizardModel.conveyance,
          selectionMethod: method as WizardSelectionMethod,
        },
      });
    },
    [wizardModel, onChange]
  );

  const handleSelectionRanksChange = useCallback(
    (ranksText: string) => {
      const ranks = ranksText
        .split(/[\n,]/)
        .map((r) => r.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      onChange({
        ...wizardModel,
        conveyance: { ...wizardModel.conveyance, selectionRanks: ranks },
      });
    },
    [wizardModel, onChange]
  );

  // ── Tradability badge ──
  const tradability = useMemo(
    () => deriveTradabilityStatus(wizardModel),
    [wizardModel]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6" data-testid="wizard-step-details">
      {/* Kind display */}
      {displayKind && (
        <div className="text-xs text-white/40 uppercase tracking-wide">
          {WIZARD_KIND_LABELS[displayKind] || displayKind}
        </div>
      )}

      {/* Tradability badge */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${TRADABILITY_STYLES[tradability.variant]}`}
        data-testid="tradability-badge"
      >
        <span>{tradability.icon}</span>
        <span className="font-medium">{tradability.label}</span>
        <span className="text-white/50 text-xs">— {tradability.reason}</span>
      </div>

      {/* ── Primary pick selector (all intents) ── */}
      <PickSelector
        value={primaryPickId}
        onChange={handlePrimaryPickChange}
        defaultTeam={wizardModel.pick.team}
        defaultYear={wizardModel.pick.year}
        label={WIZARD_LABELS.pickIdentity}
        disabled={disabled}
        error={
          fieldErrors.holderTeam || fieldErrors.seasonYear || fieldErrors.round
        }
      />

      {/* ── Description (all intents) ── */}
      <div>
        <label className="block text-xs text-white/60 mb-1.5 font-medium">
          {WIZARD_LABELS.description}
        </label>
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PICK OWNERSHIP — protection templates & ladder */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {intent === 'protect_pick' && (
        <div className="space-y-4" data-testid="pick-ownership-section">
          {/* Template selector */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              {WIZARD_LABELS.protectionPattern}
            </label>
            <p className="text-[10px] text-white/30 mb-2">
              {WIZARD_LABELS.protectionPatternHelp}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PROTECTION_TEMPLATES.map((tmpl: ProtectionTemplate) => (
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
          </div>

          {/* Protection ladder preview */}
          {wizardModel.protection.customLadder.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/60 font-medium">
                  {WIZARD_LABELS.protectionLadder}
                </label>
                <button
                  type="button"
                  onClick={handleClearLadder}
                  disabled={disabled}
                  className="text-[10px] text-red-400 hover:text-red-300 underline"
                >
                  {WIZARD_LABELS.clearLadder}
                </button>
              </div>
              <div className="bg-[#111] border border-white/10 rounded-lg p-3 space-y-2">
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
                    {fieldErrors[`protectionLadder.${idx}.year`] && (
                      <span className="text-red-400 text-[10px]">
                        {fieldErrors[`protectionLadder.${idx}.year`]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SWAP RIGHT — controller pick, swap type, target description */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {intent === 'create_swap' && (
        <div className="space-y-4" data-testid="swap-right-section">
          {/* Swap type */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              {WIZARD_LABELS.swapType}
            </label>
            <div className="flex gap-2">
              {(['best_of', 'worst_of'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSwapTypeChange(type)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded border text-xs transition-colors ${
                    wizardModel.swap.swapType === type
                      ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                      : 'border-white/10 bg-[#141414] text-white/70 hover:border-white/20'
                  }`}
                  data-testid={`swap-type-${type}`}
                >
                  {type === 'best_of' ? 'Best of' : 'Worst of'}
                </button>
              ))}
            </div>
          </div>

          {/* Controller pick */}
          <div>
            <p className="text-[10px] text-white/30 mb-2">
              {WIZARD_LABELS.controllerPickHelp}
            </p>
            <PickSelector
              value={wizardPickToId(wizardModel.swap.controllerPick)}
              onChange={handleControllerPickChange}
              defaultTeam={wizardModel.pick.team}
              defaultYear={wizardModel.pick.year}
              label={WIZARD_LABELS.controllerPick}
              disabled={disabled}
              error={fieldErrors.swapControllerPickId}
            />
          </div>

          {/* Target description */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              {WIZARD_LABELS.targetDescription}
            </label>
            <p className="text-[10px] text-white/30 mb-2">
              {WIZARD_LABELS.targetDescriptionHelp}
            </p>
            <input
              type="text"
              value={wizardModel.swap.targetDescription}
              onChange={(e) => handleTargetDescriptionChange(e.target.value)}
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
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONVEYANCE RIGHT — pool picks, selection method, ranks */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {intent === 'create_conveyance' && (
        <div className="space-y-4" data-testid="conveyance-right-section">
          {/* Pool of picks */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              {WIZARD_LABELS.poolOfPicks}
            </label>
            <p className="text-[10px] text-white/30 mb-2">
              {WIZARD_LABELS.poolOfPicksHelp}
            </p>
            <div className="space-y-2">
              {wizardModel.conveyance.poolPicks.map((poolPick, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <PickSelector
                      value={wizardPickToId(poolPick)}
                      onChange={(pickId) => handleUpdatePoolPick(idx, pickId)}
                      defaultTeam={wizardModel.pick.team}
                      defaultYear={wizardModel.pick.year}
                      disabled={disabled}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePoolPick(idx)}
                    disabled={disabled}
                    className="px-2 py-1.5 text-red-400 hover:text-red-300 text-xs"
                    data-testid={`remove-pool-pick-${idx}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddPoolPick}
              disabled={disabled}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
              data-testid="add-pool-pick"
            >
              {WIZARD_LABELS.addPick}
            </button>
            {fieldErrors.poolUnderlyingPickIds && (
              <p className="text-[10px] text-red-400 mt-0.5">
                {fieldErrors.poolUnderlyingPickIds}
              </p>
            )}
          </div>

          {/* Selection method */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              {WIZARD_LABELS.selectionMethod}
            </label>
            <select
              value={wizardModel.conveyance.selectionMethod}
              onChange={(e) => handleSelectionMethodChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
              data-testid="selection-method"
            >
              {SELECTION_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {fieldErrors.receivesComparator && (
              <p className="text-[10px] text-red-400 mt-0.5">
                {fieldErrors.receivesComparator}
              </p>
            )}
          </div>

          {/* Selection ranks */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              {WIZARD_LABELS.selectionRank}
            </label>
            <p className="text-[10px] text-white/30 mb-2">
              {WIZARD_LABELS.selectionRankHelp}
            </p>
            <input
              type="text"
              value={wizardModel.conveyance.selectionRanks.join(', ')}
              onChange={(e) => handleSelectionRanksChange(e.target.value)}
              disabled={disabled}
              placeholder="e.g. 1, 2"
              className="w-full px-3 py-2 rounded bg-[#141414] text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none"
              data-testid="selection-ranks"
            />
            {fieldErrors.receivesRank && (
              <p className="text-[10px] text-red-400 mt-0.5">
                {fieldErrors.receivesRank}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
