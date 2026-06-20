// PlayerPosition.tsx
import React from 'react';
import { POSITION_MAP } from '@/shared/utils/roles';

const getAbbreviatedPosition = (position: string) => {
  if (!position) return 'N/A';
  return POSITION_MAP[position] || position;
};

export const PlayerPosition = ({
  position = 'N/A',
  className = '',
}: {
  position?: string | null;
  className?: string;
}) => {
  return (
    <span className={`text-white font-semibold ${className}`}>
      {getAbbreviatedPosition(position || 'N/A')}
    </span>
  );
};
