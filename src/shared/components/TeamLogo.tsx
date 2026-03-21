/**
 * Purpose: Render a team logo by computed filename.
 * Inputs: teamAbbr/teamId (key), size/className.
 * Outputs: <img> with team logo and fallback.
 * Risks: Hardcoded default path; weak alt; missing lazy/decoding; falsy key handling.
 * Next TODO: Add alt fallback & guards; loading="lazy"; validate asset existence.
 */
import React from 'react';
import { getTeamLogoFilename } from '@/shared/utils/formatting/teamLogos';

type TeamLogoProps = {
  teamAbbr?: any;
  teamId?: any;
  className?: string;
};

const TeamLogo = ({ teamAbbr, teamId, className = '' }: TeamLogoProps) => {
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
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/assets/logos/default.png';
        }}
      />
    </div>
  );
};

export default TeamLogo;
