/**
 * Purpose: Provide Dialog primitives (Dialog, DialogContent).
 * Inputs: open, onOpenChange, children, content props.
 * Outputs: Accessible dialog container/content.
 * Risks: Export API mismatch; focus trap/ARIA/portal not verified.
 * Next TODO: Confirm named exports; validate a11y; document usage.
 */
// dialog.jsx — simple modal wrapper for CreateListModal

import React from 'react';

export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()} // prevent modal from closing when clicking inside
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};
