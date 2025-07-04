// components/PlayerTraitsMiniGrid.jsx
import React from 'react';

const TRAIT_ORDER = [
  'Shooting',
  'Passing',
  'Playmaking',
  'Rebounding',
  'Defense',
  'IQ',
  'Feel',
  'Energy',
];

const getTraitColor = (rating) => {
  if (rating >= 98) return '#13895b';
  if (rating >= 94) return '#369972';
  if (rating >= 91) return '#55b48f';
  if (rating >= 86) return '#6cbd9d';
  if (rating >= 80) return '#8bc8b0';
  if (rating >= 73) return '#bce6df';
  if (rating >= 66) return '#d9efe6';
  if (rating >= 56) return '#efd9d9';
  if (rating >= 46) return '#e6bcbc';
  if (rating >= 41) return '#c88b8b';
  if (rating >= 36) return '#bd6c6c';
  if (rating >= 26) return '#b45555';
  if (rating >= 16) return '#993636';
  return '#891313';
};

const PlayerTraitsMiniGrid = ({ traits }) => {
  return (
    <div className="w-[186px] rounded-md p-[2px] pr-2 mt-1 mr-[4px] shadow-lg">
      <div className="grid grid-cols-2 gap-2 mt-1">
        {TRAIT_ORDER.map((trait) => {
          const value = traits[trait];
          const isUngraded = typeof value !== 'number' || value <= 0;
          const color = isUngraded ? '#171717' : getTraitColor(value);
          const display = isUngraded ? '—' : value;
          const borderClass = isUngraded ? 'border border-black' : '';
          return (
            <div
              key={trait}
              className={`flex items-center justify-between text-[10px] font-semibold px-1.5 py-2 rounded-lg ${borderClass}`}
              style={{
                backgroundColor: color,
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
              }}
            >
              <span className="text-black">{trait}</span>
              <span className="text-black">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(PlayerTraitsMiniGrid);
