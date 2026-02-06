/**
 * FILE: src/features/architect/admin/PickRightWizardSteps/WizardStepIntent.tsx
 * PURPOSE: Step 1 of Pick Right Wizard — "What are you doing?"
 * OWNERSHIP: Feature: architect/admin (TM-8 Pick Editor UX)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 */

import React from 'react';
import type { EntitlementKind } from '../entitlementEditorFormState';

interface IntentOption {
  kind: EntitlementKind | 'advanced';
  title: string;
  description: string;
  icon: string;
  color: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    kind: 'pick_ownership',
    title: 'Protect a Pick',
    description:
      'Set up pick ownership with optional protection ladders (Top 3, Lottery, etc.)',
    icon: '🛡️',
    color: 'border-blue-500/40 hover:border-blue-400 hover:bg-blue-900/20',
  },
  {
    kind: 'swap_right',
    title: 'Create a Swap Right',
    description:
      "Define a draft pick swap — best-of or worst-of between two teams' picks.",
    icon: '🔄',
    color:
      'border-purple-500/40 hover:border-purple-400 hover:bg-purple-900/20',
  },
  {
    kind: 'conveyance_right',
    title: 'Create a Conveyance Right',
    description: 'Pool multiple picks and select by favorability ranking.',
    icon: '📦',
    color: 'border-amber-500/40 hover:border-amber-400 hover:bg-amber-900/20',
  },
  {
    kind: 'advanced',
    title: 'Advanced Editor',
    description:
      'Open the full tabbed editor with all fields and raw JSON access.',
    icon: '⚙️',
    color: 'border-gray-500/40 hover:border-gray-400 hover:bg-gray-800/20',
  },
];

interface WizardStepIntentProps {
  onSelectKind: (kind: EntitlementKind) => void;
  onOpenAdvanced: () => void;
}

export const WizardStepIntent: React.FC<WizardStepIntentProps> = ({
  onSelectKind,
  onOpenAdvanced,
}) => {
  return (
    <div data-testid="wizard-step-intent">
      <h3 className="text-lg font-semibold text-white mb-1">
        What are you doing?
      </h3>
      <p className="text-sm text-white/50 mb-6">
        Choose the type of pick right you want to create or edit.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INTENT_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            onClick={() => {
              if (option.kind === 'advanced') {
                onOpenAdvanced();
              } else {
                onSelectKind(option.kind);
              }
            }}
            data-testid={`intent-option-${option.kind}`}
            className={`
              text-left p-4 rounded-lg border transition-colors cursor-pointer
              bg-[#1a1a1a] ${option.color}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{option.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white">
                  {option.title}
                </div>
                <div className="text-xs text-white/50 mt-1 leading-relaxed">
                  {option.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
