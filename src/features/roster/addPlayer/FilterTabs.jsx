import React, { useState } from 'react';
import BasicFilters from './BasicFilters';
import RolesFilters from './RolesFilters';
import ContractFilters from './ContractFilters';
import { getDefaultAddPlayerFilters } from '@/utils/filtering';
import { X } from 'lucide-react'; // Import the close icon

const FilterTabs = ({ filters, setFilters, onCloseFilters }) => {
  // Added onCloseFilters prop
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

      <div className="max-h-[300px] overflow-y-auto">
        {activeTab === 'basic' && (
          <BasicFilters filters={filters} setFilters={setFilters} />
        )}
        {activeTab === 'roles' && (
          <RolesFilters filters={filters} setFilters={setFilters} />
        )}
        {activeTab === 'contract' && (
          <ContractFilters filters={filters} setFilters={setFilters} />
        )}
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
