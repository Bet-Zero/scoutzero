/**
 * FILE: src/features/architect/admin/EntitlementEditorFormTabs.tsx
 * PURPOSE: Tab bar and content renderer for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-4 Entitlement Authoring)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-4 entitlement authoring.
 */

import React from 'react';
import type { EntitlementFormState } from './entitlementEditorFormState';
import type { FieldErrors } from './useEntitlementEditorState';
import { EntitlementEditorBasicsTab } from './EntitlementEditorBasicsTab';
import { EntitlementEditorProtectionTab } from './EntitlementEditorProtectionTab';
import { EntitlementEditorSwapTab } from './EntitlementEditorSwapTab';
import { EntitlementEditorConveyanceTab } from './EntitlementEditorConveyanceTab';
import { EntitlementEditorAdvancedTab } from './EntitlementEditorAdvancedTab';

export type EntitlementEditorTabKey =
  | 'basics'
  | 'protection'
  | 'swap'
  | 'conveyance'
  | 'advanced';

interface EntitlementEditorFormTabsProps {
  activeTab: EntitlementEditorTabKey;
  onTabChange: (next: EntitlementEditorTabKey) => void;
  formState: EntitlementFormState;
  onChange: (next: EntitlementFormState) => void;
  onApplyJson: (jsonInput: string) => { success: boolean; error?: string };
  fieldErrors?: FieldErrors;
  disabled?: boolean;
}

const tabs: Array<{ key: EntitlementEditorTabKey; label: string }> = [
  { key: 'basics', label: 'Basics' },
  { key: 'protection', label: 'Protection Ladder' },
  { key: 'swap', label: 'Swap' },
  { key: 'conveyance', label: 'Conveyance' },
  { key: 'advanced', label: 'Advanced' },
];

export const EntitlementEditorFormTabs: React.FC<
  EntitlementEditorFormTabsProps
> = ({
  activeTab,
  onTabChange,
  formState,
  onChange,
  onApplyJson,
  fieldErrors = {},
  disabled = false,
}) => {
  // Count errors per tab for badge display
  const tabErrorCounts: Record<string, number> = {};
  const basicsFields = [
    'holderTeam',
    'seasonYear',
    'round',
    'kind',
    'underlyingPickId',
  ];
  const swapFields = ['swapControllerPickId', 'swapTargetDefinition'];
  const conveyanceFields = [
    'poolUnderlyingPickIds',
    'receivesComparator',
    'receivesRank',
  ];

  tabErrorCounts.basics = basicsFields.filter((f) => fieldErrors[f]).length;
  tabErrorCounts.swap = swapFields.filter((f) => fieldErrors[f]).length;
  tabErrorCounts.conveyance = conveyanceFields.filter(
    (f) => fieldErrors[f]
  ).length;
  tabErrorCounts.protection = Object.keys(fieldErrors).filter((k) =>
    k.startsWith('protectionLadder.')
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs border-b border-white/10 pb-2">
        {tabs.map((tab) => {
          const errorCount = tabErrorCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`pb-1 border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === tab.key
                  ? 'text-white border-blue-500'
                  : 'text-white/50 border-transparent hover:text-white'
              }`}
            >
              {tab.label}
              {errorCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] rounded-full bg-red-500/80 text-white">
                  {errorCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'basics' && (
        <EntitlementEditorBasicsTab
          formState={formState}
          onChange={onChange}
          fieldErrors={fieldErrors}
          disabled={disabled}
        />
      )}
      {activeTab === 'protection' && (
        <EntitlementEditorProtectionTab
          formState={formState}
          onChange={onChange}
          disabled={disabled}
        />
      )}
      {activeTab === 'swap' && (
        <EntitlementEditorSwapTab
          formState={formState}
          onChange={onChange}
          fieldErrors={fieldErrors}
          disabled={disabled}
        />
      )}
      {activeTab === 'conveyance' && (
        <EntitlementEditorConveyanceTab
          formState={formState}
          onChange={onChange}
          fieldErrors={fieldErrors}
          disabled={disabled}
        />
      )}
      {activeTab === 'advanced' && (
        <EntitlementEditorAdvancedTab
          formState={formState}
          onApplyJson={onApplyJson}
          disabled={disabled}
        />
      )}
    </div>
  );
};
