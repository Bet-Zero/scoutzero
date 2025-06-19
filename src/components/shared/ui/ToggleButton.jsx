// src/components/shared/ui/ToggleButton.jsx
import React from 'react';
import clsx from 'clsx';

const ToggleButton = ({ selected, onClick, children }) => {
  return (
    <button
      className={clsx(
        'px-3 py-1 rounded-md border text-sm transition-colors duration-150',
        selected
          ? 'bg-zinc-800 text-white border-zinc-600'
          : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default ToggleButton;
