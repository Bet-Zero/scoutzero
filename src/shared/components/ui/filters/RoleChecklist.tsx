/**
 * Purpose: Checklist UI for selecting roles.
 * Inputs: roles[], selected[], onChange, className.
 * Outputs: Controlled checkbox list.
 * Risks: Accessibility unknown; value type consistency; empty list handling.
 * Next TODO: Ensure fieldset/legend/ARIA; normalize values; add prop types/TS.
 */
import React from 'react';

type ChecklistRole = {
  isPositive?: boolean;
  name: string;
  type: string;
};

type RoleChecklistProps = {
  roles?: ChecklistRole[];
  selected?: Record<string, string[] | undefined>;
  onToggle?: (roleName: string) => void;
  columns?: number;
  className?: string;
};

const RoleChecklist = ({
  roles = [],
  selected = {},
  onToggle,
  columns = 2,
  className = '',
}: RoleChecklistProps) => (
  <div className={`grid gap-1 grid-cols-${columns} ${className}`.trim()}>
    {roles.map((role) => {
      const isSelected = (selected[role.type] || []).includes(role.name);
      return (
        <div
          key={role.name}
          onClick={() => onToggle?.(role.name)}
          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
            isSelected
              ? role.isPositive
                ? 'bg-green-900/50 text-green-100'
                : 'bg-red-900/50 text-red-100'
              : role.isPositive
                ? 'bg-[#2a2a2a] text-green-100 hover:bg-green-900/30'
                : 'bg-[#2a2a2a] text-red-100 hover:bg-red-900/30'
          }`}
        >
          <span>{role.name}</span>
          <span className="text-xs opacity-70">
            {role.isPositive ? '✓' : '✗'}
          </span>
        </div>
      );
    })}
  </div>
);

export default RoleChecklist;
