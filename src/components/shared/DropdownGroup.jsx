/**
 * Purpose: Layout group for multiple dropdowns/filters.
 * Inputs: children, spacing/gap props, wrap behavior.
 * Outputs: Responsive grouped layout.
 * Risks: None known.
 * Next TODO: Add spacing/wrap props; add tests.
*/
// src/components/shared/DropdownGroup.jsx

import React from 'react';

const DropdownGroup = ({
  label,
  children,
  className = '',
  legendClassName = 'text-white text-xs mb-1',
}) => {
  const legendContent = label ? (
    <span>{label}</span>
  ) : (
    <span className="sr-only">Options</span>
  );

  return (
    <fieldset className={`mb-0 flex flex-col gap-1 ${className}`.trim()}>
      <legend className={`${legendClassName}`}>{legendContent}</legend>
      <div role="group" aria-label={label || 'Options'} className="flex flex-col gap-2">
        {children}
      </div>
    </fieldset>
  );
};

export default DropdownGroup;
