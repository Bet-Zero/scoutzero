import React, { useState, useRef, useCallback } from 'react';
import { BadgeList } from '@/constants/badgeList';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import type { ProfileSetter } from '../profileUiTypes';

export const BadgeSelector = ({
  badges,
  setBadges,
}: {
  badges: string[];
  setBadges: ProfileSetter<string[]>;
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const toggleBadge = (key: string) => {
    if (badges.includes(key)) {
      setBadges(badges.filter((b) => b !== key));
    } else {
      setBadges([...badges, key]);
    }
  };

  const selectedBadges = BadgeList.filter((b) => badges.includes(b.key));

  useClickOutside(
    dropdownRef,
    useCallback(() => setIsDropdownOpen(false), []),
    isDropdownOpen
  );

  return (
    <div
      ref={dropdownRef}
      className="bg-[#1f1f1f] rounded-2xl shadow-lg px-4 py-4 text-white text-sm font-medium w-full max-w-[750px] min-h-[90px]"
    >
      <button
        type="button"
        className="flex w-full justify-between items-center mb-3 cursor-pointer pl-2 text-left"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-expanded={isDropdownOpen}
        aria-controls="profile-badge-options"
      >
        <span className="font-bold">BADGES</span>
        <span aria-hidden="true">{isDropdownOpen ? '▲' : '▼'}</span>
      </button>
      <div className="flex flex-wrap gap-2">
        {selectedBadges.length > 0 ? (
          selectedBadges.map((badge) => (
            <span
              key={badge.key}
              className="flex items-center gap-1 bg-neutral-800 px-3 py-1 rounded-full text-xs"
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </span>
          ))
        ) : (
          <span className="text-neutral-300 italic text-xs">
            Click to add badges
          </span>
        )}
      </div>
      {isDropdownOpen && (
        <div
          id="profile-badge-options"
          className="mt-4 grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto"
        >
          {BadgeList.map((badge) => (
            <button
              key={badge.key}
              type="button"
              className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer text-left text-xs ${
                badges.includes(badge.key) ? 'bg-green-700' : 'bg-neutral-700'
              }`}
              aria-pressed={badges.includes(badge.key)}
              aria-label={`${badges.includes(badge.key) ? 'Remove' : 'Add'} ${badge.label} badge`}
              onClick={() => toggleBadge(badge.key)}
            >
              <span aria-hidden="true">{badge.icon}</span>
              <span>{badge.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
