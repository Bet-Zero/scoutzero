import React from 'react';
import TeamLogo from '@/components/shared/TeamLogo';
import { BadgeList } from '@/constants/badgeList';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { getFilterStyles } from '@/utils/filtering';

const FilterContent = ({ filter }) => {
  const { key, value, isSubrole } = filter;

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

  if (key.toLowerCase().includes('team')) {
    return (
      <div className="flex items-center justify-center w-6 h-6">
        <TeamLogo teamAbbr={value} className="w-4 h-4" />
      </div>
    );
  }

  if (key.toLowerCase().includes('badge')) {
    const badge = BadgeList.find((b) => b.key === value);
    return badge ? (
      <span className="text-sm">{badge.icon}</span>
    ) : (
      <span className="text-white">{value}</span>
    );
  }

  if (key === 'offenseSubrole' || key === 'defenseSubrole') {
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

  const styles = getFilterStyles(key, value);
  return <span className={styles.textClass}>{value}</span>;
};

export default FilterContent;
