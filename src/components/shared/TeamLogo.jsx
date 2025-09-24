/**
 * Purpose: Render a team logo by computed filename.
 * Inputs: teamAbbr/teamId (key), size/className.
 * Outputs: <img> with team logo and fallback.
 * Risks: Hardcoded default path.
 * Next TODO: Validate asset existence upstream or provide manifest check.
 */
import React from 'react';
import { getTeamLogoFilename } from '@/utils/formatting';

const DEFAULT_LOGO = 'default';
const LOGO_BASE_PATH = '/assets/logos';

const TeamLogo = ({ teamAbbr, teamId, className = '' }) => {
  const rawKey = teamId || teamAbbr;
  const key = typeof rawKey === 'string' ? rawKey.trim() : rawKey;
  const hasKey = Boolean(key);
  const fileName = hasKey ? getTeamLogoFilename(key) : DEFAULT_LOGO;
  const resolvedFileName = fileName || DEFAULT_LOGO;
  const logoPath = `${LOGO_BASE_PATH}/${resolvedFileName}.png`;
  const sizeClasses = className || 'w-[3.5rem] h-[3.5rem]';
  const altText = hasKey ? `${key} logo` : 'Team logo';

  const handleImageError = (event) => {
    const target = event?.currentTarget;
    if (!target || target.dataset.fallbackApplied) return;
    target.dataset.fallbackApplied = 'true';
    target.src = `${LOGO_BASE_PATH}/${DEFAULT_LOGO}.png`;
    target.alt = 'Team logo';
  };

  return (
    <div className={`relative ${sizeClasses}`}>
      <img
        src={logoPath}
        alt={altText}
        className="w-full h-full object-contain"
        loading="lazy"
        decoding="async"
        onError={handleImageError}
      />
    </div>
  );
};

export default TeamLogo;
