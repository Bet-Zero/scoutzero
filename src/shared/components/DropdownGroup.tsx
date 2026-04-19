/**
 * Purpose: Layout group for multiple dropdowns/filters.
 * Inputs: children, spacing/gap props, wrap behavior.
 * Outputs: Responsive grouped layout.
 * Risks: Hardcoded gaps; missing a11y grouping; small-screen reflow issues.
 * Next TODO: Add spacing/wrap props; fieldset/legend where appropriate; add tests.
 */
// src/components/shared/DropdownGroup.tsx

import type { ReactNode } from 'react';

export type DropdownGroupProps = {
  label: ReactNode;
  children?: ReactNode;
};

const DropdownGroup = ({ label, children }: DropdownGroupProps) => {
  return (
    <div className="mb-0">
      <label className="text-white text-xs block mb-1">{label}</label>
      {children}
    </div>
  );
};

export default DropdownGroup;
