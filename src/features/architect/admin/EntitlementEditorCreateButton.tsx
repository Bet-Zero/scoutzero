/**
 * FILE: src/features/architect/admin/EntitlementEditorCreateButton.tsx
 * PURPOSE: Button component for creating a new entitlement from Trade Machine.
 * OWNERSHIP: Feature: architect/admin (TM-7 Pick Editor UX)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-7 Pick Editor UX.
 */

import React from 'react';
import { Plus } from 'lucide-react';

interface EntitlementEditorCreateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const EntitlementEditorCreateButton: React.FC<
  EntitlementEditorCreateButtonProps
> = ({ onClick, disabled = false, size = 'sm' }) => {
  const sizeClasses =
    size === 'sm' ? 'px-2 py-1 text-xs gap-1' : 'px-3 py-1.5 text-sm gap-1.5';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center ${sizeClasses} rounded bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      title="Create new entitlement"
    >
      <Plus size={size === 'sm' ? 14 : 16} />
      <span>New Entitlement</span>
    </button>
  );
};
