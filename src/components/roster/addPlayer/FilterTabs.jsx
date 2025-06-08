import React, { useState } from 'react';
import BasicFilters from './BasicFilters';
import RolesFilters from './RolesFilters';
import ContractFilters from './ContractFilters';
import { getDefaultAddPlayerFilters } from '@/utils/addPlayerUtils.js';

const FilterTabs = ({ filters, setFilters }) => {
  const [activeTab, setActiveTab] = useState('basic');

  return (
    <div className="border-b border-white/10">
      <div className="flex border-b border-white/10 text-xs">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 py-2 font-medium ${
            activeTab === 'basic'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-white/50 hover:text-white'
          }`}
        >
          Basic
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex-1 py-2 font-medium ${
            activeTab === 'roles'
              ? 'text-white border-b-2 border-green-500'
              : 'text-white/50 hover:text-white'
          }`}
        >
          Roles
        </button>
        <button
          onClick={() => setActiveTab('contract')}
          className={`flex-1 py-2 font-medium ${
            activeTab === 'contract'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-white/50 hover:text-white'
          }`}
        >
          Contract
        </button>
      </div>

      {activeTab === 'basic' && (
        <BasicFilters filters={filters} setFilters={setFilters} />
      )}
      {activeTab === 'roles' && (
        <RolesFilters filters={filters} setFilters={setFilters} />
      )}
      {activeTab === 'contract' && (
        <ContractFilters filters={filters} setFilters={setFilters} />
      )}

      <div className="p-2 border-t border-white/10">
        <button
          onClick={() => setFilters(getDefaultAddPlayerFilters())}
          className="w-full py-1 bg-[#222] text-white/70 hover:text-white rounded text-xs"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
};

export default FilterTabs;
