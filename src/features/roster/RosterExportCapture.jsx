// src/components/roster/RosterExportCapture.jsx
import React from 'react';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/utils/formatting/teamLogos';
import RosterSection from './RosterSection';
import '@/styles/antonFont.css';

const RosterExportCapture = React.forwardRef(({ roster, team }, ref) => {
  const { primary, secondary } = getTeamColors(team);

  return (
    <div
      ref={ref}
      className="w-[1200px] h-[975px] bg-neutral-900 text-white relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
      style={{ fontFamily: 'AntonLocal, sans-serif' }}
    >
      {team && (
        <img
          src={`/assets/logos/${getTeamLogoFilename(team)}.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-6 pointer-events-none select-none"
        />
      )}

      <div className="relative w-full h-full px-4 pt-8 pb-2 flex flex-col items-center">
        <div style={{ opacity: 0, position: 'absolute' }}>preload</div>

        <div className="w-full flex justify-center items-center h-[70px] mb-1 mt-12 relative z-10">
          <h2
            className="w-full text-center text-7xl font-black uppercase leading-none"
            style={{
              fontFamily: 'AntonLocal, sans-serif',
              color: '#1e1e1e',
              textShadow: `0 0 8px ${primary}, 0 0 16px ${secondary}`,
            }}
          >
            {team}
          </h2>
        </div>

        <h3 className="w-full text-center whitespace-nowrap text-base text-neutral-400 font-medium mb-6 tracking-wide">
          Team Roster
        </h3>

        <div className="w-full space-y-8 pb-8">
          <RosterSection
            players={roster.starters}
            section="starters"
            isExport
            previewSpacing
          />
          <RosterSection
            players={roster.rotation}
            section="rotation"
            isExport
            previewSpacing
          />
          <RosterSection
            players={roster.bench}
            section="bench"
            isExport
            previewSpacing
          />
        </div>
      </div>
    </div>
  );
});

export default RosterExportCapture;
