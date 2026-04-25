import React from 'react';
import FilterContent from './FilterContent';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { getFilterStyles } from '@/shared/utils/filtering';
import type { ActiveFilterItem } from '../../filterTypes';

type FilterPillProps = {
  filter: ActiveFilterItem;
  onRemove: () => void;
};

const FilterPill = ({ filter, onRemove }: FilterPillProps) => {
  const { key, value, isSubrole, isNonRemovable, isContext } = filter;

  // Context pills: muted styling, no remove button
  if (isContext || isNonRemovable) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1f1f1f] border border-white/10 rounded-full text-sm min-h-8 text-white/50">
        <span className="text-white/40 text-xs">{filter.label}:</span>
        <span className="text-white/60">{value}</span>
      </div>
    );
  }

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
