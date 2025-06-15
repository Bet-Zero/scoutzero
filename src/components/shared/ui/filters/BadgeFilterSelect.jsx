import React, { useState } from 'react';
import { BadgeList } from '@/constants/badgeList';

const BadgeFilterSelect = ({
  selected = [],
  onChange,
  buttonClass = 'flex items-center justify-between bg-[#2a2a2a] p-2 rounded hover:bg-[#3a3a3a] transition-colors mb-2',
  gridClass = 'grid gap-2',
  label = 'Badges',
  labelClass = '',
  badgeClass = 'px-2 py-1 rounded cursor-pointer',
  selectedBadgeClass = 'bg-yellow-500 text-black font-semibold',
  unselectedBadgeClass = 'bg-[#2a2a2a] text-white/70 hover:bg-[#3a3a3a]',
  cols = 4,
  iconSize = 'h-4 w-4',
}) => {
  const [open, setOpen] = useState(false);

  const toggle = (key) => {
    const updated = selected.includes(key)
      ? selected.filter((b) => b !== key)
      : [...selected, key];
    onChange(updated);
  };

  return (
    <div>
      <button onClick={() => setOpen(!open)} className={`${buttonClass}`}>
        <span className={`${labelClass}`}>{label}</span>
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={iconSize}
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
            className={iconSize}
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
      </button>
      {open && (
        <div className={`${gridClass}`}>
          {BadgeList.map((badge) => (
            <label
              key={badge.key}
              className={`${badgeClass} ${
                selected.includes(badge.key)
                  ? selectedBadgeClass
                  : unselectedBadgeClass
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(badge.key)}
                onChange={() => toggle(badge.key)}
                className="hidden"
              />
              <span className="mr-1">{badge.icon}</span>
              <span>{badge.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default BadgeFilterSelect;
