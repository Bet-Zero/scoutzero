import React from 'react';
import { getTeamLogoFilename } from '@/utils/formatting';

const TeamLogo = ({ teamAbbr, teamId, className = '' }) => {
  const key = teamId || teamAbbr;
  const fileName = getTeamLogoFilename(key);
  const logoPath = `/assets/logos/${fileName}.png`;
  const sizeClasses = className || 'w-[3.5rem] h-[3.5rem]';

  return (
    <div className={`relative ${sizeClasses}`}>
      <img
        src={logoPath}
        alt={`${key} logo`}
        className="w-full h-full object-contain"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/assets/logos/default.png';
        }}
      />
    </div>
  );
};

export default TeamLogo;
