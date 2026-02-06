/**
 * FILE: src/features/architect/admin/PickRightWizardSteps/WizardStepReview.tsx
 * PURPOSE: Step 3 of Pick Right Wizard — review, save draft, or apply.
 * OWNERSHIP: Feature: architect/admin (TM-8 Pick Editor UX / TM-9 Translation Layer)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Rewrote to use WizardModel. Removed schema jargon
 *                from all user-facing labels. Added tradability badge.
 */

import React, { useMemo } from 'react';
import type { EntitlementFormState } from '../entitlementEditorFormState';
import type { WizardModel } from '../pickRightWizardModel';
import { wizardPickToId } from '../pickRightWizardModel';
import type { FieldErrors } from '../useEntitlementEditorState';
import { PlainEnglishPreview } from '../PlainEnglishPreview';
import {
  WIZARD_LABELS,
  WIZARD_KIND_LABELS,
  WIZARD_STATUS_LABELS,
  WIZARD_COMPARATOR_LABELS,
  deriveTradabilityStatus,
  TRADABILITY_STYLES,
} from '../pickEditorCopy';

// ─── helper ──────────────────────────────────────────────────────────────────

const SummaryRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <>
    <dt className="text-white/40">{label}</dt>
    <dd className="text-white/80 font-mono text-[11px]">{value || '—'}</dd>
  </>
);

// ─── component ───────────────────────────────────────────────────────────────

interface WizardStepReviewProps {
  wizardModel: WizardModel;
  formState: EntitlementFormState;
  fieldErrors: FieldErrors;
  isValid: boolean;
  saving: boolean;
  onSaveDraft: () => void;
  onApply: () => void;
  onOpenAdvanced: () => void;
}

export const WizardStepReview: React.FC<WizardStepReviewProps> = ({
  wizardModel,
  formState,
  fieldErrors,
  isValid,
  saving,
  onSaveDraft,
  onApply,
  onOpenAdvanced,
}) => {
  // Tradability badge
  const tradability = useMemo(
    () => deriveTradabilityStatus(wizardModel),
    [wizardModel]
  );

  const displayKind =
    wizardModel.intent === 'protect_pick'
      ? 'pick_ownership'
      : wizardModel.intent === 'create_swap'
        ? 'swap_right'
        : wizardModel.intent === 'create_conveyance'
          ? 'conveyance_right'
          : '';

  return (
    <div className="space-y-5" data-testid="wizard-step-review">
      {/* Plain English + validity indicator */}
      <PlainEnglishPreview formState={formState} fieldErrors={fieldErrors} />

      {/* Tradability badge */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${TRADABILITY_STYLES[tradability.variant]}`}
        data-testid="review-tradability-badge"
      >
        <span>{tradability.icon}</span>
        <span className="font-medium">{tradability.label}</span>
        <span className="text-white/50 text-xs">— {tradability.reason}</span>
      </div>

      {/* Field summary — jargon-free labels */}
      <div className="bg-[#111] border border-white/10 rounded-lg p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wide mb-3 font-semibold">
          {WIZARD_LABELS.fieldSummary}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <SummaryRow
            label={WIZARD_LABELS.kind}
            value={WIZARD_KIND_LABELS[displayKind] || displayKind}
          />
          <SummaryRow
            label={WIZARD_LABELS.holderTeam}
            value={wizardModel.pick.team}
          />
          <SummaryRow
            label={WIZARD_LABELS.seasonYear}
            value={String(wizardModel.pick.year)}
          />
          <SummaryRow
            label={WIZARD_LABELS.round}
            value={wizardModel.pick.round === 1 ? '1st' : '2nd'}
          />

          {/* Pick ownership fields */}
          {wizardModel.intent === 'protect_pick' && (
            <>
              <SummaryRow
                label="Pick"
                value={wizardPickToId(wizardModel.pick)}
              />
              <SummaryRow
                label="Restrictions"
                value={
                  WIZARD_STATUS_LABELS[formState.underlyingStatus] ||
                  tradability.label
                }
              />
              {wizardModel.protection.customLadder.length > 0 && (
                <SummaryRow
                  label="Protection Tiers"
                  value={`${wizardModel.protection.customLadder.length} tier(s)`}
                />
              )}
            </>
          )}

          {/* Swap right fields */}
          {wizardModel.intent === 'create_swap' && (
            <>
              <SummaryRow
                label={WIZARD_LABELS.swapType}
                value={
                  wizardModel.swap.swapType === 'best_of'
                    ? 'Best of'
                    : 'Worst of'
                }
              />
              <SummaryRow
                label={WIZARD_LABELS.controllerPick}
                value={wizardPickToId(wizardModel.swap.controllerPick)}
              />
              <SummaryRow
                label={WIZARD_LABELS.targetDescription}
                value={wizardModel.swap.targetDescription}
              />
            </>
          )}

          {/* Conveyance right fields */}
          {wizardModel.intent === 'create_conveyance' && (
            <>
              <SummaryRow
                label={WIZARD_LABELS.poolOfPicks}
                value={`${wizardModel.conveyance.poolPicks.length} pick(s)`}
              />
              <SummaryRow
                label={WIZARD_LABELS.selectionMethod}
                value={
                  WIZARD_COMPARATOR_LABELS[formState.receivesComparator] ||
                  wizardModel.conveyance.selectionMethod
                }
              />
              <SummaryRow
                label={WIZARD_LABELS.selectionRank}
                value={wizardModel.conveyance.selectionRanks.join(', ')}
              />
            </>
          )}

          {/* Description (all intents) */}
          {wizardModel.description && (
            <SummaryRow
              label={WIZARD_LABELS.description}
              value={wizardModel.description}
            />
          )}
        </dl>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onApply}
          disabled={!isValid || saving}
          className={`px-5 py-2.5 rounded text-sm font-medium transition-colors ${
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
          className="px-4 py-2.5 rounded text-sm font-medium border border-white/20 text-white/70 hover:text-white hover:border-white/30 transition-colors"
          data-testid="wizard-save-draft"
        >
          {WIZARD_LABELS.saveDraft}
        </button>

        <button
          type="button"
          onClick={onOpenAdvanced}
          className="ml-auto text-xs text-white/40 hover:text-white/60 underline transition-colors"
          data-testid="wizard-open-advanced"
        >
          {WIZARD_LABELS.openAdvanced}
        </button>
      </div>
    </div>
  );
};
