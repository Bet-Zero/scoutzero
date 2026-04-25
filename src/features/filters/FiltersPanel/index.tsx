import React from 'react';
import FilterPanelCondensed from './FilterPanelCondensed';
import FilterPanel from './FilterPanel';
import type {
  GetDefaultPlayerFilters,
  PlayerFilterPanelProps,
} from '../filterTypes';

type FiltersPanelProps = PlayerFilterPanelProps & {
  getDefaultFilters: GetDefaultPlayerFilters;
  isOpen: boolean;
  showFullFilters: boolean;
  setShowFullFilters: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onClearFilters: () => void;
};

const FiltersPanel = ({
  filters,
  setFilters,
  getDefaultFilters,
  isOpen,
  showFullFilters,
  setShowFullFilters,
  onClose,
  onClearFilters,
}: FiltersPanelProps) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Condensed Panel - Phase 2K: Removed mb-4 for overlay use */}
      {!showFullFilters && (
        <div className="w-full relative">
          {/* + More Filters Button (floating) */}
          <button
            onClick={() => setShowFullFilters(true)}
            className="h-[23px] absolute top-[15px] right-[7px] translate-y-[-50%] flex items-center gap-1 px-1 py-1 text-white/60 text-xs border border-white/10 rounded hover:text-white hover:border-white/20 hover:bg-neutral-700 transition-all whitespace-nowrap z-10"
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
