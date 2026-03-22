/**
 * Purpose: Provide Dialog primitives (Dialog, DialogContent).
 * Inputs: open, onOpenChange, children, content props.
 * Outputs: Accessible dialog container/content.
 * Risks: Export API mismatch; focus trap/ARIA/portal not verified.
 * Next TODO: Confirm named exports; validate a11y; document usage.
 */
// dialog.tsx — simple modal wrapper for CreateListModal

import React from 'react';

type DialogOpenChangeHandler = ((open: boolean) => void) | (() => void);

type DialogProps = {
  open?: boolean;
  onOpenChange?: DialogOpenChangeHandler;
  children?: React.ReactNode;
};

type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={() => onOpenChange?.(false)}
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

export const DialogContent = ({
  children,
  className = '',
  ...props
}: DialogContentProps) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};
