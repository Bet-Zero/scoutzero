import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { toPng } from 'html-to-image';
import RosterExportCapture from './RosterExportCapture';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/utils/formatting/teamLogos';
import RosterSection from './RosterSection';
import '@/styles/antonFont.css';

const RosterPreviewModal = ({ open, onClose, roster, team }) => {
  if (!open || !roster) return null;

  const exportRef = useRef(null); // ✅ used for PNG export
  const { primary, secondary } = getTeamColors(team);

  const handleDownload = async () => {
    if (!exportRef.current) return;

    try {
      const font = new FontFace(
        'AntonLocal',
        "url('/fonts/Anton.woff2') format('woff2')",
        { display: 'swap' }
      );
      await font.load();
      document.fonts.add(font);
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        skipFonts: true,
        pixelRatio: 3,
      });

      const link = document.createElement('a');
      link.download = `${team || 'roster'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <>
      {/* 🔒 Hidden Export DOM */}
      <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <RosterExportCapture ref={exportRef} roster={roster} team={team} />
      </div>

      {/* 🟣 Visible Modal Preview */}
      <div className="fixed inset-0 z-50 bg-black/80">
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) scale(0.6)',
            transformOrigin: 'center',
            width: '1200px',
            height: '975px',
          }}
        >
          <div
            className="rounded-2xl w-full h-full border border-white/20 shadow-2xl bg-neutral-900 relative overflow-hidden"
            style={{ fontFamily: 'AntonLocal, sans-serif' }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-2.5 left-2.5 text-white/60 hover:text-white z-20"
              title="Close"
            >
              <X size={36} />
            </button>

            {/* Background logo */}
            {team && (
              <img
                src={`/assets/logos/${getTeamLogoFilename(team)}.png`}
                alt=""
                className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-6 pointer-events-none select-none"
              />
            )}

            {/* Font Preload */}
            <div
              style={{
                opacity: 0,
                position: 'absolute',
                fontFamily: 'AntonLocal, sans-serif',
              }}
            >
              preload
            </div>

            {/* Team name */}
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

            <div className="w-full space-y-8 pb-8 px-4 text-white">
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

            {/* Download Button */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
              <button
                onClick={handleDownload}
                className="bg-neutral-200 text-black text-lg font-semibold px-4 py-1.5 rounded shadow-lg hover:bg-neutral-300 transition"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RosterPreviewModal;
