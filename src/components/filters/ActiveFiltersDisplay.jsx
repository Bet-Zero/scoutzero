// ActiveFiltersDisplay.jsx
import React from 'react';
import TeamLogo from '@/components/shared/TeamLogo';
import { BadgeList } from '@/constants/badgeList';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

const ActiveFiltersDisplay = ({
  filters,
  setFilters,
  getDefaultFilters,
  excludeFromDisplay = [],
}) => {
  // Helper function to convert inches to feet'inches" format
  const inchesToFeetInches = (inches) => {
    if (inches === 0 || inches === null || inches === undefined) return '0\'0"';
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  // Helper function to get display value for a filter
  const getFilterDisplayValue = (key, value) => {
    // Stat abbreviations mapping
    const statAbbreviations = {
      PPG: 'ppg',
      RPG: 'rpg',
      APG: 'apg',
      FGP: 'fg%',
      TPP: '3p%',
      FTP: 'ft%',
      eFGP: 'efg%',
      MIN: 'min',
      G: 'games',
      Defense: 'def',
      Energy: 'energy',
      Feel: 'feel',
      IQ: 'iq',
      Passing: 'pass',
      Playmaking: 'play',
      Rebounding: 'reb',
      Shooting: 'shot',
    };

    // Handle stat filters (add inequality and abbreviation)
    if (key.startsWith('min_') || key.startsWith('max_')) {
      const statKey = key.split('_')[1]; // Gets the stat part after min_/max_
      const abbreviation = statAbbreviations[statKey] || '';
      const symbol = key.startsWith('min_') ? '≥ ' : '≤ ';

      // Special handling for percentage stats
      if (['FGP', 'TPP', 'FTP', 'eFGP'].includes(statKey)) {
        return `${symbol}${value}% ${abbreviation}`;
      }
      return `${symbol}${value} ${abbreviation}`;
    }

    // Handle height filters (convert inches to feet'inches" and add inequality symbol)
    if (key === 'minHeight') {
      return value !== null && value !== undefined
        ? `≥ ${inchesToFeetInches(value)}`
        : '';
    }
    if (key === 'maxHeight') {
      return value !== null && value !== undefined
        ? `≤ ${inchesToFeetInches(value)}`
        : '';
    }

    // Handle weight filters (add "lbs" and inequality symbol)
    if (key === 'minWeight') {
      return value !== null && value !== undefined ? `≥ ${value} lbs` : '';
    }
    if (key === 'maxWeight') {
      return value !== null && value !== undefined ? `≤ ${value} lbs` : '';
    }

    // Handle age filters (add "y/o" and inequality symbol)
    if (key === 'minAge') {
      return value !== null && value !== undefined ? `≥ ${value} y/o` : '';
    }
    if (key === 'maxAge') {
      return value !== null && value !== undefined ? `≤ ${value} y/o` : '';
    }

    if (Array.isArray(value) && value.length > 0) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      // Handle range objects like { min: 20, max: 30 }
      if (value.min !== undefined && value.max !== undefined) {
        return `${value.min} - ${value.max}`;
      }
      // Handle subRoles object
      if (key === 'subRoles') {
        return [...(value.offense || []), ...(value.defense || [])].join(', ');
      }
    }
    if (value !== '' && value !== null && value !== undefined) {
      return String(value);
    }
    return null;
  };

  // Helper function to get color styling for filters
  const getFilterStyles = (key, value) => {
    const defaultStyles = {
      bgClass: 'bg-[#2a2a2a]',
      borderClass: 'border-white/20',
      textClass: 'text-white',
    };

    // Role colors (offense = purple, defense = blue)
    if (key.toLowerCase().includes('offense') || key === 'offenseRole') {
      return {
        bgClass: 'bg-purple-900/40',
        borderClass: 'border-purple-500',
        textClass: 'text-white/80',
      };
    }
    if (key.toLowerCase().includes('defense') || key === 'defenseRole') {
      return {
        bgClass: 'bg-blue-900/40',
        borderClass: 'border-blue-500',
        textClass: 'text-white/80',
      };
    }

    // Shooting profile colors
    if (key.toLowerCase().includes('shooting')) {
      const shootingTiers = {
        Elite: { borderClass: 'border-green-500', textClass: 'text-green-500' },
        Plus: { borderClass: 'border-lime-400', textClass: 'text-lime-400' },
        Capable: {
          borderClass: 'border-yellow-400',
          textClass: 'text-yellow-400',
        },
        Willing: {
          borderClass: 'border-orange-400',
          textClass: 'text-orange-400',
        },
        Hesitant: {
          borderClass: 'border-orange-600',
          textClass: 'text-orange-600',
        },
        Non: { borderClass: 'border-red-600', textClass: 'text-red-600' },
      };
      const cleaned = String(value).replace('Shooter', '').trim();
      return shootingTiers[cleaned] || defaultStyles;
    }

    // Grade colors (overall grade, trait grades)
    if (
      key.toLowerCase().includes('grade') ||
      key.toLowerCase().includes('overall')
    ) {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        if (numValue >= 98)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-green-600',
            textClass: 'text-green-600',
          };
        if (numValue >= 94)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-green-500',
            textClass: 'text-green-500',
          };
        if (numValue >= 91)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-green-400',
            textClass: 'text-green-400',
          };
        if (numValue >= 86)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-emerald-400',
            textClass: 'text-emerald-400',
          };
        if (numValue >= 80)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-emerald-300',
            textClass: 'text-emerald-300',
          };
        if (numValue >= 73)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-teal-200',
            textClass: 'text-teal-200',
          };
        if (numValue >= 66)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-gray-300',
            textClass: 'text-gray-300',
          };
        if (numValue >= 56)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-red-200',
            textClass: 'text-red-200',
          };
        if (numValue >= 46)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-red-300',
            textClass: 'text-red-300',
          };
        if (numValue >= 41)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-red-400',
            textClass: 'text-red-400',
          };
        if (numValue >= 36)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-red-500',
            textClass: 'text-red-500',
          };
        if (numValue >= 26)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-red-600',
            textClass: 'text-red-600',
          };
        if (numValue >= 16)
          return {
            bgClass: 'bg-[#2a2a2a]',
            borderClass: 'border-red-700',
            textClass: 'text-red-700',
          };
      }
    }

    // Trait grade colors (same as overall grade)
    if (key.startsWith('min_') || key.startsWith('max_')) {
      const statKey = key.split('_')[1];
      if (
        [
          'Defense',
          'Energy',
          'Feel',
          'IQ',
          'Passing',
          'Playmaking',
          'Rebounding',
          'Shooting',
        ].includes(statKey)
      ) {
        const numValue = parseInt(value);
        if (!isNaN(numValue)) {
          if (numValue >= 98)
            return {
              borderClass: 'border-green-600',
              textClass: 'text-green-600',
            };
          if (numValue >= 94)
            return {
              borderClass: 'border-green-500',
              textClass: 'text-green-500',
            };
          if (numValue >= 91)
            return {
              borderClass: 'border-green-400',
              textClass: 'text-green-400',
            };
          if (numValue >= 86)
            return {
              borderClass: 'border-emerald-400',
              textClass: 'text-emerald-400',
            };
          if (numValue >= 80)
            return {
              borderClass: 'border-emerald-300',
              textClass: 'text-emerald-300',
            };
          if (numValue >= 73)
            return {
              borderClass: 'border-teal-200',
              textClass: 'text-teal-200',
            };
          if (numValue >= 66)
            return {
              borderClass: 'border-gray-300',
              textClass: 'text-gray-300',
            };
          if (numValue >= 56)
            return { borderClass: 'border-red-200', textClass: 'text-red-200' };
          if (numValue >= 46)
            return { borderClass: 'border-red-300', textClass: 'text-red-300' };
          if (numValue >= 41)
            return { borderClass: 'border-red-400', textClass: 'text-red-400' };
          if (numValue >= 36)
            return { borderClass: 'border-red-500', textClass: 'text-red-500' };
          if (numValue >= 26)
            return { borderClass: 'border-red-600', textClass: 'text-red-600' };
          if (numValue >= 16)
            return { borderClass: 'border-red-700', textClass: 'text-red-700' };
        }
      }
    }

    // Contract option colors - Fixed logic
    if (key.toLowerCase().includes('option')) {
      const valueStr = String(value).toLowerCase();
      if (valueStr.includes('player')) {
        return {
          bgClass: 'bg-green-900/40',
          borderClass: 'border-green-500',
          textClass: 'text-green-500',
        };
      }
      if (valueStr.includes('team')) {
        return {
          bgClass: 'bg-orange-900/40',
          borderClass: 'border-orange-400',
          textClass: 'text-orange-400',
        };
      }
    }

    // Free agent status colors - Fixed logic
    if (
      key.toLowerCase().includes('status') ||
      key.toLowerCase().includes('fa')
    ) {
      const valueStr = String(value).toLowerCase();
      if (valueStr.includes('ufa')) {
        return {
          bgClass: 'bg-blue-600/40',
          borderClass: 'border-blue-600',
          textClass: 'text-blue-400',
        };
      }
      if (valueStr.includes('rfa')) {
        return {
          bgClass: 'bg-purple-600/40',
          borderClass: 'border-purple-600',
          textClass: 'text-purple-400',
        };
      }
    }

    return defaultStyles;
  };

  // Get all active filters
  const getActiveFilters = () => {
    const defaultFilters = getDefaultFilters();
    const activeFilters = [];

    Object.entries(filters).forEach(([key, value]) => {
      const defaultValue = defaultFilters[key];
      if (excludeFromDisplay?.includes(key)) return;

      // Check if this filter is different from default
      const isActive = JSON.stringify(value) !== JSON.stringify(defaultValue);

      if (isActive) {
        // Handle subRoles object
        if (key === 'subRoles' && value) {
          [...(value.offense || []), ...(value.defense || [])].forEach(
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
        }
        // Handle arrays by creating separate pills for each item
        else if (Array.isArray(value) && value.length > 0) {
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

  // Remove a specific filter
  const removeFilter = (filterKey) => {
    const defaultFilters = getDefaultFilters();
    setFilters((prev) => ({
      ...prev,
      [filterKey]: defaultFilters[filterKey],
    }));
  };

  // Remove a specific subrole
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

  const renderFilterContent = (filter) => {
    const { key, value, isSubrole } = filter;

    // Handle subroles
    if (isSubrole) {
      const roleData = SubRoleMasterList.find((r) => r.name === value);
      const isPositive = roleData?.isPositive === true;

      return (
        <div className="flex items-center gap-1 px-2 py-[1px] rounded-md">
          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
            {isPositive ? '✓' : '✗'}
          </span>
          <span className="text-white truncate">{value}</span>
        </div>
      );
    }

    // Update the TeamLogo rendering in renderFilterContent:
    if (key.toLowerCase().includes('team')) {
      return (
        <div className="flex items-center justify-center w-6 h-6">
          <TeamLogo
            teamAbbr={value}
            className="w-4 h-4" // Exact logo dimensions
          />
        </div>
      );
    }

    // Handle badge filters with emoji icons
    if (key.toLowerCase().includes('badge')) {
      const badge = BadgeList.find((b) => b.key === value);
      return badge ? (
        <span className="text-sm">{badge.icon}</span>
      ) : (
        <span className="text-white">{value}</span>
      );
    }

    // Handle subroles (offenseSubrole/defenseSubrole) with special formatting
    if (key === 'offenseSubrole' || key === 'defenseSubrole') {
      // Determine if this is a positive or negative role indicator
      const roleData = {
        isPositive:
          !value.toLowerCase().includes('non') &&
          !value.toLowerCase().includes('weak') &&
          !value.toLowerCase().includes('poor'),
      };

      return (
        <div className="flex items-center gap-1 px-2 py-[1px] rounded-md bg-[#2a2a2a]">
          <span
            className={roleData.isPositive ? 'text-green-500' : 'text-red-500'}
          >
            {roleData.isPositive ? '✓' : '✗'}
          </span>
          <span className="text-white truncate">{value}</span>
        </div>
      );
    }

    // Default text display for regular roles and other filters
    const styles = getFilterStyles(key, value);
    return <span className={styles.textClass}>{value}</span>;
  };

  const activeFilters = getActiveFilters();

  if (activeFilters.length === 0) return null;

  return (
    <div className="w-full max-w-[1100px] mx-auto mt-4">
      <div className="mb-4 p-3 bg-[#1a1a1a] border border-white/10 rounded-md">
        <div className="flex justify-end h-0">
          <button
            onClick={() => setFilters(getDefaultFilters())}
            className="text-xs text-white/50 hover:text-white/80 underline"
          >
            Clear All
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter, index) => {
            // For subroles, apply special styling
            if (filter.isSubrole) {
              const roleData = SubRoleMasterList.find(
                (r) => r.name === filter.value
              );
              const roleType = roleData?.type; // 'offense' or 'defense'

              return (
                <div
                  key={`${filter.key}-${index}`}
                  className={`inline-flex items-center gap-2 px-2 py-1 bg-[#2a2a2a] rounded-full text-sm border ${
                    roleType === 'offense'
                      ? 'border-purple-500'
                      : 'border-blue-500'
                  }`}
                >
                  {renderFilterContent(filter)}
                  <button
                    onClick={() => removeSubrole(filter.value)}
                    className="ml-1 text-white/50 hover:text-white/80 text-lg leading-none"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              );
            }

            // For subroles (offenseSubrole/defenseSubrole), apply special styling with the internal formatting
            if (
              filter.key === 'offenseSubrole' ||
              filter.key === 'defenseSubrole'
            ) {
              // Determine if positive/negative for background color
              const roleData = SubRoleMasterList.find(
                (r) => r.name === filter.value
              );
              const isPositive = roleData?.isPositive === true;

              const bgColor =
                filter.key === 'offenseSubrole'
                  ? 'bg-purple-900/40 border-purple-500'
                  : 'bg-blue-900/40 border-blue-500';

              return (
                <div
                  key={`${filter.key}-${index}`}
                  className={`inline-flex items-center gap-2 px-2 py-1 ${bgColor} border rounded-full text-sm`}
                >
                  {renderFilterContent(filter)}
                  <button
                    onClick={() => removeFilter(filter.key)}
                    className="ml-1 text-white/50 hover:text-white/80 text-lg leading-none"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              );
            }

            // For all other filters (including teams), use the normal pill styling
            const styles = getFilterStyles(filter.key, filter.value);
            return (
              <div
                key={`${filter.key}-${index}`}
                className={`inline-flex items-center gap-2 px-3 py-1 ${styles.bgClass} border ${styles.borderClass} rounded-full text-sm min-h-8`} // min-h-8 instead of h-8
              >
                {renderFilterContent(filter)}
                <button
                  onClick={() => removeFilter(filter.key)}
                  className="ml-1 text-white/50 hover:text-white/80 text-lg leading-none"
                  title="Remove filter"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActiveFiltersDisplay;
