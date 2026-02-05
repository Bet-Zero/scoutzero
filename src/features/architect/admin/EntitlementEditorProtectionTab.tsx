/**
 * FILE: src/features/architect/admin/EntitlementEditorProtectionTab.tsx
 * PURPOSE: Render the Protection Ladder tab for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import React from 'react';
import type {
  EntitlementFormState,
  ProtectionLadderTierForm,
} from './entitlementEditorFormState';

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

  return (
    <div className="space-y-4">
      <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
        Not yet simulated in trade validation. Saved ladders are displayed and used
        by resolution tooling only.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Protection Ladder</h3>
          <p className="text-xs text-white/50">
            Add year-by-year protection tiers (e.g., Top 3, Lottery).
          </p>
        </div>
        <button
          type="button"
          onClick={addTier}
          disabled={disabled}
          className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          Add Tier
        </button>
      </div>

      {formState.protectionLadder.length === 0 ? (
        <div className="text-xs text-white/40">No tiers added yet.</div>
      ) : (
        <div className="space-y-3">
          {formState.protectionLadder.map((tier, index) => {
            const showRoll = tier.ifTriggered === 'roll';
            const showConvert = tier.ifTriggered === 'convert';

            return (
              <div
                key={`tier-${index}`}
                className="border border-white/10 rounded p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">Tier {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    disabled={disabled}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Remove
                  </button>
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
                      className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
                    />
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
                      className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10"
                    />
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
                      className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10 disabled:opacity-40"
                    />
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
                      className="w-full px-2 py-1 rounded bg-[#141414] text-white border border-white/10 disabled:opacity-40"
                    >
                      <option value="">-</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
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
