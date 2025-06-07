import React, { useState } from 'react';
import { BadgeList } from '@/constants/badgeList';

const BadgeFilters = ({ filters, setFilters }) => {
  const [showBadges, setShowBadges] = useState(false);

  const update = (badgeKey) => {
    const selected = filters.badges || [];
    const newList = selected.includes(badgeKey)
      ? selected.filter((b) => b !== badgeKey)
      : [...selected, badgeKey];
    setFilters((prev) => ({ ...prev, badges: newList }));
  };

  return (
    <div>
      <button
        onClick={() => setShowBadges(!showBadges)}
        className="flex items-center justify-between w-[120px] bg-[#2a2a2a] p-2 rounded hover:bg-[#3a3a3a] transition-colors mb-2"
      >
        <h2 className="text-white text-sm font-bold">Badges</h2>
        <span>
          {showBadges ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
      </button>

      {showBadges && (
        <div className="grid grid-cols-4 gap-2 text-white text-xs">
          {BadgeList.map((badge) => (
            <label
              key={badge.key}
              className={`px-2 py-1 rounded cursor-pointer ${
                (filters.badges || []).includes(badge.key)
                  ? 'bg-yellow-500 text-black font-semibold'
                  : 'bg-[#2a2a2a] text-white/70 hover:bg-[#3a3a3a]'
              }`}
            >
              <input
                type="checkbox"
                checked={(filters.badges || []).includes(badge.key)}
                onChange={() => update(badge.key)}
                className="hidden"
              />
              {badge.icon} {badge.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default BadgeFilters;
