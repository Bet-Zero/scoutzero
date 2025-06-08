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
      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
        showFilters
          ? 'bg-gray-700 text-white border border-gray-600'
          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      <Filter size={14} />
      Filters
    </button>

    <button
      onClick={onToggleSort}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
        showSort
          ? 'bg-gray-700 text-white border border-gray-600'
          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      <SortAsc size={14} />
      Sort
    </button>
  </div>
);

export default ControlButtons;
