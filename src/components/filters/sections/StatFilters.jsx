import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { statOptions, getActiveStatFilters } from '@/utils/filtering';

const AddFilterForm = ({ newFilter, setNewFilter, onAdd }) => {
  const { stat, operator, value } = newFilter;

  return (
    <div className="bg-[#333] p-3 rounded mb-3">
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <label className="text-white mb-1 block">Stat</label>
          <select
            value={stat}
            onChange={(e) =>
              setNewFilter((prev) => ({ ...prev, stat: e.target.value }))
            }
            className="w-full bg-[#2a2a2a] text-white p-1 rounded"
          >
            {statOptions.map(({ key, label }) => (
              <option key={key} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-white mb-1 block">Condition</label>
          <select
            value={operator}
            onChange={(e) =>
              setNewFilter((prev) => ({ ...prev, operator: e.target.value }))
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
            value={value}
            onChange={(e) =>
              setNewFilter((prev) => ({ ...prev, value: e.target.value }))
            }
            className="w-full bg-[#2a2a2a] text-white p-1 rounded"
            placeholder="0"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={onAdd}
            disabled={!value}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs p-1 rounded transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

const ActiveFiltersList = ({ activeFilters, removeFilter }) => {
  if (activeFilters.length === 0) return null;

  return (
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
  );
};

const StatFilters = ({ filters, setFilters }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFilter, setNewFilter] = useState({
    stat: 'PPG',
    operator: '>=',
    value: '',
  });

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

  const activeFilters = getActiveStatFilters(filters);

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
        <AddFilterForm
          newFilter={newFilter}
          setNewFilter={setNewFilter}
          onAdd={addFilter}
        />
      )}

      <ActiveFiltersList
        activeFilters={activeFilters}
        removeFilter={removeFilter}
      />
    </div>
  );
};

export default StatFilters;
