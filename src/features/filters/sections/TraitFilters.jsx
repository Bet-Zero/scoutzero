import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const TraitFilters = ({ filters, setFilters }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addedFilters, setAddedFilters] = useState(new Set()); // ✅ TRACK user-added filters only
  const [newFilter, setNewFilter] = useState({
    trait: 'Shooting',
    operator: '>=',
    value: '',
  });

  const traitOptions = [
    'Shooting',
    'Passing',
    'Playmaking',
    'Rebounding',
    'Defense',
    'IQ',
    'Feel',
    'Energy',
  ];

  const getActiveTraitFilters = () => {
    const activeFilters = [];
    Object.keys(filters).forEach((key) => {
      if (
        (key.startsWith('min_') || key.startsWith('max_')) &&
        addedFilters.has(key)
      ) {
        const traitName = key.replace('min_', '').replace('max_', '');
        if (traitOptions.includes(traitName)) {
          const operator = key.startsWith('min_') ? '>=' : '<=';
          const value = filters[key];
          if (typeof value === 'number' && !isNaN(value)) {
            activeFilters.push({
              key,
              trait: traitName,
              operator,
              value,
              fullKey: key,
            });
          }
        }
      }
    });
    return activeFilters;
  };

  const addFilter = () => {
    if (newFilter.value === '') return;

    const prefix = newFilter.operator === '>=' ? 'min_' : 'max_';
    const filterKey = `${prefix}${newFilter.trait}`;

    setFilters((prev) => ({
      ...prev,
      [filterKey]: parseInt(newFilter.value),
    }));

    // ✅ Mark it as user-added so it gets tracked for display
    setAddedFilters((prev) => new Set([...prev, filterKey]));

    setNewFilter({ trait: 'Shooting', operator: '>=', value: '' });
    setShowAddForm(false);
  };

  const removeFilter = (filterKey) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];
      return newFilters;
    });

    setAddedFilters((prev) => {
      const newSet = new Set(prev);
      newSet.delete(filterKey);
      return newSet;
    });
  };

  const activeFilters = getActiveTraitFilters();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-bold">Trait Grades</h2>
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
              <label className="text-white mb-1 block">Trait</label>
              <select
                value={newFilter.trait}
                onChange={(e) =>
                  setNewFilter((prev) => ({ ...prev, trait: e.target.value }))
                }
                className="w-full bg-[#2a2a2a] text-white p-1 rounded"
              >
                {traitOptions.map((trait) => (
                  <option key={trait} value={trait}>
                    {trait}
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
              <label className="text-white mb-1 block">Grade</label>
              <input
                type="number"
                value={newFilter.value}
                onChange={(e) =>
                  setNewFilter((prev) => ({ ...prev, value: e.target.value }))
                }
                className="w-full bg-[#2a2a2a] text-white p-1 rounded"
                placeholder="1-10"
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
                {filter.trait} {filter.operator} {filter.value}
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

export default TraitFilters;
