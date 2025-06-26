// src/components/roster/RosterPreviewModal.jsx
import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/utils/formatting/teamLogos';
import RosterSection from './RosterSection';
import '@/styles/antonFont.css';

const RosterPreviewModal = ({ open, onClose, roster, team }) => {
  if (!open || !roster) return null;

  const { primary, secondary } = getTeamColors(team);
  const previewRef = useRef(null);

  const handleDownload = async () => {
    if (!previewRef.current) return;
    try {
      const font = new FontFace(
        'AntonLocal',
        "url('/fonts/Anton.woff2') format('woff2')",
        { display: 'swap' }
      );

      await font.load();
      document.fonts.add(font);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        skipFonts: true,
        backgroundColor: '#111',
        pixelRatio: 2,
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

      {/* Scaled container - much smaller appearance */}
      <div
        className="relative mx-auto transform"
        style={{
          transform: 'scale(0.6)', // Scale down to 50% size
          transformOrigin: 'center',
          width: '1200px',
          height: '1000px',
        }}
      >
        <div
          ref={previewRef}
          className="rounded-2xl h-[1000px] border border-white/20 shadow-2xl bg-[#111] relative overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2.5 left-2.5 text-white/60 hover:text-white z-20"
            title="Close"
          >
            <X size={36} />
          </button>
          {/* Logo */}
          {team && (
            <img
              src={`/assets/logos/${getTeamLogoFilename(team)}.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
            />
          )}

          {/* Content */}
          <div className="relative text-white px-8 py-12 mt-7 pb-4 flex flex-col items-center">
            <div
              style={{
                fontFamily: 'AntonLocal',
                opacity: 0,
                position: 'absolute',
              }}
            >
              preload
            </div>
            <div className="w-full flex justify-center items-center h-[70px] mb-1 relative z-10">
              <h2
                className="text-7xl font-black uppercase leading-none"
                style={{
                  fontFamily: 'AntonLocal, sans-serif',
                  color: '#1e1e1e',
                  textShadow: `0 0 8px ${primary}, 0 0 16px ${secondary}`,
                  textAlign: 'center',
                  width: '100%',
                  margin: 0,
                  padding: 0,
                }}
              >
                {team}
              </h2>
            </div>

            <h3 className="text-base text-neutral-400 font-medium mb-6 tracking-wide">
              Team Roster
            </h3>

            {/* Roster Sections */}
            <div className="w-full space-y-8 pb-16">
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

      {/* Download Button positioned outside the scaled container */}
      <div className="absolute bottom-7 left-1/2 transform -translate-x-1/2 z-30">
        <button
          onClick={handleDownload}
          className="bg-neutral-200 text-black text-[10px] px-[8px] py-[4px] rounded shadow-md hover:bg-neutral-400 transition"
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default RosterPreviewModal;
