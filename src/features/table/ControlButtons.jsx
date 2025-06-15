import React from 'react';
import { Filter, SortAsc } from 'lucide-react';

const ControlButtons = ({
  showFilters,
  showSort,
  onToggleFilters,
  onToggleSort,
}) => (
  <div className="flex items-center gap-3">
    <button
      onClick={onToggleFilters}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border transition-all duration-200 ${
        showFilters
          ? 'bg-neutral-800 text-white border-neutral-600'
          : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
      }`}
    >
      <Filter size={14} />
      Filters
    </button>

    <button
      onClick={onToggleSort}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border transition-all duration-200 ${
        showSort
          ? 'bg-neutral-800 text-white border-neutral-600'
          : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50'
      }`}
    >
      <SortAsc size={14} />
      Sort
    </button>
  </div>
);

export default ControlButtons;
