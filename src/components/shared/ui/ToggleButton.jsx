/**
 * Purpose: Toggleable button with selected styles.
 * Inputs: selected (bool), onClick, disabled?, children.
 * Outputs: Button reflecting pressed/selected state.
 * Risks: None known.
 * Next TODO: Consider prop types and theming hooks.
*/
// src/components/shared/ui/ToggleButton.jsx
import React from 'react';
import clsx from 'clsx';

const ToggleButton = ({ selected, onClick, children, disabled = false }) => {
  return (
    <button
      className={clsx(
        'px-3 py-1 rounded-md border text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
        selected
          ? 'bg-zinc-800 text-white border-zinc-600'
          : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200',
        disabled && 'opacity-60 cursor-not-allowed hover:bg-zinc-100'
      )}
      onClick={disabled ? undefined : onClick}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default ToggleButton;
