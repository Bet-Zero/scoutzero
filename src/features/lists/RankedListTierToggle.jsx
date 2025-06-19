// RankedListTierToggle.jsx
// Toggle component to enable tiered grouping within a ranked list.

import React from 'react';

const ToggleViewButton = ({ view, setView }) => {
  return (
    <div className="flex gap-[6px]">
      <button
        onClick={() => setView('list')}
        className={`px-3 py-[4px] rounded text-[11px] border ${
          view === 'list'
            ? 'bg-white text-black font-semibold'
            : 'border-white/20 text-white/60 hover:text-white'
        }`}
      >
        List
      </button>
      <button
        onClick={() => setView('tier')}
        className={`px-3 py-[4px] rounded text-[11px] border ${
          view === 'tier'
            ? 'bg-white text-black font-semibold'
            : 'border-white/20 text-white/60 hover:text-white'
        }`}
      >
        Tiers
      </button>
    </div>
  );
};

export default ToggleViewButton;
