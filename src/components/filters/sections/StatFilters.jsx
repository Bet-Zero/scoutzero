import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const StatFilters = ({ filters, setFilters }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFilter, setNewFilter] = useState({
    stat: 'PPG',
    operator: '>=',
    value: '',
  });

  const statOptions = [
    { label: 'PPG', key: 'PPG' },
    { label: 'RPG', key: 'RPG' },
    { label: 'APG', key: 'APG' },
    { label: 'FG%', key: 'FGP' },
    { label: '3PT%', key: 'TPP' },
    { label: 'FT%', key: 'FTP' },
    { label: 'eFG%', key: 'eFGP' },
    { label: 'MIN', key: 'MIN' },
    { label: 'G', key: 'G' },
  ];

  const getActiveStatFilters = () => {
    const activeFilters = [];
    const validStatKeys = statOptions.map((s) => s.key);

    Object.keys(filters).forEach((key) => {
      if (key.startsWith('min_') || key.startsWith('max_')) {
        const statKey = key.replace('min_', '').replace('max_', '');
        // Only include if it's a valid stat key and has a meaningful value
        if (validStatKeys.includes(statKey)) {
          const statLabel = statOptions.find((s) => s.key === statKey)?.label;
          const operator = key.startsWith('min_') ? '>=' : '<=';
          const value = filters[key];
          // Only show filters that are explicitly set and meaningful
          // Don't show default values like 0 for minimums or very high values for maximums
          if (typeof value === 'number' && !isNaN(value)) {
            // For minimum filters, only show if greater than 0
            // For maximum filters, only show if it's a reasonable limit (not default high values)
            const isMinFilter = key.startsWith('min_');
            const isMaxFilter = key.startsWith('max_');

            if (
              (isMinFilter && value > 0) ||
              (isMaxFilter && value < getDefaultMaxValue(statKey))
            ) {
              activeFilters.push({
                key,
                stat: statLabel,
                operator,
                value,
                fullKey: key,
              });
            }
          }
        }
      }
    });
    return activeFilters;
  };

  const getDefaultMaxValue = (statKey) => {
    // Return reasonable default max values to detect when a max filter is actually set
    const defaults = {
      PPG: 50,
      RPG: 20,
      APG: 20,
      FGP: 100,
      TPP: 100,
      FTP: 100,
      eFGP: 100,
      MIN: 48,
      G: 82,
    };
    return defaults[statKey] || 100;
  };

  const addFilter = () => {
    if (newFilter.value === '') return;

    const prefix = newFilter.operator === '>=' ? 'min_' : 'max_';
    const statKey = statOptions.find((s) => s.label === newFilter.stat)?.key;
    const filterKey = `${prefix}${statKey}`;

    setFilters((prev) => ({
      ...prev,
      [filterKey]: parseFloat(newFilter.value),
    }));

    setNewFilter({ stat: 'PPG', operator: '>=', value: '' });
    setShowAddForm(false);
  };

  const removeFilter = (filterKey) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];
      return newFilters;
    });
  };

  const activeFilters = getActiveStatFilters();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-bold">Stats</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition-colors"
        >
          <Plus size={12} />
          Add Filter
        </button>
      </div>

      {showAddForm && (
        <div className="bg-[#333] p-3 rounded mb-3">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <label className="text-white mb-1 block">Stat</label>
              <select
                value={newFilter.stat}
                onChange={(e) =>
                  setNewFilter((prev) => ({ ...prev, stat: e.target.value }))
                }
                className="w-full bg-[#2a2a2a] text-white p-1 rounded"
              >
                {statOptions.map((stat) => (
                  <option key={stat.key} value={stat.label}>
                    {stat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white mb-1 block">Condition</label>
              <select
                value={newFilter.operator}
                onChange={(e) =>
                  setNewFilter((prev) => ({
                    ...prev,
                    operator: e.target.value,
                  }))
                }
                className="w-full bg-[#2a2a2a] text-white p-1 rounded"
              >
                <option value=">=">&gt;= (Min)</option>
                <option value="<=">&lt;= (Max)</option>
              </select>
            </div>
            <div>
              <label className="text-white mb-1 block">Value</label>
              <input
                type="text"
                value={newFilter.value}
                onChange={(e) =>
                  setNewFilter((prev) => ({ ...prev, value: e.target.value }))
                }
                className="w-full bg-[#2a2a2a] text-white p-1 rounded"
                placeholder="0"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addFilter}
                disabled={!newFilter.value}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs p-1 rounded transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="space-y-2">
          {activeFilters.map((filter, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-[#333] p-2 rounded text-xs"
            >
              <span className="text-white">
                {filter.stat} {filter.operator} {filter.value}
              </span>
              <button
                onClick={() => removeFilter(filter.fullKey)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatFilters;
