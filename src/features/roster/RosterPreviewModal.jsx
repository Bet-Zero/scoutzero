// src/components/roster/RosterPreviewModal.jsx
import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { getTeamColors } from '@/utils/formatting/teamColors';
import RosterSection from './RosterSection';
import '@/styles/antonFont.css';

const RosterPreviewModal = ({ open, onClose, roster, team }) => {
  if (!open || !roster) return null;

  const { primary, secondary } = getTeamColors(team);
  const previewRef = useRef(null);
  const scale = 0.6; // Zoomed out a bit more from 0.7

  const handleDownload = async () => {
    if (!previewRef.current) return;
    try {
      // Explicitly load the font
      const font = new FontFace(
        'AntonLocal',
        "url('/fonts/Anton.woff2') format('woff2')",
        { display: 'swap' }
      );

      // Wait for font to load
      await font.load();
      document.fonts.add(font);
      await document.fonts.ready;

      // Additional small delay to ensure rendering
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        skipFonts: true,
        backgroundColor: '#111',
        pixelRatio: 2, // ⬅️ Doubles resolution (can increase to 3 or 4 if needed)
      });

      const link = document.createElement('a');
      link.download = `${team || 'roster'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download roster', err);
    }
  };

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
        <button
          onClick={handleDownload}
          className="fixed top-6 right-6 z-[1000] bg-white text-black px-4 py-2 rounded shadow-lg"
        >
          Download PNG
        </button>

        {/* Preview content */}
        <div
          ref={previewRef}
          className="rounded-2xl border border-white/20 shadow-2xl bg-[#111] relative overflow-hidden"
        >
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
            <div
              style={{
                fontFamily: 'AntonLocal',
                opacity: 0,
                position: 'absolute',
              }}
            >
              preload
            </div>
            <div className="relative w-full h-[70px] mb-1">
              <h2
                className="absolute inset-0 flex items-center justify-center text-6xl font-black uppercase text-center leading-none"
                style={{
                  fontFamily: 'AntonLocal, sans-serif',
                  color: '#1e1e1e',
                  textShadow: `0 0 8px ${primary}, 0 0 16px ${secondary}`,
                  paddingLeft: '8px',
                  paddingRight: '8px',
                }}
              >
                {team}
              </h2>
            </div>

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
