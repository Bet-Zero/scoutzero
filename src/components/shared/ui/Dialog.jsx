// dialog.jsx — simple modal wrapper for CreateListModal

import React from 'react';

export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-[#111] border border-white/10 rounded-lg shadow-xl p-6 max-w-md w-full"
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
