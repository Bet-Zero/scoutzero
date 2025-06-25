// src/components/roster/RosterPreviewModal.jsx
import React from 'react';
import { getTeamColors } from '@/utils/formatting/teamColors';
import RosterSection from './RosterSection';

const RosterPreviewModal = ({ open, onClose, roster, team }) => {
  if (!open || !roster) return null;

  const { primary, secondary } = getTeamColors(team);
  const scale = 0.6; // Zoomed out a bit more from 0.7

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-auto">
      {/* Backdrop click to close */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Scaled container */}
      <div
        className="relative mx-auto"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          width: '1300px',
          maxWidth: '90vw',
          maxHeight: '90vh',
        }}
      >
        {/* Preview content */}
        <div className="rounded-2xl border border-white/20 shadow-2xl bg-[#111] relative overflow-hidden">
          {/* Background Logo */}
          {team && (
            <img
              src={`/assets/logos/${team.toLowerCase()}.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-10 blur-sm mt-4 pointer-events-none select-none"
            />
          )}

          {/* Content */}
          <div className="relative text-white px-8 py-6 mt-3 flex flex-col items-center">
            <h2
              className="text-6xl font-black tracking-wide uppercase mb-1"
              style={{
                color: '#1e1e1e',
                textShadow: `0 0 8px ${primary}, 0 0 16px ${secondary}`,
              }}
            >
              {team}
            </h2>
            <h3 className="text-base text-neutral-400 font-medium mb-5 tracking-wide">
              Team Roster
            </h3>

            {/* Roster Sections */}
            <div className="w-full space-y-6 mb-11">
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
      </div>
    </div>
  );
};

export default RosterPreviewModal;
