/**
 * FILE: src/features/filters/ActiveFiltersDrawer.tsx
 * PURPOSE: Right-side overlay drawer displaying active filter pills.
 *          Part of Phase 2O: zero layout shift controls architecture.
 *
 * OWNERSHIP: Feature: filters
 *
 * HISTORY:
 *  - 2026-02-01: Phase 2O - Created to replace inline ActiveFiltersDisplay
 *
 * LINKS:
 *  - Return Package: docs/return_packages/SCOUTING_PLAYER_TABLE_PHASE_2O_RETURN_PACKAGE.md
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import FilterPill from './ActiveFiltersDisplay/FilterPill/FilterPill';
import { getFilterDisplayValue } from '@/shared/utils/filtering';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';
import type { PlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

/**
 * ActiveFiltersDrawer - Right-side overlay drawer for active filter management.
 *
 * @param {boolean} open - Whether drawer is visible
 * @param {function} onClose - Called to close the drawer
 * @param {object} filters - Current filter state
 * @param {function} setFilters - Filter state setter
 * @param {function} getDefaultFilters - Returns default filter values
 * @param {string[]} excludeFromDisplay - Filter keys to hide
 * @param {function} onClearFilters - Clears all filters
 */
const ActiveFiltersDrawer = ({
  open,
  onClose,
  filters,
  setFilters,
  getDefaultFilters,
  excludeFromDisplay = [],
  onClearFilters,
}) => {
  const drawerRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        onClose();
      }
    };

    // Delay to avoid immediate close from the toggle click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  const getActiveFilters = () => {
    const defaultFilters = getDefaultFilters();
    const activeFilters = [];

    // Add SalaryYear context indicator when it differs from default
    if (filters.salaryYear && filters.salaryYear !== DEFAULT_SALARY_YEAR) {
      activeFilters.push({
        key: '_salaryYearContext',
        label: 'Salary Year',
        value: String(filters.salaryYear),
        isNonRemovable: true,
        isContext: true,
      });
    }

    Object.entries(filters).forEach(([key, value]) => {
      const defaultValue = defaultFilters[key];
      if (excludeFromDisplay?.includes(key)) return;

      const isActive = JSON.stringify(value) !== JSON.stringify(defaultValue);

      if (isActive) {
        if (key === 'subRoles' && value) {
          const subRoles = value as PlayerFilters['subRoles'];
          [...(subRoles.offense || []), ...(subRoles.defense || [])].forEach(
            (item) => {
              activeFilters.push({
                key,
                label: 'Subrole',
                value: item,
                isArrayItem: true,
                isSubrole: true,
              });
            }
          );
        } else if (Array.isArray(value) && value.length > 0) {
          value.forEach((item) => {
            activeFilters.push({
              key,
              label: key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase()),
              value: item,
              isArrayItem: true,
            });
          });
        } else {
          const displayValue = getFilterDisplayValue(key, value);
          if (displayValue) {
            activeFilters.push({
              key,
              label: key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase()),
              value: displayValue,
              isArrayItem: false,
            });
          }
        }
      }
    });

    return activeFilters;
  };

  const removeFilter = (filterKey) => {
    const defaultFilters = getDefaultFilters();
    setFilters((prev) => ({
      ...prev,
      [filterKey]: defaultFilters[filterKey],
    }));
  };

  const removeSubrole = (roleToRemove) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleToRemove);
    if (!roleData) return;

    const type = roleData.type;
    setFilters((prev) => ({
      ...prev,
      subRoles: {
        ...prev.subRoles,
        [type]: prev.subRoles?.[type]?.filter((r) => r !== roleToRemove),
      },
    }));
  };

  const activeFilters = getActiveFilters();
  const hasFilters = activeFilters.length > 0;

  if (!open) return null;

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-[70]" />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-80 bg-neutral-900 border-l border-white/10 z-[71] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-white font-medium">
            Active Filters
            {hasFilters && (
              <span className="ml-2 text-sm text-white/50">
                ({activeFilters.length})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {hasFilters ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter, index) => (
                <FilterPill
                  key={`${filter.key}-${index}`}
                  filter={filter}
                  onRemove={() =>
                    filter.isSubrole
                      ? removeSubrole(filter.value)
                      : removeFilter(filter.key)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-sm text-center py-8">
              No active filters
            </div>
          )}
        </div>

        {/* Footer */}
        {hasFilters && (
          <div className="px-4 py-3 border-t border-white/10">
            <button
              onClick={() => {
                onClearFilters();
                onClose();
              }}
              className="w-full py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(drawerContent, document.body);
};

export default ActiveFiltersDrawer;
