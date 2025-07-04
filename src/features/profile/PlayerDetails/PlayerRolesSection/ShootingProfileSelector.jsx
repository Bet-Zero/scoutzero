import React, { useState, useEffect } from 'react';

const SHOOTING_TIERS = [
  {
    label: 'Elite',
    border: 'border-green-500',
    text: 'text-green-500',
  },
  {
    label: 'Plus',
    border: 'border-lime-400',
    text: 'text-lime-400',
  },
  {
    label: 'Capable',
    border: 'border-yellow-400',
    text: 'text-yellow-400',
  },
  {
    label: 'Willing',
    border: 'border-orange-400',
    text: 'text-orange-400',
  },
  {
    label: 'Hesitant',
    border: 'border-orange-600',
    text: 'text-orange-600',
  },
  {
    label: 'Non',
    border: 'border-red-600',
    text: 'text-red-600',
  },
];

const ShootingProfileSelector = ({ value, onChange }) => {
  const [selected, setSelected] = useState('');

  // Sync selection on prop change (e.g. when switching players)
  useEffect(() => {
    setSelected(value || '');
  }, [value]);

  const handleSelect = (label) => {
    setSelected(label);
    if (onChange) onChange(label);
  };

  return (
    <div className="flex justify-between gap-1 w-full max-w-[100%] mt-3 px-1">
      {SHOOTING_TIERS.map(({ label, border, text }) => {
        const isSelected = selected === label;
        const classes = `
          flex-1 cursor-pointer text-xs font-bold py-2 px-1 rounded-md text-center transition-all border
          ${isSelected ? `${border} ${text}` : `border-gray-500 text-gray-500`}
          bg-transparent hover:bg-neutral-800
        `;

        return (
          <div
            key={label}
            onClick={() => handleSelect(label)}
            className={classes}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

export default ShootingProfileSelector;
