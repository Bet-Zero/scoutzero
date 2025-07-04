import React from 'react';
import FilterContent from './FilterContent';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { getFilterStyles } from '@/utils/filtering';

const FilterPill = ({ filter, onRemove }) => {
  const { key, value, isSubrole } = filter;

  if (isSubrole) {
    const roleData = SubRoleMasterList.find((r) => r.name === value);
    const roleType = roleData?.type;
    const borderColor =
      roleType === 'offense' ? 'border-purple-500' : 'border-blue-500';

    return (
      <div
        className={`inline-flex items-center gap-2 px-2 py-1 bg-[#2a2a2a] rounded-full text-sm border ${borderColor}`}
      >
        <FilterContent filter={filter} />
        <button
          onClick={onRemove}
          className="ml-1 text-white/50 hover:text-white/80 text-lg leading-none"
          title="Remove filter"
        >
          ×
        </button>
      </div>
    );
  }

  if (key === 'offenseSubrole' || key === 'defenseSubrole') {
    const bgColor =
      key === 'offenseSubrole'
        ? 'bg-purple-900/40 border-purple-500'
        : 'bg-blue-900/40 border-blue-500';

    return (
      <div
        className={`inline-flex items-center gap-2 px-2 py-1 ${bgColor} border rounded-full text-sm`}
      >
        <FilterContent filter={filter} />
        <button
          onClick={onRemove}
          className="ml-1 text-white/50 hover:text-white/80 text-lg leading-none"
          title="Remove filter"
        >
          ×
        </button>
      </div>
    );
  }

  const styles = getFilterStyles(key, value);
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 ${styles.bgClass} border ${styles.borderClass} rounded-full text-sm min-h-8`}
    >
      <FilterContent filter={filter} />
      <button
        onClick={onRemove}
        className="ml-1 text-white/50 hover:text-white/80 text-lg leading-none"
        title="Remove filter"
      >
        ×
      </button>
    </div>
  );
};

export default FilterPill;
