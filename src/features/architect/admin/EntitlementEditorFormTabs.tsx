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
  disabled = false,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`pb-1 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-white border-blue-500'
                : 'text-white/50 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'basics' && (
        <EntitlementEditorBasicsTab
          formState={formState}
          onChange={onChange}
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
          disabled={disabled}
        />
      )}
      {activeTab === 'conveyance' && (
        <EntitlementEditorConveyanceTab
          formState={formState}
          onChange={onChange}
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
