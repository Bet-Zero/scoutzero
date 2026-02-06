/**
 * FILE: src/features/architect/admin/EntitlementEditorProtectionTab.tsx
 * PURPOSE: Render the Protection Ladder tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 *  - 2026-02-05: TM-7 enhancements: templates, reorder, duplicate, inline validation.
 */

import React, { useMemo } from 'react';
import type {
  EntitlementFormState,
  ProtectionLadderTierForm,
} from './entitlementEditorFormState';
import {
  PROTECTION_TEMPLATES,
  applyProtectionTemplate,
} from './ProtectionLadderTemplates';

interface EntitlementEditorProtectionTabProps {
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  disabled?: boolean;
}

const createEmptyTier = (): ProtectionLadderTierForm => ({
  year: '',
  condition: '',
  ifTriggered: 'roll',
  rollToYear: '',
  convertToRound: '',
});

type TierValidation = {
  yearError?: string;
  conditionError?: string;
  rollToYearError?: string;
  convertToRoundError?: string;
};

const validateTier = (
  tier: ProtectionLadderTierForm,
  index: number,
  allTiers: ProtectionLadderTierForm[]
): TierValidation => {
  const errors: TierValidation = {};

  // Year validation
  if (!tier.year || tier.year.trim() === '') {
    errors.yearError = 'Year required';
  } else {
    const year = Number(tier.year);
    if (!Number.isFinite(year) || year < 2020 || year > 2040) {
      errors.yearError = 'Invalid year';
    } else {
      // Check for duplicates
      const duplicate = allTiers.findIndex(
        (t, i) => i !== index && t.year === tier.year && t.year !== ''
      );
      if (duplicate !== -1) {
        errors.yearError = 'Duplicate year';
      }
      // Check ascending order
      if (index > 0) {
        const prevYear = Number(allTiers[index - 1].year);
        if (Number.isFinite(prevYear) && year <= prevYear) {
          errors.yearError = 'Years must be ascending';
        }
      }
    }
  }

  // Condition validation (cancel tiers don't need condition)
  if (tier.ifTriggered !== 'cancel' && (!tier.condition || tier.condition.trim() === '')) {
    errors.conditionError = 'Condition required';
  }

  // Roll requires rollToYear
  if (tier.ifTriggered === 'roll') {
    if (!tier.rollToYear || tier.rollToYear.trim() === '') {
      errors.rollToYearError = 'Roll year required';
    }
  }

  // Convert requires convertToRound
  if (tier.ifTriggered === 'convert') {
    if (!tier.convertToRound || tier.convertToRound.trim() === '') {
      errors.convertToRoundError = 'Round required';
    }
  }

  return errors;
};

export const EntitlementEditorProtectionTab: React.FC<
  EntitlementEditorProtectionTabProps
> = ({ formState, onChange, disabled = false }) => {
  const updateTier = (index: number, patch: Partial<ProtectionLadderTierForm>) => {
    const next = formState.protectionLadder.map((tier, idx) =>
      idx === index ? { ...tier, ...patch } : tier
    );
    onChange({ ...formState, protectionLadder: next });
  };

  const addTier = () => {
    onChange({
      ...formState,
      protectionLadder: [...formState.protectionLadder, createEmptyTier()],
    });
  };

  const removeTier = (index: number) => {
    const next = formState.protectionLadder.filter((_, idx) => idx !== index);
    onChange({ ...formState, protectionLadder: next });
  };

  const duplicateTier = (index: number) => {
    const tierToDuplicate = formState.protectionLadder[index];
    const duplicated: ProtectionLadderTierForm = {
      ...tierToDuplicate,
      year: tierToDuplicate.year
        ? String(Number(tierToDuplicate.year) + 1)
        : '',
    };
    const next = [
      ...formState.protectionLadder.slice(0, index + 1),
      duplicated,
      ...formState.protectionLadder.slice(index + 1),
    ];
    onChange({ ...formState, protectionLadder: next });
  };

  const moveTier = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formState.protectionLadder.length) return;
    const next = [...formState.protectionLadder];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange({ ...formState, protectionLadder: next });
  };

  const applyTemplate = (templateId: string) => {
    const template = PROTECTION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const baseYear = Number(formState.seasonYear) || 2026;
    const newTiers = applyProtectionTemplate(template, baseYear);
    onChange({ ...formState, protectionLadder: newTiers });
  };

  // Validate all tiers
  const tierValidations = useMemo(() => {
    return formState.protectionLadder.map((tier, index) =>
      validateTier(tier, index, formState.protectionLadder)
    );
  }, [formState.protectionLadder]);

  return (
    <div className="space-y-4">
      <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
        Not yet simulated in trade validation. Saved ladders are displayed and used
        by resolution tooling only.
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Protection Ladder</h3>
          <p className="text-xs text-white/50">
            Add year-by-year protection tiers (e.g., Top 3, Lottery).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value=""
            onChange={(e) => applyTemplate(e.target.value)}
            disabled={disabled}
            className="px-2 py-1 text-xs rounded bg-[#141414] text-white border border-white/10"
          >
            <option value="">Apply template...</option>
            {PROTECTION_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addTier}
            disabled={disabled}
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            Add Tier
          </button>
        </div>
      </div>

      {formState.protectionLadder.length === 0 ? (
        <div className="text-xs text-white/40">No tiers added yet.</div>
      ) : (
        <div className="space-y-3">
          {formState.protectionLadder.map((tier, index) => {
            const showRoll = tier.ifTriggered === 'roll';
            const showConvert = tier.ifTriggered === 'convert';
            const validation = tierValidations[index] || {};
            const hasErrors = Object.keys(validation).length > 0;

            return (
              <div
                key={`tier-${index}`}
                className={`border rounded p-3 space-y-2 ${
                  hasErrors ? 'border-red-500/50 bg-red-900/10' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white/60">Tier {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveTier(index, -1)}
                      disabled={disabled || index === 0}
                      title="Move up"
                      className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTier(index, 1)}
                      disabled={disabled || index === formState.protectionLadder.length - 1}
                      title="Move down"
                      className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateTier(index)}
                      disabled={disabled}
                      title="Duplicate tier"
                      className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      disabled={disabled}
                      className="text-xs text-red-300 hover:text-red-200 ml-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={`tier-year-${index}`}
                      className="block text-[10px] text-white/50 mb-1"
                    >
                      Year
                    </label>
                    <input
                      id={`tier-year-${index}`}
                      type="number"
                      value={tier.year}
                      onChange={(e) => updateTier(index, { year: e.target.value })}
                      disabled={disabled}
                      className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
                        validation.yearError ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                    {validation.yearError && (
                      <p className="text-[10px] text-red-400 mt-0.5">{validation.yearError}</p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor={`tier-condition-${index}`}
                      className="block text-[10px] text-white/50 mb-1"
                    >
                      Condition
                    </label>
                    <input
                      id={`tier-condition-${index}`}
                      value={tier.condition}
                      onChange={(e) =>
                        updateTier(index, { condition: e.target.value })
                      }
                      disabled={disabled}
                      placeholder="Top 3, Lottery"
                      className={`w-full px-2 py-1 rounded bg-[#141414] text-white border ${
                        validation.conditionError ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                    {validation.conditionError && (
                      <p className="text-[10px] text-red-400 mt-0.5">{validation.conditionError}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor={`tier-trigger-${index}`}
                      className="block text-[10px] text-white/50 mb-1"
                    >
                      If Triggered
                    </label>
                    <select
                      id={`tier-trigger-${index}`}
                      value={tier.ifTriggered}
                      onChange={(e) =>
                        updateTier(index, {
                          ifTriggered: e.target.value as 'roll' | 'convert' | 'cancel',
                        })
                      }
                      disabled={disabled}
                      className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
                    >
                      <option value="roll">Roll</option>
                      <option value="convert">Convert</option>
                      <option value="cancel">Cancel</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`tier-roll-${index}`}
                      className="block text-[10px] text-white/50 mb-1"
                    >
                      Roll To Year
                    </label>
                    <input
                      id={`tier-roll-${index}`}
                      type="number"
                      value={tier.rollToYear}
                      onChange={(e) =>
                        updateTier(index, { rollToYear: e.target.value })
                      }
                      disabled={disabled || !showRoll}
                      className={`w-full px-2 py-1 rounded bg-[#141414] text-white border disabled:opacity-40 ${
                        validation.rollToYearError ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                    {validation.rollToYearError && (
                      <p className="text-[10px] text-red-400 mt-0.5">{validation.rollToYearError}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`tier-convert-${index}`}
                      className="block text-[10px] text-white/50 mb-1"
                    >
                      Convert To Round
                    </label>
                    <select
                      id={`tier-convert-${index}`}
                      value={tier.convertToRound}
                      onChange={(e) =>
                        updateTier(index, { convertToRound: e.target.value })
                      }
                      disabled={disabled || !showConvert}
                      className={`w-full px-2 py-1 rounded bg-[#141414] text-white border disabled:opacity-40 ${
                        validation.convertToRoundError ? 'border-red-500' : 'border-white/10'
                      }`}
                    >
                      <option value="">-</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                    {validation.convertToRoundError && (
                      <p className="text-[10px] text-red-400 mt-0.5">{validation.convertToRoundError}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
