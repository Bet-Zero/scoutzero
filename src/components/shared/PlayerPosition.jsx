// PlayerPosition.jsx
import React from 'react';

const positionAbbreviations = {
  Guard: 'G',
  'Point Guard': 'PG',
  'Shooting Guard': 'SG',
  Forward: 'F',
  'Small Forward': 'SF',
  'Power Forward': 'PF',
  Center: 'C',
  'Forward-Center': 'F/C',
  'Guard-Forward': 'G/F',
  'Forward-Guard': 'F',
  'Center-Forward': 'C',
};

const getAbbreviatedPosition = (position) => {
  if (!position) return 'N/A';
  return positionAbbreviations[position] || position;
};

const PlayerPosition = ({ position = 'N/A', className = '' }) => {
  return (
    <span className={`text-black font-semibold ${className}`}>
      {getAbbreviatedPosition(position)}
    </span>
  );
};

export default PlayerPosition;
