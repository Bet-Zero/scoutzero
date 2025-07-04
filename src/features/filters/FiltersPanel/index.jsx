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
  onClearFilters,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Condensed Panel */}
      {!showFullFilters && (
        <div className="w-full max-w-[1100px] mx-auto mb-4 relative">
          {/* + More Filters Button (floating, no layout shift) */}
          <button
            onClick={() => setShowFullFilters(true)}
            className="h-[23px] absolute top-[15px] right-[7px] translate-y-[-50%] flex items-center gap-1 px-1 py-1 text-white/60 text-xs border border-white/10 rounded hover:text-white hover:border-white/20 hover:bg-neutral-700 transition-all whitespace-nowrap"
          >
            <span className="text-base font-semibold leading-none">＋</span>
          </button>

          <FilterPanelCondensed filters={filters} setFilters={setFilters} />
        </div>
      )}

      {/* Full Panel */}
      {showFullFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          getDefaultFilters={getDefaultFilters}
          onClose={() => {
            setShowFullFilters(false);
            onClose();
          }}
          onClearFilters={onClearFilters}
        />
      )}
    </>
  );
};

export default FiltersPanel;
