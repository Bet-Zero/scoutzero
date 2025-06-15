// src/components/filters/FiltersPanel.jsx

import React from 'react';
import FilterPanelCondensed from './FilterPanelCondensed';
import FilterPanel from './FilterPanel';

const FiltersPanel = ({
  filters,
  setFilters,
  getDefaultFilters,
  isOpen,
  showFullFilters,
  setShowFullFilters,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-full max-w-[1100px] mx-auto mb-4 relative">
      {/* + More Filters Button (floating, no layout shift) */}
      {!showFullFilters && (
        <button
          onClick={() => setShowFullFilters(true)}
          className="absolute top-[26px] right-[7px] translate-y-[-50%] flex items-center gap-1 px-1 py-1 text-white/60 text-xs border border-white/10 rounded hover:text-white hover:border-white/20 transition-all whitespace-nowrap"
        >
          <span className="text-base font-semibold leading-none">＋</span>
        </button>
      )}

      {/* Condensed Panel */}
      {!showFullFilters && (
        <FilterPanelCondensed filters={filters} setFilters={setFilters} />
      )}

      {/* Full Panel */}
      {showFullFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          getDefaultFilters={getDefaultFilters}
          onClose={onClose}
        />
      )}
    </div>
  );
};

export default FiltersPanel;
