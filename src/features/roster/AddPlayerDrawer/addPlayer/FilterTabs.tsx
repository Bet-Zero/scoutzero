import React, { useState } from 'react';
import BasicFilters from './BasicFilters';
import RolesFilters from './RolesFilters';
import ContractFilters from './ContractFilters';
import PhysicalFilters from './PhysicalFilters';
import StatsFilters from './StatsFilters';
import { getDefaultAddPlayerFilters } from '@/shared/utils/filtering';
import { X } from 'lucide-react';

const TABS = [
  { id: 'basic',    label: 'Basic',    accent: 'border-blue-500'   },
  { id: 'roles',    label: 'Roles',    accent: 'border-green-500'  },
  { id: 'contract', label: 'Contract', accent: 'border-indigo-500' },
  { id: 'bio',      label: 'Bio',      accent: 'border-amber-500'  },
  { id: 'stats',    label: 'Stats',    accent: 'border-cyan-500'   },
];

const FilterTabs = ({ filters, setFilters, onCloseFilters }) => {
  const [activeTab, setActiveTab] = useState('basic');

  return (
    <div className="border-b border-white/10">
      <div className="flex border-b border-white/10 text-xs">
        {TABS.map(({ id, label, accent }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 font-medium ${
              activeTab === id
                ? `text-white border-b-2 ${accent}`
                : 'text-white/50 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-[180px] overflow-y-auto">
        {activeTab === 'basic'    && <BasicFilters    filters={filters} setFilters={setFilters} />}
        {activeTab === 'roles'    && <RolesFilters    filters={filters} setFilters={setFilters} />}
        {activeTab === 'contract' && <ContractFilters filters={filters} setFilters={setFilters} />}
        {activeTab === 'bio'      && <PhysicalFilters filters={filters} setFilters={setFilters} />}
        {activeTab === 'stats'    && <StatsFilters    filters={filters} setFilters={setFilters} />}
      </div>

      <div className="p-2 border-t border-white/10 flex gap-2">
        <button
          onClick={() => setFilters(getDefaultAddPlayerFilters())}
          className="flex-1 py-1 bg-[#222] text-white/70 hover:text-white rounded text-xs"
        >
          Clear All Filters
        </button>
        <button
          onClick={onCloseFilters}
          className="flex-1 py-1 bg-[#333] text-white/70 hover:text-white rounded text-xs flex items-center justify-center gap-1"
        >
          <X size={14} /> Close
        </button>
      </div>
    </div>
  );
};

export default FilterTabs;
