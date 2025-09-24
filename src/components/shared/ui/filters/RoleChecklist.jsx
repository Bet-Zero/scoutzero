/**
 * Purpose: Checklist UI for selecting roles.
 * Inputs: roles[], selected[], onChange, className.
 * Outputs: Controlled checkbox list.
 * Risks: None known.
 * Next TODO: Add prop types/TS coverage.
*/
import React from 'react';

const RoleChecklist = ({
  roles = [],
  selected = {},
  onToggle,
  columns = 2,
  className = '',
  legend = 'Roles',
}) => {
  const fieldsetId = React.useId();

  const gridClass = `grid gap-1 grid-cols-${columns} ${className}`.trim();

  return (
    <fieldset className={gridClass} aria-labelledby={fieldsetId}>
      <legend id={fieldsetId} className="sr-only">
        {legend}
      </legend>
      {roles.length === 0 && (
        <p className="text-xs text-white/60" role="status">
          No roles available
        </p>
      )}
      {roles.map((role) => {
        const selectedForType = Array.isArray(selected?.[role.type])
          ? selected[role.type]
          : [];
        const isSelected = selectedForType.includes(role.name);
        const baseClasses = role.isPositive
          ? 'bg-[#2a2a2a] text-green-100 hover:bg-green-900/30'
          : 'bg-[#2a2a2a] text-red-100 hover:bg-red-900/30';
        const activeClasses = role.isPositive
          ? 'bg-green-900/50 text-green-100'
          : 'bg-red-900/50 text-red-100';

        return (
          <button
            key={role.name}
            type="button"
            onClick={() => onToggle?.(role.name)}
            className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isSelected ? activeClasses : baseClasses
            }`}
            aria-pressed={isSelected}
          >
            <span>{role.name}</span>
            <span className="text-xs opacity-70" aria-hidden="true">
              {role.isPositive ? '✓' : '✗'}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
};

export default RoleChecklist;
