import React from 'react';
import { BadgeList } from '@/constants/badgeList';

const BadgeMini = ({ badges = [] }) => {
  if (!badges.length) return null;

  const displayBadges = BadgeList.filter((b) => badges.includes(b.key));

  return (
    <div className="rounded-xs bg-neutral-900 p-1 border border-black shadow-sm">
      <div className="flex gap-[6px] pt-[4px] pb-1 border-l-2 border-neutral-500 pl-3">
        {displayBadges.map(({ key, label, icon }) => (
          <div
            key={key}
            title={label}
            className="w-7 h-7 flex items-center justify-center rounded-[4px] border border-neutral-500 text-[14px] shadow-md hover:scale-[1.08] transition-transform"
          >
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BadgeMini;
