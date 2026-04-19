// PlayerPosition.tsx
import React from 'react';
import { POSITION_MAP } from '@/shared/utils/roles';

const getAbbreviatedPosition = (position) => {
  if (!position) return 'N/A';
  return POSITION_MAP[position] || position;
};

const PlayerPosition = ({ position = 'N/A', className = '' }) => {
  return (
    <span className={`text-black font-semibold ${className}`}>
      {getAbbreviatedPosition(position)}
    </span>
  );
};

export default PlayerPosition;
