import React from 'react';
import { Filter } from 'lucide-react';

const PlayerSearchBar = ({
  search,
  onSearchChange,
  showFilters,
  onToggleFilters,
}) => (
  <div className="flex-shrink-0 px-3 py-2 border-b border-white/10">
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 bg-[#111] text-white px-2 py-1 rounded text-sm placeholder-white/30 border border-white/10"
      />
      <button
        onClick={onToggleFilters}
        className={`p-1.5 rounded ${showFilters ? 'bg-[#222] text-white' : 'text-white/50 hover:text-white'}`}
      >
        <Filter size={16} />
      </button>
    </div>
  </div>
);

export default PlayerSearchBar;
