import React, { useState, useRef, useEffect } from 'react';
import { BadgeList } from '@/constants/badgeList';

const BadgeSelector = ({ badges, setBadges }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleBadge = (key) => {
    if (badges.includes(key)) {
      setBadges(badges.filter((b) => b !== key));
    } else {
      setBadges([...badges, key]);
    }
  };

  const selectedBadges = BadgeList.filter((b) => badges.includes(b.key));

  // 🔹 Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={dropdownRef}
      className="bg-[#1f1f1f] rounded-2xl shadow-lg px-4 py-4 text-white text-sm font-medium w-full max-w-[750px] min-h-[90px]"
    >
      <div
        className="flex justify-between items-center mb-3 cursor-pointer pl-2"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <span className="font-bold">BADGES</span>
        <span>{isDropdownOpen ? '▲' : '▼'}</span>
      </div>
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
          <span className="text-neutral-500 italic text-xs">
            Click to add badges
          </span>
        )}
      </div>
      {isDropdownOpen && (
        <div className="mt-4 grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
          {BadgeList.map((badge) => (
            <div
              key={badge.key}
              className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer text-xs ${
                badges.includes(badge.key) ? 'bg-green-700' : 'bg-neutral-700'
              }`}
              onClick={() => toggleBadge(badge.key)}
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BadgeSelector;
